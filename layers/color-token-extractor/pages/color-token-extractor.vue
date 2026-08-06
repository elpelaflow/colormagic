<template>
  <div>
    <!-- header -->
    <div class="mb-8">
      <h1>
        {{ $t('tokenExtractor.title') }}
      </h1>
      <p class="text-xl font-medium mb-4 max-w-xl">
        {{ $t('tokenExtractor.seoDescription') }}
      </p>
    </div>

    <!-- url input -->
    <div class="flex flex-col sm:flex-row gap-2 mb-10">
      <UInput
        v-model="url"
        size="xl"
        icon="i-heroicons-link"
        class="flex-1"
        :placeholder="t('tokenExtractor.urlPlaceholder')"
        @keyup.enter="onExtract"
      />
      <UButton
        size="xl"
        :loading="isExtracting"
        :label="isExtracting ? t('tokenExtractor.extracting') : t('tokenExtractor.extractLabel')"
        icon="i-heroicons-magnifying-glass"
        :disabled="!url.trim()"
        @click="onExtract"
      />
    </div>

    <!-- results -->
    <template v-if="result">
      <!-- site summary -->
      <div class="flex flex-wrap items-center gap-4 border border-gray-200 rounded-lg p-4 mb-8">
        <img
          v-if="result.favicon"
          :src="result.favicon"
          alt="favicon"
          class="w-10 h-10 rounded"
        >
        <div class="min-w-0 flex-1">
          <p class="font-semibold truncate">
            {{ result.title || result.url }}
          </p>
          <p class="text-sm text-gray-500 truncate">
            {{ result.url }}
          </p>
        </div>
        <div
          v-if="result.themeColorHex"
          class="flex items-center gap-2"
        >
          <div
            class="w-8 h-8 rounded-full border border-gray-200"
            :style="{ backgroundColor: result.themeColorHex }"
          />
          <div class="text-sm">
            <p class="font-semibold">
              {{ t('tokenExtractor.themeColor') }}
            </p>
            <p class="font-mono text-gray-500">
              {{ result.themeColorHex }}
            </p>
          </div>
        </div>
      </div>

      <!-- export actions -->
      <div class="flex flex-wrap gap-2 mb-8">
        <UButton
          icon="i-heroicons-clipboard-document-list"
          :label="t('tokenExtractor.copyCss')"
          @click="onCopyCss"
        />
        <UButton
          icon="i-heroicons-clipboard"
          :label="t('tokenExtractor.copyTailwind')"
          @click="onCopyTailwind"
        />
        <UButton
          icon="i-heroicons-arrow-down-tray"
          variant="soft"
          :label="t('tokenExtractor.downloadJson')"
          @click="onDownloadJson"
        />
        <UButton
          icon="i-heroicons-code-bracket"
          variant="soft"
          :label="t('tokenExtractor.downloadTailwind')"
          @click="onDownloadTailwind"
        />
      </div>

      <!-- tokens -->
      <div class="mb-10">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div class="flex items-center gap-3">
            <p class="text-lg font-bold">
              {{ t('tokenExtractor.tokensTitle') }}
            </p>
            <UBadge variant="soft">
              {{ t('tokenExtractor.tokensCount', { count: result.tokens.length }) }}
            </UBadge>
          </div>

          <UButtonGroup size="sm">
            <UButton
              :variant="filterType === 'all' ? 'solid' : 'soft'"
              :label="t('tokenExtractor.filterAll')"
              @click="filterType = 'all'"
            />
            <UButton
              :variant="filterType === 'brand' ? 'solid' : 'soft'"
              :label="t('tokenExtractor.typeBrand')"
              @click="filterType = 'brand'"
            />
            <UButton
              :variant="filterType === 'semantic' ? 'solid' : 'soft'"
              :label="t('tokenExtractor.typeSemantic')"
              @click="filterType = 'semantic'"
            />
            <UButton
              :variant="filterType === 'custom' ? 'solid' : 'soft'"
              :label="t('tokenExtractor.typeCustom')"
              @click="filterType = 'custom'"
            />
          </UButtonGroup>
        </div>

        <p v-if="result.tokens.length === 0" class="text-gray-500">
          {{ t('tokenExtractor.noTokens') }}
        </p>

        <ul
          v-else
          class="border border-gray-200 rounded-lg divide-y divide-gray-200"
        >
          <li
            v-for="token in filteredTokens"
            :key="token.name"
            class="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
          >
            <!-- swatch -->
            <div
              class="w-9 h-9 rounded-md border border-gray-200 shrink-0 shadow-sm"
              :style="{ backgroundColor: token.hex ?? '#e5e7eb' }"
            />

            <!-- name -->
            <div class="min-w-0 flex-1">
              <p class="font-mono text-sm font-semibold truncate">
                {{ token.name }}
              </p>
              <p class="font-mono text-xs text-gray-500 truncate">
                {{ token.value }}
              </p>
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

            <!-- copy -->
            <UButton
              icon="i-heroicons-clipboard"
              size="sm"
              variant="ghost"
              :aria-label="t('tokenExtractor.copyValue')"
              @click="onCopyToken(token)"
            />
          </li>
        </ul>
      </div>

      <!-- derived palette -->
      <div v-if="result.palette.length > 0">
        <p class="text-lg font-bold mb-4">
          {{ t('tokenExtractor.paletteTitle') }}
        </p>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div
            v-for="entry in result.palette"
            :key="entry.hex"
            class="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
          >
            <div
              class="h-16"
              :style="{ backgroundColor: entry.hex }"
            />
            <div class="p-2">
              <p class="font-mono text-xs font-semibold">
                {{ entry.hex }}
              </p>
              <p class="text-xs text-gray-500 truncate">
                {{ t('tokenExtractor.tokensCount', { count: entry.count }) }}
              </p>
              <p
                v-if="entry.names.length"
                class="text-xs text-gray-400 truncate"
                :title="entry.names.join(', ')"
              >
                {{ entry.names.join(', ') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useClipboard } from '@vueuse/core';
import type { ColorToken, TokenExtractorResult, TokenType } from '~/layers/color-token-extractor/utils/token-extractor.util';
import { buildCssExport, buildTailwindExport } from '~/layers/color-token-extractor/utils/token-extractor.util';
import { PlausibleEventName } from '~/layers/plausible/types';

const { t } = useI18n();
const notifications = useNotifications();
const { copy } = useClipboard();

const title = t('tokenExtractor.seoTitle');
const description = t('tokenExtractor.seoDescription');

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImageUrl: `${useRuntimeConfig().public.siteUrl}${formatOgUrl(['#7c3aed', '#0ea5e9', '#f59e0b'], 'Color Token Extractor')}`
});

