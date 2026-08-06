/** Viewport compartido entre el pool (contextos) y el screenshot (clip). */
export const VIEWPORT = { width: 1440, height: 900 };

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

// ---------------------------------------------------------------------------
// Contraste WCAG (Fase 2b) — matemática pura
// ---------------------------------------------------------------------------

/** '#rrggbb' -> { r, g, b } (0-255). */
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Luminancia relativa WCAG 2.x de un hex. */
export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Ratio de contraste WCAG 1..21 (orden de argumentos indiferente). */
export function contrastRatio(hexA, hexB) {
  const hi = Math.max(relativeLuminance(hexA), relativeLuminance(hexB));
  const lo = Math.min(relativeLuminance(hexA), relativeLuminance(hexB));
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Agrega muestras de contraste de texto: agrupa por par (fg|bg), calcula el
 * ratio y los pases AA/AAA. Si alguna muestra del par es texto normal (no
 * large), se usan los umbrales estrictos (4.5/7); si todas son large, 3/4.5.
 * @param {{ fg: string, bg: string, isLarge: boolean }[]} samples
 * @param {number} max
 */
export function aggregateContrast(samples, max = 20) {
  const map = new Map();
  for (const sample of samples) {
    const key = `${sample.fg}|${sample.bg}`;
    const entry = map.get(key) ?? { fg: sample.fg, bg: sample.bg, count: 0, small: 0, large: 0 };
    entry.count++;
    if (sample.isLarge) entry.large++;
    else entry.small++;
    map.set(key, entry);
  }
  return [...map.values()]
    .map((entry) => {
      const ratio = contrastRatio(entry.fg, entry.bg);
      const strict = entry.small > 0;
      return {
        fg: entry.fg,
        bg: entry.bg,
        count: entry.count,
        ratio: Math.round(ratio * 100) / 100,
        passesAA: ratio >= (strict ? 4.5 : 3),
        passesAAA: ratio >= (strict ? 7 : 4.5)
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, max);
}

/**
 * Detección de dark mode comparando los renders light y dark.
 * Señal principal: luminancia del fondo dominante (light > 0.5, dark < 0.2
 * típicamente). Señal secundaria: solapamiento de las paletas top-10 — solo
 * se activa si las paletas casi no se solapan (< 10%), para no dar falsos
 * positivos cuando el fondo dominante no cambió pero los acentos difieren.
 * @param {{ hex: string }[]} lightPalette
 * @param {{ hex: string }[]} darkPalette
 * @param {string} lightDominantBg
 * @param {string} darkDominantBg
 */
export function detectDarkMode(lightPalette, darkPalette, lightDominantBg, darkDominantBg) {
  const lumLight = relativeLuminance(lightDominantBg);
  const lumDark = relativeLuminance(darkDominantBg);
  if (Math.abs(lumLight - lumDark) > 0.25) return true;

  // Señal secundaria: si la paleta cambió mucho, también es dark mode.
  const lightTop = new Set(lightPalette.slice(0, 10).map((p) => p.hex));
  const darkTop = new Set(darkPalette.slice(0, 10).map((p) => p.hex));
  const intersection = [...lightTop].filter((hex) => darkTop.has(hex)).length;
  const union = new Set([...lightTop, ...darkTop]).size;
  return union > 0 && intersection / union < 0.1;
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
