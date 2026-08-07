<template>
  <div>
    <!-- header -->
    <div class="mb-8">
      <h1>
        {{ $t('brandColors.title') }}
      </h1>
      <p class="text-xl font-medium mb-4 max-w-xl">
        {{ $t('brandColors.seoDescription') }}
      </p>
      <p class="text-sm text-gray-500 mb-4">
        {{ $t('brandColors.brandsCount', { count: brands.length }) }} · {{ $t('brandColors.colorsCount', { count: totalColors }) }}
      </p>
    </div>

    <!-- search -->
    <UInput
      v-model="query"
      size="lg"
      icon="i-heroicons-magnifying-glass"
      :placeholder="$t('brandColors.searchPlaceholder')"
      class="max-w-md mb-8"
    />

    <!-- empty state -->
    <p
      v-if="filtered.length === 0"
      class="text-gray-500"
    >
      {{ $t('brandColors.searchEmpty') }}
    </p>

    <!-- brands grid (render acotado a VISIBLE_STEP, "Show more" amplía) -->
    <ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <li
        v-for="brand in visibleBrands"
        :key="brand.slug"
      >
        <div class="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
          <!-- swatch strip -->
          <div class="flex h-16">
            <button
              v-for="(hex, i) in brand.colors"
              :key="hex"
              type="button"
              class="flex-1 min-w-0 hover:brightness-110 transition-all cursor-pointer"
              :style="{ backgroundColor: hex }"
              :title="`${hex} · ${t('brandColors.copyHex')}`"
              :aria-label="`${hex} · ${t('brandColors.copyHex')}`"
              @click="onCopyColor(brand, hex)"
            >
              <span class="sr-only">{{ hex }}</span>
            </button>
          </div>

          <!-- meta -->
          <div class="p-3">
            <div class="flex items-center justify-between gap-2">
              <p class="font-semibold text-sm truncate">
                {{ brand.title }}
              </p>
              <div class="flex items-center gap-1 shrink-0">
                <UButton
                  size="xs"
                  icon="i-heroicons-clipboard-document-check"
                  variant="ghost"
                  color="gray"
                  :aria-label="t('brandColors.copyAll') + ' ' + brand.title"
                  :title="t('brandColors.copyAll')"
                  @click="onCopyAll(brand)"
                />
                <UButton
                  size="xs"
                  icon="i-heroicons-arrow-top-right-on-square"
                  variant="ghost"
                  color="gray"
                  :aria-label="t('brandColors.openBrand') + ' ' + brand.title"
                  :title="t('brandColors.openBrand')"
                  :to="brand.brandUrl"
                  target="_blank"
                  @click="onOpenBrand(brand)"
                />
              </div>
            </div>
            <p class="text-xs text-gray-500 truncate mt-0.5">
              {{ brand.category }}
            </p>

            <!-- hex list -->
            <div class="flex flex-wrap gap-1.5 mt-2">
              <button
                v-for="hex in brand.colors"
                :key="hex"
                type="button"
                class="font-mono text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/40 transition-colors cursor-pointer"
                @click="onCopyColor(brand, hex)"
              >
                {{ hex }}
              </button>
            </div>
          </div>
        </div>
      </li>
    </ul>

    <!-- show more -->
    <div
      v-if="visibleBrands.length < filtered.length"
      class="mt-8 text-center"
    >
      <UButton
        size="md"
        variant="soft"
        color="primary"
        icon="i-heroicons-chevron-down"
        :label="$t('brandColors.showMore')"
        @click="showMore"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useClipboard } from '@vueuse/core';
import { BRAND_COLORS_WITH_COLORS, TOTAL_BRAND_COLORS, searchBrands, type BrandColor } from '~/layers/brand-colors/utils/brand-colors.util';
import { sendPlausibleEvent } from '~/layers/plausible/utils/plausible.util';
import { PlausibleEventName } from '~/layers/plausible/types';

const { t } = useI18n();
const notifications = useNotifications();
const { copy } = useClipboard();

const brands = BRAND_COLORS_WITH_COLORS;
const totalColors = TOTAL_BRAND_COLORS;
const query = ref('');

const VISIBLE_STEP = 60;
const visibleCount = ref(VISIBLE_STEP);

const filtered = computed(() => searchBrands(query.value));
const visibleBrands = computed(() => filtered.value.slice(0, visibleCount.value));

watch(query, () => {
  visibleCount.value = VISIBLE_STEP;
});

function showMore(): void {
  visibleCount.value += VISIBLE_STEP;
}

const title = t('brandColors.seoTitle');
const description = t('brandColors.seoDescription');

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
});

async function onCopyColor(brand: BrandColor, hex: string): Promise<void> {
  await copy(hex);
  notifications.addSuccess(`${brand.title} ${hex} — ${t('brandColors.copied')}`);
  sendPlausibleEvent(PlausibleEventName.BRAND_COLORS_COPIED);
}

async function onCopyAll(brand: BrandColor): Promise<void> {
  await copy(brand.colors.join(', '));
  notifications.addSuccess(`${brand.title} — ${t('brandColors.copyAllCopied')}`);
  sendPlausibleEvent(PlausibleEventName.BRAND_COLORS_COPY_ALL);
}

function onOpenBrand(brand: BrandColor): void {
  sendPlausibleEvent(PlausibleEventName.BRAND_COLORS_BRAND_SITE_OPENED);
}
</script>