const url = ref('');
const isExtracting = ref(false);
const result = ref<TokenExtractorResult | null>(null);
const filterType = ref<'all' | TokenType>('all');

const filteredTokens = computed(() => {
  if (filterType.value === 'all') return result.value?.tokens ?? [];
  return (result.value?.tokens ?? []).filter(token => token.type === filterType.value);
});

const cssExport = computed(() => result.value ? buildCssExport(result.value.tokens) : '');
const tailwindExport = computed(() => result.value ? buildTailwindExport(result.value.tokens) : '');

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

function scopeLabel(scope: 'root' | 'scoped'): string {
  return t(`tokenExtractor.scope${scope.charAt(0).toUpperCase()}${scope.slice(1)}`);
}

async function onExtract(): Promise<void> {
  const target = url.value.trim();
  if (!target) {
    notifications.addWarning(t('tokenExtractor.urlMissing'));
    return;
  }

  isExtracting.value = true;
  try {
    result.value = await $fetch<TokenExtractorResult>('/api/color-token-extractor', {
      method: 'POST',
      body: { url: target }
    });
    filterType.value = 'all';
    sendPlausibleEvent(PlausibleEventName.TOKEN_EXTRACTOR_EXTRACTED);
  } catch (error: any) {
    result.value = null;
    const statusMessage = error?.data?.statusMessage;
    if (statusMessage === 'Missing or invalid "url". Expected an http(s) URL.') {
      notifications.addError(t('tokenExtractor.urlInvalid'));
    } else {
      notifications.addError(statusMessage || t('tokenExtractor.fetchFailed'));
    }
  } finally {
    isExtracting.value = false;
  }
}

async function onCopyCss(): Promise<void> {
  await copy(cssExport.value);
  notifications.addSuccess(t('tokenExtractor.copiedCss'));
  sendPlausibleEvent(PlausibleEventName.TOKEN_EXTRACTOR_CSS_COPIED);
}

async function onCopyTailwind(): Promise<void> {
  await copy(tailwindExport.value);
  notifications.addSuccess(t('tokenExtractor.copiedTailwind'));
  sendPlausibleEvent(PlausibleEventName.TOKEN_EXTRACTOR_TAILWIND_COPIED);
}

function onDownloadJson(): void {
  if (!result.value) return;
  download(`tokens-${new URL(result.value.url).hostname}.json`, JSON.stringify(result.value, null, 2), 'application/json');
  sendPlausibleEvent(PlausibleEventName.TOKEN_EXTRACTOR_JSON_DOWNLOADED);
}

function onDownloadTailwind(): void {
  download('tailwind-colors.config.js', tailwindExport.value, 'text/javascript');
  sendPlausibleEvent(PlausibleEventName.TOKEN_EXTRACTOR_TAILWIND_DOWNLOADED);
}

async function onCopyToken(token: ColorToken): Promise<void> {
  await copy(token.value);
  notifications.addSuccess(t('tokenExtractor.tokenCopied'));
  sendPlausibleEvent(PlausibleEventName.TOKEN_EXTRACTOR_TOKEN_COPIED);
}

function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
</script>
