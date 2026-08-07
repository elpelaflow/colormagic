/**
 * Utilidades puras del Palette Maker.
 *
 * - `randomColorHex`: colores aleatorios "inteligentes" generados en OKLCH
 *   (hue libre + chroma/luz controlados) → paletas agradables, sin grises
 *   barrosos de un hex totalmente al azar.
 * - `interpolateHex`: mezcla perceptiva en OKLab (la misma matemática
 *   validada por el parity test de pro-color-harmonies) para el tono
 *   intermedio del botón "+".
 * - `getColorName` / `createId`: helpers de nombre (ntc) e id estable.
 */
import {
  hexToOklch,
  oklchToHex,
  oklchToOklab,
  oklabToOklch,
  clampChroma,
  lerp
} from '~/layers/color-palette-creator/utils/oklch.util';
import { hexToName } from '~/layers/palette/utils/color-converter.util';

/** Color aleatorio agradable: chroma 0.15-0.30 y luz 0.45-0.80. */
export function randomColorHex(): string {
  const h = Math.random() * 360;
  const c = 0.15 + Math.random() * 0.15;
  const l = 0.45 + Math.random() * 0.35;
  return oklchToHex(clampChroma({ l, c, h }));
}

/** Mezcla perceptiva entre dos hex en OKLab (50% por defecto). */
export function interpolateHex(hexA: string, hexB: string, ratio = 0.5): string {
  const labA = oklchToOklab(hexToOklch(hexA));
  const labB = oklchToOklab(hexToOklch(hexB));
  const mid = oklabToOklch({
    l: lerp(ratio, labA.l, labB.l),
    a: lerp(ratio, labA.a, labB.a),
    b: lerp(ratio, labA.b, labB.b)
  });
  return oklchToHex(clampChroma(mid));
}

/** Nombre descriptivo del color vía ntc (fallback al hex). */
export function getColorName(hex: string): string {
  const name = hexToName(hex);
  return typeof name === 'string' && name ? name : hex;
}

/** Id único estable para locks y drag-and-drop. */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
