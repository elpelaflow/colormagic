/**
 * Generador de paletas "Color Palette Creator" — port 1:1 de la lógica de
 * pro-color-harmonies v0.11.0 (meodai, MIT).
 *
 * La copia literal de la librería original vive en
 * utils/__tests__/reference/pro-color-harmonies/ (verificada por md5 contra
 * el tag v0.11.0). Este archivo es la traducción directa de:
 *   - src/index.ts            (tipos + ColorPaletteGenerator + 5 ensambladores)
 *   - src/utils/color.ts      (clampOKLCH, avoidMuddyZones, safeColor)
 *   - src/utils/palette.ts    (createPaletteGenerator, neutral palette)
 *   - src/utils/hue-strategies.ts
 *   - src/utils/variations.ts
 *   - src/utils/enhancer.ts   (ChromaNarrative + ColorHierarchy + polish)
 *   - src/utils/modifiers.ts
 *   - src/utils/tintsShades.ts
 *   - src/utils/demo-palette.ts (extendPalette -> expandPalette)
 *
 * La paridad numérica (tolerancia 0.0005 por componente l/c/h) se mantiene con
 * utils/__tests__/palette-parity.test.ts:
 *   node --experimental-strip-types layers/color-palette-creator/utils/__tests__/palette-parity.test.ts
 *
 * Única divergencia deliberada: `clampToGamut` — ver PARITY-REPORT.md (la UI
 * lo usa en true; el original lo tiene off por defecto).
 */

import {
  clampChroma,
  hexToOklch,
  lerp,
  normalizeHue,
  oklchToHex,
  oklchToOklab,
  type Oklch
} from './oklch.util';

export type PaletteStyle = 'default' | 'square' | 'triangle' | 'circle' | 'diamond';
export type PaletteType =
  | 'analogous'
  | 'complementary'
  | 'triadic'
  | 'tetradic'
  | 'splitComplementary'
  | 'tintsShades';

/** Los 5 tipos de armonia (todo menos tintsShades, que es autonomo). */
export type HarmonyType = Exclude<PaletteType, 'tintsShades'>;

export interface PaletteModifiers {
  sine?: number
  wave?: number
  zap?: number
  block?: number
  // Rango real: -1 a 1. 0 desactiva el efecto. Negativo invierte la direccion.
}

export interface GeneratorOptions {
  /** The geometric style to use for hue calculation */
  style: PaletteStyle
  /** Optional modifiers to apply to the generated palette */
  modifiers?: PaletteModifiers
  /** Whether to interpolate variations for smooth transitions */
  interpolation?: boolean
  /**
   * Clamp the generated colors into sRGB by reducing chroma (lightness and hue
   * are preserved). Off by default (como en el original): los valores OKLCH
   * crudos pueden quedar fuera de gamut, lo que es fino para CSS `oklch()`
   * pero clipea con corrimientos de hue al convertir a hex en JS.
   */
  clampToGamut?: boolean
}

export const OKLCH_LIMITS = {
  l: { min: 0.01, max: 0.99 },
  c: { min: 0, max: 0.37 },
  h: { min: 0, max: 360 }
};

/** Chroma below this value is treated as achromatic (gray) input. */
export const ACHROMATIC_CHROMA_THRESHOLD = 0.002;

export const PALETTE_TYPES: PaletteType[] = [
  'analogous',
  'complementary',
  'triadic',
  'tetradic',
  'splitComplementary',
  'tintsShades'
];

// ---------------------------------------------------------------------------
// src/utils/color.ts
// ---------------------------------------------------------------------------

/** Normalize hue to 0-360 range (delegada a oklch.util). */
export { normalizeHue };

/**
 * Clamp OKLCH values to valid ranges. El hue se devuelve tal cual (el original
 * no lo normaliza aquí; todas las llamadas lo pasan ya normalizado).
 */
export function clampOKLCH(l: number, c: number, h: number): Oklch {
  return {
    l: Math.max(OKLCH_LIMITS.l.min, Math.min(OKLCH_LIMITS.l.max, l)),
    c: Math.max(OKLCH_LIMITS.c.min, Math.min(OKLCH_LIMITS.c.max, c)),
    h
  };
}

/**
 * Avoid muddy zones in the color space by shifting hue away from problematic
 * areas. Zonas "feas": marrón-oliva [25,65], verde enfermizo [100,140], cian
 * cadaver [180,200]. Primera zona que matchea gana.
 */
export function avoidMuddyZones(hue: number, lightness: number, chroma: number): Oklch {
  const mudZones = [
    { range: [25, 65], name: 'brown-olive' },
    { range: [100, 140], name: 'sick-green' },
    { range: [180, 200], name: 'corpse-cyan' }
  ];

  for (const zone of mudZones) {
    if (hue >= zone.range[0] && hue <= zone.range[1]) {
      if (chroma < 0.15) {
        // Muy apagado: neutral sofisticado
        return clampOKLCH(lightness, chroma * 0.5, hue);
      }
      // Empujar mas alla del borde de la zona (el hue sale de la zona)
      const escapeMargin = 10;
      const pushDirection = hue > (zone.range[0] + zone.range[1]) / 2 ? 1 : -1;
      const newHue = normalizeHue(
        pushDirection === 1 ? zone.range[1] + escapeMargin : zone.range[0] - escapeMargin
      );
      // Boost de chroma para escapar del barro
      return clampOKLCH(lightness, chroma * 1.1, newHue);
    }
  }

  return clampOKLCH(lightness, chroma, hue);
}

/** Builds a color, avoiding muddy zones when enhanced mode is on. */
export function safeColor(hue: number, lightness: number, chroma: number, enhanced: boolean): Oklch {
  if (!enhanced) return { l: lightness, c: chroma, h: hue };
  return avoidMuddyZones(hue, lightness, chroma);
}

// ---------------------------------------------------------------------------
// src/utils/palette.ts — resolvePaletteStyle / isAchromatic / neutral
// ---------------------------------------------------------------------------

/** 'default' es un alias de 'square': producen paletas identicas. */
export function resolvePaletteStyle(style: PaletteStyle): Exclude<PaletteStyle, 'default'> {
  return style === 'default' ? 'square' : style;
}

/** Whether a color is effectively achromatic (a gray). */
export function isAchromatic(color: Oklch): boolean {
  return color.c < ACHROMATIC_CHROMA_THRESHOLD;
}

/**
 * Rampa neutral para input acromatico: el base primero, luego la rampa con el
 * slot mas cercano a su lightness quitado.
 */
export function generateNeutralPalette(base: Oklch): Oklch[] {
  const ramp = [0.2, 0.35, 0.5, 0.65, 0.8, 0.95];

  const nearestIndex = ramp.reduce(
    (best, l, i) => (Math.abs(l - base.l) < Math.abs(ramp[best] - base.l) ? i : best),
    0
  );

  return [
    { l: base.l, c: base.c, h: base.h },
    ...ramp
      .filter((_, i) => i !== nearestIndex)
      .map((l) => ({ l, c: base.c, h: base.h }))
  ];
}

// ---------------------------------------------------------------------------
// src/utils/interpolation.ts — interpolateDeep
// ---------------------------------------------------------------------------

/** Deep interpolation between two objects or numbers. */
export function interpolateDeep<T>(start: T, end: T, amt: number): T {
  if (typeof start === 'number' && typeof end === 'number') {
    return lerp(amt, start, end) as unknown as T;
  }

  if (typeof start === 'object' && start !== null && typeof end === 'object' && end !== null) {
    if (Array.isArray(start) && Array.isArray(end)) {
      return start.map((val, i) => interpolateDeep(val, end[i], amt)) as unknown as T;
    }

    const result = {} as T;
    for (const key in start) {
      if (Object.prototype.hasOwnProperty.call(start, key)) {
        (result as Record<string, unknown>)[key] = interpolateDeep(
          (start as Record<string, unknown>)[key],
          (end as Record<string, unknown>)[key],
          amt
        );
      }
    }
    return result;
  }

  return start;
}

// ---------------------------------------------------------------------------
// src/utils/hue-strategies.ts
// ---------------------------------------------------------------------------

/** Calculates the complementary hue based on the selected style. */
export const getComplementaryHue = (base: Oklch, style: PaletteStyle): number => {
  const { h: hue, l: lightness, c: chroma } = base;

  switch (style) {
    case 'triangle':
      if (hue < 30) return 170 + hue * 0.3;
      if (hue < 90) return 240 + (hue - 30) * 0.5;
      if (hue < 150) return 320 + (hue - 90) * 0.6;
      if (hue < 210) return 20 + (hue - 150) * 0.4;
      if (hue < 270) return 40 + (hue - 210) * 0.3;
      return 90 + (hue - 270) * 0.4;
    case 'circle':
      if (hue >= 345 || hue < 30) return 180 + Math.sin((hue * Math.PI) / 180) * 20;
      if (hue < 90) return 240 + (chroma * lightness) * 30;
      if (hue < 150) return 320 + (hue - 90) * 0.5;
      if (hue < 210) return 30 + Math.cos((hue * Math.PI) / 180) * 15;
      if (hue < 270) return 50 + (270 - hue) * 0.4;
      return 100 + Math.sin(((hue - 270) * Math.PI) / 90) * 25;
    case 'diamond':
      if (lightness > 0.8 && chroma < 0.3) return normalizeHue(hue + 200);
      if (hue >= 30 && hue < 90 && lightness > 0.6) return 240 + (hue - 30) * 0.3;
      if (hue >= 180 && hue < 240 && lightness < 0.5) return 40 + (hue - 180) * 0.4;
      if (chroma > 0.8 && lightness < 0.4) {
        return hue < 180 ? normalizeHue(hue + 160) : normalizeHue(hue + 200);
      }
      if (hue >= 270 && hue < 330) return 90 + (hue - 270) * 0.6;
      return normalizeHue(hue + 180 + (lightness * 20 - 10));
    case 'square':
    default:
      return normalizeHue(hue + 180);
  }
};

