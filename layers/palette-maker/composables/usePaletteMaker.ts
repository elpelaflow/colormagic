import { useLocalStorage, StorageSerializers } from '@vueuse/core';
import { createId, interpolateHex, randomColorHex } from '../utils/palette-maker.util';
import {
  generateAllPalettes,
  expandPalette,
  paletteToHex,
  type HarmonyType,
  type PaletteStyle
} from '~/layers/color-palette-creator/utils/palette-generator.util';

export interface MakerColor {
  id: string
  hex: string
  locked: boolean
}

export const MIN_COLORS = 2;
export const MAX_COLORS = 10;
export const INITIAL_COLORS = 5;

/** Las 5 armonías del motor pro-color-harmonies (tintsShades es autónomo). */
const HARMONY_TYPES: HarmonyType[] = [
  'analogous',
  'complementary',
  'triadic',
  'tetradic',
  'splitComplementary'
];

// 'default' resuelve a 'square' en el motor — solo un representante de cada estilo.
const HARMONY_STYLES: PaletteStyle[] = ['square', 'triangle', 'circle', 'diamond'];

function createColor(hex?: string): MakerColor {
  return { id: createId(), hex: hex ?? randomColorHex(), locked: false };
}

/**
 * Genera una paleta cohesionada real: elige un color base aleatorio, una
 * armonía (analogous/complementary/triadic/tetradic/splitComplementary) y un
 * estilo geométrico al azar, y la expande/reduce a `count` colores.
 */
function generateHarmonyHexes(count: number): string[] {
  const baseHex = randomColorHex();
  const all = generateAllPalettes(baseHex, {
    style: HARMONY_STYLES[Math.floor(Math.random() * HARMONY_STYLES.length)],
    clampToGamut: true
  });
  const type = HARMONY_TYPES[Math.floor(Math.random() * HARMONY_TYPES.length)];
  return paletteToHex(expandPalette(all[type], count));
}

/**
 * Estado del lienzo del Palette Maker: la lista de colores con su lock,
 * las acciones (generar, tono intermedio "+", quitar, bloquear, reordenar)
 * y persistencia en localStorage (la paleta sobrevive al refresh).
 *
 * - Modo normal (`harmonyMode` off): cada columna se regenera con un color
 *   aleatorio independiente (random "inteligente" en OKLCH).
 * - Modo armonía (`harmonyMode` on): las columnas desbloqueadas se rellenan
 *   con una paleta armónica real generada con pro-color-harmonies.
 *
 * Se REASIGNA el ref en cada mutación (patrón de `useFavorites`): vueuse
 * `useStorage` escribe vía un watcher y la reasignación lo dispara de forma
 * garantizada, a diferencia de la mutación directa del array.
 */
export function usePaletteMaker() {
  const colors = useLocalStorage<MakerColor[]>('palette-maker:current', [], {
    serializer: StorageSerializers.object
  });

  const harmonyMode = useLocalStorage<boolean>('palette-maker:harmony', false, {
    serializer: StorageSerializers.boolean
  });

  if (!colors.value.length) {
    colors.value = Array.from({ length: INITIAL_COLORS }, () => createColor());
  }

  /** Regenera solo los colores desbloqueados (barra espaciadora). */
  function generate(): void {
    if (harmonyMode.value) {
      const harmony = generateHarmonyHexes(colors.value.length);
      colors.value = colors.value.map((c, i) => (c.locked ? c : { ...c, hex: harmony[i] }));
    } else {
      colors.value = colors.value.map((c) => (c.locked ? c : { ...c, hex: randomColorHex() }));
    }
  }

  /** Inserta un tono intermedio (interpolación OKLab) entre index e index+1. */
  function addIntermediate(index: number): void {
    if (index < 0 || index >= colors.value.length - 1 || colors.value.length >= MAX_COLORS) return;
    const next = [...colors.value];
    const hex = interpolateHex(next[index].hex, next[index + 1].hex, 0.5);
    next.splice(index + 1, 0, createColor(hex));
    colors.value = next;
  }

  function removeColor(index: number): void {
    if (colors.value.length <= MIN_COLORS) return;
    const next = [...colors.value];
    next.splice(index, 1);
    colors.value = next;
  }

  function toggleLock(index: number): void {
    if (index < 0 || index >= colors.value.length) return;
    const next = [...colors.value];
    next[index] = { ...next[index], locked: !next[index].locked };
    colors.value = next;
  }

  function moveColor(from: number, to: number): void {
    if (
      from === to
      || from < 0 || to < 0
      || from >= colors.value.length || to >= colors.value.length
    ) return;
    const next = [...colors.value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    colors.value = next;
  }

  return {
    colors,
    harmonyMode,
    generate,
    addIntermediate,
    removeColor,
    toggleLock,
    moveColor
  };
}
