#!/usr/bin/env node
/**
 * unit-tests.mjs — Tests unitarios de las utilidades puras de color.
 * ==================================================================
 * Cubre las utilidades de lógica pura (sin DOM ni server) del proyecto:
 *   - conversor canónico de color (layers/common/utils/color-converter.util.ts)
 *   - contraste WCAG (layers/contrast-checker/utils/color-contrast.util.ts)
 *   - mezcla RYB (layers/color-mixer/utils/color-mixer.util.ts)
 *   - gradient builder (layers/gradient-generator/utils/gradient-generator.util.ts)
 *   - formatos de all-colors (layers/all-colors/utils/color-formats.util.ts)
 *   - matcher Pantone (layers/all-colors/utils/pantone-dataset.ts)
 *
 * Los archivos con imports por alias `~/layers/...` se copian a un directorio
 * temporal parcheando el alias a imports relativos (mismo patrón que el
 * harness de paridad OKLCH), porque Node plano no resuelve los alias de Nuxt.
 *
 * Uso:
 *   node --experimental-strip-types scripts/unit-tests.mjs
 *
 * Exit code: 0 = todo pasa, 1 = hay fallos, 2 = error de harness.
 */
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const TMP = join(HERE, '.tmp-unit');

// ---------------------------------------------------------------------------
// Preparación: copias con imports parcheados
// ---------------------------------------------------------------------------
const SOURCES = {
  'color-converter.util.ts': join(ROOT, 'layers/common/utils/color-converter.util.ts'),
  'color-contrast.util.ts': join(ROOT, 'layers/contrast-checker/utils/color-contrast.util.ts'),
  'gradient-generator.util.ts': join(ROOT, 'layers/gradient-generator/utils/gradient-generator.util.ts'),
  'color-mixer.util.ts': join(ROOT, 'layers/color-mixer/utils/color-mixer.util.ts'),
  'color-formats.util.ts': join(ROOT, 'layers/all-colors/utils/color-formats.util.ts'),
  'pantone-data.json': join(ROOT, 'layers/all-colors/utils/pantone-data.json'),
  'pantone-dataset.ts': join(ROOT, 'layers/all-colors/utils/pantone-dataset.ts')
};

const PATCHES = {
  // color-mixer importa desde el shim de palette; redirigimos a la copia canónica
  'color-mixer.util.ts': [
    ["from '~/layers/palette/utils/color-converter.util'", "from './color-converter.util.ts'"]
  ],
  'color-formats.util.ts': [
    ["from '~/layers/common/utils/color-converter.util'", "from './color-converter.util.ts'"]
  ],
  'pantone-dataset.ts': [
    ["from './color-formats.util'", "from './color-formats.util.ts'"],
    ["from './pantone-data.json'", "from './pantone-data.json' with { type: 'json' }"]
  ]
};

function prepare() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  for (const [name, src] of Object.entries(SOURCES)) {
    let content = readFileSync(src, 'utf8');
    for (const [from, to] of PATCHES[name] ?? []) {
      if (!content.includes(from)) {
        throw new Error(`patch no aplicado en ${name}: no se encontró ${from}`);
      }
      content = content.replaceAll(from, to);
    }
    writeFileSync(join(TMP, name), content);
  }
}

// ---------------------------------------------------------------------------
// Mini runner (sin framework, mismo espíritu que el harness de paridad)
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    failures.push({ name, err });
  }
}

