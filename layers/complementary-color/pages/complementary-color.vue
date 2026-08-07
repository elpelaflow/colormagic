<template>
  <div>
    <!-- header -->
    <div class="mb-8">
      <h1>
        {{ $t('complementaryColor.title') }}
      </h1>
      <p class="text-xl font-medium mb-4 max-w-xl">
        {{ $t('complementaryColor.seoDescription') }}
      </p>
    </div>

    <!-- panel dividido: base | complementario -->
    <div class="grid sm:grid-cols-2 gap-4 mb-6">
      <div class="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm">
        <div
          class="relative h-44 sm:h-60 flex flex-col justify-between p-4 transition-colors duration-150"
          :style="{ backgroundColor: selectedHex, color: baseContrast }"
        >
          <span class="text-xs font-semibold uppercase tracking-wider opacity-80">
            {{ $t('complementaryColor.baseColor') }}
          </span>
          <div class="space-y-0.5">
            <div class="font-mono font-bold text-lg select-all">
              {{ selectedHex }}
            </div>
            <div class="text-sm truncate max-w-full">
              {{ baseName }}
            </div>
          </div>
        </div>
        <div class="p-3 flex items-center gap-2 bg-white dark:bg-gray-900">
          <UButton
            size="xs"
            variant="soft"
            color="primary"
            icon="i-heroicons-clipboard"
            :label="$t('complementaryColor.copyHex')"
            @click="onCopy(selectedHex)"
          />
          <UButton
            size="xs"
            variant="ghost"
            color="gray"
            icon="i-heroicons-arrow-top-right-on-square"
            :label="$t('complementaryColor.openColorPage')"
            :to="baseColorPageUrl"
            target="_blank"
            @click="onOpenColorPage"
          />
        </div>
      </div>

      <div class="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm">
        <div
          class="relative h-44 sm:h-60 flex flex-col justify-between p-4 transition-colors duration-150"
          :style="{ backgroundColor: complementaryHex, color: compContrast }"
        >
          <span class="text-xs font-semibold uppercase tracking-wider opacity-80">
            {{ $t('complementaryColor.complementary') }}
          </span>
          <div class="space-y-0.5">
            <div class="font-mono font-bold text-lg select-all">
              {{ complementaryHex }}
            </div>
            <div class="text-sm truncate max-w-full">
              {{ compName }}
            </div>
          </div>
        </div>
        <div class="p-3 flex items-center gap-2 bg-white dark:bg-gray-900">
          <UButton
            size="xs"
            variant="soft"
            color="primary"
            icon="i-heroicons-clipboard"
            :label="$t('complementaryColor.copyHex')"
            @click="onCopy(complementaryHex)"
          />
          <UButton
            size="xs"
            variant="ghost"
            color="gray"
            icon="i-heroicons-arrow-top-right-on-square"
            :label="$t('complementaryColor.openColorPage')"
            :to="compColorPageUrl"
            target="_blank"
            @click="onOpenColorPage"
          />
        </div>
      </div>
    </div>

    <!-- selector del color base -->
    <div class="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
      <div class="flex flex-col sm:flex-row gap-4">
        <!-- saturation box -->
        <div class="relative h-44 sm:h-56 sm:flex-1 rounded-xl overflow-hidden">
          <Saturation
            :value="pickerColors"
            @change="onSaturationChange"
          />
        </div>

        <!-- hex preview + input + random -->
        <div class="flex sm:flex-col gap-3 items-center sm:items-stretch sm:w-32">
          <div
            class="w-12 h-12 rounded-xl border border-gray-200 dark:border-gray-700 shrink-0"
            :style="{ backgroundColor: selectedHex }"
          />
          <UInput
            v-model="hexInput"
            :placeholder="$t('complementaryColor.hexPlaceholder')"
            class="w-full"
            @keyup.enter="commitHex"
            @blur="commitHex"
          />
          <UButton
            icon="i-heroicons-arrow-path"
            variant="soft"
            color="primary"
            :label="$t('complementaryColor.random')"
            class="w-full"
            @click="onRandom"
          />
        </div>
      </div>

      <!-- hue bar -->
      <div class="mt-4 h-4 relative rounded-full overflow-hidden">
        <Hue
          :value="pickerColors"
          @change="onHueChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Saturation, Hue } from '@ckpack/vue-color';