/** Calculates analogous hues based on the selected style. */
export const getAnalogousHues = (base: Oklch, style: PaletteStyle): number[] => {
  const { h: hue, l: lightness, c: chroma } = base;

  switch (style) {
    case 'triangle':
      if (hue < 30) return [0, -15, -8, 8, 20, 35].map((d) => normalizeHue(hue + d));
      if (hue < 90) {
        if (hue < 50) return [0, -25, -12, 10, 20, 30].map((d) => normalizeHue(hue + d));
        return [0, -20, -10, 8, 18, 30].map((d) => normalizeHue(hue + d));
      }
      if (hue < 180) return [0, -25, -12, 10, 20, 35].map((d) => normalizeHue(hue + d));
      if (hue < 240) return [0, -20, -10, 8, 18, 30].map((d) => normalizeHue(hue + d));
      return [0, -25, -12, 10, 20, 35].map((d) => normalizeHue(hue + d));
    case 'circle':
      if (hue >= 345 || hue < 30) return [0, -20, -10, 8, 18, 30].map((d) => normalizeHue(hue + d));
      if (hue >= 30 && hue < 90) return [0, -25, -12, 10, 20, 35].map((d) => normalizeHue(hue + d));
      if (hue >= 90 && hue < 150) return [0, -22, -10, 10, 20, 35].map((d) => normalizeHue(hue + d));
      if (hue >= 150 && hue < 210) return [0, -20, -10, 8, 18, 30].map((d) => normalizeHue(hue + d));
      if (hue >= 210 && hue < 270) return [0, -25, -12, 10, 20, 35].map((d) => normalizeHue(hue + d));
      return [0, -20, -10, 10, 20, 35].map((d) => normalizeHue(hue + d));
    case 'diamond':
      if (lightness > 0.8 && chroma < 0.3) return [0, -22, -10, 8, 18, 30].map((d) => normalizeHue(hue + d));
      if (hue >= 30 && hue < 90 && lightness > 0.6) return [0, -20, -10, 8, 18, 30].map((d) => normalizeHue(hue + d));
      if (hue >= 180 && hue < 240 && lightness < 0.5) return [0, -25, -12, 10, 20, 35].map((d) => normalizeHue(hue + d));
      if (chroma > 0.8 && lightness < 0.4) return [0, -35, -18, 15, 28, 45].map((d) => normalizeHue(hue + d));
      if (hue >= 270 && hue < 330) return [0, -30, -15, 12, 25, 40].map((d) => normalizeHue(hue + d));
      return [0, -22, -10, 8, 18, 30].map((d) => normalizeHue(hue + d));
    case 'square':
    default:
      return [0, -30, -20, -10, 15, 30].map((d) => normalizeHue(hue + d));
  }
};

/** Calculates triadic hues based on the selected style. */
export const getTriadicHues = (base: Oklch, style: PaletteStyle): number[] => {
  const { h: hue, l: lightness, c: chroma } = base;

  switch (style) {
    case 'triangle':
      if (hue < 60) return [hue, normalizeHue(hue + 125), normalizeHue(hue + 235)];
      if (hue < 120) return [hue, normalizeHue(hue + 135), normalizeHue(hue + 225)];
      if (hue < 180) return [hue, normalizeHue(hue + 115), normalizeHue(hue + 245)];
      if (hue < 240) return [hue, normalizeHue(hue + 120), normalizeHue(hue + 240)];
      if (hue < 300) return [hue, normalizeHue(hue + 115), normalizeHue(hue + 245)];
      return [hue, normalizeHue(hue + 125), normalizeHue(hue + 235)];
    case 'circle':
      if (hue >= 345 || hue < 30) return [hue, normalizeHue(hue + 130), normalizeHue(hue + 230)];
      if (hue >= 30 && hue < 90) {
        const i = chroma * lightness;
        return [hue, normalizeHue(hue + 120 + i * 15), normalizeHue(hue + 240 - i * 10)];
      }
      if (hue >= 90 && hue < 150) return [hue, normalizeHue(hue + 125), normalizeHue(hue + 235)];
      if (hue >= 150 && hue < 210) return [hue, normalizeHue(hue + 115), normalizeHue(hue + 245)];
      if (hue >= 210 && hue < 270) return [hue, normalizeHue(hue + 130), normalizeHue(hue + 230)];
      return [hue, normalizeHue(hue + 120), normalizeHue(hue + 240)];
    case 'diamond':
      if (lightness > 0.8 && chroma < 0.3) return [hue, normalizeHue(hue + 125), normalizeHue(hue + 235)];
      if (hue >= 30 && hue < 90 && lightness > 0.6) return [hue, normalizeHue(hue + 110), normalizeHue(hue + 250)];
      if (hue >= 180 && hue < 240 && lightness < 0.5) return [hue, normalizeHue(hue + 130), normalizeHue(hue + 230)];
      if (chroma > 0.8 && lightness < 0.4) {
        return hue < 180
          ? [hue, normalizeHue(hue + 115), normalizeHue(hue + 245)]
          : [hue, normalizeHue(hue + 125), normalizeHue(hue + 235)];
      }
      if (hue >= 270 && hue < 330) return [hue, normalizeHue(hue + 135), normalizeHue(hue + 225)];
      const inf = (lightness - 0.5) * 15;
      return [hue, normalizeHue(hue + 120 + inf), normalizeHue(hue + 240 - inf)];
    case 'square':
    default:
      return [hue, normalizeHue(hue + 120), normalizeHue(hue + 240)];
  }
};

/** Calculates tetradic hues based on the selected style. */
export const getTetradicHues = (base: Oklch, style: PaletteStyle): number[] => {
  const { h: hue, l: lightness, c: chroma } = base;

  switch (style) {
    case 'triangle':
      if (hue < 45) return [0, 75, 165, 255].map((d) => normalizeHue(hue + d));
      if (hue < 90) return [0, 105, 195, 285].map((d) => normalizeHue(hue + d));
      if (hue < 135) return [0, 85, 175, 265].map((d) => normalizeHue(hue + d));
      if (hue < 180) return [0, 80, 170, 280].map((d) => normalizeHue(hue + d));
      if (hue < 225) return [0, 85, 175, 275].map((d) => normalizeHue(hue + d));
      if (hue < 270) return [0, 90, 180, 270].map((d) => normalizeHue(hue + d));
      if (hue < 315) return [0, 95, 185, 275].map((d) => normalizeHue(hue + d));
      return [0, 85, 165, 255].map((d) => normalizeHue(hue + d));
    case 'circle':
      if (hue >= 345 || hue < 30) return [0, 75, 165, 255].map((d) => normalizeHue(hue + d));
      if (hue < 90) {
        const i = chroma * lightness;
        return [hue, normalizeHue(hue + 90 + i * 10), normalizeHue(hue + 180), normalizeHue(hue + 270 - i * 5)];
      }
      if (hue < 150) return [0, 85, 175, 265].map((d) => normalizeHue(hue + d));
      if (hue < 210) return [0, 80, 170, 280].map((d) => normalizeHue(hue + d));
      if (hue < 270) return [0, 95, 185, 275].map((d) => normalizeHue(hue + d));
      return [0, 90, 180, 270].map((d) => normalizeHue(hue + d));
    case 'diamond':
      if (lightness > 0.8 && chroma < 0.3) return [0, 85, 185, 275].map((d) => normalizeHue(hue + d));
      if (hue >= 30 && hue < 90 && lightness > 0.6) return [0, 70, 160, 250].map((d) => normalizeHue(hue + d));
      if (hue >= 180 && hue < 240 && lightness < 0.5) return [0, 95, 175, 285].map((d) => normalizeHue(hue + d));
      if (chroma > 0.8 && lightness < 0.4) {
        const wc = hue < 180 ? 1 : -1;
        return [hue, normalizeHue(hue + 80 * wc), normalizeHue(hue + 160), normalizeHue(hue + 260 * wc)];
      }
      if (hue >= 270 && hue < 330) return [0, 100, 200, 280].map((d) => normalizeHue(hue + d));
      const inf = (lightness - 0.5) * 20;
      return [hue, normalizeHue(hue + 90 + inf), normalizeHue(hue + 180), normalizeHue(hue + 270 - inf)];
    case 'square':
    default:
      return [0, 90, 180, 270].map((d) => normalizeHue(hue + d));
  }
};

