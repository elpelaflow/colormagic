import { hexToRgb, rgbToHex, rgbToString, type Rgb } from '~/layers/palette/utils/color-converter.util';

export interface Ryb {
  r: number
  y: number
  b: number
}

export interface MixedColor {
  hex: string
  rgb: Rgb
  rgbString: string
}

export interface MixPreset {
  id: string
  nameKey: string
  a: string
  b: string
  ratio: number
}

export const MIX_PRESETS: MixPreset[] = [
  { id: 'blue-yellow', nameKey: 'blueYellow', a: '#0000ff', b: '#fefe33', ratio: 50 },
  { id: 'red-yellow', nameKey: 'redYellow', a: '#fe2712', b: '#fefe33', ratio: 50 },
  { id: 'red-blue', nameKey: 'redBlue', a: '#fe2712', b: '#0000ff', ratio: 50 },
  { id: 'blue-white', nameKey: 'blueWhite', a: '#0000ff', b: '#ffffff', ratio: 50 },
  { id: 'red-black', nameKey: 'redBlack', a: '#fe2712', b: '#000000', ratio: 50 }
];

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * RGB -> RYB conversion based on the classic subtractive algorithm (from the
 * "insanit.net" RYB writeups, later popularised by several open source color
 * libraries). Unlike trilinear/Gossett-Chen approaches, this conversion is a
 * bijection: pure colors round-trip exactly (blue -> blue, yellow -> yellow),
 * and mixing yellow + blue gives green instead of muddy gray.
 */
export function rgbToRyb(rgb: Rgb): Ryb {
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  const white = Math.min(r, g, b);
  r -= white;
  g -= white;
  b -= white;

  const maxGreen = Math.max(r, g, b);

  let y = Math.min(r, g);
  r -= y;
  g -= y;

  if (b > 0 && g > 0) {
    b /= 2;
    g /= 2;
  }

  y += g;
  b += g;

  const maxYellow = Math.max(r, y, b);
  if (maxYellow > 0) {
    const n = maxGreen / maxYellow;
    r *= n;
    y *= n;
    b *= n;
  }

  return {
    r: clamp01(r + white),
    y: clamp01(y + white),
    b: clamp01(b + white)
  };
}

/** RYB -> RGB. Exact inverse of `rgbToRyb`. */
export function rybToRgb(ryb: Ryb): Rgb {
  let r = ryb.r;
  let y = ryb.y;
  let b = ryb.b;

  const white = Math.min(r, y, b);
  r -= white;
  y -= white;
  b -= white;

  const maxYellow = Math.max(r, y, b);

  let g = Math.min(y, b);
  y -= g;
  b -= g;

  if (b > 0 && g > 0) {
    b *= 2;
    g *= 2;
  }

  r += y;
  g += y;

  const maxGreen = Math.max(r, g, b);
  if (maxGreen > 0) {
    const n = maxYellow / maxGreen;
    r *= n;
    g *= n;
    b *= n;
  }

  return {
    r: Math.round(clamp01(r + white) * 255),
    g: Math.round(clamp01(g + white) * 255),
    b: Math.round(clamp01(b + white) * 255)
  };
}

/**
 * Linearly interpolate two colors in RYB space.
 * @param ratioA fraction (0..1) of color A, the rest being color B.
 */
export function mixRyb(rybA: Ryb, rybB: Ryb, ratioA: number): MixedColor {
  const t = clamp01(ratioA);
  const rgb = rybToRgb({
    r: rybA.r * t + rybB.r * (1 - t),
    y: rybA.y * t + rybB.y * (1 - t),
    b: rybA.b * t + rybB.b * (1 - t)
  });
  return {
    hex: rgbToHex(rgb),
    rgb,
    rgbString: rgbToString(rgb)
  };
}

/** Convenience wrapper that takes two hex strings and returns the RYB mix. */
export function mixColorsRyb(hexA: string, hexB: string, ratioA: number): MixedColor {
  if (ratioA <= 0) {
    return pureColor(hexB);
  }
  if (ratioA >= 1) {
    return pureColor(hexA);
  }
  return mixRyb(rgbToRyb(hexToRgb(hexA)), rgbToRyb(hexToRgb(hexB)), ratioA);
}

function pureColor(hex: string): MixedColor {
  const rgb = hexToRgb(hex);
  return { hex: rgbToHex(rgb), rgb, rgbString: rgbToString(rgb) };
}
