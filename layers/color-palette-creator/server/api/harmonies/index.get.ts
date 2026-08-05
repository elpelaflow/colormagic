import { normalizeHex } from '~/layers/all-colors/utils/color-formats.util';
import {
  generatePalette,
  expandPalette,
  paletteToHex,
  type GeneratorOptions,
  type PaletteStyle,
  type PaletteType
} from '~/layers/color-palette-creator/utils/palette-generator.util';

const VALID_TYPES: PaletteType[] = [
  'analogous',
  'complementary',
  'triadic',
  'tetradic',
  'splitComplementary',
  'tintsShades'
];

const VALID_STYLES: PaletteStyle[] = ['default', 'square', 'triangle', 'circle', 'diamond'];

const DEFAULT_TYPE: PaletteType = 'analogous';
const DEFAULT_STYLE: PaletteStyle = 'square';

/**
 * GET /api/harmonies
 * Genera una paleta de armonía de colores con la misma lógica que la tool
 * "Color Palette Creator" (port 1:1 de pro-color-harmonies, OKLCH).
 *
 * Query:
 *   base         (obligatorio) hex code del color base (con o sin '#')
 *   type         (opcional) armonía: analogous | complementary | triadic |
 *                tetradic | splitComplementary | tintsShades (default: analogous)
 *   style        (opcional) estilo geométrico: default | square | triangle |
 *                circle | diamond (default: square)
 *   count        (opcional) cantidad de colores, 3..30 (default: 6)
 *   sine|wave|zap|block  (opcional) modificadores, -1..1 (default: 0)
 *   clamp        (opcional) 'true' | 'false' — clampa a sRGB reduciendo chroma
 *                (default: true, igual que la UI; el original lo tiene off)
 *   interpolation (opcional) 'true' | 'false' — blend suave de variaciones
 *                (default: true)
 */
export default defineEventHandler((event) => {
  const query = getQuery(event);

  const base = normalizeHex(String(query.base ?? ''));
  if (base === null) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid hex color. Use ?base=#RRGGBB'
    });
  }

  const typeRaw = String(query.type ?? DEFAULT_TYPE);
  if (!VALID_TYPES.includes(typeRaw as PaletteType)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid type: ${typeRaw}. Use one of: ${VALID_TYPES.join(' | ')}`
    });
  }
  const type: PaletteType = typeRaw as PaletteType;

  const styleRaw = String(query.style ?? DEFAULT_STYLE);
  if (!VALID_STYLES.includes(styleRaw as PaletteStyle)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid style: ${styleRaw}. Use one of: ${VALID_STYLES.join(' | ')}`
    });
  }
  const style: PaletteStyle = styleRaw as PaletteStyle;

  const countRaw = Number(query.count ?? 6);
  const count = Number.isFinite(countRaw)
    ? Math.min(30, Math.max(3, Math.round(countRaw)))
    : 6;

  const clampRaw = String(query.clamp ?? 'true');
  const clampToGamut = clampRaw !== 'false';

  const interpRaw = String(query.interpolation ?? 'true');
  const interpolation = interpRaw !== 'false';

  const modifiers: GeneratorOptions['modifiers'] = {};
  for (const key of ['sine', 'wave', 'zap', 'block'] as const) {
    const raw = query[key];
    if (raw !== undefined) {
      const n = Number(raw);
      modifiers[key] = Number.isFinite(n) ? Math.min(1, Math.max(-1, n)) : 0;
    }
  }

  const options: GeneratorOptions = { style, modifiers, interpolation, clampToGamut };

  const palette = generatePalette(base, type, options);
  const expanded = expandPalette(palette, count);
  const colors = paletteToHex(expanded);

  return {
    base,
    type,
    style,
    count,
    clampToGamut,
    interpolation,
    modifiers,
    colors
  };
});
