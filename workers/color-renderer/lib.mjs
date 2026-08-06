/**
 * color-renderer — funciones puras (testeables sin Playwright).
 * 'rgb(r, g, b)' / 'rgba(...)' -> '#rrggbb' | null (null si transparente o inválido).
 */
export function rgbToHex(value) {
  const m = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  if (Number(m[4] ?? 1) === 0) return null;
  return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}

/**
 * Agrega muestras de color por hex y devuelve el top-N con share (%).
 * @param {string[]} samples hex '#rrggbb'
 * @param {number} max cantidad máxima de entradas
 */
export function aggregateUsage(samples, max = 40) {
  const counts = new Map();
  for (const hex of samples) {
    counts.set(hex, (counts.get(hex) || 0) + 1);
  }
  const total = samples.length || 1;
  return [...counts.entries()]
    .map(([hex, count]) => ({ hex, count, share: Math.round((count / total) * 1000) / 10 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, max);
}

/**
 * Caché LRU simple en memoria con TTL.
 * @param {number} maxEntries
 * @param {number} ttlMs
 */
export function createLruCache(maxEntries, ttlMs) {
  const map = new Map();
  return {
    get(key) {
      const entry = map.get(key);
      if (!entry) return undefined;
      if (Date.now() - entry.at > ttlMs) {
        map.delete(key);
        return undefined;
      }
      map.delete(key); // refresca el orden LRU
      map.set(key, entry);
      return entry.value;
    },
    set(key, value) {
      if (map.has(key)) map.delete(key);
      map.set(key, { value, at: Date.now() });
      if (map.size > maxEntries) {
        map.delete(map.keys().next().value); // evicta el más viejo
      }
    },
    size: () => map.size
  };
}