/** Calculates split complementary hues based on the selected style. */
export const getSplitComplementaryHues = (base: Oklch, style: PaletteStyle): number[] => {
  const { h: hue, l: lightness, c: chroma } = base;

  switch (style) {
    case 'triangle':
      if (hue < 45) return [hue, normalizeHue(hue + 155), normalizeHue(hue + 185)];
      if (hue < 90) return [hue, normalizeHue(hue + 165), normalizeHue(hue + 205)];
      if (hue < 135) return [hue, normalizeHue(hue + 170), normalizeHue(hue + 210)];
      if (hue < 180) return [hue, normalizeHue(hue + 160), normalizeHue(hue + 200)];
      if (hue < 225) return [hue, normalizeHue(hue + 150), normalizeHue(hue + 190)];
      if (hue < 270) return [hue, normalizeHue(hue + 145), normalizeHue(hue + 175)];
      if (hue < 315) return [hue, normalizeHue(hue + 135), normalizeHue(hue + 165)];
      return [hue, normalizeHue(hue + 125), normalizeHue(hue + 155)];
    case 'circle':
      if (hue >= 345 || hue < 30) return [hue, normalizeHue(hue + 165), normalizeHue(hue + 195)];
      if (hue >= 30 && hue < 90) {
        const i = chroma * lightness;
        return [hue, normalizeHue(hue + 160 + i * 15), normalizeHue(hue + 200 + i * 10)];
      }
      if (hue < 150) return [hue, normalizeHue(hue + 170), normalizeHue(hue + 210)];
      if (hue < 210) return [hue, normalizeHue(hue + 155), normalizeHue(hue + 185)];
      if (hue < 270) return [hue, normalizeHue(hue + 145), normalizeHue(hue + 175)];
      return [hue, normalizeHue(hue + 135), normalizeHue(hue + 165)];
    case 'diamond':
      if (lightness > 0.8 && chroma < 0.3) return [hue, normalizeHue(hue + 170), normalizeHue(hue + 190)];
      if (hue >= 30 && hue < 90 && lightness > 0.6) return [hue, normalizeHue(hue + 160), normalizeHue(hue + 190)];
      if (hue >= 180 && hue < 240 && lightness < 0.5) return [hue, normalizeHue(hue + 140), normalizeHue(hue + 170)];
      if (chroma > 0.8 && lightness < 0.4) {
        return [hue, normalizeHue(hue + 150), normalizeHue(hue + 210)];
      }
      if (hue >= 270 && hue < 330) return [hue, normalizeHue(hue + 120), normalizeHue(hue + 160)];
      const inf = lightness * 15 - 7.5;
      return [hue, normalizeHue(hue + 165 + inf), normalizeHue(hue + 195 - inf)];
    case 'square':
    default: {
      const c = normalizeHue(hue + 180);
      return [hue, normalizeHue(c - 30), normalizeHue(c + 30)];
    }
  }
};

// ---------------------------------------------------------------------------
// src/utils/variations.ts
// ---------------------------------------------------------------------------

type Variation = { l: number; c: number };

type TriadVariations = {
  base: { dark: Variation }
  triad: {
    first: { pure: Variation; muted: Variation }
    second: { pure: Variation; muted: Variation }
  }
};

type ComplementaryVariations = {
  base: { dark: Variation; light: Variation }
  complement: { main: Variation; light: Variation; muted: Variation }
};

type AnalogousVariations = Variation[];

type TetradicVariations = {
  first: { pure: Variation; muted: Variation }
  complement: Variation
  fourth: { light: Variation; dark: Variation }
};

type SplitComplementaryVariations = {
  base: { dark: Variation }
  complement: {
    first: { pure: Variation; muted: Variation }
    second: { pure: Variation; muted: Variation }
  }
};

/** Adaptive lightness and chroma variations for triadic palettes. */
export const getTriadicVariations = (base: Oklch, style: PaletteStyle, interpolate = false): TriadVariations => {
  const { l: baseLightness, c: baseChroma, h: baseHue } = base;

  const getDefault = (l: number) => {
    const targetRange = { min: 0.15, max: 0.9 };
    let baseVariations: { dark: Variation };
    let triadVariations: TriadVariations['triad'];

    if (l < 0.3) {
      baseVariations = { dark: { l: Math.max(-0.1, targetRange.min - l), c: 1.0 } };
      triadVariations = {
        first: { pure: { l: 0.2, c: 0.95 }, muted: { l: 0.35, c: 0.7 } },
        second: { pure: { l: 0.15, c: 0.95 }, muted: { l: 0.3, c: 0.7 } }
      };
    } else if (l > 0.7) {
      baseVariations = { dark: { l: Math.max(-0.4, targetRange.min - l), c: 1.1 } };
      triadVariations = {
        first: { pure: { l: -0.2, c: 0.95 }, muted: { l: -0.35, c: 0.7 } },
        second: { pure: { l: -0.25, c: 0.95 }, muted: { l: -0.15, c: 0.7 } }
      };
    } else {
      baseVariations = { dark: { l: -0.2, c: 1.1 } };
      triadVariations = {
        first: { pure: { l: 0.1, c: 0.95 }, muted: { l: 0.2, c: 0.7 } },
        second: { pure: { l: -0.1, c: 0.95 }, muted: { l: -0.2, c: 0.7 } }
      };
    }
    return { base: baseVariations, triad: triadVariations };
  };

  if (style === 'triangle') {
    const getTriangle = (l: number) => {
      const mod = l < 0.4 ? 0.1 : l > 0.6 ? -0.1 : 0;
      return {
        base: { dark: { l: Math.max(-0.18 + mod, -0.3), c: 1.0 } },
        triad: {
          first: { pure: { l: 0.05 - mod, c: 0.9 }, muted: { l: 0.12 - mod, c: 0.65 } },
          second: { pure: { l: -0.02 - mod, c: 0.92 }, muted: { l: -0.08 - mod, c: 0.68 } }
        }
      };
    };

    if (interpolate) {
      const width = 0.1;
      if (baseLightness >= 0.4 - width / 2 && baseLightness <= 0.4 + width / 2) {
        const t = (baseLightness - (0.4 - width / 2)) / width;
        return interpolateDeep(getTriangle(0.35), getTriangle(0.45), t);
      }
      if (baseLightness >= 0.6 - width / 2 && baseLightness <= 0.6 + width / 2) {
        const t = (baseLightness - (0.6 - width / 2)) / width;
        return interpolateDeep(getTriangle(0.55), getTriangle(0.65), t);
      }
    }
    return getTriangle(baseLightness);
  } else if (style === 'circle') {
    const mod = baseLightness < 0.4 ? 0.15 : baseLightness > 0.6 ? -0.15 : 0;
    if (baseHue >= 345 || baseHue < 30) {
      return {
        base: { dark: { l: Math.max(-0.25 + mod, -0.35), c: 1.2 } },
        triad: {
          first: { pure: { l: 0.08 - mod, c: 0.85 }, muted: { l: 0.15 - mod, c: 0.6 } },
          second: { pure: { l: 0.05 - mod, c: 0.9 }, muted: { l: -0.05 - mod, c: 0.65 } }
        }
      };
    } else if (baseHue >= 150 && baseHue < 210) {
      return {
        base: { dark: { l: Math.max(-0.15 + mod, -0.25), c: 0.9 } },
        triad: {
          first: { pure: { l: 0.1 - mod, c: 0.9 }, muted: { l: 0.18 - mod, c: 0.7 } },
          second: { pure: { l: 0.05 - mod, c: 0.85 }, muted: { l: -0.08 - mod, c: 0.6 } }
        }
      };
    }
  } else if (style === 'diamond') {
    if (baseLightness > 0.8 && baseChroma < 0.3) {
      return {
        base: { dark: { l: Math.max(-0.25, 0.15 - baseLightness), c: 1.0 } },
        triad: {
          first: { pure: { l: -0.05, c: 0.85 }, muted: { l: 0.1, c: 0.6 } },
          second: { pure: { l: -0.15, c: 0.8 }, muted: { l: -0.25, c: 0.5 } }
        }
      };
    } else if (baseChroma > 0.8 && baseLightness < 0.4) {
      return {
        base: { dark: { l: Math.max(-0.2, 0.15 - baseLightness), c: 1.3 } },
        triad: {
          first: { pure: { l: 0.25, c: 1.0 }, muted: { l: 0.15, c: 0.8 } },
          second: { pure: { l: 0.35, c: 1.1 }, muted: { l: 0.1, c: 0.75 } }
        }
      };
    }
  }

  if (interpolate) {
    const width = 0.1;
    if (baseLightness >= 0.3 - width / 2 && baseLightness <= 0.3 + width / 2) {
      const t = (baseLightness - (0.3 - width / 2)) / width;
      return interpolateDeep(getDefault(0.25), getDefault(0.35), t);
    }
    if (baseLightness >= 0.7 - width / 2 && baseLightness <= 0.7 + width / 2) {
      const t = (baseLightness - (0.7 - width / 2)) / width;
      return interpolateDeep(getDefault(0.65), getDefault(0.75), t);
    }
  }

  return getDefault(baseLightness);
};

