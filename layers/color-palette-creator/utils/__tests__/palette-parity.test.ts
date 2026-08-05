/**
 * palette-parity.test.ts — Harness de paridad numérica
 * =====================================================
 * Compara componente a componente (l, c, h; tolerancia 0.0005) la salida de mi
 * implementación del generador de paletas (palette-generator.util.ts) contra
 * la librería original pro-color-harmonies v0.11.0 (meodai, MIT), cuya copia
 * literal vive en ./reference/pro-color-harmonies/ (verificada por md5 contra
 * el tag v0.11.0 del repo).
 *
 * Regla de oro: ninguna comparación visual ni transcripción de memoria. La
 * referencia se ejecuta tal cual; solo se parchean los especificadores de
 * import (extensiones .ts para Node) y se sustituye el import de 'culori' por
 * el shim local ./reference/pro-color-harmonies/culori-shim.ts.
 *
 * Batería: 10 colores base (cubren los umbrales 0.3/0.7, zonas de blend
 * 0.25-0.35 y 0.65-0.75, bandas de hue 345-30 y 150-210, condiciones
 * compuestas de diamond y el atajo acromático) x 6 tipos x 5 estilos
 * (default/square/triangle/circle/diamond) x interpolation on/off +
 * combinaciones de modificadores + expansión a N colores (1..30).
 *
 * Uso:
 *   node --experimental-strip-types layers/color-palette-creator/utils/__tests__/palette-parity.test.ts
 *   MINE_DIR=<dir> node --experimental-strip-types ...  (usar otra carpeta con la implementación)
 *
 * Exit code: 0 = paridad completa, 1 = hay diffs > tolerancia.
 */
import {
  readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, copyFileSync
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REF_DIR = join(HERE, 'reference', 'pro-color-harmonies');
const MINE_DIR = process.env.MINE_DIR ? join(process.cwd(), process.env.MINE_DIR) : join(HERE, '..');
const TMP_DIR = join(HERE, '.tmp-parity');
const TOLERANCE = 0.0005;

// ---------------------------------------------------------------------------
// Batería de colores base (cubre todos los umbrales y casos especiales)
// ---------------------------------------------------------------------------
const BASES = [
  { l: 0.15, c: 0.20, h: 20 },   // oscuro puro (bajo umbral 0.3)
  { l: 0.28, c: 0.20, h: 20 },   // borde oscuro (zona de blend 0.25-0.35)
  { l: 0.50, c: 0.18, h: 150 },  // medio
  { l: 0.72, c: 0.15, h: 150 },  // borde claro (zona de blend 0.65-0.75)
  { l: 0.85, c: 0.10, h: 280 },  // claro puro
  { l: 0.50, c: 0.20, h: 10 },   // hue banda roja (circle 345-30)
  { l: 0.50, c: 0.20, h: 180 },  // hue banda cian (circle 150-210)
  { l: 0.85, c: 0.10, h: 100 },  // claro+poco saturado (diamond)
  { l: 0.30, c: 0.30, h: 250 },  // saturado+oscuro (diamond)
  { l: 0.50, c: 0.001, h: 0 },   // acromático (debe activar el atajo neutro)
  // Extras para cubrir branches que la batería base no tocaba:
  { l: 0.40, c: 0.20, h: 60 },   // banda hue [30,90) + [45,90) + zona blend 0.35-0.45
  { l: 0.58, c: 0.20, h: 260 },  // zona blend 0.55-0.65
  { l: 0.45, c: 0.20, h: 200 },  // diamond: hue [180,240) && l < 0.5
  { l: 0.70, c: 0.20, h: 80 },   // diamond: hue [30,90) && l > 0.6
  { l: 0.50, c: 0.20, h: 30 },   // borde de banda (hue >= 30)
  { l: 0.50, c: 0.20, h: 90 }    // borde de banda (hue >= 90)
];
const TYPES = ['analogous', 'complementary', 'triadic', 'tetradic', 'splitComplementary', 'tintsShades'];
const STYLES = ['default', 'square', 'triangle', 'circle', 'diamond'];
const INTERPOLATIONS = [true, false];
const MODIFIER_COMBOS = [
  undefined,
  { sine: 0.5 },
  { wave: -0.3 },
  { zap: 0.7 },
  { block: -0.5 },
  { sine: 0.4, wave: -0.2, zap: 0.3, block: -0.1 },
];
const EXTEND_COUNTS = [1, 2, 3, 5, 8, 12, 30];

// ---------------------------------------------------------------------------
// Preparación: copias con imports parcheados
// ---------------------------------------------------------------------------
function patchImports(src: string): string {
  let out = src.replace(/from\s+'(\.[^']*?)'/g, (m: string, spec: string) =>
    /\.(ts|mts|cts|json)$/.test(spec) ? m : m.replace(spec, `${spec}.ts`)
  );
  out = out.replace(/from\s+'culori'/g, "from '../culori-shim.ts'");
  return out;
}

function collectTsFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectTsFiles(full, out);
    else if (entry.endsWith('.ts')) out.push(full);
  }
}

function prepareCopies(): void {
  rmSync(TMP_DIR, { recursive: true, force: true });

  const refFiles: string[] = [];
  collectTsFiles(REF_DIR, refFiles);
  for (const file of refFiles) {
    const rel = file.slice(REF_DIR.length + 1);
    const dest = join(TMP_DIR, 'reference', 'pro-color-harmonies', rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, patchImports(readFileSync(file, 'utf8')));
  }

  // shim de culori (sin parchear, ya es .ts)
  const shimDest = join(TMP_DIR, 'reference', 'pro-color-harmonies', 'culori-shim.ts');
  mkdirSync(dirname(shimDest), { recursive: true });
  copyFileSync(join(REF_DIR, 'culori-shim.ts'), shimDest);

  // mi implementación
  for (const file of ['palette-generator.util.ts', 'oklch.util.ts']) {
    const src = join(MINE_DIR, file);
    const dest = join(TMP_DIR, 'mine', file);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, patchImports(readFileSync(src, 'utf8')));
  }
}

// ---------------------------------------------------------------------------
// Comparación
// ---------------------------------------------------------------------------
interface Diff { type: string; style: string; base: string; index: number; channel: 'l' | 'c' | 'h'; expected: number; actual: number; delta: number; phase: string }

function hueDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

const fmt = (n: number): string => n.toFixed(6);
const baseLabel = (b: { l: number; c: number; h: number }): string =>
  `L${b.l.toFixed(2)}/C${b.c.toFixed(3)}/H${b.h}`;

function comparePalette(ref: Array<{ l: number; c: number; h: number }>, mine: Array<{ l: number; c: number; h: number }>, ctx: { type: string; style: string; base: string; phase: string }, diffs: Diff[]): number {
  let maxDelta = 0;
  for (let i = 0; i < Math.max(ref.length, mine.length); i++) {
    const r = ref[i];
    const m = mine[i];
    for (const ch of ['l', 'c', 'h'] as const) {
      const delta = ch === 'h' ? hueDiff(r.h, m.h) : Math.abs(r[ch] - m[ch]);
      maxDelta = Math.max(maxDelta, delta);
      if (delta > TOLERANCE) {
        diffs.push({ type: ctx.type, style: ctx.style, base: ctx.base, index: i, channel: ch, expected: r[ch], actual: m[ch], delta, phase: ctx.phase });
      }
    }
  }
  return maxDelta;
}

