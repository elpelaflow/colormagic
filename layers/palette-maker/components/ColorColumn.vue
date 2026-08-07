<template>
  <div
    class="relative flex-1 min-w-0 group transition-colors duration-300"
    :style="{ backgroundColor: color.hex }"
    @dragover.prevent
    @drop="onDrop"
    @mousemove="onMouseMove"
    @mouseleave="hoverEdge = null"
  >
    <!-- + flotante al acercar el mouse al límite izquierdo -->
    <button
      v-if="hoverEdge === 'left'"
      class="pm-add pm-add-left"
      :title="$t('paletteMaker.addStop')"
      :aria-label="$t('paletteMaker.addStop')"
      @click.stop="emit('addLeft')"
    >
      <UIcon name="i-heroicons-plus" class="w-4 h-4" />
    </button>

    <!-- + flotante al acercar el mouse al límite derecho -->
    <button
      v-if="hoverEdge === 'right'"
      class="pm-add pm-add-right"
      :title="$t('paletteMaker.addStop')"
      :aria-label="$t('paletteMaker.addStop')"
      @click.stop="emit('addRight')"
    >
      <UIcon name="i-heroicons-plus" class="w-4 h-4" />
    </button>

    <!-- menú vertical al hover (se oculta mientras se muestra un +) -->
    <div
      class="pm-menu absolute left-1.5 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 transition-opacity duration-200"
      :class="hoverEdge ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'"
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
      class="lock-indicator absolute top-2 right-2"
      :style="{ color: contrastText }"
    >
      <UIcon name="i-heroicons-lock-solid" class="w-4 h-4" />
    </div>

    <!-- pie: hex + nombre (se desvanece desde el 7° color para no aplastarse) -->
    <div
      class="absolute inset-x-0 bottom-0 p-2.5 space-y-0.5 transition-opacity duration-300"
      :class="showDetails ? 'opacity-100' : 'opacity-0 pointer-events-none'"
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
  canAddLeft: boolean
  canAddRight: boolean
  /** Si hay 7+ colores el pie (hex+nombre) se oculta para no aplastarse. */
  showDetails: boolean
}>();

const emit = defineEmits([
  'remove',
  'toggleLock',
  'copy',
  'save',
  'info',
  'dragStart',
  'dragEnd',
  'dropAt',
  'addLeft',
  'addRight'
]);

const name = computed(() => getColorName(props.color.hex));
const contrastText = computed(() => getContrastTextColor(props.color.hex));

/** Borde de la columna donde el mouse está cerca del límite con el vecino. */
const hoverEdge = ref<'left' | 'right' | null>(null);

function onMouseMove(e: MouseEvent): void {
  // No interferir con el área del menú de acciones (botones Y huecos) ni con el candado
  const target = e.target as HTMLElement | null;
  if (target?.closest('.pm-menu, .lock-indicator')) return;

  const el = e.currentTarget as HTMLElement;
  const rect = el.getBoundingClientRect();
  const x = e.clientX - rect.left;
  // Zona adaptativa: 25% del ancho de la columna (tope 24px) — con columnas
  // angostas la franja se achica para no dominar toda la columna.
  const zone = Math.min(24, rect.width * 0.25);

  if (x < zone) {
    hoverEdge.value = props.canAddLeft ? 'left' : null;
  } else if (x > rect.width - zone) {
    hoverEdge.value = props.canAddRight ? 'right' : null;
  } else {
    hoverEdge.value = null;
  }
}

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

/* Botón + flotante en la unión entre colores */
.pm-add {
  position: absolute;
  top: 50%;
  z-index: 10;
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  transition: background 0.15s, transform 0.15s;
}
.pm-add:hover {
  background: rgba(0, 0, 0, 0.7);
}
/* Centrado en la línea divisoria: media ficha afuera, media adentro */
.pm-add-left {
  left: 0;
  transform: translate(-50%, -50%);
}
.pm-add-right {
  right: 0;
  transform: translate(50%, -50%);
}
.pm-add-left:hover {
  transform: translate(-50%, -50%) scale(1.1);
}
.pm-add-right:hover {
  transform: translate(50%, -50%) scale(1.1);
}
</style>