/** Adaptive lightness and chroma variations for complementary palettes. */
export const getComplementaryVariations = (base: Oklch, style: PaletteStyle, interpolate = false): ComplementaryVariations => {
  const { l: baseLightness, c: baseChroma, h: baseHue } = base;

  const getDefault = (l: number) => {
    const targetRange = { min: 0.15, max: 0.9 };
    if (l < 0.3) {
      return {
        base: {
          dark: { l: Math.max(-0.1, targetRange.min - l), c: 1.0 },
          light: { l: Math.min(0.4, targetRange.max - l), c: 0.8 }
        },
        complement: {
          main: { l: 0.2, c: 1.0 },
          light: { l: 0.35, c: 0.7 },
          muted: { l: 0.1, c: 0.5 }
        }
      };
    } else if (l > 0.7) {
      return {
        base: {
          dark: { l: Math.max(-0.4, targetRange.min - l), c: 1.1 },
          light: { l: Math.min(0.1, targetRange.max - l), c: 0.8 }
        },
        complement: {
          main: { l: -0.2, c: 1.0 },
          light: { l: -0.1, c: 0.8 },
          muted: { l: -0.3, c: 0.6 }
        }
      };
    } else {
      return {
        base: {
          dark: { l: -0.2, c: 1.1 },
          light: { l: 0.2, c: 0.8 }
        },
        complement: {
          main: { l: 0.05, c: 1.0 },
          light: { l: 0.25, c: 0.7 },
          muted: { l: -0.15, c: 0.5 }
        }
      };
    }
  };

  if (style === 'triangle') {
    const getTriangle = (l: number) => {
      const mod = l < 0.4 ? 0.1 : l > 0.6 ? -0.1 : 0;
      return {
        base: {
          dark: { l: Math.max(-0.2 + mod, -0.3), c: 0.9 },
          light: { l: Math.min(0.15 + mod, 0.3), c: 0.7 }
        },
        complement: {
          main: { l: 0.05 - mod, c: 1.0 },
          light: { l: 0.2 - mod, c: 0.75 },
          muted: { l: -0.1 - mod, c: 0.5 }
        }
      };
    };

    if (interpolate) {
      const width = 0.1;
      if (baseLightness >= 0.4 - width / 2 && baseLightness <= 0.4 + width / 2) {
        const t = (baseLightness - (0.4 - width / 2)) / width;
        return interpolateDeep(getTriangle(0.35), getTriangle(0.45), t);
      }
      if (baseLightness >= 0.6 - width / 2 && baseLightness <= 0.6 + width / 2) {
        const t = (baseLightness - (0.6 - width / 2)) / width;
        return interpolateDeep(getTriangle(0.55), getTriangle(0.65), t);
      }
    }
    return getTriangle(baseLightness);
  } else if (style === 'circle') {
    const mod = baseLightness < 0.4 ? 0.15 : baseLightness > 0.6 ? -0.15 : 0;
    if (baseHue >= 345 || baseHue < 30) {
      return {
        base: {
          dark: { l: Math.max(-0.25 + mod, -0.4), c: 1.2 },
          light: { l: Math.min(0.1 + mod, 0.3), c: 0.8 }
        },
        complement: {
          main: { l: 0.15 - mod, c: 0.9 },
          light: { l: 0.3 - mod, c: 0.6 },
          muted: { l: -0.05 - mod, c: 0.5 }
        }
      };
    } else if (baseHue >= 150 && baseHue < 210) {
      return {
        base: {
          dark: { l: Math.max(-0.15 + mod, -0.3), c: 0.8 },
          light: { l: Math.min(0.15 + mod, 0.25), c: 0.5 }
        },
        complement: {
          main: { l: 0.1 - mod, c: 1.0 },
          light: { l: 0.25 - mod, c: 0.85 },
          muted: { l: -0.05 - mod, c: 0.6 }
        }
      };
    }
  } else if (style === 'diamond') {
    if (baseLightness > 0.8 && baseChroma < 0.3) {
      return {
        base: {
          dark: { l: Math.max(-0.3, 0.15 - baseLightness), c: 1.0 },
          light: { l: Math.min(0.05, 0.9 - baseLightness), c: 0.7 }
        },
        complement: {
          main: { l: -0.1, c: 0.9 },
          light: { l: 0.05, c: 0.7 },
          muted: { l: -0.25, c: 0.4 }
        }
      };
    } else if (baseChroma > 0.8 && baseLightness < 0.4) {
      return {
        base: {
          dark: { l: Math.max(-0.25, 0.15 - baseLightness), c: 1.3 },
          light: { l: Math.min(0.3, 0.8 - baseLightness), c: 0.9 }
        },
        complement: {
          main: { l: 0.25, c: 1.2 },
          light: { l: 0.4, c: 0.9 },
          muted: { l: 0.1, c: 0.6 }
        }
      };
    }
  }

  if (interpolate) {
    const width = 0.1;
    if (baseLightness >= 0.3 - width / 2 && baseLightness <= 0.3 + width / 2) {
      const t = (baseLightness - (0.3 - width / 2)) / width;
      return interpolateDeep(getDefault(0.25), getDefault(0.35), t);
    }
    if (baseLightness >= 0.7 - width / 2 && baseLightness <= 0.7 + width / 2) {
      const t = (baseLightness - (0.7 - width / 2)) / width;
      return interpolateDeep(getDefault(0.65), getDefault(0.75), t);
    }
  }

  return getDefault(baseLightness);
};

/** Adaptive lightness and chroma variations for analogous palettes. */
export const getAnalogousVariations = (base: Oklch, style: PaletteStyle, interpolate = false): AnalogousVariations => {
  const { l: baseLightness, h: baseHue } = base;

  const getDefault = (l: number) => {
    if (l < 0.3) {
      return [
        { l: 0, c: 1.0 },
        { l: 0.25, c: 0.8 },
        { l: 0.1, c: 0.9 },
        { l: 0.35, c: 0.85 },
        { l: 0.45, c: 0.7 },
        { l: 0.55, c: 0.6 }
      ];
    } else if (l > 0.7) {
      return [
        { l: 0, c: 1.0 },
        { l: -0.35, c: 0.8 },
        { l: -0.2, c: 0.9 },
        { l: -0.45, c: 0.85 },
        { l: -0.1, c: 0.7 },
        { l: 0.05, c: 0.6 }
      ];
    } else {
      return [
        { l: 0, c: 1.0 },
        { l: -0.2, c: 0.8 },
        { l: -0.1, c: 0.9 },
        { l: 0.15, c: 0.85 },
        { l: 0.25, c: 0.7 },
        { l: 0.35, c: 0.6 }
      ];
    }
  };

  if (style === 'triangle') {
    const getTriangle = (l: number) => {
      const mod = l < 0.4 ? 0.15 : l > 0.6 ? -0.15 : 0;
      return [
        { l: 0, c: 1.0 },
        { l: Math.max(-0.2 + mod, -0.35), c: 0.65 },
        { l: -0.08 + mod, c: 0.85 },
        { l: 0.06 + mod, c: 0.95 },
        { l: Math.min(0.18 + mod, 0.4), c: 0.75 },
        { l: Math.min(0.32 + mod, 0.5), c: 0.5 }
      ];
    };

    if (interpolate) {
      const width = 0.1;
      if (baseLightness >= 0.4 - width / 2 && baseLightness <= 0.4 + width / 2) {
        const t = (baseLightness - (0.4 - width / 2)) / width;
        return interpolateDeep(getTriangle(0.35), getTriangle(0.45), t);
      }
      if (baseLightness >= 0.6 - width / 2 && baseLightness <= 0.6 + width / 2) {
        const t = (baseLightness - (0.6 - width / 2)) / width;
        return interpolateDeep(getTriangle(0.55), getTriangle(0.65), t);
      }
    }
    return getTriangle(baseLightness);
  } else if (style === 'circle') {
    const mod = baseLightness < 0.4 ? 0.2 : baseLightness > 0.6 ? -0.2 : 0;
    if (baseHue >= 345 || baseHue < 30) {
      return [
        { l: 0, c: 1.0 },
        { l: Math.max(-0.25 + mod, -0.4), c: 1.1 },
        { l: -0.08 + mod, c: 1.0 },
        { l: 0.05 + mod, c: 0.95 },
        { l: Math.min(0.15 + mod, 0.35), c: 0.85 },
        { l: Math.min(0.3 + mod, 0.5), c: 0.6 }
      ];
    } else if (baseHue >= 150 && baseHue < 210) {
      return [
        { l: 0, c: 1.0 },
        { l: Math.max(-0.18 + mod, -0.35), c: 0.7 },
        { l: -0.06 + mod, c: 0.85 },
        { l: 0.08 + mod, c: 0.9 },
        { l: Math.min(0.2 + mod, 0.4), c: 0.7 },
        { l: Math.min(0.35 + mod, 0.55), c: 0.45 }
      ];
    }
  } else if (style === 'diamond') {
    if (baseHue >= 30 && baseHue < 90 && baseLightness > 0.6) {
      return [
        { l: 0, c: 1.0 },
        { l: Math.max(-0.3, 0.15 - baseLightness), c: 0.6 },
        { l: -0.12, c: 0.8 },
        { l: Math.min(0.08, 0.85 - baseLightness), c: 1.05 },
        { l: Math.min(0.22, 0.9 - baseLightness), c: 0.95 },
        { l: Math.min(0.3, 0.9 - baseLightness), c: 0.75 }
      ];
    } else if (baseHue >= 180 && baseHue < 240 && baseLightness < 0.5) {
      return [
        { l: 0, c: 1.0 },
        { l: Math.max(-0.2, 0.15 - baseLightness), c: 0.5 },
        { l: -0.08, c: 0.7 },
        { l: 0.1, c: 0.85 },
        { l: 0.25, c: 0.65 },
        { l: 0.35, c: 0.45 }
      ];
    }
  }

  if (interpolate) {
    const width = 0.1;
    if (baseLightness >= 0.3 - width / 2 && baseLightness <= 0.3 + width / 2) {
      const t = (baseLightness - (0.3 - width / 2)) / width;
      return interpolateDeep(getDefault(0.25), getDefault(0.35), t);
    }
    if (baseLightness >= 0.7 - width / 2 && baseLightness <= 0.7 + width / 2) {
      const t = (baseLightness - (0.7 - width / 2)) / width;
      return interpolateDeep(getDefault(0.65), getDefault(0.75), t);
    }
  }

  return getDefault(baseLightness);
};

