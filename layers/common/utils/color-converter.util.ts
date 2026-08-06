/**
 * Utilidad canónica compartida de conversión de color.
 *
 * Antes existían DOS copias de `hexToRgb` / `rgbToHex` / `rgbToHsl` /
 * `hslToRgb` (una en `layers/palette/utils/color-converter.util.ts` y otra en
 * `layers/all-colors/utils/color-formats.util.ts`). Este archivo es la fuente
 * única; los otros dos re-exportan desde acá para no romper imports existentes.
 *
 * Convención: `rgbToHsl` NO redondea internamente (máxima precisión para
 * cálculos intermedios). Los consumidores que muestran valores redondean al
 * renderizar (ej. `Math.round(hsl.h)`).
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

export interface Hsl {
  h: number
  s: number
  l: number
}

export function hexToRgb(hex: string): Rgb {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result !== null
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : { r: 0, g: 0, b: 0 };
};

export function rgbToString(rgb: Rgb, alpha?: number): string {
  return alpha !== undefined
    ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
    : `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
};

export function rgbToHex(rgb: Rgb): string {
  const r = rgb.r.toString(16);
  const g = rgb.g.toString(16);
  const b = rgb.b.toString(16);
  return `#${r.length === 1 ? `0${r}` : r}${g.length === 1 ? `0${g}` : g}${
    b.length === 1 ? `0${b}` : b
  }`;
};

export function hexToRgbString(hex: string, alpha?: number): string {
  const rgb = hexToRgb(hex);
  return rgbToString(rgb, alpha);
};

/** Normaliza un hex a `#rrggbb` minúscula; acepta 3 o 6 dígitos, con o sin `#`. Null si inválido. */
export function normalizeHex(value: string): string | null {
  const result = /^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(value.trim());
  if (result === null) {
    return null;
  }
  let hex = result[1];
  if (hex.length === 3) {
    hex = hex.split('').map(channel => `${channel}${channel}`).join('');
  }
  return `#${hex.toLowerCase()}`;
};

/** Blanco o negro según la luminancia percibida del color de fondo. */
export function getContrastTextColor(hex: string): string {
  const rgb = hexToRgb(hex);
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? '#000000' : '#ffffff';
};

export function rgbToHsl(rgb: Rgb): Hsl {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case r:
        h = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      case b:
        h = (r - g) / delta + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100
  };
};

export function hslToRgb(hsl: Hsl): Rgb {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = function hue2rgb(p: number, q: number, t: number): number {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};
