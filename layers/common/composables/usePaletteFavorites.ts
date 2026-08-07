import { useLocalStorage, StorageSerializers } from '@vueuse/core';

export interface SavedPalette {
  id: string
  /** Hex en orden de la paleta guardada. */
  colors: string[]
  savedAt: number
}

// OJO: no usar 'palettes:favorites' — colisiona con `useFavorites` (Map de
// paletas de la DB con la MISMA clave). Esta key es exclusiva del Palette Maker.
const PALETTE_FAVORITES_KEY = 'palette-maker:favorites';

/**
 * Paletas completas guardadas con el corazón ♥ desde el Palette Maker y
 * visibles en /favorites. Mismo patrón que `useFavorites` / `useColorFavorites`:
 * localStorage, sin backend todavía.
 *
 * La identidad de una paleta es su firma (hex en orden, unidos por coma):
 * guardar dos veces la misma paleta hace toggle (la quita).
 */
export function usePaletteFavorites() {
  const savedPalettes = useLocalStorage<SavedPalette[]>(
    PALETTE_FAVORITES_KEY,
    [],
    { serializer: StorageSerializers.object }
  );

  /** Descarta entradas corruptas (p. ej. si la key fue pisada por otro formato). */
  function clean(): void {
    if (!Array.isArray(savedPalettes.value)) {
      savedPalettes.value = [];
      return;
    }
    const valid = savedPalettes.value.filter(
      (p) => p && Array.isArray(p.colors) && typeof p.id === 'string'
    );
    if (valid.length !== savedPalettes.value.length) {
      savedPalettes.value = valid;
    }
  }

  const signature = (colors: string[]): string => colors.join(',');

  function isSaved(colors: string[]): boolean {
    clean();
    const sig = signature(colors);
    return savedPalettes.value.some((p) => p.colors.join(',') === sig);
  }

  /** Devuelve `true` si quedó guardada, `false` si se quitó (toggle por firma). */
  function toggleSave(colors: string[]): boolean {
    clean();
    const sig = signature(colors);
    const saved = savedPalettes.value.some((p) => p.colors.join(',') === sig);
    savedPalettes.value = saved
      ? savedPalettes.value.filter((p) => p.colors.join(',') !== sig)
      : [
          ...savedPalettes.value,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            colors: [...colors],
            savedAt: Date.now()
          }
        ];
    return !saved;
  }

  function removePalette(id: string): void {
    clean();
    savedPalettes.value = savedPalettes.value.filter((p) => p.id !== id);
  }

  return {
    savedPalettes,
    isSaved,
    toggleSave,
    removePalette
  };
}