/** Adaptive lightness and chroma variations for tetradic palettes. */
export const getTetradicVariations = (base: Oklch, style: PaletteStyle, interpolate = false): TetradicVariations => {
  const { l: baseLightness, c: baseChroma, h: baseHue } = base;

  const getDefault = (l: number) => {
    if (l < 0.3) {
      return {
        first: { pure: { l: 0.25, c: 0.9 }, muted: { l: 0.1, c: 0.6 } },
        complement: { l: 0.35, c: 0.95 },
        fourth: { light: { l: 0.45, c: 0.8 }, dark: { l: 0.15, c: 1.1 } }
      };
    } else if (l > 0.7) {
      return {
        first: { pure: { l: -0.25, c: 0.9 }, muted: { l: -0.4, c: 0.6 } },
        complement: { l: -0.35, c: 0.95 },
        fourth: { light: { l: -0.15, c: 0.8 }, dark: { l: -0.45, c: 1.1 } }
      };
    } else {
      return {
        first: { pure: { l: 0.1, c: 0.9 }, muted: { l: -0.15, c: 0.6 } },
        complement: { l: 0.05, c: 0.95 },
        fourth: { light: { l: 0.2, c: 0.8 }, dark: { l: -0.25, c: 1.1 } }
      };
    }
  };

  if (style === 'triangle') {
    const getTriangle = (l: number) => {
      const mod = l < 0.4 ? 0.1 : l > 0.6 ? -0.1 : 0;
      return {
        first: { pure: { l: 0.08 - mod, c: 0.85 }, muted: { l: -0.08 - mod, c: 0.65 } },
        complement: { l: 0.02 - mod, c: 0.9 },
        fourth: { light: { l: 0.12 - mod, c: 0.75 }, dark: { l: -0.12 - mod, c: 0.95 } }
      };
    };

    if (interpolate) {
      const width = 0.1;
      if (baseLightness >= 0.4 - width / 2 && baseLightness <= 0.4 + width / 2) {
        const t = (baseLightness - (0.4 - width / 2)) / width;
        return interpolateDeep(getTriangle(0.35), getTriangle(0.45), t);
      }
      if (baseLightness >= 0.6 - width / 2 && baseLightness <= 0.6 + width / 2) {
        const t = (baseLightness - (0.6 - width / 2)) / width;
        return interpolateDeep(getTriangle(0.55), getTriangle(0.65), t);
      }
    }
    return getTriangle(baseLightness);
  } else if (style === 'circle') {
    const mod = baseLightness < 0.4 ? 0.15 : baseLightness > 0.6 ? -0.15 : 0;
    if (baseHue >= 345 || baseHue < 30) {
      return {
        first: { pure: { l: 0.1 - mod, c: 1.0 }, muted: { l: -0.05 - mod, c: 0.8 } },
        complement: { l: 0.15 - mod, c: 0.8 },
        fourth: { light: { l: 0.2 - mod, c: 0.7 }, dark: { l: -0.2 - mod, c: 1.2 } }
      };
    } else if (baseHue >= 150 && baseHue < 210) {
      return {
        first: { pure: { l: 0.06 - mod, c: 0.8 }, muted: { l: -0.12 - mod, c: 0.5 } },
        complement: { l: 0.08 - mod, c: 0.85 },
        fourth: { light: { l: 0.15 - mod, c: 0.75 }, dark: { l: -0.1 - mod, c: 0.9 } }
      };
    }
  } else if (style === 'diamond') {
    if (baseLightness > 0.8 && baseChroma < 0.3) {
      return {
        first: { pure: { l: -0.05, c: 0.8 }, muted: { l: -0.2, c: 0.5 } },
        complement: { l: -0.15, c: 0.85 },
        fourth: { light: { l: 0.05, c: 0.7 }, dark: { l: Math.max(-0.3, 0.15 - baseLightness), c: 0.9 } }
      };
    } else if (baseChroma > 0.8 && baseLightness < 0.4) {
      return {
        first: { pure: { l: 0.25, c: 1.1 }, muted: { l: 0.1, c: 0.8 } },
        complement: { l: 0.35, c: 1.0 },
        fourth: { light: { l: 0.4, c: 0.9 }, dark: { l: Math.max(-0.15, 0.15 - baseLightness), c: 1.3 } }
      };
    }
  }

  if (interpolate) {
    const width = 0.1;
    if (baseLightness >= 0.3 - width / 2 && baseLightness <= 0.3 + width / 2) {
      const t = (baseLightness - (0.3 - width / 2)) / width;
      return interpolateDeep(getDefault(0.25), getDefault(0.35), t);
    }
    if (baseLightness >= 0.7 - width / 2 && baseLightness <= 0.7 + width / 2) {
      const t = (baseLightness - (0.7 - width / 2)) / width;
      return interpolateDeep(getDefault(0.65), getDefault(0.75), t);
    }
  }

  return getDefault(baseLightness);
};

/** Adaptive lightness and chroma variations for split-complementary palettes. */
export const getSplitComplementaryVariations = (base: Oklch, style: PaletteStyle, interpolate = false): SplitComplementaryVariations => {
  const { l: baseLightness, c: baseChroma, h: baseHue } = base;

  const getDefault = (l: number) => {
    const targetRange = { min: 0.15, max: 0.9 };
    if (l < 0.3) {
      return {
        base: { dark: { l: Math.max(-0.1, targetRange.min - l), c: 1.0 } },
        complement: {
          first: { pure: { l: 0.3, c: 0.9 }, muted: { l: 0.15, c: 0.7 } },
          second: { pure: { l: 0.2, c: 0.9 }, muted: { l: 0.4, c: 0.6 } }
        }
      };
    } else if (l > 0.7) {
      return {
        base: { dark: { l: Math.max(-0.4, targetRange.min - l), c: 1.1 } },
        complement: {
          first: { pure: { l: -0.2, c: 0.9 }, muted: { l: -0.35, c: 0.7 } },
          second: { pure: { l: -0.3, c: 0.9 }, muted: { l: -0.15, c: 0.7 } }
        }
      };
    } else {
      return {
        base: { dark: { l: -0.2, c: 1.1 } },
        complement: {
          first: { pure: { l: 0.15, c: 0.9 }, muted: { l: -0.15, c: 0.7 } },
          second: { pure: { l: -0.1, c: 0.9 }, muted: { l: 0.2, c: 0.7 } }
        }
      };
    }
  };

  if (style === 'triangle') {
    const getTriangle = (l: number) => {
      const mod = l < 0.4 ? 0.1 : l > 0.6 ? -0.1 : 0;
      return {
        base: { dark: { l: Math.max(-0.18 + mod, -0.3), c: 0.95 } },
        complement: {
          first: { pure: { l: 0.08 - mod, c: 0.85 }, muted: { l: -0.08 - mod, c: 0.65 } },
          second: { pure: { l: -0.02 - mod, c: 0.88 }, muted: { l: 0.12 - mod, c: 0.68 } }
        }
      };
    };

    if (interpolate) {
      const width = 0.1;
      if (baseLightness >= 0.4 - width / 2 && baseLightness <= 0.4 + width / 2) {
        const t = (baseLightness - (0.4 - width / 2)) / width;
        return interpolateDeep(getTriangle(0.35), getTriangle(0.45), t);
      }
      if (baseLightness >= 0.6 - width / 2 && baseLightness <= 0.6 + width / 2) {
        const t = (baseLightness - (0.6 - width / 2)) / width;
        return interpolateDeep(getTriangle(0.55), getTriangle(0.65), t);
      }
    }
    return getTriangle(baseLightness);
  } else if (style === 'circle') {
    const mod = baseLightness < 0.4 ? 0.15 : baseLightness > 0.6 ? -0.15 : 0;
    if (baseHue >= 345 || baseHue < 30) {
      return {
        base: { dark: { l: Math.max(-0.2 + mod, -0.35), c: 1.2 } },
        complement: {
          first: { pure: { l: 0.15 - mod, c: 0.8 }, muted: { l: -0.05 - mod, c: 0.6 } },
          second: { pure: { l: 0.1 - mod, c: 0.85 }, muted: { l: 0.2 - mod, c: 0.65 } }
        }
      };
    } else if (baseHue >= 150 && baseHue < 210) {
      return {
        base: { dark: { l: Math.max(-0.15 + mod, -0.25), c: 0.9 } },
        complement: {
          first: { pure: { l: 0.12 - mod, c: 0.95 }, muted: { l: -0.08 - mod, c: 0.75 } },
          second: { pure: { l: 0.08 - mod, c: 0.9 }, muted: { l: 0.18 - mod, c: 0.7 } }
        }
      };
    }
  } else if (style === 'diamond') {
    if (baseLightness > 0.8 && baseChroma < 0.3) {
      return {
        base: { dark: { l: Math.max(-0.25, 0.15 - baseLightness), c: 1.0 } },
        complement: {
          first: { pure: { l: -0.05, c: 0.8 }, muted: { l: -0.2, c: 0.5 } },
          second: { pure: { l: -0.08, c: 0.75 }, muted: { l: 0.05, c: 0.55 } }
        }
      };
    } else if (baseChroma > 0.8 && baseLightness < 0.4) {
      return {
        base: { dark: { l: Math.max(-0.2, 0.15 - baseLightness), c: 1.3 } },
        complement: {
          first: { pure: { l: 0.25, c: 1.1 }, muted: { l: 0.1, c: 0.8 } },
          second: { pure: { l: 0.35, c: 1.0 }, muted: { l: 0.15, c: 0.75 } }
        }
      };
    }
  }

  if (interpolate) {
    const width = 0.1;
    if (baseLightness >= 0.3 - width / 2 && baseLightness <= 0.3 + width / 2) {
      const t = (baseLightness - (0.3 - width / 2)) / width;
      return interpolateDeep(getDefault(0.25), getDefault(0.35), t);
    }
    if (baseLightness >= 0.7 - width / 2 && baseLightness <= 0.7 + width / 2) {
      const t = (baseLightness - (0.7 - width / 2)) / width;
      return interpolateDeep(getDefault(0.65), getDefault(0.75), t);
    }
  }

  return getDefault(baseLightness);
};

// ---------------------------------------------------------------------------
// src/utils/enhancer.ts — ChromaNarrative + ColorHierarchy + polish
// ---------------------------------------------------------------------------

interface ChromaNarrative {
  pattern: number[]
  description: string
  breathingRoom: boolean
}

interface ColorRole {
  name: 'protagonist' | 'deuteragonist' | 'supporting' | 'accent' | 'background' | 'neutral'
  chromaMultiplier: number
  lightnessShift: number
  presence: number
}