const near = (actual, expected, tol) => Math.abs(actual - expected) <= tol;

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------
async function main() {
  prepare();

  const converter = await import(pathToFileURL(join(TMP, 'color-converter.util.ts')).href);
  const contrast = await import(pathToFileURL(join(TMP, 'color-contrast.util.ts')).href);
  const mixer = await import(pathToFileURL(join(TMP, 'color-mixer.util.ts')).href);
  const gradient = await import(pathToFileURL(join(TMP, 'gradient-generator.util.ts')).href);
  const formats = await import(pathToFileURL(join(TMP, 'color-formats.util.ts')).href);
  const pantone = await import(pathToFileURL(join(TMP, 'pantone-dataset.ts')).href);

  // ---------------- color-converter (canónica común) ----------------
  test('hexToRgb #ff0000', () => assert.deepEqual(converter.hexToRgb('#ff0000'), { r: 255, g: 0, b: 0 }));
  test('hexToRgb sin # y mayúsculas', () => assert.deepEqual(converter.hexToRgb('00FF00'), { r: 0, g: 255, b: 0 }));
  test('hexToRgb inválido → negro', () => assert.deepEqual(converter.hexToRgb('zzz'), { r: 0, g: 0, b: 0 }));
  test('rgbToHex', () => assert.equal(converter.rgbToHex({ r: 0, g: 0, b: 255 }), '#0000ff'));
  test('rgbToHex completa con ceros', () => assert.equal(converter.rgbToHex({ r: 1, g: 2, b: 3 }), '#010203'));
  test('round-trip hex→rgb→hex', () => {
    for (const hex of ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#123456', '#abcdef', '#ff8800']) {
      assert.equal(converter.rgbToHex(converter.hexToRgb(hex)), hex, hex);
    }
  });
  test('rgbToHsl rojo', () => assert.deepEqual(converter.rgbToHsl(converter.hexToRgb('#ff0000')), { h: 0, s: 100, l: 50 }));
  test('rgbToHsl cian', () => assert.deepEqual(converter.rgbToHsl(converter.hexToRgb('#00ffff')), { h: 180, s: 100, l: 50 }));
  test('rgbToHsl blanco', () => assert.deepEqual(converter.rgbToHsl(converter.hexToRgb('#ffffff')), { h: 0, s: 0, l: 100 }));
  test('rgbToHsl negro', () => assert.deepEqual(converter.rgbToHsl(converter.hexToRgb('#000000')), { h: 0, s: 0, l: 0 }));
  test('hslToRgb rojo', () => assert.deepEqual(converter.hslToRgb({ h: 0, s: 100, l: 50 }), { r: 255, g: 0, b: 0 }));
  test('round-trip hsl→rgb→hsl', () => {
    // tolerancia s/l de 1pp: hslToRgb redondea a enteros (≤ 1/255 por canal),
    // ruido que se propaga a la saturación calculada de vuelta
    for (const hsl of [{ h: 0, s: 100, l: 50 }, { h: 210, s: 80, l: 40 }, { h: 45, s: 100, l: 50 }, { h: 350, s: 15, l: 90 }]) {
      const back = converter.rgbToHsl(converter.hslToRgb(hsl));
      // peor ruido de cuantización a baja saturación: h±3°, s±3pp, l±1.5pp
      assert.ok(near(back.h, hsl.h, 3) && near(back.s, hsl.s, 3) && near(back.l, hsl.l, 1.5), `${JSON.stringify(hsl)} → ${JSON.stringify(back)}`);
    }
  });
  test('normalizeHex 3 dígitos', () => assert.equal(converter.normalizeHex('#f00'), '#ff0000'));
  test('normalizeHex sin #', () => assert.equal(converter.normalizeHex('ABC'), '#aabbcc'));
  test('normalizeHex inválido → null', () => assert.equal(converter.normalizeHex('xyz'), null));
  test('normalizeHex longitud inválida → null', () => assert.equal(converter.normalizeHex('#12345'), null));
  test('getContrastTextColor negro → blanco', () => assert.equal(converter.getContrastTextColor('#000000'), '#ffffff'));
  test('getContrastTextColor blanco → negro', () => assert.equal(converter.getContrastTextColor('#ffffff'), '#000000'));
  test('getContrastTextColor rojo → blanco', () => assert.equal(converter.getContrastTextColor('#ff0000'), '#ffffff'));
  test('getContrastTextColor amarillo → negro', () => assert.equal(converter.getContrastTextColor('#ffff00'), '#000000'));

  // ---------------- contraste WCAG ----------------
  test('blanco vs negro = 21', () => assert.ok(near(contrast.calculateContrastRatio([255, 255, 255], [0, 0, 0]), 21, 0.01)));
  test('contraste es simétrico', () => {
    const a = contrast.calculateContrastRatio([255, 255, 255], [0, 0, 0]);
    const b = contrast.calculateContrastRatio([0, 0, 0], [255, 255, 255]);
    assert.equal(a, b);
  });
  test('rojo sobre blanco ≈ 4.0', () => {
    const ratio = contrast.calculateContrastRatio([255, 0, 0], [255, 255, 255]);
    assert.ok(near(ratio, 4.0, 0.05), `esperado ~4.0, obtenido ${ratio}`);
  });
  test('mismo color → ratio 1', () => assert.equal(contrast.calculateContrastRatio([10, 20, 30], [10, 20, 30]), 1));

  // ---------------- mezcla RYB ----------------
  test('rgbToRyb azul puro', () => {
    const ryb = mixer.rgbToRyb(converter.hexToRgb('#0000ff'));
    assert.ok(ryb.b > 0.99 && ryb.r < 0.01 && ryb.y < 0.01, JSON.stringify(ryb));
  });
  test('round-trip ryb amarillo', () => {
    const rgb = mixer.rybToRgb(mixer.rgbToRyb(converter.hexToRgb('#fefe33')));
    assert.ok(rgb.r > 240 && rgb.g > 240 && rgb.b < 80, JSON.stringify(rgb));
  });
  test('azul + amarillo → verde (no gris)', () => {
    // el modelo RYB existe justamente para esto: mezclar azul y amarillo
    // debe dar un verde saturado, NO un gris sucio
    const mix = mixer.mixColorsRyb('#0000ff', '#fefe33', 0.5);
    const { r, g, b } = mix.rgb;
    assert.ok(g > r && g > b, `${mix.hex} no es verde (${JSON.stringify(mix.rgb)})`);
    assert.ok(g - Math.min(r, b) > 50, `${mix.hex} quedó apagado/gris (${JSON.stringify(mix.rgb)})`);
  });
  test('mezclar un color consigo mismo lo devuelve', () => {
    const mix = mixer.mixColorsRyb('#ff8800', '#ff8800', 0.5);
    assert.equal(mix.hex, '#ff8800');
  });
  test('ratioA=0 → color B puro', () => assert.equal(mixer.mixColorsRyb('#ff0000', '#00ff00', 0).hex, '#00ff00'));
  test('ratioA=1 → color A puro', () => assert.equal(mixer.mixColorsRyb('#ff0000', '#00ff00', 1).hex, '#ff0000'));
  test('ratio fuera de rango se clamp', () => {
    assert.equal(mixer.mixColorsRyb('#ff0000', '#00ff00', -0.5).hex, '#00ff00');
    assert.equal(mixer.mixColorsRyb('#ff0000', '#00ff00', 1.7).hex, '#ff0000');
  });

  // ---------------- gradient builder ----------------
  const gradCfg = {
    type: 'linear', angle: 90,
    stops: [
      { id: 'a', color: '#ff0000', position: 0 },
      { id: 'b', color: '#0000ff', position: 100 }
    ]
  };
  test('buildGradientValue linear', () => assert.equal(
    gradient.buildGradientValue(gradCfg),
    'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)'
  ));
  test('buildGradientValue radial', () => assert.equal(
    gradient.buildGradientValue({ ...gradCfg, type: 'radial' }),
    'radial-gradient(circle, #ff0000 0%, #0000ff 100%)'
  ));
  test('buildGradientValue conic', () => assert.equal(
    gradient.buildGradientValue({ ...gradCfg, type: 'conic' }),
    'conic-gradient(from 90deg, #ff0000 0%, #0000ff 100%)'
  ));
  test('buildCssDeclaration', () => assert.equal(
    gradient.buildCssDeclaration(gradCfg),
    'background-image: linear-gradient(90deg, #ff0000 0%, #0000ff 100%);'
  ));
  test('buildCssFile incluye clase y declaración', () => {
    const css = gradient.buildCssFile(gradCfg);
    assert.ok(css.includes('.gradient'));
    assert.ok(css.includes('background-image: linear-gradient(90deg, #ff0000 0%, #0000ff 100%);'));
  });
  test('buildTailwindConfig incluye colores y custom-gradient', () => {
    const tw = gradient.buildTailwindConfig(gradCfg);
    assert.ok(tw.includes("'gradient-1': '#ff0000'"), tw);
    assert.ok(tw.includes("'custom-gradient'"));
  });
  test('buildGradientJson ordena stops y agrega css', () => {
    const json = gradient.buildGradientJson({ ...gradCfg, stops: [...gradCfg.stops].reverse() });
    assert.equal(json.stops[0].position, 0);
    assert.equal(json.stops[1].position, 100);
    assert.ok(json.css.startsWith('linear-gradient'));
  });
  test('sortStops ordena por posición', () => {
    const sorted = gradient.sortStops([
      { id: 'x', color: '#000000', position: 100 },
      { id: 'y', color: '#000000', position: 0 }
    ]);
    assert.equal(sorted[0].position, 0);
  });
  test('isValidHex', () => {
    assert.ok(gradient.isValidHex('#fff'));
    assert.ok(gradient.isValidHex('123456'));
    assert.ok(!gradient.isValidHex('#12345'));
    assert.ok(!gradient.isValidHex('notacolor'));
  });
  test('stopsToString descarta colores inválidos', () => {
    const s = gradient.stopsToString([
      { id: 'a', color: '#ff0000', position: 0 },
      { id: 'b', color: 'zzz', position: 50 }
    ]);
    assert.equal(s, '#ff0000 0%');
  });
  test('buildGradientValue sin stops válidos → fallback blanco', () => {
    const v = gradient.buildGradientValue({ type: 'linear', angle: 45, stops: [{ id: 'x', color: 'nope', position: 0 }] });
    assert.equal(v, 'linear-gradient(45deg, #ffffff 0%, #ffffff 100%)');
  });

  // ---------------- formatos all-colors ----------------
  test('rgbToHsv rojo', () => assert.deepEqual(formats.rgbToHsv(converter.hexToRgb('#ff0000')), { h: 0, s: 100, v: 100 }));
  test('rgbToLab blanco ≈ L100 a0 b0', () => {
    const lab = formats.rgbToLab({ r: 255, g: 255, b: 255 });
    assert.ok(near(lab.l, 100, 0.5) && near(lab.a, 0, 0.5) && near(lab.b, 0, 0.5), JSON.stringify(lab));
  });
  test('deltaE2000 idénticos = 0', () => assert.equal(formats.deltaE2000({ l: 50, a: 10, b: 20 }, { l: 50, a: 10, b: 20 }), 0));
  test('deltaE2000 rojo vs azul > 50', () => {
    const d = formats.deltaE2000({ l: 53, a: 80, b: 67 }, { l: 32, a: 79, b: -107 });
    assert.ok(d > 50, `deltaE=${d}`);
  });
  test('generateTints: 4 tintes, el primero más claro', () => {
    const tints = formats.generateTints('#ff0000', 4);
    assert.equal(tints.length, 4);
    const r0 = converter.hexToRgb(tints[0]).r;
    const r3 = converter.hexToRgb(tints[3]).r;
    assert.ok(r0 >= r3, `tints[0].r=${r0} < tints[3].r=${r3}`);
  });
  test('generateShadeVariants: 2+1+2 estructura', () => {
    const v = formats.generateShadeVariants('#ff0000', 2);
    assert.equal(v.length, 5);
    assert.equal(v[0].kind, 'shade');
    assert.equal(v[2].kind, 'base');
    assert.equal(v[4].kind, 'tint');
    assert.equal(v[2].hex, '#ff0000');
  });
  test('mixHex 50% negro+blanco = gris medio', () => assert.equal(formats.mixHex('#000000', '#ffffff', 0.5), '#808080'));

  // ---------------- dataset Pantone ----------------
  test('dataset tiene más de 3000 muestras', () => {
    assert.ok(pantone.PANTONE_DATASET.length > 3000, `tiene ${pantone.PANTONE_DATASET.length}`);
  });
  test('muestras tienen shape válido', () => {
    for (const s of pantone.PANTONE_DATASET.slice(0, 200)) {
      assert.ok(typeof s.code === 'string' && s.code.length > 0, JSON.stringify(s));
      assert.ok(/^#[0-9a-f]{6}$/.test(s.hex), `hex inválido ${s.hex}`);
      assert.ok(typeof s.name === 'string' && s.name.length > 0);
      assert.ok(['Solid Coated', 'Pastels & Neons', 'Metallics'].includes(s.category), s.category);
    }
  });
  test('findNearestPantones ordena por ΔE ascendente', () => {
    const matches = pantone.findNearestPantones('#ff0000', 5);
    assert.equal(matches.length, 5);
    for (let i = 1; i < matches.length; i++) {
      assert.ok(matches[i].deltaE >= matches[i - 1].deltaE, `orden roto en ${i}`);
    }
    assert.ok(matches[0].deltaE < 50, `el más cercano está a ΔE ${matches[0].deltaE}`);
  });
  test('un swatch del dataset se encuentra a sí mismo (ΔE≈0)', () => {
    const probe = pantone.PANTONE_DATASET[1000];
    const nearest = pantone.findNearestPantones(probe.hex, 1)[0];
    assert.ok(nearest.deltaE < 5, `ΔE=${nearest.deltaE} para ${probe.code} ${probe.hex}`);
  });

  // -------------------------------------------------------------------------
  // Reporte
  // -------------------------------------------------------------------------
  rmSync(TMP, { recursive: true, force: true });

  console.log('==============================================================');
  console.log(`Tests: ${passed} pasaron | ${failed} fallaron`);
  console.log('==============================================================');

  if (failed > 0) {
    for (const { name, err } of failures) {
      console.log(`\n❌ ${name}`);
      console.log(`   ${err.message}`);
    }
    process.exit(1);
  }

  console.log('✅ TODOS LOS TESTS UNITARIOS PASAN');
  process.exit(0);
}

main().catch((err) => {
  console.error('ERROR en el harness:', err);
  rmSync(TMP, { recursive: true, force: true });
  process.exit(2);
});
