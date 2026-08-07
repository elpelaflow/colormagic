<template>
  <div>
    <!-- header -->
    <div class="mb-6">
      <h1>
        {{ $t('paletteMaker.title') }}
      </h1>
      <p class="text-xl font-medium mb-5 max-w-xl">
        {{ $t('paletteMaker.seoDescription') }}
      </p>

      <!-- hints de teclado -->
      <div class="flex flex-wrap gap-2 text-sm text-gray-500">
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800">
          <UIcon name="i-heroicons-keyboard" class="w-4 h-4" />
          {{ $t('paletteMaker.hintGenerate') }}
          <kbd class="px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 font-mono text-xs">Space</kbd>
        </span>
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800">
          {{ $t('paletteMaker.hintLock') }}
          <kbd class="px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 font-mono text-xs">Ctrl/Cmd+1..9</kbd>
        </span>

        <!-- modo armonía (ClientOnly: harmonyMode vive en localStorage) -->
        <ClientOnly>
          <label class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 cursor-pointer select-none">
            <UIcon name="i-heroicons-swatch" class="w-4 h-4" />
            <span>{{ $t('paletteMaker.harmonyMode') }}</span>
            <USwitch
              v-model="harmonyMode"
              size="sm"
              :aria-label="$t('paletteMaker.harmonyMode')"
            />
          </label>
          <template #fallback>
            <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 opacity-60">
              <UIcon name="i-heroicons-swatch" class="w-4 h-4" />
              <span>{{ $t('paletteMaker.harmonyMode') }}</span>
              <USkeleton class="w-9 h-5" />
            </span>
          </template>
        </ClientOnly>
      </div>
    </div>

    <!-- lienzo (ClientOnly: los colores viven en localStorage y se generan con
         Math.random, así que SSR y cliente nunca coincidirían → skeleton) -->
    <ClientOnly>
      <template #fallback>
        <div class="flex h-[420px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm">
          <USkeleton
            v-for="index in 5"
            :key="index"
            class="flex-1 h-full rounded-none"
          />
        </div>
      </template>

      <div class="flex h-[420px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm">
        <template
          v-for="(color, index) in colors"
          :key="color.id"
        >
          <ColorColumn
            :color="color"
            :index="index"
            :can-remove="colors.length > MIN_COLORS"
            @remove="onRemove(index)"
            @toggle-lock="onToggleLock(index)"
            @copy="onCopy(color)"
            @save="onSave(color)"
            @info="onInfo(color)"
            @drag-start="onDragStart"
            @drop-at="onDropAt"
            @drag-end="onDragEnd"
          />
          <button
            v-if="index < colors.length - 1"
            class="w-9 shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500
                   hover:text-primary hover:bg-primary/10 transition-colors
                   disabled:opacity-30 disabled:cursor-not-allowed"
            :disabled="colors.length >= MAX_COLORS"
            :title="$t('paletteMaker.addStop')"
            :aria-label="$t('paletteMaker.addStop')"
            @click="onAddIntermediate(index)"
          >
            <UIcon name="i-heroicons-plus" class="w-5 h-5" />
          </button>
        </template>
      </div>
    </ClientOnly>

    <!-- colores guardados -->
    <ClientOnly>
      <section
        v-if="savedColors.length"
        class="mt-8"
      >
        <h2 class="text-lg font-semibold mb-3">
          {{ $t('paletteMaker.savedColorsTitle') }}
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
    </ClientOnly>

    <!-- modal de info del color -->
    <UModal v-model="isInfoModalOpen">
      <div
        v-if="infoDetails"
        class="p-6 space-y-5"
      >
        <div
          class="h-28 rounded-xl flex items-center justify-center"
          :style="{ backgroundColor: infoDetails.hex, color: infoDetails.contrastText }"
        >
          <span class="font-mono font-bold text-xl select-all">
            {{ infoDetails.hex }}
          </span>
        </div>

        <div class="space-y-1">
          <h3 class="text-lg font-semibold">
            {{ infoDetails.name }}
          </h3>
          <p class="text-sm text-gray-500">
            {{ $t('paletteMaker.infoSubtitle') }}
          </p>
        </div>

        <dl class="grid grid-cols-2 gap-3 text-sm font-mono">
          <div class="rounded-lg bg-gray-100 dark:bg-gray-800 p-3">
            <dt class="text-xs font-sans text-gray-500 mb-1">RGB</dt>
            <dd>{{ infoDetails.rgb.r }}, {{ infoDetails.rgb.g }}, {{ infoDetails.rgb.b }}</dd>
          </div>
          <div class="rounded-lg bg-gray-100 dark:bg-gray-800 p-3">
            <dt class="text-xs font-sans text-gray-500 mb-1">HSL</dt>
            <dd>{{ Math.round(infoDetails.hsl.h) }}°, {{ Math.round(infoDetails.hsl.s) }}%, {{ Math.round(infoDetails.hsl.l) }}%</dd>
          </div>
          <div class="rounded-lg bg-gray-100 dark:bg-gray-800 p-3">
            <dt class="text-xs font-sans text-gray-500 mb-1">HSV</dt>
            <dd>{{ Math.round(infoDetails.hsv.h) }}°, {{ Math.round(infoDetails.hsv.s) }}%, {{ Math.round(infoDetails.hsv.v) }}%</dd>
          </div>
          <div class="rounded-lg bg-gray-100 dark:bg-gray-800 p-3">
            <dt class="text-xs font-sans text-gray-500 mb-1">CMYK</dt>
            <dd>{{ Math.round(infoDetails.cmyk.c) }}, {{ Math.round(infoDetails.cmyk.m) }}, {{ Math.round(infoDetails.cmyk.y) }}, {{ Math.round(infoDetails.cmyk.k) }}</dd>
          </div>
          <div class="col-span-2 rounded-lg bg-gray-100 dark:bg-gray-800 p-3">
            <dt class="text-xs font-sans text-gray-500 mb-1">LAB</dt>
            <dd>L {{ infoDetails.lab.l.toFixed(2) }} · a {{ infoDetails.lab.a.toFixed(2) }} · b {{ infoDetails.lab.b.toFixed(2) }}</dd>
          </div>
        </dl>

        <div>
          <p class="text-sm font-medium mb-2">
            {{ $t('paletteMaker.tintsShades') }}
          </p>
          <div class="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
            <div
              v-for="(s, i) in infoDetails.shades"
              :key="i"
              class="flex-1 h-10"
              :style="{ backgroundColor: s.hex }"
              :title="s.hex"
            />
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <UButton
            variant="soft"
            icon="i-heroicons-clipboard"
            :label="$t('paletteMaker.copyHex')"
            @click="onCopyModal"
          />
          <UButton
            color="primary"
            icon="i-heroicons-arrow-top-right-on-square"
            :label="$t('paletteMaker.openColorPage')"
            :to="infoColorPageUrl"
            target="_blank"
            @click="onOpenColorPage"
          />
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { useClipboard } from '@vueuse/core';
import { useColorFavorites, type SavedColor } from '~/layers/common/composables/useColorFavorites';
import {
  MIN_COLORS,
  MAX_COLORS,
  usePaletteMaker,
  type MakerColor
} from '~/layers/palette-maker/composables/usePaletteMaker';
import { getColorName } from '../utils/palette-maker.util';
import { hexToRgb, rgbToHsl, getContrastTextColor } from '~/layers/common/utils/color-converter.util';
import { rgbToHsv, rgbToCmyk, rgbToLab, generateShadeVariants } from '~/layers/all-colors/utils/color-formats.util';
import { formatOgUrl } from '~/layers/og/utils/og.util';
import { sendPlausibleEvent } from '~/layers/plausible/utils/plausible.util';
import { PlausibleEventName } from '~/layers/plausible/types';

