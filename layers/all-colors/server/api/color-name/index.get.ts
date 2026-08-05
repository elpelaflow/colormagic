import { normalizeHex } from '~/layers/all-colors/utils/color-formats.util';
import colorNames from '~/layers/palette/utils/color-names-data.json';

type NameEntry = [hex: string, name: string];

const NAMES = colorNames as NameEntry[];

// Precompute RGB + HSL de cada color del diccionario una sola vez al cargar.
// Misma métrica que ntc (Name that Color): distancia RGB + 2× distancia HSL.
const PRECOMPUTED = NAMES.map(([hex, name]) => {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return { hex, name, r, g, b, ...rgbToHslScaled(r, g, b) };
});

// índice O(1) para match exacto (hex en mayúsculas sin '#' → nombre)
const EXACT = new Map<string, string>(NAMES);

function rgbToHslScaled(r: number, g: number, b: number): { h: number, s: number, l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const delta = max - min;
  if (delta > 0) {
    s = l < 0.5 ? delta / (2 * l) : delta / (2 - 2 * l);
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: h * (255 / 360), s: s * 255, l: l * 255 };
}

/**
 * GET /api/color-name
 * Devuelve el nombre del color más cercano del diccionario (14.394 nombres).
 *
 * Query:
 *   hex   (obligatorio) hex code con o sin '#'
 *
 * Response 200:
 *   {
 *     hex: "#2c3e50",
 *     name: "Cloud Burst",
 *     exactMatch: false,
 *     matchedHex: "#2d3a52"   // hex real del diccionario que matcheó
 *   }
 *
 * Response 400: si el hex no es válido.
 */
export default defineEventHandler((event) => {
  const query = getQuery(event);

  const hex = normalizeHex(String(query.hex ?? ''));
  if (hex === null) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid hex color. Use ?hex=#RRGGBB'
    });
  }

  const hexKey = hex.slice(1).toUpperCase();

  // match exacto O(1)
  const exact = EXACT.get(hexKey);
  if (exact !== undefined) {
    return { hex, name: exact, exactMatch: true, matchedHex: hex };
  }

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const hsl = rgbToHslScaled(r, g, b);

  let best = PRECOMPUTED[0];
  let bestDist = Infinity;
  for (const c of PRECOMPUTED) {
    const ndf1 = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
    const ndf2 = (hsl.h - c.h) ** 2 + (hsl.s - c.s) ** 2 + (hsl.l - c.l) ** 2;
    const dist = ndf1 + ndf2 * 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }

  return {
    hex,
    name: best.name,
    exactMatch: false,
    matchedHex: `#${best.hex.toLowerCase()}`
  };
});
