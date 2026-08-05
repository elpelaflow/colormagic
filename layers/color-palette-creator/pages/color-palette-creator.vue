<template>
  <div>
    <!-- header -->
    <div class="mb-8">
      <h1>
        {{ $t('colorPaletteCreator.title') }}
      </h1>
      <p class="text-xl font-medium mb-4 max-w-xl">
        {{ $t('colorPaletteCreator.seoDescription') }}
      </p>
    </div>

    <!-- base color -->
    <div class="border border-gray-200 rounded-2xl overflow-hidden mb-6">
      <div class="p-4 space-y-4">
        <div class="flex items-center justify-between">
          <p class="font-semibold text-sm">
            {{ $t('colorPaletteCreator.baseColor') }}
          </p>
          <ColorNameBadge :name="baseName" />
        </div>

        <div class="flex gap-2 items-center">
          <ColorPicker
            :initial-color="state.baseHex"
            @select="value => state.baseHex = value"
          />
          <UInput
            v-model="state.baseHex"
            placeholder="#000000"
          />
          <UButton
            icon="i-heroicons-sparkles"
            variant="soft"
            :label="$t('colorPaletteCreator.random')"
            @click="randomizeBase"
          />
        </div>

        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-lg border border-gray-200 shrink-0"
            :style="{ background: state.baseHex }"
          />
          <code class="text-xs text-gray-500 font-mono">{{ baseOklchLabel }}</code>
        </div>
      </div>
    </div>

    <!-- controls -->
    <div class="border border-gray-200 rounded-2xl p-4 mb-6 space-y-5">
      <!-- style -->
      <div>
        <p class="font-semibold text-sm mb-2">
          {{ $t('colorPaletteCreator.style') }}
        </p>
        <UButtonGroup size="md">
          <UButton
            v-for="s in STYLES"
            :key="s"
            :label="$t(`colorPaletteCreator.styles.${s}`)"
            :variant="state.style === s ? 'solid' : 'soft'"
            @click="state.style = s"
          />
        </UButtonGroup>
      </div>

      <!-- color count -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <p class="font-semibold text-sm">
            {{ $t('colorPaletteCreator.colorCount') }}
          </p>
          <p class="font-semibold text-sm">
            {{ state.colorCount }}
          </p>
        </div>
        <URange
          v-model="state.colorCount"
          :min="3"
          :max="30"
          :step="1"
          size="lg"
        />
      </div>

      <!-- modifiers -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <p class="font-semibold text-sm">
            {{ $t('colorPaletteCreator.modifiers') }}
          </p>
          <UButton
            size="xs"
            variant="ghost"
            color="gray"
            :label="$t('colorPaletteCreator.modifiersReset')"
            @click="resetModifiers"
          />
        </div>
        <div
          v-for="mod in MODIFIER_KEYS"
          :key="mod"
          class="flex items-center gap-3"
        >
          <span class="w-16 text-sm font-medium shrink-0">
            {{ $t(`colorPaletteCreator.modifierNames.${mod}`) }}
          </span>
          <URange
            v-model="state.modifiers[mod]"
            :min="-1"
            :max="1"
            :step="0.05"
            size="md"
            class="flex-1"
          />
          <span class="w-10 text-right text-xs text-gray-500 font-mono shrink-0">
            {{ state.modifiers[mod].toFixed(2) }}
          </span>
        </div>
      </div>
    </div>

    <!-- export bar -->
    <div class="flex flex-wrap gap-2 mb-6">
      <UButton
        icon="i-heroicons-arrow-down-tray"
        :label="$t('colorPaletteCreator.downloadPng')"
        @click="onExportPng"
      />
      <UButton
        icon="i-heroicons-document-arrow-down"
        :label="$t('colorPaletteCreator.exportPdf')"
        @click="onExportPdf"
      />
      <UButton
        icon="i-heroicons-swatch"
        :label="$t('colorPaletteCreator.exportAse')"
        @click="onExportAse"
      />
    </div>

    <!-- palettes grid -->
    <div class="grid gap-6">
      <div
        v-for="type in PALETTE_TYPES"
        :key="type"
        class="border border-gray-200 rounded-2xl overflow-hidden"
      >
        <div class="flex items-center justify-between p-3">
          <p class="font-semibold">
            {{ $t(`colorPaletteCreator.types.${type}`) }}
          </p>
          <UButton
            size="xs"
            variant="ghost"
            color="gray"
            icon="i-heroicons-clipboard"
            :label="$t('colorPaletteCreator.copyAll')"
            @click="onCopyPalette(displayed[type])"
          />
        </div>

        <div class="flex">
          <div
            v-for="(hex, i) in displayed[type]"
            :key="i"
            class="flex-1 min-w-0"
          >
            <button
              class="w-full h-20 group relative cursor-pointer"
              :style="{ background: hex }"
              :aria-label="`Copy ${hex}`"
              @click="onCopyColor(hex)"
            >
              <span
                class="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-mono px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                :style="{ background: 'rgba(0,0,0,0.55)', color: getContrastTextColor(hex) }"
              >
                {{ hex }}
              </span>
            </button>
            <p class="text-center text-[10px] text-gray-500 font-mono py-1 truncate">
              {{ hex }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useClipboard } from '@vueuse/core';