const { t } = useI18n();
const { addSuccess } = useNotifications();
const { copy } = useClipboard();

const {
  colors,
  harmonyMode,
  generate,
  addIntermediate,
  removeColor,
  toggleLock,
  moveColor
} = usePaletteMaker();

watch(harmonyMode, (on) => {
  if (on) {
    sendPlausibleEvent(PlausibleEventName.PALETTE_MAKER_HARMONY_TOGGLED);
  }
});
const { savedColors, toggleSave, removeColor: removeSavedColor } = useColorFavorites();

const {
  isOpen: isInfoModalOpen,
  data: infoModalData,
  open: openInfoModal
} = useModalV2<MakerColor>();
const dragIndex = ref<number | null>(null);

const title = t('paletteMaker.seoTitle');
const description = t('paletteMaker.seoDescription');

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
});

/* ---------- acciones ---------- */

function onGenerate(): void {
  generate();
  sendPlausibleEvent(PlausibleEventName.PALETTE_MAKER_GENERATED);
}

function onAddIntermediate(index: number): void {
  addIntermediate(index);
  sendPlausibleEvent(PlausibleEventName.PALETTE_MAKER_STOP_ADDED);
}

function onRemove(index: number): void {
  removeColor(index);
  sendPlausibleEvent(PlausibleEventName.PALETTE_MAKER_COLUMN_REMOVED);
}

