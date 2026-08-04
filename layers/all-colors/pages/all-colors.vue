<template>
  <div>
    <!-- header -->
    <div class="mb-8">
      <h1>
        {{ $t('allColors.title') }}
      </h1>

      <p class="text-xl font-medium mb-4 max-w-xl">
        {{ $t('allColors.seoDescription') }}
      </p>
    </div>

    <!-- section: shades & tints -->
    <section>
      <div class="mb-6">
        <h2 class="text-2xl font-semibold mb-1">
          {{ $t('allColors.shadesTintsTitle') }}
        </h2>
        <p class="text-gray-500 max-w-xl">
          {{ $t('allColors.shadesTintsDescription') }}
        </p>
      </div>

      <!-- panel: selector (top) + formats (bottom) -->
      <div class="flex flex-col gap-6 mb-8">
        <!-- selector -->
        <div class="border border-gray-200 rounded-2xl p-4">
          <p class="font-semibold text-sm mb-3">
            {{ $t('allColors.selectColor') }}
          </p>

          <div class="grid sm:grid-cols-[1fr_auto] gap-4 items-start">
            <!-- saturation box -->
            <div class="relative h-44 sm:h-56 rounded-xl overflow-hidden">
              <Saturation
                :value="pickerColors"
                @change="onSaturationChange"
              />
            </div>

            <!-- hex preview + input -->
            <div class="flex sm:flex-col gap-3 items-center sm:items-stretch sm:w-32">
              <div
                class="w-12 h-12 sm:h-16 rounded-lg border border-gray-200 shrink-0"
                :style="{ background: selectedHex }"
              />
              <UInput
                v-model="hexInput"
                :placeholder="$t('allColors.hexInputPlaceholder')"
                class="w-full"
                @keyup.enter="commitHex"
                @blur="commitHex"
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

        <!-- formats + actions -->
        <div class="border border-gray-200 rounded-2xl p-4 flex flex-col gap-4">
          <p class="font-semibold text-sm">
            {{ $t('allColors.formatsTitle') }}
          </p>

          <!-- quick actions -->
          <div class="flex flex-wrap gap-2">
            <UButton
              icon="i-heroicons-clipboard"
              :label="$t('allColors.copyHex')"
              size="md"
              color="primary"
              @click="copyHex"
            />
            <UButton
              icon="i-heroicons-sparkles"
              :label="$t('allColors.randomColor')"
              size="md"
              variant="soft"
              @click="randomColor"
            />
            <UButton
              icon="i-heroicons-arrow-top-right-on-square"
              :label="$t('allColors.openColorPage')"
              size="md"
              variant="soft"
              :to="colorPageUrl"
              target="_blank"
              @click="onOpenColorPage"
            />
            <UButton
              icon="i-heroicons-arrow-down-tray"
              :label="$t('allColors.downloadPng')"
              size="md"
              variant="soft"
              :to="colorPageUrl"
              download
              target="_blank"
            />
          </div>

          <!-- formats list -->
          <ul class="grid sm:grid-cols-2 gap-x-6 divide-y divide-gray-100">
            <li
              v-for="format in formats"
              :key="format.key"
              class="flex items-center justify-between gap-2 py-2 border-b border-gray-100 sm:border-b-0"
            >
              <span class="text-sm font-semibold text-gray-600 w-24 shrink-0">
                {{ format.label }}
              </span>
              <code class="text-xs text-gray-500 text-right break-all">{{ format.value }}</code>
              <UButton
                icon="i-heroicons-clipboard"
                size="xs"
                color="gray"
                variant="ghost"
                :aria-label="`Copy ${format.label}`"
                @click="copyFormat(format)"
              />
            </li>
          </ul>
        </div>
      </div>

      <!-- lower panel: tints & shades grid -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <p class="font-semibold text-sm">
            {{ $t('allColors.variantsTitle') }}
          </p>
          <p class="text-xs text-gray-500 font-mono">
            {{ selectedHex.toUpperCase() }}
          </p>
        </div>

        <ul class="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 gap-2">
          <li
            v-for="variant in variants"
            :key="variant.hex"
            class="border border-gray-200 rounded-xl overflow-hidden"
          >
            <!-- swatch -->
            <div
              class="h-16 relative"
              :style="{ background: variant.hex }"
            >
              <UBadge
                size="xs"
                color="gray"
                variant="soft"
                class="absolute top-1 left-1"
              >
                {{ $t(`allColors.variantKind.${variant.kind}`) }}
              </UBadge>
            </div>

            <!-- info -->
            <div class="p-1.5 bg-white flex items-center justify-between gap-1">
              <span class="text-xs font-mono">{{ variant.hex }}</span>
              <UButton
                icon="i-heroicons-clipboard"
                size="xs"
                color="gray"
                variant="ghost"
                :aria-label="`Copy ${variant.hex}`"
                @click="copyShade(variant.hex)"
              />
            </div>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { Saturation, Hue } from '@ckpack/vue-color';
