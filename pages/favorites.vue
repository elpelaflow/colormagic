<template>
  <div>
    <!-- header -->
    <div class="mb-8">
      <h1>
        {{ $t('favorites.title') }}
      </h1>

      <p class="text-xl font-medium mb-4 max-w-xl">
        {{ $t('favorites.seoDescription') }}
      </p>
    </div>

    <!-- favorites grid + empty state: ClientOnly porque dependen de localStorage
         (solo existe en el cliente) -> evita mismatches de hidratacion -->
    <ClientOnly>
      <template #fallback>
        <ul class="grid sm:grid-cols-3 gap-4">
          <li
            v-for="index in 6"
            :key="index"
          >
            <USkeleton class="w-full h-24" />
          </li>
        </ul>
      </template>

      <!-- saved colors (from Palette Maker ♥) -->
      <section
        v-if="savedColors.length"
        class="mb-10"
      >
        <h2 class="text-lg font-semibold mb-3">
          {{ $t('favorites.savedColorsTitle') }}
        </h2>
        <ul class="flex flex-wrap gap-3">
          <li
            v-for="sc in savedColors"
            :key="sc.hex"
            class="w-36 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm bg-white dark:bg-gray-900"
          >
            <div
              class="h-14 w-full relative group"
              :style="{ backgroundColor: sc.hex }"
            >
              <button
                class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-black/40 text-white"
                :title="$t('paletteMaker.remove')"
                :aria-label="$t('paletteMaker.remove')"
                @click="onRemoveSaved(sc)"
              >
                <UIcon name="i-heroicons-x-mark" class="w-3.5 h-3.5" />
              </button>
            </div>
            <div class="p-2 space-y-1">
              <div
                class="text-xs font-medium truncate"
                :title="sc.name"
              >
                {{ sc.name }}
              </div>
              <div class="font-mono text-xs text-gray-500">
                {{ sc.hex }}
              </div>
              <UButton
                size="xs"
                variant="soft"
                color="primary"
                icon="i-heroicons-clipboard"
                :label="$t('paletteMaker.copyHex')"
                @click="onCopySaved(sc)"
              />
            </div>
          </li>
        </ul>
      </section>

      <ul
        v-if="favorites.size"
        class="grid sm:grid-cols-3 gap-4"
      >
        <li
          v-for="([id, item]) in Array.from(favorites)"
          :key="id"
        >
          <ColorPaletteButton
            :colors="item.colors"
            :name="item.text"
            :id="id"
            :to="localePath(`/palette/${id}`)"
          />
        </li>
      </ul>

      <div
        v-else
        class="text-center py-16"
      >
        <UIcon
          name="i-heroicons-heart"
          class="w-12 h-12 mx-auto text-gray-300 mb-4"
        />
        <p class="text-lg font-semibold mb-2">
          {{ $t('favorites.emptyTitle') }}
        </p>
        <p class="text-gray-500 max-w-sm mx-auto">
          {{ $t('favorites.emptyDescription') }}
        </p>
        <UButton
          class="mt-6"
          size="xl"
          color="primary"
          :label="$t('explore.title')"
          :to="localePath('/palette/explore')"
        />
      </div>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { useClipboard } from '@vueuse/core';
import type { SavedColor } from '~/layers/common/composables/useColorFavorites';

const { t } = useI18n();
const localePath = useLocalePath();
const { favorites } = useFavorites();
const { savedColors, removeColor: removeSavedColor } = useColorFavorites();
const { addSuccess } = useNotifications();
const { copy } = useClipboard();

function onRemoveSaved(sc: SavedColor): void {
  removeSavedColor(sc.hex);
}

function onCopySaved(sc: SavedColor): void {
  copy(sc.hex);
  addSuccess(t('paletteMaker.copied'));
}

useSeoMeta({
  title: t('favorites.seoTitle'),
  description: t('favorites.seoDescription'),
  ogTitle: t('favorites.seoTitle'),
  ogDescription: t('favorites.seoDescription'),
  ogImageUrl: `${useRuntimeConfig().public.siteUrl}/img/og.png`
});
</script>
