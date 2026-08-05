<template>
  <div>
    <!-- header -->
    <div class="mb-8">
      <h1>
        {{ $t('gradientGenerator.title') }}
      </h1>
      <p class="text-xl font-medium mb-4 max-w-xl">
        {{ $t('gradientGenerator.seoDescription') }}
      </p>
    </div>

    <!-- live preview -->
    <div class="border border-gray-200 rounded-2xl overflow-hidden mb-6">
      <div
        class="h-64 sm:h-80 w-full"
        :style="{ background: gradientValue }"
      />

      <div class="p-4 bg-white">
        <div class="flex items-center justify-between gap-2 flex-wrap mb-2">
          <p class="text-sm font-semibold">
            {{ $t('gradientGenerator.previewCss') }}
          </p>
          <UButton
            size="sm"
            variant="soft"
            icon="i-heroicons-clipboard"
            :label="$t('gradientGenerator.copyCss')"
            @click="onCopyCss"
          />
        </div>
        <code class="block text-xs text-gray-600 font-mono bg-gray-50 rounded-lg p-3 break-all">
          {{ cssDeclaration }}
        </code>
      </div>
    </div>

    <!-- config: type + angle -->
    <div class="border border-gray-200 rounded-2xl p-4 mb-6 space-y-5">
      <!-- gradient type -->
      <div>
        <p class="font-semibold text-sm mb-2">
          {{ $t('gradientGenerator.gradientType') }}
        </p>
        <UButtonGroup size="md">
          <UButton
            v-for="g in GRADIENT_TYPES"
            :key="g"
            :label="$t(`gradientGenerator.types.${g}`)"
            :variant="state.type === g ? 'solid' : 'soft'"
            @click="state.type = g"
          />
        </UButtonGroup>
      </div>

      <!-- angle (applies to linear direction / conic start, not radial) -->
      <div :class="{ 'opacity-50 pointer-events-none': state.type === 'radial' }">
        <div class="flex items-center justify-between mb-2">
          <p class="font-semibold text-sm">
            {{ $t('gradientGenerator.angle') }}
          </p>
          <p class="font-semibold text-sm">
            {{ state.angle }}°
          </p>
        </div>
        <div class="flex items-center gap-3">
          <URange
            v-model="state.angle"
            :min="0"
            :max="360"
            :step="1"
            size="lg"
            class="flex-1"
          />
          <UInput
            v-model="angleInput"
            type="number"
            :min="0"
            :max="360"
            class="w-24 shrink-0"
            :aria-label="$t('gradientGenerator.angle')"
          />
        </div>
      </div>
    </div>

    <!-- color stops -->
    <div class="border border-gray-200 rounded-2xl p-4 mb-6">
      <div class="flex items-center justify-between mb-4">
        <p class="font-semibold text-sm">
          {{ $t('gradientGenerator.stopsTitle') }}
        </p>
        <UButton
          size="sm"
          icon="i-heroicons-plus"
          :label="$t('gradientGenerator.addStop')"
          :disabled="state.stops.length >= MAX_STOPS"
          @click="addStop"
        />
      </div>

      <ul class="space-y-3">
        <li
          v-for="stop in state.stops"
          :key="stop.id"
          class="border border-gray-200 rounded-xl p-3"
        >
          <div class="flex items-center gap-2 mb-2">
            <div
              class="w-8 h-8 rounded-lg border border-gray-200 shrink-0"
              :style="{ background: stop.color }"
            />

            <ColorPicker
              :initial-color="stop.color"
              @select="value => updateStopColor(stop.id, value)"
            />

            <UInput
              v-model="stop.color"
              class="flex-1"
              placeholder="#000000"
            />

            <UButton
              icon="i-heroicons-trash"
              variant="soft"
              color="gray"
              :aria-label="$t('gradientGenerator.deleteStop')"
              :disabled="state.stops.length <= MIN_STOPS"
              circle
              @click="removeStop(stop.id)"
            />
          </div>

          <div class="flex items-center gap-3">
            <span class="text-xs text-gray-500 w-16 shrink-0">
              {{ $t('gradientGenerator.position') }}
            </span>
            <URange
              v-model="stop.position"
              :min="0"
              :max="100"
              :step="1"
              size="sm"
              class="flex-1"
            />
            <span class="w-10 text-right text-xs text-gray-500 font-mono shrink-0">
              {{ stop.position }}%
            </span>
          </div>
        </li>
      </ul>
    </div>

    <!-- actions -->
    <div class="flex flex-wrap gap-2 mb-6">
      <UButton
        icon="i-heroicons-clipboard"
        :label="$t('gradientGenerator.copyCss')"
        @click="onCopyCss"
      />
      <UButton
        icon="i-heroicons-bookmark"
        variant="soft"
        :label="$t('gradientGenerator.saveGradient')"
        @click="onSave"
      />
    </div>

    <!-- export options -->
    <div class="border border-gray-200 rounded-2xl p-4 mb-6">
      <p class="font-semibold text-sm mb-3">
        {{ $t('gradientGenerator.exportTitle') }}
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton
          icon="i-heroicons-arrow-down-tray"
          variant="soft"
          :label="$t('gradientGenerator.downloadCss')"
          @click="onDownloadCss"
        />
        <UButton
          icon="i-heroicons-arrow-down-tray"
          variant="soft"
          :label="$t('gradientGenerator.downloadTailwind')"
          @click="onDownloadTailwind"
        />
        <UButton
          icon="i-heroicons-arrow-down-tray"
          variant="soft"
          :label="$t('gradientGenerator.downloadJson')"
          @click="onDownloadJson"
        />
      </div>
    </div>

    <!-- saved gradients (local gallery) -->
    <div class="border border-gray-200 rounded-2xl p-4">
      <p class="font-semibold text-sm mb-3">
        {{ $t('gradientGenerator.savedTitle') }}
      </p>

      <p
        v-if="savedGradients.length === 0"
        class="text-sm text-gray-500"
      >
        {{ $t('gradientGenerator.savedEmpty') }}
      </p>

      <ul
        v-else
        class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
      >
        <li
          v-for="g in savedGradients"
          :key="g.id"
          class="border rounded-xl overflow-hidden"
        >
          <button
            class="w-full h-16 block cursor-pointer hover:opacity-90 transition-opacity"
            :style="{ background: buildGradientValue(g.config) }"
            :aria-label="$t('gradientGenerator.loadGradient')"
            @click="loadSaved(g)"
          />
          <div class="p-2 bg-white flex items-center justify-between gap-1">
            <p class="text-xs font-semibold truncate">
              {{ g.name }}
            </p>
            <UButton
              icon="i-heroicons-trash"
              size="xs"
              variant="ghost"
              color="gray"
              :aria-label="$t('gradientGenerator.deleteGradient')"
              @click="deleteSaved(g.id)"
            />
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useClipboard } from '@vueuse/core';
import { PlausibleEventName } from '~/layers/plausible/types';
import { downloadBlob } from '~/layers/color-palette-creator/utils/palette-export.util';
import {
  GRADIENT_TYPES,
  MAX_STOPS,
  MIN_STOPS,
  buildCssDeclaration,
  buildCssFile,
  buildGradientJson,
  buildGradientValue,
  buildTailwindConfig,
  createStop,
  loadSavedGradients,
  persistSavedGradients,
  type GradientConfig,
  type SavedGradient
} from '~/layers/gradient-generator/utils/gradient-generator.util';