import { useClipboard } from '@vueuse/core';
import { PlausibleEventName } from '~/layers/plausible/types';
import ntc from '~/layers/palette/utils/ntc.util';
import { formatOgUrl } from '~/layers/og/utils/og.util';
import { getRandomHexColor } from '~/layers/random-color/utils/random-color.util';
import {
  generateShadeVariants,
  hexToRgb,
  hsvToRgb,
  hsvToHsl,
  normalizeHex,
  rgbToCmyk,
  rgbToHex,
  rgbToHsl,
  rgbToHunterLab,
  rgbToHsv,
  rgbToLab,
  rgbToXyz,
  rgbToYuv,
  rgbToYxy,
  type Cmyk,
  type Hsl,
  type Hsv,
  type Lab,
  type Rgb,
  type Xyz,
  type Yxy
} from '~/layers/all-colors/utils/color-formats.util';

interface PickerColors {
  hsl: Hsl & { a: number }
  hsv: Hsv & { a: number }
  hex: string
  rgb: Rgb & { a: number }
  a: number
  source: string
}

interface ChangePayload {
  h: number
  s: number
  v?: number
  l?: number
  a: number
  source: string
}

const { t } = useI18n();
const { copy } = useClipboard();

const title = t('allColors.seoTitle');
const description = t('allColors.seoDescription');

const selectedHex = ref('#1B4474');
const hexInput = ref('#1B4474');

const pickerHsv = ref<{ h: number, s: number, v: number }>({ h: 212, s: 0.77, v: 0.45 });

function syncPickerFromHex(hex: string): void {
  const hsv = rgbToHsv(hexToRgb(hex));
  pickerHsv.value = { h: hsv.h, s: hsv.s / 100, v: hsv.v / 100 };
}

syncPickerFromHex(selectedHex.value);

const pickerColors = computed<PickerColors>(() => {
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

const formats = computed(() => {
  const hex = selectedHex.value;
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb);
  const hsv = rgbToHsv(rgb);
  const cmyk: Cmyk = rgbToCmyk(rgb);
  const lab: Lab = rgbToLab(rgb);
  const hunterLab: Lab = rgbToHunterLab(rgb);
  const xyz: Xyz = rgbToXyz(rgb);
  const yxy: Yxy = rgbToYxy(rgb);
  const yuv: Rgb = rgbToYuv(rgb);

  return [
    { key: 'hex', label: 'HEX', value: hex.toUpperCase() },
    { key: 'rgb', label: 'RGB', value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` },
    { key: 'hsl', label: 'HSL', value: `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)` },
    { key: 'hsv', label: 'HSV', value: `hsv(${Math.round(hsv.h)}, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%)` },
    { key: 'cmyk', label: 'CMYK', value: `cmyk(${round1(cmyk.c)}%, ${round1(cmyk.m)}%, ${round1(cmyk.y)}%, ${round1(cmyk.k)}%)` },
    { key: 'cieLab', label: 'CIE-LAB', value: `lab(${round1(lab.l)}, ${round1(lab.a)}, ${round1(lab.b)})` },
    { key: 'hunterLab', label: 'Hunter-LAB', value: `lab(${round1(hunterLab.l)}, ${round1(hunterLab.a)}, ${round1(hunterLab.b)})` },
    { key: 'xyz', label: 'XYZ', value: `xyz(${round2(xyz.x)}, ${round2(xyz.y)}, ${round2(xyz.z)})` },
    { key: 'yxy', label: 'YXY', value: `yxy(${round2(yxy.y)}, ${round4(yxy.x)}, ${round4(yxy.yChromaticity)})` },
    { key: 'yuv', label: 'YUV', value: `yuv(${Math.round(yuv.r)}, ${Math.round(yuv.g)}, ${Math.round(yuv.b)})` }
  ];
});

const variants = computed(() => generateShadeVariants(selectedHex.value, 10));

const colorName = computed(() => ntc.name(selectedHex.value)[1].toString());

const siteUrl = useRuntimeConfig().public.siteUrl;

const colorPageUrl = computed(() => `${siteUrl}${formatOgUrl([selectedHex.value], encodeURIComponent(colorName.value))}`);

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImageUrl: colorPageUrl
});

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function setHex(hex: string): void {
  selectedHex.value = hex;
  hexInput.value = hex;
  syncPickerFromHex(hex);
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

function copyHex(): void {
  copy(selectedHex.value);
  sendPlausibleEvent(PlausibleEventName.ALL_COLORS_COLOR_COPIED);
}

function copyFormat(format: { value: string }): void {
  copy(format.value);
  sendPlausibleEvent(PlausibleEventName.ALL_COLORS_COLOR_COPIED);
}

function copyShade(hex: string): void {
  copy(hex);
  sendPlausibleEvent(PlausibleEventName.ALL_COLORS_SHADE_COPIED);
}

function randomColor(): void {
  setHex(getRandomHexColor());
  sendPlausibleEvent(PlausibleEventName.ALL_COLORS_RANDOM_COLOR_GENERATED);
}

function onOpenColorPage(): void {
  sendPlausibleEvent(PlausibleEventName.ALL_COLORS_COLOR_PAGE_OPENED);
}
</script>