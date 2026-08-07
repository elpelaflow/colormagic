<template>
  <div
    class="relative flex-1 min-w-[110px] group transition-colors duration-300"
    :style="{ backgroundColor: color.hex }"
    @dragover.prevent
    @drop="onDrop"
  >
    <!-- menú vertical al hover -->
    <div
      class="absolute left-1.5 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1
             opacity-0 group-hover:opacity-100 transition-opacity duration-200"
    >
      <button
        class="action-btn"
        :disabled="!canRemove"
        :title="$t('paletteMaker.remove')"
        :aria-label="$t('paletteMaker.remove')"
        @click="emit('remove')"
      >
        <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
      </button>
      <button
        class="action-btn"
        :title="$t('paletteMaker.saveColor')"
        :aria-label="$t('paletteMaker.saveColor')"
        @click="emit('save')"
      >
        <UIcon name="i-heroicons-heart" class="w-4 h-4" />
      </button>
      <button
        class="action-btn cursor-grab active:cursor-grabbing"
        draggable="true"
        :title="$t('paletteMaker.drag')"
        :aria-label="$t('paletteMaker.drag')"
        @dragstart="onDragStart"
        @dragend="emit('dragEnd')"
      >
        <UIcon name="i-heroicons-arrows-right-left" class="w-4 h-4" />
      </button>
      <button
        class="action-btn"
        :title="$t('paletteMaker.copyHex')"
        :aria-label="$t('paletteMaker.copyHex')"
        @click="emit('copy')"
      >
        <UIcon name="i-heroicons-clipboard" class="w-4 h-4" />
      </button>
      <button
        class="action-btn"
        :title="$t('paletteMaker.viewInfo')"
        :aria-label="$t('paletteMaker.viewInfo')"
        @click="emit('info')"
      >
        <UIcon name="i-heroicons-information-circle" class="w-4 h-4" />
      </button>
      <button
        class="action-btn"
        :title="color.locked ? $t('paletteMaker.unlock') : $t('paletteMaker.lock')"
        :aria-label="color.locked ? $t('paletteMaker.unlock') : $t('paletteMaker.lock')"
        @click="emit('toggleLock')"
      >
        <UIcon
          :name="color.locked ? 'i-heroicons-lock-open' : 'i-heroicons-lock-closed'"
          class="w-4 h-4"
        />
      </button>
    </div>

    <!-- candado visible cuando el color está fijado -->
    <div
      v-if="color.locked"
      class="absolute top-2 right-2"
      :style="{ color: contrastText }"
    >
      <UIcon name="i-heroicons-lock-solid" class="w-4 h-4" />
    </div>

    <!-- pie: hex + nombre -->
    <div
      class="absolute inset-x-0 bottom-0 p-2.5 space-y-0.5"
      :style="{ color: contrastText }"
    >
      <div class="font-mono font-semibold text-sm leading-tight select-all">
        {{ color.hex }}
      </div>
      <div class="text-[11px] leading-tight truncate max-w-full">
        {{ name }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getColorName } from '../utils/palette-maker.util';
import { hexToRgb, getContrastTextColor } from '~/layers/common/utils/color-converter.util';
import type { MakerColor } from '../composables/usePaletteMaker';

const props = defineProps<{
  color: MakerColor
  index: number
  canRemove: boolean
}>();

const emit = defineEmits([
  'remove',
  'toggleLock',
  'copy',
  'save',
  'info',
  'dragStart',
  'dragEnd',
  'dropAt'
]);

const name = computed(() => getColorName(props.color.hex));
const contrastText = computed(() => getContrastTextColor(props.color.hex));

function onDragStart(e: DragEvent): void {
  e.dataTransfer?.setData('text/plain', String(props.index));
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
  }
  emit('dragStart', props.index);
}

function onDrop(e: DragEvent): void {
  e.preventDefault();
  emit('dropAt', props.index);
}
</script>

<style scoped>
.action-btn {
  @apply w-7 h-7 rounded-lg flex items-center justify-center transition-colors;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
}
.action-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.6);
}
.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>
