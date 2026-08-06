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
    <div class="flex flex-col sm:flex-row gap-2 mb-3">
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

    <!-- example sites -->
    <div class="flex flex-wrap items-center gap-2 mb-10">
      <span class="text-sm text-gray-500">
        {{ t('tokenExtractor.examplesLabel') }}
      </span>
      <USelect
        size="sm"
        class="w-56"
        :model-value="exampleUrl"
        :options="exampleOptions"
        :placeholder="t('tokenExtractor.examplesPlaceholder')"
        :aria-label="t('tokenExtractor.examplesPlaceholder')"
        @update:model-value="onExampleSelect"
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
              {{ t('tokenExtractor.tokensCount', { count: visibleCount }) }}
            </UBadge>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UButton
              size="sm"
              variant="soft"
              :color="groupByPrefix ? 'primary' : 'gray'"
              :icon="groupByPrefix ? 'i-heroicons-folder-open' : 'i-heroicons-folder'"
              :label="t('tokenExtractor.groupByPrefix')"
              @click="groupByPrefix = !groupByPrefix"
            />
            <USelect
              size="sm"
              class="w-40"
              :model-value="sortMode"
              :options="sortOptions"
              :aria-label="t('tokenExtractor.sortLabel')"
              @update:model-value="onSortChange"
            />
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
        </div>

        <UInput
          v-model="searchQuery"
          size="md"
          icon="i-heroicons-magnifying-glass"
          class="mb-4"
          :placeholder="t('tokenExtractor.searchPlaceholder')"
        />

        <p v-if="result.tokens.length === 0" class="text-gray-500">
          {{ t('tokenExtractor.noTokens') }}
        </p>

        <template v-else>
          <p v-if="filteredTokens.length === 0" class="text-gray-500">
            {{ t('tokenExtractor.noMatches') }}
          </p>

          <!-- grouped by prefix -->
          <div
            v-else-if="groupByPrefix"
            class="space-y-3"
          >
            <div
              v-for="group in tokenGroups"
              :key="group.prefix"
              class="border border-gray-200 rounded-lg overflow-hidden"
            >
              <button
                class="w-full flex items-center justify-between gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                @click="toggleGroup(group.prefix)"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <UIcon
                    :name="isGroupCollapsed(group.prefix) ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-down'"
                    class="w-4 h-4 text-gray-500 shrink-0"
                  />
                  <span class="font-mono text-sm font-semibold truncate">
                    {{ group.prefix || t('tokenExtractor.groupOther') }}
                  </span>
                </div>
                <UBadge variant="soft" size="sm">
                  {{ group.tokens.length }}
                </UBadge>
              </button>
              <ul
                v-if="!isGroupCollapsed(group.prefix)"
                class="divide-y divide-gray-200"
              >
                <li
                  v-for="token in group.tokens"
                  :key="token.name"
                  class="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
                >
                  <TokenRow
                    :token="token"
                    @copy-value="onCopyToken"
                    @copy-var="onCopyVar"
                  />
                </li>
              </ul>
            </div>
          </div>

          <!-- flat list -->
          <ul
            v-else
            class="border border-gray-200 rounded-lg divide-y divide-gray-200"
          >
            <li
              v-for="token in filteredTokens"
              :key="token.name"
              class="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
            >
              <TokenRow
                :token="token"
                @copy-value="onCopyToken"
                @copy-var="onCopyVar"
              />
            </li>
          </ul>
        </template>
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
import { buildCssExport, buildTailwindExport, hexToHue, tokenPrefix } from '~/layers/color-token-extractor/utils/token-extractor.util';
import { PlausibleEventName } from '~/layers/plausible/types';

const { t } = useI18n();
const notifications = useNotifications();
const { copy } = useClipboard();

/** Sitios con sistemas de tokens grandes y bien nombrados, verificados contra el endpoint. */
const EXAMPLE_SITES = [
  { label: 'GitHub Primer — primer.style', url: 'https://primer.style' },
  { label: 'IBM Carbon — carbondesignsystem.com', url: 'https://carbondesignsystem.com' },
  { label: 'Open Props — open-props.style', url: 'https://open-props.style' },
  { label: 'Pico CSS — picocss.com', url: 'https://picocss.com' },
  { label: 'shadcn/ui — ui.shadcn.com', url: 'https://ui.shadcn.com' },
  { label: 'Tailwind CSS — tailwindcss.com', url: 'https://tailwindcss.com' }
];

