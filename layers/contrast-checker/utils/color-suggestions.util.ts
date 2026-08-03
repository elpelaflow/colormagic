import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, type Rgb } from '~/layers/palette/utils/color-converter.util';
import { calculateContrastRatio } from '~/layers/contrast-checker/utils/color-contrast.util';

export interface ColorSuggestion {
  primary: string
  secondary: string
  ratio: number
  passesAA: boolean
  passesAAA: boolean
}

export interface AccessibilityFails {
  normalText: boolean
  largeText: boolean
  uiComponents: boolean
}

const AA_NORMAL = 4.5;
const AA_LARGE = 3;
const AA_UI = 3;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function adjustLightness(hex: string, deltaL: number): string {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb);
  const newL = clamp(hsl.l + deltaL, 0, 100);
  return rgbToHex(hslToRgb({ h: hsl.h, s: hsl.s, l: newL }));
}

function ratioBetween(a: string, b: string): number {
  return calculateContrastRatio(
    [hexToRgb(a).r, hexToRgb(a).g, hexToRgb(a).b],
    [hexToRgb(b).r, hexToRgb(b).g, hexToRgb(b).b]
  );
}

function buildSuggestion(primary: string, secondary: string): ColorSuggestion {
  const ratio = ratioBetween(primary, secondary);
  return {
    primary,
    secondary,
    ratio,
    passesAA: ratio >= AA_NORMAL,
    passesAAA: ratio >= 7
  };
}

/**
 * Genera sugerencias de pares (primary, secondary) que cumplen AA (>=4.5).
 *
 * Estrategia:
 *  - Mantiene los matices (hue) y saturaciones originales.
 *  - Decide cual de los dos colores es el "claro" y cual el "oscuro".
 *  - Para alcanzar mas contraste, oscurece el oscuro y aclara el claro
 *    en pasos de lightness crecientes.
 *  - Devuelve varias alternativas ordenadas por "menor cambio posible".
 */
export function suggestAccessibleColors(
  primaryHex: string,
  secondaryHex: string,
  target: number = AA_NORMAL
): ColorSuggestion[] {
  const primaryL = rgbToHsl(hexToRgb(primaryHex)).l;
  const secondaryL = rgbToHsl(hexToRgb(secondaryHex)).l;
  const primaryIsLighter = primaryL >= secondaryL;

  // El "claro" se aclara, el "oscuro" se oscurece.
  const lightOriginal = primaryIsLighter ? primaryHex : secondaryHex;
  const darkOriginal = primaryIsLighter ? secondaryHex : primaryHex;

  const steps = [5, 10, 15, 20, 25, 30, 40, 50];
  const suggestions: ColorSuggestion[] = [];

  for (const step of steps) {
    const newLight = adjustLightness(lightOriginal, step);
    const newDark = adjustLightness(darkOriginal, -step);

    // Reconstruir par (primary, secondary) manteniendo el rol de cada uno
    const newPrimary = primaryIsLighter ? newLight : newDark;
    const newSecondary = primaryIsLighter ? newDark : newLight;

    // Evitar duplicados (matiz identico de un par ya agregado)
    const exists = suggestions.some(s =>
      s.primary.toLowerCase() === newPrimary.toLowerCase() &&
      s.secondary.toLowerCase() === newSecondary.toLowerCase()
    );
    if (exists) continue;

    const suggestion = buildSuggestion(newPrimary, newSecondary);
    if (suggestion.ratio >= target) {
      suggestions.push(suggestion);
      if (suggestions.length >= 4) break;
    }
  }

  // Si ninguna alcanzo el target (poco probable), devolver las que tengamos
  // con mas contraste aunque no lleguen a AA — aun asi utiles como "mejora".
  if (suggestions.length === 0) {
    let bestFallback: ColorSuggestion | null = null;
    for (const step of steps) {
      const newLight = adjustLightness(lightOriginal, step);
      const newDark = adjustLightness(darkOriginal, -step);
      const newPrimary = primaryIsLighter ? newLight : newDark;
      const newSecondary = primaryIsLighter ? newDark : newLight;
      const s = buildSuggestion(newPrimary, newSecondary);
      if (bestFallback === null || s.ratio > bestFallback.ratio) {
        bestFallback = s;
      }
    }
    if (bestFallback !== null) suggestions.push(bestFallback);
  }

  return suggestions;
}

export function getAccessibilityFails(ratio: number): AccessibilityFails {
  return {
    normalText: ratio < AA_NORMAL,
    largeText: ratio < AA_LARGE,
    uiComponents: ratio < AA_UI
  };
}

export function hasAnyFail(fails: AccessibilityFails): boolean {
  return fails.normalText || fails.largeText || fails.uiComponents;
}
