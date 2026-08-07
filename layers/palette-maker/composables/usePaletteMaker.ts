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

/** Máxima cantidad de pasos atrás que se pueden deshacer. */
const HISTORY_LIMIT = 5;

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
/** Copia superficial de los colores para guardar en el historial (las
 * mutaciones del estado siempre crean objetos nuevos, así que las copias
 * almacenadas nunca se corrompen). */
function snapshot(colors: MakerColor[]): MakerColor[] {
  return colors.map((c) => ({ ...c }));
}

export function usePaletteMaker() {
  const colors = useLocalStorage<MakerColor[]>('palette-maker:current', [], {
    serializer: StorageSerializers.object
  });

  const harmonyMode = useLocalStorage<boolean>('palette-maker:harmony', false, {
    serializer: StorageSerializers.boolean
  });

  /** Historial en memoria (no persiste): estados anteriores y futuros (redo). */
  const history = ref<MakerColor[][]>([]);
  const future = ref<MakerColor[][]>([]);

  // Seed robusto: si localStorage trae datos corruptos (null, malformados,
  // entradas sin hex válido), se filtran y se regenera la paleta inicial.
  const seeded = Array.isArray(colors.value)
    ? colors.value.filter((c) => c && typeof c.hex === 'string' && /^#[0-9a-f]{6}$/i.test(c.hex))
    : [];
  if (seeded.length !== (Array.isArray(colors.value) ? colors.value.length : 0)) {
    colors.value = seeded;
  }
  if (!colors.value.length) {
    colors.value = Array.from({ length: INITIAL_COLORS }, () => createColor());
  }

  /** Guarda el estado actual antes de mutar y descarta el redo pendiente. */
  function commit(): void {
    history.value = [...history.value, snapshot(colors.value)].slice(-HISTORY_LIMIT);
    future.value = [];
  }

  /** Regenera solo los colores desbloqueados (barra espaciadora). */
  function generate(): void {
    // Si todo está bloqueado no hay nada que regenerar (evita un undo no-op)
    if (!colors.value.some((c) => !c.locked)) return;
    commit();
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
    commit();
    const next = [...colors.value];
    const hex = interpolateHex(next[index].hex, next[index + 1].hex, 0.5);
    next.splice(index + 1, 0, createColor(hex));
    colors.value = next;
  }

  function removeColor(index: number): void {
    if (colors.value.length <= MIN_COLORS) return;
    commit();
    const next = [...colors.value];
    next.splice(index, 1);
    colors.value = next;
  }

  function toggleLock(index: number): void {
    if (index < 0 || index >= colors.value.length) return;
    commit();
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
    commit();
    const next = [...colors.value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    colors.value = next;
  }

  /** Vuelve a la paleta anterior (hasta HISTORY_LIMIT pasos). */
  function undo(): void {
    if (!history.value.length) return;
    future.value = [snapshot(colors.value), ...future.value].slice(0, HISTORY_LIMIT);
    colors.value = history.value[history.value.length - 1];
    history.value = history.value.slice(0, -1);
  }

  /** Rehace lo que se deshizo (vuelve a una paleta posterior). */
  function redo(): void {
    if (!future.value.length) return;
    history.value = [...history.value, snapshot(colors.value)].slice(-HISTORY_LIMIT);
    colors.value = future.value[0];
    future.value = future.value.slice(1);
  }

  return {
    colors,
    harmonyMode,
    history,
    future,
    generate,
    addIntermediate,
    removeColor,
    toggleLock,
    moveColor,
    undo,
    redo
  };
}
