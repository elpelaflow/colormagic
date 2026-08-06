<template>
  <div class="flex items-center gap-3 w-full min-w-0">
    <!-- swatch -->
    <div
      class="w-9 h-9 rounded-md border border-gray-200 shrink-0 shadow-sm"
      :style="{ backgroundColor: token.hex ?? '#e5e7eb' }"
    />

    <!-- name + value -->
    <div class="min-w-0 flex-1">
      <button
        type="button"
        class="font-mono text-sm font-semibold truncate w-full text-left bg-transparent border-none p-0 cursor-pointer transition-colors hover:text-primary-600 focus-visible:text-primary-600 focus-visible:outline-none focus-visible:underline"
        :title="t('tokenExtractor.copyName')"
        :aria-label="t('tokenExtractor.copyName') + ': ' + token.name"
        @click="emit('copy-var', token)"
      >
        {{ token.name }}
      </button>
      <p class="font-mono text-xs text-gray-500 truncate">
        {{ token.value }}
      </p>
      <span
        v-if="used"
        class="inline-flex items-center gap-1 text-xs text-green-600 font-medium"
      >
        <UIcon name="i-heroicons-check-circle" class="w-3.5 h-3.5" />
        {{ t('tokenExtractor.usedOnPage') }}
      </span>
    </div>

    <!-- hex -->
    <p class="font-mono text-sm hidden md:block text-gray-600 w-24 text-right">
      {{ token.hex ?? '—' }}
    </p>

    <!-- badges -->
    <div class="hidden sm:flex items-center gap-1">
      <UBadge
        size="sm"
        variant="soft"
        :color="typeBadgeColor(token.type)"
      >
        {{ typeLabel(token.type) }}
      </UBadge>
      <UBadge size="sm" variant="soft" color="gray">
        {{ scopeLabel(token.scope) }}
      </UBadge>
    </div>

    <!-- copy value -->
    <UButton
      icon="i-heroicons-clipboard"
      size="sm"
      variant="ghost"
      :aria-label="t('tokenExtractor.copyValue')"
      :title="t('tokenExtractor.copyValue')"
      @click="emit('copy-value', token)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColorToken, TokenType, TokenScope } from '../utils/token-extractor.util';

defineProps<{ token: ColorToken; used?: boolean }>();

const emit = defineEmits<{
  (e: 'copy-value', token: ColorToken): void;
  (e: 'copy-var', token: ColorToken): void;
}>();

const { t } = useI18n();

function typeBadgeColor(type: TokenType): 'primary' | 'yellow' | 'gray' {
  switch (type) {
    case 'brand': return 'primary';
    case 'semantic': return 'yellow';
    default: return 'gray';
  }
}

function typeLabel(type: TokenType): string {
  return t(`tokenExtractor.type${type.charAt(0).toUpperCase()}${type.slice(1)}`);
}

function scopeLabel(scope: TokenScope): string {
  return t(`tokenExtractor.scope${scope.charAt(0).toUpperCase()}${scope.slice(1)}`);
}
</script>
