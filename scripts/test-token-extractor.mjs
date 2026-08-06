/**
 * Test del Color Token Extractor: parser CSS Color 4 + extractor de tokens.
 * Corre con: node --experimental-strip-types scripts/test-token-extractor.mjs
 */
import { parseCssColor, colorToHex, extractColorTokens, buildCssExport, buildTailwindExport } from '../layers/color-token-extractor/utils/token-extractor.util.ts';
import assert from 'node:assert';

// 1) parser de colores CSS Color 4
const cases = [
  ['#ff0000', '#ff0000'],
  ['#f00', '#ff0000'],
  ['rgb(255, 0, 0)', '#ff0000'],
  ['rgb(100% 0% 0%)', '#ff0000'],
  ['hsl(0, 100%, 50%)', '#ff0000'],
  ['hwb(0 0% 0%)', '#ff0000'],
  ['red', '#ff0000'],
  ['oklch(0.627 0.258 29.23)', '#ff0000'],
  ['color(display-p3 1 0 0)', '#ff0000'],
  ['rgba(255,0,0,0.5)', '#ff0000'],
  ['#00ff00', '#00ff00'],
  ['blue', '#0000ff'],
  // transparent = rgba(0,0,0,0): el parser lo resuelve, el extractor lo descarta por alpha.
  ['transparent', '#000000'],
  // Valores confirmados contra culori (referencia autoritativa, misma salida exacta).
  ['lab(53.23 80.11 67.22)', '#fa0007'],
  ['lch(53.23 104.55 40)', '#fa0007'],
];
for (const [input, expected] of cases) {
  const c = parseCssColor(input);
  const hex = c ? colorToHex(c) : null;
  if (expected === null) {
    assert.strictEqual(hex, null, `${input} deberia ser null`);
  } else {
    assert.strictEqual(hex, expected, `${input} -> ${hex}`);
  }
}
console.log('[1] parseCssColor: 15 casos OK');

// 2) extractor con CSS de ejemplo: ruido de frameworks, var() encadenadas, @property, keyframes
const css = `
:root {
  --color-primary: #1a2b3c;
  --color-brand: var(--color-primary);
  --tw-shadow: 0 1px 2px rgba(0,0,0,0.1);
  --colors-red-500: #ef4444;
  --chakra-colors-blue-500: #3182ce;
  --error-color: #dc2626;
  --spacing-md: 1rem;
  --bg-gradient-from: #0000;
}
@media (prefers-color-scheme: dark) { :root { --color-primary: #ffffff; } }
.card { --card-bg: oklch(0.5 0.1 250); }
@property --custom-prop { syntax: '<color>'; inherits: false; initial-value: #663399; }
@keyframes fade { from { --x: #000000; } }
`;
const { tokens } = extractColorTokens([{ text: css, source: 'test' }]);
const byName = (n) => tokens.find((t) => t.name === n);
const names = tokens.map((t) => t.name);

// Primera declaracion gana: el valor light/default (estandar). El override de
// dark-mode (via @media) se descarta — limitacion documentada de la extraccion
// estatica, igual que dembrandt exige su flag --dark-mode explicito.
assert.ok(names.includes('--color-primary'), 'primary presente');
assert.strictEqual(byName('--color-primary').hex, '#1a2b3c', 'primer valor (light) gana');
assert.ok(names.includes('--color-brand'), 'brand via var presente');
assert.strictEqual(byName('--color-brand').hex, '#1a2b3c', 'var() encadenada resuelve contra el valor ganador');
assert.ok(names.includes('--error-color'), 'semantic conservado');
assert.strictEqual(byName('--error-color').type, 'semantic', 'clasificacion semantic');
assert.ok(!names.includes('--tw-shadow'), 'ruido tailwind filtrado');
assert.ok(!names.includes('--colors-red-500'), 'paleta framework filtrada');
assert.ok(!names.includes('--chakra-colors-blue-500'), 'prefijo framework filtrado');
assert.ok(!names.includes('--spacing-md'), 'no-color descartado');
assert.ok(!names.includes('--bg-gradient-from'), 'utilidad tailwind filtrada');
assert.ok(names.includes('--card-bg'), 'scoped conservado');
assert.ok(!names.includes('--x'), 'keyframes descartado');
assert.ok(names.includes('--custom-prop'), '@property conservado');
assert.strictEqual(byName('--custom-prop').hex, '#663399', '@property initial-value');
console.log('[2] extractColorTokens: filtros + var() + @property + scoped + keyframes OK');
console.log(`    tokens: ${names.length}`);

// 3) exports
const cssOut = buildCssExport(tokens);
assert.ok(cssOut.includes('--color-primary: #1a2b3c;'), 'css export con hex resuelto');
const tw = buildTailwindExport(tokens);
assert.ok(tw.includes("'color-primary': '#1a2b3c',"), 'tailwind export con key sanitizada');
console.log('[3] buildCssExport + buildTailwindExport OK');

console.log('\nTODO OK ✔');