const { t } = useI18n();
const notifications = useNotifications();
const { copy } = useClipboard();

const title = t('gradientGenerator.seoTitle');
const description = t('gradientGenerator.seoDescription');

const state = reactive<GradientConfig>({
  type: 'linear',
  angle: 90,
  stops: [
    createStop('#15437F', 0, 'stop-init-0'),
    createStop('#3B82F6', 100, 'stop-init-1')
  ]
});

// input numérico del ángulo, sincronizado con el slider
const angleInput = ref(String(state.angle));

watch(() => state.angle, (value) => {
  angleInput.value = String(value);
});

watch(angleInput, (value) => {
  const n = Number(value);
  if (Number.isFinite(n)) {
    state.angle = Math.min(360, Math.max(0, Math.round(n)));
  }
});

const gradientValue = computed(() => buildGradientValue(state));
const cssDeclaration = computed(() => buildCssDeclaration(state));

const fileStem = computed(() => `colormagic-gradient-${state.type}-${state.angle}`);

// galería local
const savedGradients = ref<SavedGradient[]>([]);

onMounted(() => {
  savedGradients.value = loadSavedGradients();
});

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
});

function updateStopColor(id: string, value: string): void {
  const stop = state.stops.find(s => s.id === id);
  if (stop) {
    stop.color = value;
  }
}

function addStop(): void {
  if (state.stops.length >= MAX_STOPS) return;
  // nueva parada en el medio por defecto
  state.stops.push(createStop('#000000', 50));
  sendPlausibleEvent(PlausibleEventName.GRADIENT_GENERATOR_STOP_ADDED);
}

function removeStop(id: string): void {
  if (state.stops.length <= MIN_STOPS) return;
  state.stops = state.stops.filter(s => s.id !== id);
}

function onCopyCss(): void {
  copy(cssDeclaration.value);
  notifications.addSuccess(t('gradientGenerator.copiedCss'));
  sendPlausibleEvent(PlausibleEventName.GRADIENT_GENERATOR_COPY_CSS);
}

function onSave(): void {
  const list = loadSavedGradients();
  list.push({
    id: `gradient-${Date.now()}`,
    name: t('gradientGenerator.savedName', { number: list.length + 1 }),
    config: {
      type: state.type,
      angle: state.angle,
      stops: state.stops.map(stop => ({ ...stop }))
    },
    createdAt: Date.now()
  });
  persistSavedGradients(list);
  savedGradients.value = list;
  notifications.addSuccess(t('gradientGenerator.savedSuccess'));
  sendPlausibleEvent(PlausibleEventName.GRADIENT_GENERATOR_SAVED);
}

function loadSaved(gradient: SavedGradient): void {
  state.type = gradient.config.type;
  state.angle = gradient.config.angle;
  state.stops = gradient.config.stops.map(s => ({ ...s }));
  notifications.addSuccess(t('gradientGenerator.loadedSuccess'));
}

function deleteSaved(id: string): void {
  const list = savedGradients.value.filter(g => g.id !== id);
  persistSavedGradients(list);
  savedGradients.value = list;
}

function onDownloadCss(): void {
  downloadBlob(
    new TextEncoder().encode(buildCssFile(state)),
    `${fileStem.value}.css`,
    'text/css'
  );
  sendPlausibleEvent(PlausibleEventName.GRADIENT_GENERATOR_CSS_DOWNLOADED);
}

function onDownloadTailwind(): void {
  downloadBlob(
    new TextEncoder().encode(buildTailwindConfig(state)),
    `${fileStem.value}.tailwind.config.js`,
    'text/javascript'
  );
  sendPlausibleEvent(PlausibleEventName.GRADIENT_GENERATOR_TAILWIND_DOWNLOADED);
}

function onDownloadJson(): void {
  downloadBlob(
    new TextEncoder().encode(JSON.stringify(buildGradientJson(state), null, 2)),
    `${fileStem.value}.json`,
    'application/json'
  );
  sendPlausibleEvent(PlausibleEventName.GRADIENT_GENERATOR_JSON_DOWNLOADED);
}
</script>
