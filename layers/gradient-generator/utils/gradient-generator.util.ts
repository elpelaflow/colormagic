/**
 * Utilidades del Gradient Generator: construcción del valor CSS del gradiente
 * (linear / radial / conic), del archivo CSS completo, de un tailwind.config
 * compatible y del JSON estructurado para exportar.
 *
 * Los stops se ordenan por posición antes de renderizar (igual que hace el
 * navegador), y los hex inválidos se descartan para no romper el gradiente
 * mientras el usuario edita el campo.
 */

export type GradientType = 'linear' | 'radial' | 'conic';

export interface GradientStop {
  id: string
  color: string // hex (#rrggbb)
  position: number // 0..100
}

export interface GradientConfig {
  type: GradientType
  angle: number // grados: dirección (linear) / punto de partida (conic)
  stops: GradientStop[]
}

export interface SavedGradient {
  id: string
  name: string
  config: GradientConfig
  createdAt: number
}

export const MIN_STOPS = 2;
export const MAX_STOPS = 8;
export const STORAGE_KEY = 'colormagic:gradients';

export const GRADIENT_TYPES: GradientType[] = ['linear', 'radial', 'conic'];

let idCounter = 0;

/** Crea un stop. Los ids de los stops iniciales deben ser deterministas (SSR). */
export function createStop(color = '#000000', position = 50, id?: string): GradientStop {
  idCounter += 1;
  return {
    id: id ?? `stop-${Date.now()}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`,
    color,
    position
  };
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isValidHex(value: string): boolean {
  return HEX_RE.test(value.trim());
}

/** Copia ordenada por posición (no muta el original). */
export function sortStops(stops: GradientStop[]): GradientStop[] {
  return [...stops].sort((a, b) => a.position - b.position);
}

/** "color pos%", descartando colores inválidos. */
export function stopsToString(stops: GradientStop[]): string {
  return sortStops(stops)
    .filter((stop) => isValidHex(stop.color))
    .map((stop) => `${stop.color} ${stop.position}%`)
    .join(', ');
}

/** Valor de `background-image` (sin la propiedad). */
export function buildGradientValue(config: GradientConfig): string {
  const stops = stopsToString(config.stops) || '#ffffff 0%, #ffffff 100%';
  switch (config.type) {
    case 'linear':
      return `linear-gradient(${config.angle}deg, ${stops})`;
    case 'radial':
      return `radial-gradient(circle, ${stops})`;
    case 'conic':
      return `conic-gradient(from ${config.angle}deg, ${stops})`;
  }
}

/** Declaración CSS completa: `background-image: ...;` */
export function buildCssDeclaration(config: GradientConfig): string {
  return `background-image: ${buildGradientValue(config)};`;
}

/** Archivo CSS listo para producción. */
export function buildCssFile(config: GradientConfig): string {
  return [
    '/* Generated with ColorMagic Gradient Generator */',
    '.gradient {',
    `  ${buildCssDeclaration(config)}`,
    '}',
    ''
  ].join('\n');
}

/** tailwind.config.js con los colores y el gradiente registrados como utilidad. */
export function buildTailwindConfig(config: GradientConfig): string {
  const colors = sortStops(config.stops)
    .map((stop, index) => `        'gradient-${index + 1}': '${stop.color}'`)
    .join(',\n');

  return [
    '/** @type {import(\'tailwindcss\').Config} */',
    'module.exports = {',
    '  theme: {',
    '    extend: {',
    '      colors: {',
    colors,
    '      },',
    '      backgroundImage: {',
    `        'custom-gradient': '${buildGradientValue(config)}'`,
    '      }',
    '    }',
    '  }',
    '};',
    ''
  ].join('\n');
}

/** Datos estructurados para integraciones JS (stops ordenados + CSS listo). */
export interface GradientJson extends Omit<GradientConfig, 'stops'> {
  stops: GradientStop[]
  css: string
}

export function buildGradientJson(config: GradientConfig): GradientJson {
  return {
    type: config.type,
    angle: config.angle,
    stops: sortStops(config.stops),
    css: buildGradientValue(config)
  };
}

/** Carga la galería local del usuario (localStorage). */
export function loadSavedGradients(): SavedGradient[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persiste la galería local. */
export function persistSavedGradients(gradients: SavedGradient[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(gradients));
  } catch {
    // cuota de localStorage excedida: no romper la app
  }
}
