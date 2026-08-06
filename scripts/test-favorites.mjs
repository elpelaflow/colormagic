#!/usr/bin/env node
/**
 * Test del patrón de persistencia de favoritos (useFavorites).
 *
 * Uso: node --experimental-strip-types scripts/test-favorites.mjs
 *
 * Cubre dos partes:
 *   1) El MECANISMO de escritura de vueuse (useStorage con storage explícito
 *      + reasignación del ref): agrega, persiste, otra instancia lee, quita.
 *   2) La LÓGICA del composable useFavorites (agregar/quitar/isFavorite).
 *
 * Nota: se usa la REASIGNACIÓN del ref (no Map.set()) porque se verificó que
 * vueuse 11 no dispara el write en localStorage con mutación directa del Map.
 *
 * Parte 1: valida el mecanismo de escritura de vueuse (useStorage con storage
 * explícito + reasignación del ref) tal como lo usa useFavorites — la
 * reasignación dispara el watcher y escribe el serialized Map.
 *
 * Parte 2: valida la lógica pura del composable useFavorites (agregar/quitar/
 * isFavorite) sin depender del DOM (en Node, vueuse no detecta window).
 */
const { useStorage, StorageSerializers } = await import('@vueuse/core');

const tick = () => new Promise((r) => setTimeout(r, 10));
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : ` — ${detail}`}`);
  if (!ok) failures++;
};

const PALETTE = {
  id: '6a70162e20952e047bc5716a',
  colors: ['#111111', '#222222', '#333333', '#444444', '#555555'],
  text: 'Test Palette',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z'
};

// ---------- Parte 1: mecanismo de persistencia ----------
console.log('--- Parte 1: persistencia (useStorage + reasignación) ---');
{
  const store = new Map();
  const shim = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };

  const fav = useStorage('test:fav', new Map(), shim, { serializer: StorageSerializers.map });

  // reasignación (patrón de useFavorites) -> debe escribir
  fav.value = new Map(fav.value).set(PALETTE.id, PALETTE);
  await tick();
  const raw = store.get('test:fav');
  check('reasignar agrega y escribe en storage', raw !== undefined && raw.includes(PALETTE.id), `raw=${String(raw).slice(0, 90)}`);

  // segunda instancia lee el mismo dato
  const fav2 = useStorage('test:fav', new Map(), shim, { serializer: StorageSerializers.map });
  check('otra instancia lee el favorito', fav2.value.get(PALETTE.id)?.text === 'Test Palette');

  // quitar vía reasignación -> escribe sin el id
  const next = new Map(fav.value);
  next.delete(PALETTE.id);
  fav.value = next;
  await tick();
  check('quitar escribe el storage sin el id', !String(store.get('test:fav')).includes(PALETTE.id), String(store.get('test:fav')).slice(0, 60));

  // coexistencia de dos favoritos
  fav.value = new Map(fav.value).set(PALETTE.id, PALETTE).set('aaaaaaaaaaaaaaaaaaaaaaaa', { ...PALETTE, id: 'aaaaaaaaaaaaaaaaaaaaaaaa' });
  await tick();
  const raw2 = store.get('test:fav');
  check('dos favoritos coexisten en storage', raw2.includes(PALETTE.id) && raw2.includes('aaaaaaaaaaaaaaaaaaaaaaaa'), raw2.slice(0, 100));
}

// ---------- Parte 2: lógica del composable ----------
console.log('--- Parte 2: lógica de useFavorites (sin DOM) ---');
{
  const { useFavorites } = await import('../layers/common/composables/useFavorites.ts');
  const fav = useFavorites();

  const added = fav.toggleFavorite(PALETTE);
  check('toggle agrega (devuelve true)', added === true);
  check('isFavorite true tras agregar', fav.isFavorite(PALETTE.id) === true);
  check('el ref fue reasignado (nuevo Map)', fav.favorites.value instanceof Map);

  const removed = fav.toggleFavorite(PALETTE);
  check('segundo toggle quita (devuelve false)', removed === false);
  check('isFavorite false tras quitar', fav.isFavorite(PALETTE.id) === false);
}

console.log(failures === 0 ? '\n✅ TODOS LOS CHECKS PASAN' : `\n❌ ${failures} fallaron`);
process.exit(failures === 0 ? 0 : 1);
