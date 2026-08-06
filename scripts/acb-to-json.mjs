#!/usr/bin/env node
/**
 * Decodificador de archivos Adobe Color Book (.acb) a JSON.
 *
 * Formato basado en la spec no oficial de Ateş Göral (2003):
 *   http://magnetiq.com/pages/acb-spec/  (redirige a https://ates.dev)
 * Referencia de la estructura binaria: https://github.com/jacobbubu/acb
 *
 * Uso (desde la raiz del repo):
 *   node scripts/acb-to-json.mjs <ruta.acb> [--out salida.json]
 *        [--category "Solid Uncoated"] [--array] [--raw] [--stdout]
 *
 * Opciones:
 *   --category "Nombre"  agrega category a cada muestra (formato pantone-data.json)
 *   --array              emite un array plano de {code, name, hex, ...} (sin metadatos)
 *   --raw                incluye los componentes originales del .acb (lab/cmyk/rgb)
 *   --stdout             vuelca el JSON a stdout en vez de escribir archivo
 *
 * Default: escribe <mismo-nombre>.json al lado del .acb (con metadatos del libro).
 *
 * Nota de color: los .acb guardan los colores en su color model nativo (LAB, CMYK
 * o RGB). Para LAB se aplica la misma cadena usada al generar el CSV Pantone:
 * Lab(D50) -> XYZ(D50) -> Bradford D65 -> sRGB. Para CMYK el hex es aproximado
 * (conversion naive de tinta a RGB). Para espacios exóticos (Pantone, Toyo, HKS,
 * etc.) no se convierte: hex queda null.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const COLOR_SPACES = {
  0: 'RGB',
  1: 'HSB',
  2: 'CMYK',
  3: 'Pantone',
  4: 'Focoltone',
  5: 'Trumatch',
  6: 'Toyo',
  7: 'LAB',
  8: 'Grayscale',
  10: 'HKS'
};

// ---------------------------------------------------------------------------
// Conversion Lab (D50) -> sRGB hex
// Misma cadena usada al generar colors_pantone.csv -> pantone-data.json:
//   Lab(D50) -> XYZ(D50) -> Bradford (D50->D65) -> sRGB
// Validado: Lab(92, -8, 65) -> #f6eb64 (PANTONE 100 C del dataset actual).
// ---------------------------------------------------------------------------

const D50 = { x: 96.422, y: 100, z: 82.521 };
const EPSILON = 0.008856;
const KAPPA = 903.3;

// Matriz de adaptacion Bradford D50 -> D65 (Bruce Lindbloom, CIE)
const BRADFORD_D50_TO_D65 = [
  [0.9555766, -0.0230393, 0.0631636],
  [-0.0282895, 1.0099416, 0.0210077],
  [0.0122982, -0.0204830, 1.3299098]
];

function labToXyz({ l, a, b }) {
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inv = (t) => {
    const t3 = t * t * t;
    return t3 > EPSILON ? t3 : (116 * t - 16) / KAPPA;
  };
  return {
    x: D50.x * inv(fx),
    y: D50.y * inv(fy),
    z: D50.z * inv(fz)
  };
}

function xyzD50ToD65({ x, y, z }) {
  const [r, g, b] = BRADFORD_D50_TO_D65;
  return {
    x: r[0] * x + r[1] * y + r[2] * z,
    y: g[0] * x + g[1] * y + g[2] * z,
    z: b[0] * x + b[1] * y + b[2] * z
  };
}

function xyzToSrgbLinear({ x, y, z }) {
  // XYZ en 0..100 -> RGB lineal 0..1
  return {
    r: (3.2404542 * x - 1.5371385 * y - 0.4985314 * z) / 100,
    g: (-0.9692660 * x + 1.8760108 * y + 0.0415560 * z) / 100,
    b: (0.0556434 * x - 0.2040259 * y + 1.0572252 * z) / 100
  };
}

const srgbGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function labToHex(lab) {
  const xyz65 = xyzD50ToD65(labToXyz(lab));
  const lin = xyzToSrgbLinear(xyz65);
  const ch = [lin.r, lin.g, lin.b].map((c) => Math.round(clamp01(srgbGamma(c)) * 255));
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

// CMYK -> RGB aproximado (tinta -> pantalla, sin perfil de impresion)
function cmykToRgb(c, m, y, k) {
  const f = (v) => Math.round(255 * (1 - v / 100) * (1 - k / 100));
  return [f(c), f(m), f(y)];
}

function rgbToHex([r, g, b]) {
  const ch = [r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))));
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

// ---------------------------------------------------------------------------
// Decoder .acb
// ---------------------------------------------------------------------------

export function decodeAcb(buf) {
  let offset = 0;
  const readBytes = (count) => {
    const v = buf.subarray(offset, offset + count);
    offset += count;
    return v;
  };
  const readChars = (count = 1) => readBytes(count).toString('ascii');
  const readUInt16 = () => {
    const v = buf.readUInt16BE(offset);
    offset += 2;
    return v;
  };
  const readUInt32 = () => {
    const v = buf.readUInt32BE(offset);
    offset += 4;
    return v;
  };
  // String: uint32 length + length x uint16 chars (2 bytes por char)
  const readString = () => {
    const length = readUInt32();
    let v = '';
    for (let i = 0; i < length; i++) v += String.fromCharCode(readUInt16());
    return v;
  };
  const extractValue = (str) => {
    let value = str.replace(/^"(.*)"$/, '$1');
    // Localized keys tipo "$$$/acb/Pantone/...=Process Yellow CP"
    if (value.startsWith('$$$')) value = value.split('=')[1] ?? value;
    return value.replace(/\^R/g, '®').replace(/\^C/g, '©');
  };

  const magic = readChars(4);
  if (magic !== '8BCB') throw new Error(`Archivo .acb invalido: magic "${magic}" != "8BCB"`);

  const version = readUInt16();
  const identifier = readUInt16();
  const title = extractValue(readString());
  const prefix = extractValue(readString());
  const suffix = extractValue(readString());
  const description = extractValue(readString());
  const colorCount = readUInt16();
  const pageSize = readUInt16();
  const pageSelectorOffset = readUInt16();
  const colorSpaceId = readUInt16();

  const colorSpace = COLOR_SPACES[colorSpaceId];
  if (!colorSpace) throw new Error(`Color space desconocido en .acb: ${colorSpaceId}`);

  const channels = colorSpace === 'CMYK' ? 4 : colorSpace === 'Grayscale' ? 1 : 3;

  const colors = [];
  for (let i = 0; i < colorCount; i++) {
    let colorName = extractValue(readString());
    let colorCode = readChars(6).trim();
    colorCode = colorCode.replace(/^0*(\d+)$/, '$1'); // quita ceros a la izquierda
    colorCode = colorCode.replace('X', '-');
    const raw = [...readBytes(channels)];

    // Record dummy (sin nombre ni codigo) -> se saltea
    if (!colorName && !colorCode) continue;

    // Sin nombre: se deriva del codigo quitando el suffix del libro
    if (!colorName) {
      const tail = suffix.trim();
      const pos = colorCode.lastIndexOf(tail);
      colorName = pos >= 0 ? colorCode.slice(0, pos) : colorCode;
    }

    let components;
    switch (colorSpace) {
      case 'LAB':
        components = { l: raw[0] / 2.55, a: raw[1] - 128, b: raw[2] - 128 };
        break;
      case 'CMYK':
        components = { c: (255 - raw[0]) / 2.55, m: (255 - raw[1]) / 2.55, y: (255 - raw[2]) / 2.55, k: (255 - raw[3]) / 2.55 };
        break;
      case 'RGB':
        components = { r: raw[0], g: raw[1], b: raw[2] };
        break;
      default:
        components = { raw };
        break;
    }

    let hex = null;
    if (colorSpace === 'LAB') hex = labToHex(components);
    else if (colorSpace === 'RGB') hex = rgbToHex([components.r, components.g, components.b]);
    else if (colorSpace === 'CMYK') hex = rgbToHex(cmykToRgb(components.c, components.m, components.y, components.k));

    colors.push({ code: colorCode, name: prefix + colorName + suffix, hex, ...components });
  }

  // Identificador Spot/Process (8 chars al final del archivo)
  let isSpot = null;
  if (offset + 8 <= buf.length) {
    const spot = readChars(8);
    if (spot === 'spflspot') isSpot = true;
    else if (spot === 'spflproc') isSpot = false;
  }

  return { version, identifier, title, description, prefix, suffix, colorCount: colors.length, pageSize, pageSelectorOffset, colorSpace, isSpot, colors };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function die(msg) {
  console.error('\n[ERROR] ' + msg);
  process.exit(1);
}

function printUsage() {
  console.log(`Uso: node scripts/acb-to-json.mjs <ruta.acb> [--out salida.json]
       [--category "Solid Uncoated"] [--array] [--raw] [--stdout]

  --category "Nombre"  agrega category a cada muestra (formato pantone-data.json)
  --array              emite array plano {code, name, hex, ...} sin metadatos
  --raw                incluye componentes originales (lab/cmyk/rgb) en cada muestra
  --stdout             vuelca el JSON a stdout en vez de escribir archivo`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const positionals = args.filter((a) => !a.startsWith('--'));
  const src = positionals[0];
  if (!src) die('Falta la ruta del archivo .acb');

  const flagValue = (name) => {
    const idx = args.indexOf(name);
    if (idx < 0) return null;
    if (idx + 1 >= args.length || args[idx + 1].startsWith('--')) die(`El flag ${name} requiere un valor`);
    return args[idx + 1];
  };
  const out = flagValue('--out');
  const category = flagValue('--category');

  const toStdout = flags.has('--stdout');
  const asArray = flags.has('--array');
  const withRaw = flags.has('--raw');

  // Con --stdout el stdout queda reservado para el JSON puro (pipeable);
  // todo el resumen va a stderr.
  const log = toStdout ? (m) => console.error(m) : (m) => console.log(m);

  readFile(src)
    .then(async (buf) => {
      const book = decodeAcb(buf);
      log('--- Decodificador .acb Magicolor ---');
      log(`Archivo : ${src}`);
      log(`Titulo  : ${book.title}`);
      log(`Color   : ${book.colorSpace}${book.isSpot === null ? '' : book.isSpot ? ' (Spot)' : ' (Process)'}`);
      log(`Muestras: ${book.colors.length}`);

      let colors = book.colors;
      if (category) colors = colors.map((c) => ({ ...c, category }));
      if (!withRaw) {
        colors = colors.map((c) => {
          const clean = { code: c.code, name: c.name, hex: c.hex };
          if (c.category) clean.category = c.category;
          return clean;
        });
      }

      const payload = asArray
        ? colors
        : { title: book.title, version: book.version, identifier: book.identifier, colorSpace: book.colorSpace, pageSize: book.pageSize, isSpot: book.isSpot, count: colors.length, colors };

      const json = JSON.stringify(payload, null, 2);

      if (toStdout) {
        process.stdout.write(json + '\n');
      } else {
        const dest = out ?? join(dirname(src), basename(src, '.acb') + '.json');
        await writeFile(dest, json + '\n', 'utf8');
        log(`\nJSON   : ${dest}`);
      }

      // Sample de depuracion
      log('\nSample (3):');
      for (const c of colors.slice(0, 3)) {
        log(`  ${String(c.code).padEnd(12)} ${String(c.name).padEnd(28)} ${c.hex ?? '(sin hex)'}`);
      }
      if (colors.length > 3) log(`  ... ${colors.length - 3} mas`);
    })
    .catch((e) => die(e.message));
}

const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (IS_MAIN) main();