// ---------------------------------------------------------------------------
// Run principal
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  prepareCopies();

  const ref = await import(pathToFileURL(join(TMP_DIR, 'reference', 'pro-color-harmonies', 'index.ts')).href);
  const refDemo = await import(pathToFileURL(join(TMP_DIR, 'reference', 'pro-color-harmonies', 'utils', 'demo-palette.ts')).href);
  const mine = await import(pathToFileURL(join(TMP_DIR, 'mine', 'palette-generator.util.ts')).href);

  // generar desde OKLCH directo: en la implementación nueva existe
  // generateFromOklch; en la vieja (solo para diagnóstico pre-fix) se usa el
  // fallback con generatePalette parcheado para aceptar OKLCH.
  const gen = (mine.generateFromOklch as ((b: unknown, t: string, o: unknown) => Array<{ l: number; c: number; h: number }>) | undefined)
    ?? ((b: unknown, t: string, o: unknown) => (mine.generatePalette as (b: unknown, t: string, o: unknown) => Array<{ l: number; c: number; h: number }>)(b, t, o));

  const diffs: Diff[] = [];
  let comparisons = 0;
  let maxDeltaGlobal = 0;
  const summary: Record<string, number> = {};

  // --- invariantes (default === square) ---
  for (const type of TYPES) {
    for (const b of BASES) {
      const rDef = ref.ColorPaletteGenerator.generate(b, type, { style: 'default' });
      const rSq = ref.ColorPaletteGenerator.generate(b, type, { style: 'square' });
      const mDef = gen(b, type, { style: 'default' });
      const mSq = gen(b, type, { style: 'square' });
      for (let i = 0; i < 6; i++) {
        if (Math.abs(rDef[i].l - rSq[i].l) > 1e-12 || Math.abs(rDef[i].c - rSq[i].c) > 1e-12 || Math.abs(rDef[i].h - rSq[i].h) > 1e-12) {
          diffs.push({ type, style: 'default-vs-square', base: baseLabel(b), index: i, channel: 'l', expected: rSq[i].l, actual: rDef[i].l, delta: 999, phase: 'REF-default!=square' });
        }
        if (Math.abs(mDef[i].l - mSq[i].l) > 1e-12 || Math.abs(mDef[i].c - mSq[i].c) > 1e-12 || Math.abs(mDef[i].h - mSq[i].h) > 1e-12) {
          diffs.push({ type, style: 'default-vs-square', base: baseLabel(b), index: i, channel: 'l', expected: mSq[i].l, actual: mDef[i].l, delta: 999, phase: 'MINE-default!=square' });
        }
      }
    }
  }

  // --- grid principal: bases x tipos x estilos x interpolation ---
  for (const interp of INTERPOLATIONS) {
    for (const b of BASES) {
      for (const type of TYPES) {
        for (const style of STYLES) {
          const opts = { style, interpolation: interp };
          const refPal = ref.ColorPaletteGenerator.generate(b, type, opts);
          const minePal = gen(b, type, opts);
          comparisons++;
          const maxD = comparePalette(refPal, minePal, { type, style, base: baseLabel(b), phase: `interp=${interp}` }, diffs);
          maxDeltaGlobal = Math.max(maxDeltaGlobal, maxD);
          const key = `${type}|${style}|interp=${interp}`;
          summary[key] = Math.max(summary[key] ?? 0, maxD);
        }
      }
    }
  }

  // --- modificadores (interpolation default true) ---
  for (const mods of MODIFIER_COMBOS) {
    if (!mods) continue;
    for (const b of BASES) {
      for (const type of TYPES) {
        for (const style of ['square', 'circle'] as const) {
          const opts = { style, modifiers: mods };
          const refPal = ref.ColorPaletteGenerator.generate(b, type, opts);
          const minePal = gen(b, type, opts);
          comparisons++;
          const maxD = comparePalette(refPal, minePal, { type, style, base: baseLabel(b), phase: `mods=${JSON.stringify(mods)}` }, diffs);
          maxDeltaGlobal = Math.max(maxDeltaGlobal, maxD);
        }
      }
    }
  }

  // --- expansión a N colores (downsample y upsample) ---
  const expandBases = [BASES[0], BASES[2], BASES[5], BASES[10]];
  for (const b of expandBases) {
    for (const type of ['analogous', 'complementary', 'triadic', 'tetradic', 'splitComplementary', 'tintsShades'] as const) {
      for (const style of ['square', 'triangle', 'circle'] as const) {
        const opts = { style };
        const refPal = ref.ColorPaletteGenerator.generate(b, type, opts);
        const minePal = gen(b, type, opts);
        for (const n of EXTEND_COUNTS) {
          const refExt = refDemo.extendPalette(refPal, n);
          const mineExt = mine.expandPalette(minePal, n);
          comparisons++;
          const maxD = comparePalette(refExt, mineExt, { type, style, base: baseLabel(b), phase: `extend=${n}` }, diffs);
          maxDeltaGlobal = Math.max(maxDeltaGlobal, maxD);
        }
      }
    }
  }

  // --- reporte ---
  const diffByPhase: Record<string, number> = {};
  for (const d of diffs) diffByPhase[d.phase] = (diffByPhase[d.phase] ?? 0) + 1;

  console.log('==============================================================');
  console.log(`Comparaciones: ${comparisons} | Diffs > ${TOLERANCE}: ${diffs.length} | Delta máx: ${maxDeltaGlobal.toFixed(6)}`);
  console.log('==============================================================');

  const worst = Object.entries(summary).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log('\nPeores (tipo|estilo):');
  for (const [k, v] of worst) console.log(`  ${k.padEnd(38)} maxΔ=${v.toFixed(6)}`);

  if (diffs.length > 0) {
    console.log(`\nDiffs por fase:`);
    for (const [k, v] of Object.entries(diffByPhase)) console.log(`  ${k.padEnd(30)} ${v}`);

    console.log('\nPrimeros 120 diffs [tipo, estilo, base, índice] -> esperado vs obtenido -> delta:');
    for (const d of diffs.slice(0, 120)) {
      console.log(`  [${d.type}, ${d.style}, ${d.base}, idx ${d.index}] ${d.channel}: ${fmt(d.expected)} vs ${fmt(d.actual)} -> Δ${d.delta.toFixed(6)}  (${d.phase})`);
    }

    writeFileSync(join(HERE, 'parity-diffs.json'), JSON.stringify(diffs, null, 1));
    console.log('\nLista completa en __tests__/parity-diffs.json');
    process.exit(1);
  }

  console.log('✅ PARIDAD COMPLETA (0 diffs por encima de la tolerancia)');
  process.exit(0);
}

main().catch((err) => {
  console.error('ERROR en el harness:', err);
  process.exit(2);
});
