/**
 * Brand Colors — dataset de colores de marcas.
 *
 * Fuente: https://github.com/pickcoloronline/brands (licencia ISC, permisiva).
 * Dataset consolidado y normalizado en `brand-colors-data.json` (910 marcas,
 * ~2.750 colores, 136 KB) generado con `scripts/import-brand-colors.mjs`.
 *
 * Se conservan solo { title, slug, colors, category, brandUrl } — se omiten
 * `description` y `sourceUrl` del repo original para mantener el JSON liviano.
 * Los hex se normalizan a `#RRGGBB` mayúsculas (3-dígitos expandidos, valores
 * no parseables descartados).
 */

import data from './brand-colors-data.json';

export interface BrandColor {
  /** Nombre de la marca (Airbnb, Adidas…). */
  title: string;
  /** Slug normalizado (airbnb, adidas…). */
  slug: string;
  /** Colores de la marca, normalizados a #RRGGBB mayúsculas. */
  colors: string[];
  /** Categoría textual del repo (Technology, Education…). Vacío si no tiene. */
  category: string;
  /** URL del sitio oficial de la marca. */
  brandUrl: string;
}

/** Dataset completo, ordenado alfabéticamente por título. */
export const BRAND_COLORS: BrandColor[] = data as BrandColor[];

/** Marcas con al menos un color (excluye entradas vacías como Siemens). */
export const BRAND_COLORS_WITH_COLORS: BrandColor[] = BRAND_COLORS.filter(b => b.colors.length > 0);

/** Total de colores de todo el dataset. */
export const TOTAL_BRAND_COLORS: number = BRAND_COLORS_WITH_COLORS.reduce((sum, b) => sum + b.colors.length, 0);

/** Normaliza una query de búsqueda: minúsculas, sin espacios al borde. */
function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * Normaliza una query de hex: expande 3 dígitos a 6 (igual que el import) y
 * devuelve el patrón de prefijo a matchear, o null si no parece un hex.
 */
function normalizeHexQuery(query: string): string | null {
  let hex = query.replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(hex)) {
    hex = hex.split('').map(ch => `${ch}${ch}`).join('');
  }
  return /^[0-9a-f]{3,6}$/.test(hex) ? hex : null;
}

/** Filtra marcas por nombre o por un hex (con o sin #, 3 o 6 dígitos). */
export function searchBrands(query: string): BrandColor[] {
  const q = normalizeQuery(query);
  if (!q) {
    return BRAND_COLORS_WITH_COLORS;
  }
  const hexPattern = normalizeHexQuery(q);

  return BRAND_COLORS_WITH_COLORS.filter((brand) => {
    if (brand.title.toLowerCase().includes(q) || brand.slug.includes(q)) {
      return true;
    }
    if (hexPattern !== null) {
      // Match por prefijo: "f00" → "ff0000" matchea #FF0000; "ff0000" matchea exacto.
      return brand.colors.some(c => c.slice(1).toLowerCase().startsWith(hexPattern));
    }
    return false;
  });
}