import { useClipboard } from '@vueuse/core';
import { hexToRgb, rgbToHex, normalizeHex, getContrastTextColor } from '~/layers/common/utils/color-converter.util';
import { rgbToHsv, hsvToRgb, hsvToHsl } from '~/layers/all-colors/utils/color-formats.util';
import { hexToName } from '~/layers/palette/utils/color-converter.util';
import { getComplementaryHex } from '../utils/complementary-color.util';
import { getRandomHexColor } from '~/layers/random-color/utils/random-color.util';
import { formatOgUrl } from '~/layers/og/utils/og.util';
import { sendPlausibleEvent } from '~/layers/plausible/utils/plausible.util';
import { PlausibleEventName } from '~/layers/plausible/types';

interface ChangePayload {
  h: number
  s: number
  v: number
  a?: number
  source?: string
}

const { t } = useI18n();
const { addSuccess } = useNotifications();
const { copy } = useClipboard();

const selectedHex = ref('#1B4474');
const hexInput = ref('#1B4474');
const pickerHsv = ref<{ h: number, s: number, v: number }>({ h: 212, s: 0.77, v: 0.45 });

const complementaryHex = computed(() => getComplementaryHex(selectedHex.value));
const baseContrast = computed(() => getContrastTextColor(selectedHex.value));
const compContrast = computed(() => getContrastTextColor(complementaryHex.value));
const baseName = computed(() => getColorName(selectedHex.value));
const compName = computed(() => getColorName(complementaryHex.value));

const pickerColors = computed(() => {
  const hsv = { h: pickerHsv.value.h, s: pickerHsv.value.s, v: pickerHsv.value.v, a: 1 };
  const hsl = hsvToHsl({ h: pickerHsv.value.h, s: pickerHsv.value.s * 100, v: pickerHsv.value.v * 100 });
  const rgb = hsvToRgb({ h: pickerHsv.value.h, s: pickerHsv.value.s * 100, v: pickerHsv.value.v * 100 });
  return {
    hsl: { h: hsl.h, s: hsl.s / 100, l: hsl.l / 100, a: 1 },
    hsv,
    hex: selectedHex.value,
    rgb: { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 },
    a: 1,
    source: 'hex'
  };
});

const title = t('complementaryColor.seoTitle');
const description = t('complementaryColor.seoDescription');

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
});

const siteUrl = useRuntimeConfig().public.siteUrl;

const baseColorPageUrl = computed(() =>
  `${siteUrl}${formatOgUrl([selectedHex.value], encodeURIComponent(baseName.value))}`
);
const compColorPageUrl = computed(() =>
  `${siteUrl}${formatOgUrl([complementaryHex.value], encodeURIComponent(compName.value))}`
);

/* ---------- helpers ---------- */

function getColorName(hex: string): string {
  const name = hexToName(hex);
  return typeof name === 'string' && name ? name : hex;
}

function setHex(hex: string): void {
  selectedHex.value = hex;
  hexInput.value = hex;
  const hsv = rgbToHsv(hexToRgb(hex));
  pickerHsv.value = { h: hsv.h, s: hsv.s / 100, v: hsv.v / 100 };
}

function onSaturationChange(payload: ChangePayload): void {
  pickerHsv.value = { h: payload.h, s: payload.s, v: payload.v ?? 1 };
  selectedHex.value = rgbToHex(hsvToRgb({ h: pickerHsv.value.h, s: pickerHsv.value.s * 100, v: pickerHsv.value.v * 100 }));
  hexInput.value = selectedHex.value;
}

function onHueChange(payload: ChangePayload): void {
  pickerHsv.value = { h: payload.h, s: pickerHsv.value.s, v: pickerHsv.value.v };
  selectedHex.value = rgbToHex(hsvToRgb({ h: pickerHsv.value.h, s: pickerHsv.value.s * 100, v: pickerHsv.value.v * 100 }));
  hexInput.value = selectedHex.value;
}

function commitHex(): void {
  const normalized = normalizeHex(hexInput.value);
  if (normalized !== null) {
    setHex(normalized);
  } else {
    hexInput.value = selectedHex.value;
  }
}

function onRandom(): void {
  setHex(getRandomHexColor());
  sendPlausibleEvent(PlausibleEventName.COMPLEMENTARY_COLOR_RANDOM);
}

function onCopy(hex: string): void {
  copy(hex);
  addSuccess(t('complementaryColor.copied'));
  sendPlausibleEvent(PlausibleEventName.COMPLEMENTARY_COLOR_COPIED);
}

function onOpenColorPage(): void {
  sendPlausibleEvent(PlausibleEventName.COMPLEMENTARY_COLOR_PAGE_OPENED);
}
</script>
