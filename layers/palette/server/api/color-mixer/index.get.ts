import { hexToRgb, rgbToHsl, hslToRgb, rgbToHex, type Rgb } from '~/layers/palette/utils/color-converter.util';

function parseHex(input: string): string | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(input.trim());
  return match ? `#${match[1].toLowerCase()}` : null;
}

function mixRgb(a: Rgb, b: Rgb, ratio: number): Rgb {
  return {
    r: Math.round(a.r + (b.r - a.r) * ratio),
    g: Math.round(a.g + (b.g - a.g) * ratio),
    b: Math.round(a.b + (b.b - a.b) * ratio)
  };
}

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const aRaw = String(query.a ?? query.color1 ?? '');
  const bRaw = String(query.b ?? query.color2 ?? '');
  const ratioRaw = Number(query.ratio ?? 0.5);

  const a = parseHex(aRaw);
  const b = parseHex(bRaw);

  if (a === null || b === null) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid hex colors. Use ?a=#RRGGBB&b=#RRGGBB&ratio=0.5'
    });
  }

  const ratio = Number.isFinite(ratioRaw) ? Math.min(1, Math.max(0, ratioRaw)) : 0.5;

  const rgbA = hexToRgb(a);
  const rgbB = hexToRgb(b);

  const hslA = rgbToHsl(rgbA);
  const hslB = rgbToHsl(rgbB);

  function interpolateHue(h1: number, h2: number, t: number): number {
    let diff = h2 - h1;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    let h = h1 + diff * t;
    if (h < 0) h += 360;
    if (h >= 360) h -= 360;
    return Math.round(h);
  }

  const mixedHsl = {
    h: interpolateHue(hslA.h, hslB.h, ratio),
    s: Math.round(hslA.s + (hslB.s - hslA.s) * ratio),
    l: Math.round(hslA.l + (hslB.l - hslA.l) * ratio)
  };

  const mixedRgb = hslToRgb(mixedHsl);
  const mixedHexRgb = mixRgb(rgbA, rgbB, ratio);

  return {
    inputs: { a, b, ratio },
    mixed: {
      hex: rgbToHex(mixedRgb),
      rgb: mixedRgb,
      method: 'hsl'
    },
    mixedRgb: {
      hex: rgbToHex(mixedRgb),
      rgb: mixedRgb,
      method: 'rgb-linear'
    }
  };
});