import { PlausibleEventName } from '~/layers/plausible/types';
import ntc from '~/layers/palette/utils/ntc.util';
import {
  PALETTE_TYPES,
  expandPalette,
  generateAllPalettes,
  paletteToHex,
  type PaletteStyle,
  type PaletteType
} from '~/layers/color-palette-creator/utils/palette-generator.util';
import {
  buildAseFile,
  downloadBlob,
  downloadDataUrl,
  renderPalettePng,
  type PaletteRow
} from '~/layers/color-palette-creator/utils/palette-export.util';
import { hexToOklch } from '~/layers/color-palette-creator/utils/oklch.util';
import { getContrastTextColor } from '~/layers/all-colors/utils/color-formats.util';

const STYLES: PaletteStyle[] = ['square', 'triangle', 'circle', 'diamond'];
const MODIFIER_KEYS = ['sine', 'wave', 'zap', 'block'] as const;

const { t } = useI18n();
const notifications = useNotifications();
const { copy } = useClipboard();

const title = t('colorPaletteCreator.seoTitle');
const description = t('colorPaletteCreator.seoDescription');

const state = reactive({
  baseHex: '#2D6A4F',
  style: 'square' as PaletteStyle,
  colorCount: 6,
  modifiers: { sine: 0, wave: 0, zap: 0, block: 0 }
});

const baseName = computed(() => ntc.name(state.baseHex)[1].toString());

const baseOklch = computed(() => hexToOklch(state.baseHex));
const baseOklchLabel = computed(() => `L ${baseOklch.value.l.toFixed(3)} · C ${baseOklch.value.c.toFixed(3)} · H ${Math.round(baseOklch.value.h)}°`);

const all = computed(() => generateAllPalettes(state.baseHex, {
  style: state.style,
  modifiers: { ...state.modifiers },
  clampToGamut: true
}));

const displayed = computed(() => {
  const out = {} as Record<PaletteType, string[]>;
  for (const type of PALETTE_TYPES) {
    out[type] = paletteToHex(expandPalette(all.value[type], state.colorCount));
  }
  return out;
});

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
});

function randomizeBase(): void {
  const hex = `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
  state.baseHex = hex;
}

function resetModifiers(): void {
  state.modifiers = { sine: 0, wave: 0, zap: 0, block: 0 };
}

function onCopyColor(hex: string): void {
  copy(hex);
  notifications.addSuccess(`Copied ${hex}`);
  sendPlausibleEvent(PlausibleEventName.COLOR_PALETTE_CREATOR_COLOR_COPIED);
}

function onCopyPalette(hexes: string[]): void {
  copy(hexes.join(', '));
  notifications.addSuccess(`Copied ${hexes.length} colors`);
  sendPlausibleEvent(PlausibleEventName.COLOR_PALETTE_CREATOR_PALETTE_COPIED);
}

function rowsForExport(): PaletteRow[] {
  return PALETTE_TYPES.map((type) => ({
    title: t(`colorPaletteCreator.types.${type}`),
    hexes: displayed.value[type]
  }));
}

const fileStem = computed(() => `colormagic-palette-${state.baseHex.replace('#', '')}`);

function onExportPng(): void {
  const dataUrl = renderPalettePng(rowsForExport());
  if (dataUrl) {
    downloadDataUrl(dataUrl, `${fileStem.value}.png`);
    sendPlausibleEvent(PlausibleEventName.COLOR_PALETTE_CREATOR_PNG_DOWNLOADED);
  }
}

function onExportPdf(): void {
  if (typeof window !== 'undefined') {
    window.print();
  }
  sendPlausibleEvent(PlausibleEventName.COLOR_PALETTE_CREATOR_PDF_EXPORTED);
}

function onExportAse(): void {
  const colors = PALETTE_TYPES.flatMap((type) =>
    displayed.value[type].map((hex, i) => ({
      name: `${t(`colorPaletteCreator.types.${type}`)} ${i + 1}`,
      hex
    }))
  );
  downloadBlob(buildAseFile(colors), `${fileStem.value}.ase`, 'application/octet-stream');
  sendPlausibleEvent(PlausibleEventName.COLOR_PALETTE_CREATOR_ASE_DOWNLOADED);
}
</script>
