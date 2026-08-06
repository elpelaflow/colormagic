<template>
  <div class="relative">
    <UButton
      class="w-full"
      :ui="{ rounded: 'rounded-xl'}"
      :to="to"
      :loading="loading"
      :disabled="disabled"
    >
      <span class="w-full flex rounded-lg relative overflow-hidden">
        <!-- name -->
        <ColorNameBadge
          :name="name"
          class="bottom-2 left-2 absolute"
        />

        <!-- colors -->
        <span
          v-for="(color, colorIndex) in colors"
          :key="colorIndex"
          :style="{
            'background': color
          }"
          class="w-full h-20 block"
        />
      </span>
    </UButton>

    <!-- favorite heart (solo si la paleta tiene id en la DB).
         ClientOnly: el estado del favorito vive en localStorage (solo cliente),
         asi el SSR pinta el fallback y evita mismatches de hidratacion -->
    <ClientOnly>
      <template #fallback>
        <UButton
          v-if="id !== undefined"
          class="absolute top-2 right-2 z-10 text-gray-500"
          :ui="{ rounded: 'rounded-full' }"
          color="white"
          square
          size="sm"
          icon="i-heroicons-heart"
          :aria-label="t('favorites.addFavorite')"
          :disabled="disabled || loading"
        />
      </template>

      <UButton
        v-if="id !== undefined"
        class="absolute top-2 right-2 z-10"
        :ui="{ rounded: 'rounded-full' }"
        color="white"
        square
        size="sm"
        :icon="favorite ? 'i-heroicons-heart-solid' : 'i-heroicons-heart'"
        :class="favorite ? 'text-red-500' : 'text-gray-500'"
        :aria-label="favorite ? t('favorites.removeFavorite') : t('favorites.addFavorite')"
        :disabled="disabled || loading"
        @click="toggleFavorite()"
      />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { PlausibleEventName } from '~/layers/plausible/types';

export interface Props {
  colors: string[]
  name: string
  to?: string
  id?: string
  loading?: boolean
  disabled?: boolean
}

const props = defineProps<Props>();

const { t } = useI18n();
const { isFavorite, toggleFavorite: toggle } = useFavorites();

const favorite = computed(() => props.id !== undefined && isFavorite(props.id));

function toggleFavorite(): void {
  if (props.id === undefined) {
    return;
  }

  const nowFavorite = toggle({
    id: props.id,
    colors: props.colors,
    text: props.name,
    tags: [],
    createdAt: new Date().toISOString()
  });

  sendPlausibleEvent(nowFavorite ? PlausibleEventName.FAVORITE_ADDED : PlausibleEventName.FAVORITE_REMOVED);
}
</script>
