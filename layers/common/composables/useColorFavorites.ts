import { useLocalStorage, StorageSerializers } from '@vueuse/core';

export interface SavedColor {
  hex: string
  name: string
}

const COLORS_FAVORITES_KEY = 'colors:favorites';

/**
 * Colores individuales guardados con el corazón ♥ (Palette Maker) y
 * visibles también en /favorites. Mismo patrón que `useFavorites`:
 * localStorage, sin backend todavía.
 */
export function useColorFavorites() {
  const savedColors = useLocalStorage<SavedColor[]>(
    COLORS_FAVORITES_KEY,
    [],
    { serializer: StorageSerializers.object }
  );

  function isSaved(hex: string): boolean {
    return savedColors.value.some((c) => c.hex.toLowerCase() === hex.toLowerCase());
  }

  /** Devuelve `true` si quedó guardado, `false` si se quitó. */
  function toggleSave(hex: string, name: string): boolean {
    const saved = isSaved(hex);
    savedColors.value = saved
      ? savedColors.value.filter((c) => c.hex.toLowerCase() !== hex.toLowerCase())
      : [...savedColors.value, { hex, name }];
    return !saved;
  }

  function removeColor(hex: string): void {
    savedColors.value = savedColors.value.filter((c) => c.hex.toLowerCase() !== hex.toLowerCase());
  }

  return {
    savedColors,
    isSaved,
    toggleSave,
    removeColor
  };
}