function getChromaNarrative(paletteType: HarmonyType, style: PaletteStyle, _baseChroma: number): ChromaNarrative {
  if (paletteType === 'analogous') {
    switch (style) {
      case 'square':
        return { pattern: [0.8, 0.9, 1.0, 1.0, 0.9, 0.8], description: 'Mathematical harmony', breathingRoom: true };
      case 'triangle':
        return { pattern: [0.7, 1.0, 0.85, 1.0, 0.75, 0.6], description: 'Natural visual rhythm', breathingRoom: true };
      case 'circle':
        return { pattern: [0.6, 0.9, 1.0, 1.0, 1.1, 0.8], description: 'Emotional journey', breathingRoom: false };
      case 'diamond':
        return { pattern: [0.8, 0.7, 1.0, 0.9, 1.1, 0.6], description: 'Luminosity dance', breathingRoom: true };
    }
  }

  if (paletteType === 'complementary') {
    switch (style) {
      case 'square':
        return { pattern: [1.0, 0.9, 0.7, 0.6, 0.8, 0.5], description: 'Clear hierarchy', breathingRoom: true };
      case 'triangle':
        return { pattern: [1.0, 0.85, 0.6, 0.5, 0.75, 0.4], description: 'Visual weight distribution', breathingRoom: true };
      case 'circle':
        return { pattern: [1.0, 1.1, 0.8, 0.6, 0.9, 0.5], description: 'Emotional contrast', breathingRoom: false };
      case 'diamond':
        return { pattern: [1.0, 0.9, 0.7, 0.5, 0.8, 0.4], description: 'Light temperature narrative', breathingRoom: true };
    }
  }

  if (paletteType === 'splitComplementary') {
    switch (style) {
      case 'square':
        return { pattern: [1.0, 0.8, 0.9, 0.7, 0.85, 0.6], description: 'Balanced triad', breathingRoom: true };
      case 'triangle':
        return { pattern: [1.0, 0.7, 0.95, 0.6, 0.8, 0.5], description: 'Perceptual triangle', breathingRoom: true };
      case 'circle':
        return { pattern: [1.0, 0.9, 1.1, 0.8, 0.9, 0.7], description: 'Three-part emotional narrative', breathingRoom: false };
      case 'diamond':
        return { pattern: [1.0, 0.8, 0.9, 0.7, 0.85, 0.65], description: 'Three-point lighting', breathingRoom: true };
    }
  }

  if (paletteType === 'triadic') {
    switch (style) {
      case 'square':
        return { pattern: [1.0, 0.8, 0.9, 0.85, 0.9, 0.7], description: 'Triangular harmony', breathingRoom: true };
      case 'triangle':
        return { pattern: [1.0, 0.75, 0.95, 0.7, 0.85, 0.6], description: 'Perceptual triangle', breathingRoom: true };
      case 'circle':
        return { pattern: [1.0, 0.9, 1.1, 0.8, 0.95, 0.75], description: 'Three-part emotional story', breathingRoom: false };
      case 'diamond':
        return { pattern: [1.0, 0.8, 0.9, 0.7, 0.85, 0.65], description: 'Three-source illumination', breathingRoom: true };
    }
  }

  if (paletteType === 'tetradic') {
    switch (style) {
      case 'square':
        return { pattern: [1.0, 0.8, 0.7, 0.9, 0.75, 0.6], description: 'Quadratic harmony', breathingRoom: true };
      case 'triangle':
        return { pattern: [1.0, 0.7, 0.6, 0.85, 0.65, 0.5], description: 'Perceptual quadrangle', breathingRoom: true };
      case 'circle':
        return { pattern: [1.0, 0.9, 0.8, 1.0, 0.85, 0.7], description: 'Four-part epic', breathingRoom: false };
      case 'diamond':
        return { pattern: [1.0, 0.8, 0.6, 0.9, 0.7, 0.5], description: 'Four-point lighting', breathingRoom: true };
    }
  }

  // Default fallback
  return { pattern: [1.0, 0.9, 0.8, 0.7, 0.6, 0.5], description: 'Standard decay', breathingRoom: true };
}

function getColorHierarchy(paletteType: HarmonyType, _style: PaletteStyle): ColorRole[] {
  if (paletteType === 'analogous') {
    return [
      { name: 'supporting', chromaMultiplier: 0.8, lightnessShift: -0.05, presence: 0.15 },
      { name: 'accent', chromaMultiplier: 1.0, lightnessShift: 0.02, presence: 0.1 },
      { name: 'protagonist', chromaMultiplier: 1.0, lightnessShift: 0, presence: 0.4 },
      { name: 'protagonist', chromaMultiplier: 0.95, lightnessShift: 0, presence: 0.4 },
      { name: 'deuteragonist', chromaMultiplier: 0.9, lightnessShift: 0.03, presence: 0.2 },
      { name: 'background', chromaMultiplier: 0.6, lightnessShift: 0.08, presence: 0.25 }
    ];
  }

  if (paletteType === 'complementary') {
    return [
      { name: 'protagonist', chromaMultiplier: 1.0, lightnessShift: 0, presence: 0.6 },
      { name: 'deuteragonist', chromaMultiplier: 0.95, lightnessShift: 0.05, presence: 0.3 },
      { name: 'supporting', chromaMultiplier: 0.8, lightnessShift: -0.1, presence: 0.15 },
      { name: 'neutral', chromaMultiplier: 0.5, lightnessShift: -0.05, presence: 0.2 },
      { name: 'supporting', chromaMultiplier: 0.7, lightnessShift: 0.08, presence: 0.12 },
      { name: 'background', chromaMultiplier: 0.4, lightnessShift: -0.08, presence: 0.18 }
    ];
  }

  if (paletteType === 'splitComplementary') {
    return [
      { name: 'protagonist', chromaMultiplier: 1.0, lightnessShift: 0, presence: 0.5 },
      { name: 'supporting', chromaMultiplier: 0.9, lightnessShift: -0.08, presence: 0.2 },
      { name: 'deuteragonist', chromaMultiplier: 0.85, lightnessShift: 0.03, presence: 0.25 },
      { name: 'neutral', chromaMultiplier: 0.6, lightnessShift: -0.05, presence: 0.15 },
      { name: 'accent', chromaMultiplier: 0.8, lightnessShift: 0.05, presence: 0.15 },
      { name: 'background', chromaMultiplier: 0.5, lightnessShift: 0.08, presence: 0.12 }
    ];
  }

  if (paletteType === 'triadic') {
    return [
      { name: 'protagonist', chromaMultiplier: 1.0, lightnessShift: 0, presence: 0.5 },
      { name: 'supporting', chromaMultiplier: 0.9, lightnessShift: -0.1, presence: 0.2 },
      { name: 'deuteragonist', chromaMultiplier: 0.85, lightnessShift: 0.05, presence: 0.3 },
      { name: 'neutral', chromaMultiplier: 0.65, lightnessShift: 0.08, presence: 0.15 },
      { name: 'accent', chromaMultiplier: 0.8, lightnessShift: 0.02, presence: 0.25 },
      { name: 'background', chromaMultiplier: 0.6, lightnessShift: -0.05, presence: 0.12 }
    ];
  }

  if (paletteType === 'tetradic') {
    return [
      { name: 'protagonist', chromaMultiplier: 1.0, lightnessShift: 0, presence: 0.4 },
      { name: 'deuteragonist', chromaMultiplier: 0.85, lightnessShift: 0.02, presence: 0.25 },
      { name: 'neutral', chromaMultiplier: 0.6, lightnessShift: -0.05, presence: 0.15 },
      { name: 'supporting', chromaMultiplier: 0.8, lightnessShift: 0, presence: 0.2 },
      { name: 'accent', chromaMultiplier: 0.75, lightnessShift: 0.05, presence: 0.12 },
      { name: 'background', chromaMultiplier: 0.7, lightnessShift: -0.08, presence: 0.18 }
    ];
  }

  // Default fallback
  return Array(6).fill({
    name: 'neutral',
    chromaMultiplier: 1.0,
    lightnessShift: 0,
    presence: 0.16
  });
}

/**
 * Enhances a raw palette by applying chroma narratives and color hierarchy
 * roles. El color base (indice 0) queda siempre intacto.
 */
export function enhancePalette(colors: Oklch[], paletteType: HarmonyType, style: PaletteStyle): Oklch[] {
  const baseColor = colors[0];
  const baseChroma = baseColor.c;

  const narrative = getChromaNarrative(paletteType, style, baseChroma);
  const hierarchy = getColorHierarchy(paletteType, style);

  return colors.map((color, index) => {
    if (index === 0) return color;

    const role = hierarchy[index] || hierarchy[0];
    const narrativeFactor = narrative.pattern[index] || 1.0;

    let newL = color.l + role.lightnessShift;
    const newC = color.c * role.chromaMultiplier * narrativeFactor;

    if (narrative.breathingRoom && index % 2 !== 0) {
      newL += newL > 0.5 ? -0.05 : 0.05;
    }

    return clampOKLCH(newL, newC, color.h);
  });
}

/** Polishes the palette: previene grises muertos y aclara tonos muy claros. */
export function polishPalette(colors: Oklch[], baseColorIndex: number = 0): Oklch[] {
  return colors.map((color, index) => {
    if (index === baseColorIndex) return color;

    const polished = { ...color };

    // 1. Prevent "dead" grays in mid-tones
    if (polished.c < 0.05 && polished.l > 0.2 && polished.l < 0.8) {
      polished.c = Math.max(0.08, polished.c * 2); // Minimum life
    }

    // 2. Make very light colors more interesting
    if (polished.l > 0.85 && polished.c < 0.04) {
      polished.c = 0.04; // Minimum tint
    }

    return clampOKLCH(polished.l, polished.c, polished.h);
  });
}

