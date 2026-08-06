/**
 * Test del worker color-renderer (Fase 2a) — lógica pura de lib.mjs.
 * La parte de Playwright se valida con el endpoint real (docker run), no aquí.
 * Corre con: node --experimental-strip-types scripts/test-color-renderer.mjs
 */
import { rgbToHex, aggregateUsage, createLruCache } from '../workers/color-renderer/lib.mjs';
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

console.log('\nTODO OK ✔');