function onToggleLock(index: number): void {
  toggleLock(index);
}

function onCopy(color: MakerColor): void {
  copy(color.hex);
  addSuccess(t('paletteMaker.copied'));
  sendPlausibleEvent(PlausibleEventName.PALETTE_MAKER_COLOR_COPIED);
}

function onSave(color: MakerColor): void {
  const saved = toggleSave(color.hex, getColorName(color.hex));
  sendPlausibleEvent(saved
    ? PlausibleEventName.PALETTE_MAKER_COLOR_SAVED
    : PlausibleEventName.PALETTE_MAKER_COLOR_UNSAVED);
}

function onInfo(color: MakerColor): void {
  openInfoModal(color);
}

function onCopyModal(): void {
  const color = infoModalData.value;
  if (color) onCopy(color);
}

function onOpenColorPage(): void {
  sendPlausibleEvent(PlausibleEventName.PALETTE_MAKER_COLOR_PAGE_OPENED);
}

function onDragStart(index: number): void {
  dragIndex.value = index;
}

function onDropAt(index: number): void {
  if (dragIndex.value !== null) {
    moveColor(dragIndex.value, index);
  }
  dragIndex.value = null;
}

/** Si el drag se suelta fuera de una columna, descarta el índice pendiente. */
function onDragEnd(): void {
  dragIndex.value = null;
}

function onRemoveSaved(sc: SavedColor): void {
  removeSavedColor(sc.hex);
}

function onCopySaved(sc: SavedColor): void {
  copy(sc.hex);
  addSuccess(t('paletteMaker.copied'));
  sendPlausibleEvent(PlausibleEventName.PALETTE_MAKER_COLOR_COPIED);
}

/* ---------- atajos de teclado ---------- */

function onKeydown(e: KeyboardEvent): void {
  // No generar paletas nuevas mientras el modal de info está abierto
  if (isInfoModalOpen.value) return;

  const target = e.target as HTMLElement | null;
  const tag = target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;

  // Barra espaciadora → nueva paleta (sin repetir con la tecla sostenida)
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    onGenerate();
    return;
  }

  // Ctrl/Cmd + 1..9/0 → fijar/desfijar color N
  if ((e.ctrlKey || e.metaKey) && /^[0-9]$/.test(e.key)) {
    const index = e.key === '0' ? 9 : Number(e.key) - 1;
    if (index < colors.value.length) {
      onToggleLock(index);
    }
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

/* ---------- modal info ---------- */

const infoDetails = computed(() => {
  const color = infoModalData.value;
  if (!color) return null;
  const hex = color.hex;
  const rgb = hexToRgb(hex);
  return {
    hex,
    name: getColorName(hex),
    contrastText: getContrastTextColor(hex),
    rgb,
    hsl: rgbToHsl(rgb),
    hsv: rgbToHsv(rgb),
    cmyk: rgbToCmyk(rgb),
    lab: rgbToLab(rgb),
    shades: generateShadeVariants(hex, 6)
  };
});

const infoColorPageUrl = computed(() => {
  const details = infoDetails.value;
  if (!details) return '';
  return `${useRuntimeConfig().public.siteUrl}${formatOgUrl([details.hex], encodeURIComponent(details.name))}`;
});
</script>