// ---------------------------------------------------------------------------
// src/utils/modifiers.ts
// ---------------------------------------------------------------------------

/** Applies a sine wave modulation to the palette. */
export function sineModifier(palette: Oklch[], modifier: number): Oklch[] {
  const hueIntensity = modifier * 45;
  const lightnessIntensity = modifier * 0.15;

  return palette.map((color, idx, arr) => {
    const wavePosition = (idx / Math.max(1, arr.length - 1)) * Math.PI * 2;
    const fundamental = Math.sin(wavePosition + modifier * 1);
    const harmonic = Math.sin(wavePosition * 2 + modifier * 0.5) * 0.3;
    const sineValue = fundamental + harmonic;

    const hueShift = sineValue * hueIntensity;
    const lightnessShift = Math.sin(wavePosition * 1.5 + modifier * 0.8) * lightnessIntensity;

    const { l, c, h } = color;
    return clampOKLCH(l + lightnessShift, c, normalizeHue(h + hueShift));
  });
}

/** Applies a chaotic wave modulation using a logistic map. */
export function waveModifier(palette: Oklch[], modifier: number): Oklch[] {
  const chaosLevel = 2.0 + modifier * 1.2;
  const hueRange = modifier * 120;
  const lightnessRange = modifier * 0.35;

  return palette.map((color, idx, arr) => {
    let x = 0.2 + (idx / Math.max(1, arr.length)) * 0.6 + Math.sin(idx * 0.7) * 0.15;

    for (let i = 0; i < 8; i++) {
      x = chaosLevel * x * (1 - x);
    }

    const smoothedX = x * 0.85 + 0.5 * 0.15;

    const hueShift = (smoothedX - 0.5) * hueRange;
    const lightnessShift = (smoothedX - 0.5) * lightnessRange;
    const chromaMultiplier = 0.4 + smoothedX * 1.2;

    const { l, c, h } = color;
    return clampOKLCH(l + lightnessShift, c * chromaMultiplier, normalizeHue(h + hueShift));
  });
}

/** Applies a spiral-like modulation. */
export function zapModifier(palette: Oklch[], modifier: number): Oklch[] {
  const spiralTightness = 0.2 + Math.abs(modifier) * 1.0;
  const maxHueShift = modifier * 90;

  return palette.map((color, idx, arr) => {
    const normalizedPos = idx / Math.max(1, arr.length - 1);
    const angle = normalizedPos * spiralTightness * Math.PI * 2;
    const radius = Math.sqrt(normalizedPos) * 2;

    const spiralX = Math.cos(angle) * radius;
    const spiralY = Math.sin(angle) * radius;

    const hueShift = spiralX * maxHueShift;
    const lightnessShift = spiralY * 0.12 * modifier;
    const chromaShift = Math.sin(angle * 1.5) * 0.08 * modifier;

    const { l, c, h } = color;
    return clampOKLCH(l + lightnessShift, c + chromaShift, normalizeHue(h + hueShift));
  });
}

/** Applies a triangular wave pattern. */
export function blockModifier(palette: Oklch[], modifier: number): Oklch[] {
  const lightnessAmplitude = modifier * 0.25;
  const hueAmplitude = modifier * 30;
  const chromaAmplitude = modifier * 0.1;

  return palette.map((color, idx, arr) => {
    const frequency = Math.max(1, Math.floor(arr.length / 8));
    const wavePosition = (idx / Math.max(1, arr.length - 1)) * Math.PI * frequency;

    const rawTriangle = (2 / Math.PI) * Math.asin(Math.sin(wavePosition));
    const softTriangle = rawTriangle * (1 - Math.abs(rawTriangle) * 0.3);

    const lightnessShift = softTriangle * lightnessAmplitude;
    const hueShift = Math.sin(wavePosition + Math.PI * 0.25) * rawTriangle * hueAmplitude;
    const chromaShift = Math.cos(wavePosition + Math.PI * 0.5) * rawTriangle * chromaAmplitude;

    const { l, c, h } = color;
    return clampOKLCH(l + lightnessShift, c + chromaShift, normalizeHue(h + hueShift));
  });
}

/**
 * Apply a series of modifiers to a palette in sequence.
 * Orden fijo: sine -> wave -> zap -> block, solo si el valor es truthy (0 off).
 */
export function applyModifiers(palette: Oklch[], modifiers?: PaletteModifiers): Oklch[] {
  if (!modifiers) return palette;

  let result = [...palette];

  if (modifiers.sine) result = sineModifier(result, modifiers.sine);
  if (modifiers.wave) result = waveModifier(result, modifiers.wave);
  if (modifiers.zap) result = zapModifier(result, modifiers.zap);
  if (modifiers.block) result = blockModifier(result, modifiers.block);

  return result;
}

// ---------------------------------------------------------------------------
// src/utils/tintsShades.ts — 100% autonomo (no pasa por el pipeline general)
// ---------------------------------------------------------------------------

/** Clamps a hue shift to ±maxDegrees. */
function clampShift(shift: number, maxDegrees: number): number {
  return Math.max(-maxDegrees, Math.min(maxDegrees, shift));
}

/**
 * Generates a 6-step lightness scale (tints and shades) for a single color.
 * Aplica estrategias perceptuales distintas segun el estilo. El base se
 * inserta en su slot mas cercano (clampeado entre vecinos para mantener la
 * rampa monotona).
 */
export function generateTintsAndShades(base: Oklch, style: PaletteStyle): Oklch[] {
  const resolvedStyle = resolvePaletteStyle(style);
  const { h: hue, c: chroma, l: lightness } = base;

  const steps = 6;
  const results: Oklch[] = [];

  const lightnessProgression = [0.02, 0.25, 0.38, 0.62, 0.84, 0.98];

  const baseSlotIndex = lightnessProgression.reduce(
    (best, l, i) => (Math.abs(l - lightness) < Math.abs(lightnessProgression[best] - lightness) ? i : best),
    0
  );

  for (let i = 0; i < steps; i++) {
    if (i === baseSlotIndex) {
      const lower = lightnessProgression[i - 1] ?? OKLCH_LIMITS.l.min;
      const upper = lightnessProgression[i + 1] ?? OKLCH_LIMITS.l.max;
      const snappedL = Math.min(Math.max(lightness, lower), upper);
      results.push(clampOKLCH(snappedL, chroma, hue));
      continue;
    }

    const targetL = lightnessProgression[i];
    let newColor: Oklch = { l: targetL, c: chroma, h: hue };

    switch (resolvedStyle) {
      case 'square':
        // Pure numerical consistency — sin ajustes extra
        break;

      case 'triangle': {
        const lDelta = targetL - lightness;

        let chromaMult = 1.0;
        if (targetL < lightness) {
          chromaMult = 1.0 + Math.abs(lDelta) * 0.4;
        } else {
          chromaMult = Math.max(0.2, 1.0 - Math.abs(lDelta) * 0.8);
        }

        const bezoldBrucke = clampShift(lDelta * Math.cos(((hue - 90) * Math.PI) / 180) * 4, 4);
        const chromaReduction = Math.max(0, 1 - chromaMult);
        const abney = clampShift(chromaReduction * Math.sin(((hue - 30) * Math.PI) / 180) * 15, 2);

        newColor.h = normalizeHue(hue + bezoldBrucke + abney);
        newColor.c = chroma * chromaMult;
        break;
      }

      case 'circle': {
        const darkness = 1 - targetL;
        const chromaBoost = Math.pow(darkness, 1.5) * 0.8 + 0.2;
        const targetChroma = chroma * chromaBoost * 1.2;

        newColor.c = Math.max(0, Math.min(0.37, targetChroma));

        const circleHueShift = (targetL - 0.5) * 10;
        newColor.h = normalizeHue(hue + circleHueShift);
        break;
      }

      case 'diamond': {
        if (targetL < lightness) {
          const shadeFactor = (lightness - targetL) / lightness; // 0 to 1
          newColor.c = lerp(shadeFactor, chroma, chroma * 0.5);
        } else {
          const tintFactor = (targetL - lightness) / (1 - lightness); // 0 to 1
          newColor.c = lerp(tintFactor, chroma, 0);
        }
        break;
      }
    }

    results.push(clampOKLCH(newColor.l, newColor.c, newColor.h));
  }

  return results;
}

// ---------------------------------------------------------------------------
// src/index.ts — los 5 ensambladores + ColorPaletteGenerator
// ---------------------------------------------------------------------------

/** Creates a palette generator function with common boilerplate. */
function createPaletteGenerator(
  paletteType: HarmonyType,
  generatorFn: (base: Oklch, options: GeneratorOptions, enhanced: boolean) => Oklch[]
): (baseColor: Oklch, options: GeneratorOptions) => Oklch[] {
  return (baseColor: Oklch, options: GeneratorOptions): Oklch[] => {
    const base = { l: baseColor.l, c: baseColor.c, h: baseColor.h || 0 };

    if (isAchromatic(base)) {
      return generateNeutralPalette(base);
    }

    const style = resolvePaletteStyle(options.style);
    const enhanced = style !== 'square';
    const colors = generatorFn(base, { ...options, style }, enhanced);

    if (enhanced) {
      const enhancedColors = enhancePalette(colors, paletteType, style);
      return polishPalette(enhancedColors);
    }

    return colors;
  };
}

