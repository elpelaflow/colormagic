<template>
  <div>
    <!-- header -->
    <div class="mb-8">
      <h1>
        {{ $t('skinTonePalette.title') }}
      </h1>
      <p class="text-xl font-medium mb-4 max-w-xl">
        {{ $t('skinTonePalette.seoDescription') }}
      </p>
    </div>

    <!-- copy all -->
    <UButton
      size="lg"
      icon="i-heroicons-clipboard-document-check"
      :label="$t('skinTonePalette.copyAll')"
      :disabled="isCopyingAll"
      class="mb-8"
      @click="onCopyAll"
    />

    <!-- groups -->
    <div
      v-for="group in groups"
      :key="group.id"
      class="mb-10"
    >
      <p class="text-lg font-bold">
        {{ t(group.titleKey) }}
      </p>
      <p class="text-sm text-gray-500 mb-4 max-w-xl">
        {{ t(group.descriptionKey) }}
      </p>

      <ul class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <li
          v-for="tone in group.tones"
          :key="tone.hex"
        >
          <div class="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
            <!-- swatch: click → color page -->
            <button
              type="button"
              class="block w-full h-20 hover:scale-105 hover:brightness-105 transition-transform cursor-pointer"
              :style="{ backgroundColor: tone.hex }"
              :aria-label="t('skinTonePalette.openColorPage', { name: tone.name })"
              :title="t('skinTonePalette.openColorPage', { name: tone.name })"
              @click="onOpenColorPage(tone)"
            />

            <div class="p-2">
              <!-- name + undertone -->
              <p class="font-semibold text-sm truncate">
                {{ tone.name }}
              </p>
              <p class="text-xs text-gray-500 truncate">
                {{ t(`skinTonePalette.undertones.${tone.undertone}`) }}
              </p>

              <!-- hex + copy -->
              <div class="flex items-center justify-between gap-1 mt-1">
                <p class="font-mono text-xs text-gray-600">
                  {{ tone.hex }}
                </p>
                <UButton
                  size="xs"
                  icon="i-heroicons-clipboard"
                  variant="ghost"
                  :aria-label="t('skinTonePalette.copyHex') + ' ' + tone.hex"
                  :title="t('skinTonePalette.copyHex')"
                  @click="onCopyHex(tone)"
                />
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <!-- naming note -->
    <div class="border border-gray-200 rounded-lg p-4 text-sm text-gray-500">
      {{ $t('skinTonePalette.namingNote') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useClipboard } from '@vueuse/core';
import { ALL_SKIN_TONE_HEXES, SKIN_TONE_GROUPS, type SkinTone } from '~/layers/skin-tone-palette/utils/skin-tone-palette.util';
import { formatOgUrl } from '~/layers/og/utils/og.util';
import { PlausibleEventName } from '~/layers/plausible/types';

const { t } = useI18n();
const notifications = useNotifications();
const { copy } = useClipboard();

const groups = SKIN_TONE_GROUPS;
const isCopyingAll = ref(false);
const siteUrl = useRuntimeConfig().public.siteUrl;

const title = t('skinTonePalette.seoTitle');
const description = t('skinTonePalette.seoDescription');

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImageUrl: `${siteUrl}${formatOgUrl([ALL_SKIN_TONE_HEXES[0]], encodeURIComponent('Skin Tone Palette'))}`
});

/** Color page compartida de una muestra (mismo patrón que color-mixer/all-colors). */
function colorPageUrl(tone: SkinTone): string {
  return `${siteUrl}${formatOgUrl([tone.hex], encodeURIComponent(tone.name))}`;
}

function onOpenColorPage(tone: SkinTone): void {
  window.open(colorPageUrl(tone), '_blank');
  sendPlausibleEvent(PlausibleEventName.SKIN_TONE_COLOR_PAGE_OPENED);
}

async function onCopyHex(tone: SkinTone): Promise<void> {
  await copy(tone.hex);
  notifications.addSuccess(`${tone.name} ${tone.hex} — ${t('skinTonePalette.copied')}`);
  sendPlausibleEvent(PlausibleEventName.SKIN_TONE_COPIED);
}

async function onCopyAll(): Promise<void> {
  if (isCopyingAll.value) return;
  isCopyingAll.value = true;
  try {
    await copy(ALL_SKIN_TONE_HEXES.join(', '));
    notifications.addSuccess(t('skinTonePalette.copyAllCopied'));
    sendPlausibleEvent(PlausibleEventName.SKIN_TONE_COPY_ALL);
  } finally {
    isCopyingAll.value = false;
  }
}
</script>
