import { normalizeHex } from '~/layers/all-colors/utils/color-formats.util';
import { PANTONE_DATASET, findNearestPantones } from '~/layers/all-colors/utils/pantone-dataset';

function normalizeCode(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * GET /api/pantone
 * Busca en el dataset Pantone (3.219 muestras de la guía Solid Coated).
 *
 * Query — una de estas tres:
 *   hex         color de referencia → devuelve los `limit` Pantone más cercanos
 *               (CIEDE2000) ordenados por distancia
 *   code        código Pantone exacto (case-insensitive, acepta "185 C" o
 *               "PANTONE 185 C") → devuelve el swatch único
 *   q           búsqueda por substring en nombre/código (case-insensitive)
 *
 * Query — común:
 *   limit       (opcional, solo con hex) máx resultados, 1..50 (default: 12)
 *
 * Response:
 *   hex  → { mode: "match", hex, matches: [{code, name, category, hex, deltaE}] }
 *   code → { mode: "code", swatch: {code, name, category, hex} } | 404
 *   q    → { mode: "search", query, results: [{code, name, category, hex}] }
 */
export default defineEventHandler((event) => {
  const query = getQuery(event);

  const hexRaw = query.hex !== undefined ? String(query.hex) : '';
  const codeRaw = query.code !== undefined ? String(query.code) : '';
  const qRaw = query.q !== undefined ? String(query.q) : '';

  // modo 1: color de referencia -> nearest por CIEDE2000
  if (hexRaw !== '') {
    const hex = normalizeHex(hexRaw);
    if (hex === null) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid hex color. Use ?hex=#RRGGBB'
      });
    }
    const limitRaw = Number(query.limit ?? 12);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(50, Math.max(1, Math.round(limitRaw)))
      : 12;

    const matches = findNearestPantones(hex, limit).map(({ swatch, deltaE }) => ({
      code: swatch.code,
      name: swatch.name,
      category: swatch.category,
      hex: swatch.hex,
      deltaE: Number(deltaE.toFixed(2))
    }));

    return { mode: 'match', hex, matches };
  }

  // modo 2: código exacto
  if (codeRaw !== '') {
    const needle = normalizeCode(codeRaw).replace(/^pantone\s*/, '');
    const swatch = PANTONE_DATASET.find((s) =>
      normalizeCode(s.code).replace(/^pantone\s*/, '') === needle
    );
    if (swatch === undefined) {
      throw createError({
        statusCode: 404,
        statusMessage: `Pantone code not found: ${codeRaw}`
      });
    }
    return { mode: 'code', swatch };
  }

  // modo 3: búsqueda por substring en nombre/código
  if (qRaw !== '') {
    const needle = qRaw.trim().toLowerCase();
    const results = PANTONE_DATASET
      .filter((s) =>
        s.name.toLowerCase().includes(needle) ||
        s.code.toLowerCase().includes(needle)
      )
      .slice(0, 50)
      .map(({ code, name, category, hex }) => ({ code, name, category, hex }));
    return { mode: 'search', query: qRaw, results };
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Missing query. Use ?hex=#RRGGBB, ?code=PANTONE 185 C or ?q=green'
  });
});
