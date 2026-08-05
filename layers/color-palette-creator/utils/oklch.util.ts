/**
 * Conversiones OKLab / OKLCH hechas a mano (sin dependencias).
 *
 * Formulas de Björn Ottosson (2020) - "A perceptual color space for image
 * processing". Validado contra valores de referencia:
 *   sRGB(255,0,0) -> OKLab L=0.6280 a=0.2249 b=0.1258  (OKLCH C=0.2577 h=29.23)
 *   roundtrips exactos.
 *
 * El gamut clamp se hace por reduccion de chroma (busqueda binaria), el mismo
 * enfoque perceptual que usa clampChroma de Culori: se baja el chroma hasta
 * que el color entra en sRGB, manteniendo hue y lightness intactos.
 */

export interface Oklch {
  l: number // 0..1
  c: number // 0..~0.4
  h: number // 0..360
}

export interface Oklab {
  l: number
  a: number
  b: number
}

export interface Rgb {
  r: number // 0..255
  g: number
  b: number
}

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

export const normalizeHue = (hue: number): number => ((hue % 360) + 360) % 360;

export const lerp = (amt: number, from: number, to: number): number => from + amt * (to - from);

const srgbToLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linearToSrgb = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

export function rgbToOklch(rgb: Rgb): Oklch {
  const { r, g, b } = rgb;
  const rl = srgbToLinear(r / 255);
  const gl = srgbToLinear(g / 255);
  const bl = srgbToLinear(b / 255);

  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;

  const l_ = Math.cbrt(Math.max(l, 0));
  const m_ = Math.cbrt(Math.max(m, 0));
  const s_ = Math.cbrt(Math.max(s, 0));

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  const c = Math.sqrt(a * a + bb * bb);
  const h = normalizeHue(Math.atan2(bb, a) * 180 / Math.PI);
  return { l: L, c, h };
}

/** OKLCH -> OKLab (a y b en coordenadas cartesianas) */
export function oklchToOklab(oklch: Oklch): Oklab {
  const rad = (oklch.h * Math.PI) / 180;
  return {
    l: oklch.l,
    a: oklch.c * Math.cos(rad),
    b: oklch.c * Math.sin(rad)
  };
}

export function oklabToOklch(oklab: Oklab): Oklch {
  const c = Math.sqrt(oklab.a * oklab.a + oklab.b * oklab.b);
  const h = normalizeHue(Math.atan2(oklab.b, oklab.a) * 180 / Math.PI);
  return { l: oklab.l, c, h };
}

/** OKLab -> RGB lineal (0..1, SIN clamp — para testear gamut) */
function oklabToLinearRgb(oklab: Oklab): { r: number, g: number, b: number } {
  const l_ = oklab.l + 0.3963377774 * oklab.a + 0.2158037573 * oklab.b;
  const m_ = oklab.l - 0.1055613458 * oklab.a - 0.0638541728 * oklab.b;
  const s_ = oklab.l - 0.0894841775 * oklab.a - 1.2914855480 * oklab.b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  };
}

export function oklchToRgb(oklch: Oklch): Rgb {
  const lin = oklabToLinearRgb(oklchToOklab(oklch));
  const to255 = (v: number): number => Math.round(clamp(linearToSrgb(v), 0, 1) * 255);
  return { r: to255(lin.r), g: to255(lin.g), b: to255(lin.b) };
}

/** RGB (0..1 linear) esta dentro del gamut sRGB? */
function inSrgbGamut(lin: { r: number, g: number, b: number }): boolean {
  return lin.r >= 0 && lin.r <= 1 && lin.g >= 0 && lin.g <= 1 && lin.b >= 0 && lin.b <= 1;
}

/**
 * Clamp al gamut sRGB reduciendo chroma (busqueda binaria, ~20 iteraciones).
 * Mantiene l y h intactos — equivalente perceptual al clampChroma de Culori.
 */
export function clampChroma(oklch: Oklch): Oklch {
  const l = clamp(oklch.l, 0.01, 0.99);
  const h = normalizeHue(oklch.h);
  if (inSrgbGamut(oklabToLinearRgb({ l, a: oklch.c * Math.cos(h * Math.PI / 180), b: oklch.c * Math.sin(h * Math.PI / 180) }))) {
    return { l, c: oklch.c, h };
  }
  let lo = 0;
  let hi = oklch.c;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const rad = (h * Math.PI) / 180;
    const lin = oklabToLinearRgb({ l, a: mid * Math.cos(rad), b: mid * Math.sin(rad) });
    if (inSrgbGamut(lin)) lo = mid; else hi = mid;
  }
  return { l, c: lo, h };
}

export function rgbToHex(rgb: Rgb): string {
  const ch = [rgb.r, rgb.g, rgb.b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'));
  return `#${ch.join('')}`;
}

export function hexToRgb(hex: string): Rgb {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

export function hexToOklch(hex: string): Oklch {
  return rgbToOklch(hexToRgb(hex));
}

export function oklchToHex(oklch: Oklch): string {
  return rgbToHex(oklchToRgb(oklch));
}