const exampleOptions = EXAMPLE_SITES.map(site => ({ label: site.label, value: site.url }));

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
const exampleUrl = ref<string | undefined>();
const isExtracting = ref(false);
const result = ref<TokenExtractorResult | null>(null);
const filterType = ref<'all' | TokenType>('all');
const searchQuery = ref('');
const sortMode = ref<'default' | 'name' | 'hue'>('default');
const groupByPrefix = ref(false);
const collapsedGroups = ref(new Set<string>());

const sortOptions = computed(() => [
  { label: t('tokenExtractor.sortDefault'), value: 'default' },
  { label: t('tokenExtractor.sortName'), value: 'name' },
  { label: t('tokenExtractor.sortHue'), value: 'hue' }
]);

const filteredTokens = computed(() => {
  let list = result.value?.tokens ?? [];
  if (filterType.value !== 'all') {
    list = list.filter(token => token.type === filterType.value);
  }
  const query = searchQuery.value.trim().toLowerCase();
  if (query) {
    list = list.filter(token =>
      token.name.toLowerCase().includes(query)
      || (token.value || '').toLowerCase().includes(query)
      || (token.hex || '').toLowerCase().includes(query)
    );
  }
  if (sortMode.value === 'name') {
    list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortMode.value === 'hue') {
    list = [...list].sort((a, b) => hueSortKey(a.hex) - hueSortKey(b.hex));
  }
  return list;
});

/** Clave de orden por matiz: acromáticos (grises/negro/blanco) y sin hex al final. */
function hueSortKey(hex: string | null): number {
  if (!hex) return 361;
  const hue = hexToHue(hex);
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return Math.max(r, g, b) - Math.min(r, g, b) < 12 ? 361 : hue;
}

const visibleCount = computed(() => filteredTokens.value.length);

const tokenGroups = computed(() => {
  const groups = new Map<string, ColorToken[]>();
  for (const token of filteredTokens.value) {
    const prefix = tokenPrefix(token.name);
    const group = groups.get(prefix) ?? [];
    group.push(token);
    groups.set(prefix, group);
  }
  return Array.from(groups.entries()).map(([prefix, tokens]) => ({ prefix, tokens }));
});

const cssExport = computed(() => result.value ? buildCssExport(result.value.tokens) : '');
const tailwindExport = computed(() => result.value ? buildTailwindExport(result.value.tokens) : '');

function onSortChange(value: unknown): void {
  if (value === 'default' || value === 'name' || value === 'hue') {
    sortMode.value = value;
  }
}

function toggleGroup(prefix: string): void {
  const next = new Set(collapsedGroups.value);
  if (next.has(prefix)) {
    next.delete(prefix);
  } else {
    next.add(prefix);
  }
  collapsedGroups.value = next;
}

function isGroupCollapsed(prefix: string): boolean {
  return collapsedGroups.value.has(prefix);
}

async function onExampleSelect(value: unknown): Promise<void> {
  const target = typeof value === 'string' ? value : undefined;
  if (!target) return;
  url.value = target;
  sendPlausibleEvent(PlausibleEventName.TOKEN_EXTRACTOR_EXAMPLE_SELECTED);
  await onExtract();
}

async function onExtract(): Promise<void> {
  if (isExtracting.value) return; // evita extracciones concurrentes
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
    searchQuery.value = '';
    sortMode.value = 'default';
    groupByPrefix.value = false;
    collapsedGroups.value = new Set();
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
    // el select de ejemplos vuelve al placeholder al terminar (permite re-elegir)
    exampleUrl.value = undefined;
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

async function onCopyVar(token: ColorToken): Promise<void> {
  await copy(`var(${token.name})`);
  notifications.addSuccess(t('tokenExtractor.varCopied'));
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
