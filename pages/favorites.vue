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
const { t } = useI18n();
const localePath = useLocalePath();
const { favorites } = useFavorites();

useSeoMeta({
  title: t('favorites.seoTitle'),
  description: t('favorites.seoDescription'),
  ogTitle: t('favorites.seoTitle'),
  ogDescription: t('favorites.seoDescription'),
  ogImageUrl: `${useRuntimeConfig().public.siteUrl}/img/og.png`
});
</script>
