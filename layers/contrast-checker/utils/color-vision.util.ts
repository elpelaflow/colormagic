import { hexToRgb, rgbToHex, type Rgb } from '~/layers/palette/utils/color-converter.util';

export type VisionType = 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';

export interface VisionOption {
  id: VisionType
  divides: boolean
}

export const VISION_OPTIONS: VisionOption[] = [
  { id: 'normal', divides: false },
  { id: 'protanopia', divides: true },
  { id: 'deuteranopia', divides: true },
  { id: 'tritanopia', divides: true },
  { id: 'achromatopsia', divides: true }
];

// Matrices de transformacion LMS para simulacion de daltonismo.
// Fuente: Brettel-Vienot-Le Rohellec (1999) / Machado et al. (2009).
// Estas son las matrices estandar usadas por todas las librerias de
// colour-blindness simulation (p.ej. colorblind, daltonlens).
const PROTANOPIA: number[] = [
  0.567, 0.433, 0,
  0.558, 0.442, 0,
  0,     0.242, 0.758
];

const DEUTERANOPIA: number[] = [
  0.625, 0.375, 0,
  0.7,   0.3,   0,
  0,     0.3,   0.7
];

const TRITANOPIA: number[] = [
  0.95, 0.05,  0,
  0,    0.433, 0.567,
  0,    0.475, 0.525
];

const ACHROMATOPSIA: number[] = [
  0.299, 0.587, 0.114,
  0.299, 0.587, 0.114,
  0.299, 0.587, 0.114
];

function applyMatrix(rgb: Rgb, m: number[]): Rgb {
  return {
    r: Math.round(m[0] * rgb.r + m[1] * rgb.g + m[2] * rgb.b),
    g: Math.round(m[3] * rgb.r + m[4] * rgb.g + m[5] * rgb.b),
    b: Math.round(m[6] * rgb.r + m[7] * rgb.g + m[8] * rgb.b)
  };
}

function clamp(rgb: Rgb): Rgb {
  return {
    r: Math.min(255, Math.max(0, rgb.r)),
    g: Math.min(255, Math.max(0, rgb.g)),
    b: Math.min(255, Math.max(0, rgb.b))
  };
}

export function simulateVision(hex: string, type: VisionType): string {
  if (type === 'normal') {
    return hex;
  }
  const rgb = hexToRgb(hex);
  let matrix: number[];
  switch (type) {
    case 'protanopia': matrix = PROTANOPIA; break;
    case 'deuteranopia': matrix = DEUTERANOPIA; break;
    case 'tritanopia': matrix = TRITANOPIA; break;
    case 'achromatopsia': matrix = ACHROMATOPSIA; break;
    default: return hex;
  }
  return rgbToHex(clamp(applyMatrix(rgb, matrix)));
}