/** Complementary: base + hue opuesto. chromaAdjust 0.9 (solo aca y analogous). */
export const generateComplementary = createPaletteGenerator('complementary', (base, options, enhanced) => {
  const { l: baseLightness, c: baseChroma, h: baseHue } = base;
  const chromaAdjust = 0.9;

  const complementHue = getComplementaryHue(base, options.style);
  const { base: baseVars, complement: compVars } = getComplementaryVariations(base, options.style, options.interpolation);

  const createColor = (hue: number, v: Variation) =>
    safeColor(hue, baseLightness + v.l, baseChroma * v.c * chromaAdjust, enhanced);

  return [
    { l: baseLightness, c: baseChroma, h: baseHue },
    createColor(complementHue, compVars.main),
    createColor(baseHue, baseVars.dark),
    createColor(baseHue, baseVars.light),
    createColor(complementHue, compVars.light),
    createColor(complementHue, compVars.muted)
  ];
});

/** Analogous: colores adyacentes en la rueda. chromaAdjust 0.9. */
export const generateAnalogous = createPaletteGenerator('analogous', (base, options, enhanced) => {
  const { l: baseLightness, c: baseChroma, h: baseHue } = base;
  const chromaAdjust = 0.9;

  const analogousHues = getAnalogousHues(base, options.style);
  const variations = getAnalogousVariations(base, options.style, options.interpolation);

  return analogousHues.map((hue, index) => {
    if (index === 0) return { l: baseLightness, c: baseChroma, h: baseHue };

    const v = variations[index];
    return safeColor(hue, baseLightness + v.l, baseChroma * v.c * chromaAdjust, enhanced);
  });
});

/** Triadic: tres colores equiespaciados. El "baseDark" (idx 1) va sin safeColor. */
export const generateTriadic = createPaletteGenerator('triadic', (base, options, enhanced) => {
  const { l: baseLightness, c: baseChroma, h: baseHue } = base;
  const triadicHues = getTriadicHues(base, options.style);
  const { base: baseVariations, triad: triadVariations } = getTriadicVariations(base, options.style, options.interpolation);

  const colors: Oklch[] = [];
  triadicHues.forEach((hue, idx) => {
    if (idx === 0) {
      colors.push({ l: baseLightness, c: baseChroma, h: baseHue });
      colors.push({ l: baseLightness + baseVariations.dark.l, c: baseChroma * baseVariations.dark.c, h: hue });
    } else {
      const v = idx === 1 ? triadVariations.first : triadVariations.second;
      colors.push(safeColor(hue, baseLightness + v.pure.l, baseChroma * v.pure.c, enhanced));
      colors.push(safeColor(hue, baseLightness + v.muted.l, baseChroma * v.muted.c, enhanced));
    }
  });
  return colors;
});

/** Tetradic: dos pares de complementarios. */
export const generateTetradic = createPaletteGenerator('tetradic', (base, options, enhanced) => {
  const { l: baseLightness, c: baseChroma, h: baseHue } = base;
  const tetradicHues = getTetradicHues(base, options.style);
  const variations = getTetradicVariations(base, options.style, options.interpolation);

  const colors: Oklch[] = [];

  colors.push({ l: baseLightness, c: baseChroma, h: baseHue });

  const h1 = tetradicHues[1];
  const v1Pure = variations.first.pure;
  colors.push(safeColor(h1, baseLightness + v1Pure.l, baseChroma * v1Pure.c, enhanced));

  const v1Muted = variations.first.muted;
  colors.push(safeColor(h1, baseLightness + v1Muted.l, baseChroma * v1Muted.c, enhanced));

  const h2 = tetradicHues[2];
  const vComp = variations.complement;
  colors.push(safeColor(h2, baseLightness + vComp.l, baseChroma * vComp.c, enhanced));

  const h3 = tetradicHues[3];
  const v4Light = variations.fourth.light;
  colors.push(safeColor(h3, baseLightness + v4Light.l, baseChroma * v4Light.c, enhanced));

  const v4Dark = variations.fourth.dark;
  colors.push(safeColor(h3, baseLightness + v4Dark.l, baseChroma * v4Dark.c, enhanced));

  return colors;
});

/** Split-complementary: base + dos adyacentes al complemento. El baseDark (idx 1) va sin safeColor. */
export const generateSplitComplementary = createPaletteGenerator('splitComplementary', (base, options, enhanced) => {
  const { l: baseLightness, c: baseChroma, h: baseHue } = base;
  const splitHues = getSplitComplementaryHues(base, options.style);
  const { base: baseVars, complement: compVars } = getSplitComplementaryVariations(base, options.style, options.interpolation);

  const colors: Oklch[] = [];

  colors.push({ l: baseLightness, c: baseChroma, h: baseHue });

  colors.push({
    l: baseLightness + baseVars.dark.l,
    c: baseChroma * baseVars.dark.c,
    h: baseHue
  });

  const h1 = splitHues[1];
  const v1Pure = compVars.first.pure;
  colors.push(safeColor(h1, baseLightness + v1Pure.l, baseChroma * v1Pure.c, enhanced));

  const v1Muted = compVars.first.muted;
  colors.push(safeColor(h1, baseLightness + v1Muted.l, baseChroma * v1Muted.c, enhanced));

  const h2 = splitHues[2];
  const v2Pure = compVars.second.pure;
  colors.push(safeColor(h2, baseLightness + v2Pure.l, baseChroma * v2Pure.c, enhanced));

  const v2Muted = compVars.second.muted;
  colors.push(safeColor(h2, baseLightness + v2Muted.l, baseChroma * v2Muted.c, enhanced));

  return colors;
});

export const generators = {
  analogous: generateAnalogous,
  complementary: generateComplementary,
  triadic: generateTriadic,
  tetradic: generateTetradic,
  splitComplementary: generateSplitComplementary
};

// ---------------------------------------------------------------------------
// API pública del layer (misma API que antes, ahora fiel al original)
// ---------------------------------------------------------------------------

/**
 * Genera una paleta (siempre 6 colores OKLCH) a partir de un color base OKLCH.
 * Pipeline real: achromatic-check -> style-resolve -> hue-strategy ->
 * variations(+interpolate) -> safeColor(muddy-zones si enhanced) ->
 * enhance+polish (si enhanced) -> modifiers (orden fijo) -> clampToGamut (opc).
 * `tintsShades` es autonomo: no pasa por achromatic-check ni enhance/polish.
 */
export function generateFromOklch(baseColor: Oklch, paletteType: PaletteType, options: GeneratorOptions): Oklch[] {
  const baseOptions = { interpolation: true, ...options };
  const modifiers = baseOptions.modifiers;

  let palette: Oklch[];
  switch (paletteType) {
    case 'analogous': palette = generateAnalogous(baseColor, baseOptions); break;
    case 'complementary': palette = generateComplementary(baseColor, baseOptions); break;
    case 'triadic': palette = generateTriadic(baseColor, baseOptions); break;
    case 'tetradic': palette = generateTetradic(baseColor, baseOptions); break;
    case 'splitComplementary': palette = generateSplitComplementary(baseColor, baseOptions); break;
    case 'tintsShades': palette = generateTintsAndShades(baseColor, baseOptions.style); break;
    default: throw new Error(`Unknown palette type: ${paletteType}`);
  }

  const result = applyModifiers(palette, modifiers);

  if (baseOptions.clampToGamut) {
    return result.map(clampChroma);
  }

  return result;
}

/** generatePalette a partir de un hex (entrada de la UI). */
export function generatePalette(baseHex: string, paletteType: PaletteType, options: GeneratorOptions): Oklch[] {
  return generateFromOklch(hexToOklch(baseHex), paletteType, options);
}

/** generateAll: las 6 armonias con la misma base/opciones (estilo demo). */
export function generateAllPalettes(baseHex: string, options: GeneratorOptions): Record<PaletteType, Oklch[]> {
  const base = hexToOklch(baseHex);
  const out = {} as Record<PaletteType, Oklch[]>;
  for (const type of PALETTE_TYPES) {
    out[type] = generateFromOklch(base, type, options);
  }
  return out;
}

// ---------------------------------------------------------------------------
// src/utils/demo-palette.ts — extendPalette (expandir/reducir de 6 a N)
// ---------------------------------------------------------------------------

/**
 * Extiende/reduce una paleta al conteo deseado (port de extendPalette).
 * - N <= largo: down-sampling por indice con step = largo/N (Math.floor).
 * - N > largo: interpola en OKLAB sobre TODOS los stops (lineal por tramos,
 *   equivalente a culori.interpolate(colors, 'oklab')).
 * El hue resultante queda normalizado a [0,360) y `h || 0` para grises.
 */
export function expandPalette(basePalette: Oklch[], targetCount: number): Oklch[] {
  if (targetCount <= basePalette.length) {
    const step = basePalette.length / targetCount;
    return Array.from({ length: targetCount }, (_, i) => {
      const index = Math.min(Math.floor(i * step), basePalette.length - 1);
      return basePalette[index];
    });
  }

  // Upsampling: interpolacion en OKLAB via oklch.util (equivalente a culori)
  const baseColors = basePalette.map((p) => oklchToOklab(p));

  const result: Oklch[] = [];
  for (let i = 0; i < targetCount; i++) {
    const t = targetCount === 1 ? 0 : i / (targetCount - 1);
    const pos = t * (baseColors.length - 1);
    const i0 = Math.min(Math.floor(pos), baseColors.length - 2);
    const f = pos - i0;

    const from = baseColors[i0];
    const to = baseColors[i0 + 1];

    const l = lerp(f, from.l, to.l);
    const a = lerp(f, from.a, to.a);
    const b = lerp(f, from.b, to.b);

    const c = Math.sqrt(a * a + b * b);
    const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
    result.push({ l, c, h: h || 0 });
  }

  return result;
}

export const paletteToHex = (palette: Oklch[]): string[] => palette.map(oklchToHex);
