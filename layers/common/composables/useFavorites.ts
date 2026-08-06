import { useLocalStorage, StorageSerializers } from '@vueuse/core';
import type { PaletteModel } from '~/layers/palette/models/palette.model';

const FAVORITES_KEY = 'palettes:favorites';

/**
 * Favoritos de paletas (sección "Favorites").
 *
 * Sin autenticación por ahora: se guardan en localStorage del navegador,
 * mismo patrón que la página /recent ('palettes:created'). Un Map de
 * `id -> palette` (el id de la paleta en la DB) para que el corazón de cada
 * tarjeta pueda consultar su estado y se pueda quitar el favorito.
 */
export function useFavorites() {
  const favorites = useLocalStorage<Map<string, PaletteModel>>(
    FAVORITES_KEY,
    new Map(),
    { serializer: StorageSerializers.map }
  );

  function isFavorite(id: string): boolean {
    return favorites.value.has(id);
  }

  /**
   * Devuelve `true` si quedó favorita (se agregó), `false` si se quitó.
   *
   * Se REASIGNA el ref en vez de mutar el Map: vueuse useStorage escribe en
   * localStorage vía un watcher, y la reasignación dispara ese watcher de
   * forma garantizada (la mutación directa con `Map.set()` no siempre es
   * trackeada como cambio por el deep-watch en todas las versiones).
   */
  function toggleFavorite(palette: PaletteModel & { id: string }): boolean {
    const next = new Map(favorites.value);
    if (next.has(palette.id)) {
      next.delete(palette.id);
      favorites.value = next;
      return false;
    }
    next.set(palette.id, palette);
    favorites.value = next;
    return true;
  }

  return {
    favorites,
    isFavorite,
    toggleFavorite
  };
}
