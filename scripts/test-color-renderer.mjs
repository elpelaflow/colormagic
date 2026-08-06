/**
 * Test del worker color-renderer (Fase 2a) — lógica pura de lib.mjs.
 * La parte de Playwright se valida con el endpoint real (docker run), no aquí.
 * Corre con: node --experimental-strip-types scripts/test-color-renderer.mjs
 */
import { rgbToHex, aggregateUsage, createLruCache, contrastRatio, aggregateContrast } from '../workers/color-renderer/lib.mjs';
import assert from 'node:assert';

// 1) rgbToHex
const hexCases = [
  ['rgb(255, 0, 0)', '#ff0000'],
  ['rgb(1, 2, 3)', '#010203'],
  ['rgba(0, 0, 0, 0)', null],        // totalmente transparente
  ['rgba(0, 0, 0, 0.0)', null],
  ['rgba(255, 255, 255, 0.5)', '#ffffff'], // alpha > 0 se conserva
  ['#ff0000', null],                  // ya es hex, no un rgb()
  ['', null],
  ['transparent', null]
];
for (const [input, expected] of hexCases) {
  assert.strictEqual(rgbToHex(input), expected, `rgbToHex('${input}')`);
}
console.log('[1] rgbToHex OK');

// 2) aggregateUsage: orden por frecuencia + share + top-N
const samples = ['#ff0000', '#ff0000', '#00ff00', '#ff0000', '#0000ff'];
const agg = aggregateUsage(samples, 2);
assert.strictEqual(agg.length, 2, 'top-N respeta el límite');
assert.strictEqual(agg[0].hex, '#ff0000', 'el más usado primero');
assert.strictEqual(agg[0].count, 3, 'conteo correcto');
assert.strictEqual(agg[0].share, 60, 'share 3/5 = 60%');
assert.strictEqual(aggregateUsage([]).length, 0, 'sin muestras');
console.log('[2] aggregateUsage OK');

// 3) createLruCache: TTL + evicción LRU
const cache = createLruCache(2, 50);
cache.set('a', 1);
cache.set('b', 2);
cache.set('c', 3);
assert.strictEqual(cache.get('a'), undefined, 'evicta el menos reciente cuando excede max');
assert.strictEqual(cache.get('c'), 3, 'mantiene las recientes');
cache.get('b'); // toca b → queda como el más reciente
cache.set('d', 4);
assert.strictEqual(cache.get('c'), undefined, 'evicta al más viejo tras tocar b');
assert.strictEqual(cache.get('b'), 2, 'b presente (fue tocado)');
assert.strictEqual(cache.get('d'), 4, 'd presente');

const ttlCache = createLruCache(10, 30);
ttlCache.set('x', 42);
await new Promise((r) => setTimeout(r, 60));
assert.strictEqual(ttlCache.get('x'), undefined, 'expira por TTL');
console.log('[3] createLruCache OK');

// 4) contraste WCAG
assert.ok(Math.abs(contrastRatio('#ffffff', '#000000') - 21) < 0.01, 'blanco/negro = 21:1');
assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 0.01, 'orden de argumentos indiferente');
assert.ok(Math.abs(contrastRatio('#ffffff', '#ffffff') - 1) < 0.01, 'mismo color = 1:1');
const gray77 = contrastRatio('#777777', '#ffffff');
assert.ok(gray77 < 4.5 && gray77 >= 4.4, `#777777 sobre blanco no llega a AA normal (${gray77})`);
const gray76 = contrastRatio('#767676', '#ffffff');
assert.ok(gray76 >= 4.5, `#767676 sobre blanco pasa AA normal (${gray76})`);
const contrastAgg = aggregateContrast([
  { fg: '#000000', bg: '#ffffff', isLarge: false },
  { fg: '#000000', bg: '#ffffff', isLarge: false },
  { fg: '#777777', bg: '#ffffff', isLarge: true }
]);
assert.strictEqual(contrastAgg.length, 2, 'agrupa por par fg|bg');
assert.strictEqual(contrastAgg[0].count, 2, 'conteo por par');
assert.strictEqual(contrastAgg[0].passesAA, true, 'negro/blanco pasa AA');
assert.strictEqual(contrastAgg[0].passesAAA, true, 'negro/blanco pasa AAA');
assert.strictEqual(contrastAgg[1].passesAA, true, '#777777 large text pasa AA (umbral 3:1)');
assert.strictEqual(contrastAgg[1].passesAAA, false, '#777777 large text no pasa AAA (umbral 4.5:1)');
console.log('[4] contrastRatio + aggregateContrast OK');

console.log('\nTODO OK ✔');
