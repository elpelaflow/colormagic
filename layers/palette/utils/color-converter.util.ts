/**
 * Re-export de la utilidad canónica de conversión de color
 * (`layers/common/utils/color-converter.util.ts`) para no romper los imports
 * existentes de `~/layers/palette/utils/color-converter.util`.
 *
 * Se mantienen acá las funciones específicas del layer palette:
 * `Hsb`/`rgbToHsb`/`hsbToRgb` (variante con "brightness" en vez de "value") y
 * `hexToName` (usa ntc).
 */
import ntc from '~/layers/palette/utils/ntc.util';
import {
  hexToRgb,
  rgbToString,
  rgbToHex,
  hexToRgbString,
  rgbToHsl,
  hslToRgb,
  type Hsl,
  type Rgb
} from '~/layers/common/utils/color-converter.util';

export interface Hsb {
  h: number
  s: number
  b: number
}

export type { Hsl, Rgb };

export { hexToRgb, rgbToString, rgbToHex, hexToRgbString, rgbToHsl, hslToRgb };

export function rgbToHsb(rgb: Rgb): Hsb {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const v = max;

  if (delta !== 0) {
    s = delta / max;
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
    b: v * 100
  };
};

export function hsbToRgb(hsb: Hsb): Rgb {
  const h = hsb.h / 360;
  const s = hsb.s / 100;
  const v = hsb.b / 100;

  let r = 0;
  let g = 0;
  let b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

export function hexToName(hex: string): string | boolean {
  const nMatch = ntc.name(hex);
  const name = nMatch[1];
  return name;
};
