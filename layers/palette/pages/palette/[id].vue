<template>
  <div>
    <div v-if="!data && !isError">
      <USkeleton class="w-full h-12" />
      <USkeleton class="w-full h-12 mt-4" />
    </div>

    <div v-else-if="data">
      <div>
        <!-- tag links -->
        <div class="mb-2">
          <PaletteTagLinks :links="paletteTagLinks" />
        </div>

        <!-- title -->
        <div class="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-4">
          <h1 class="mb-0">
            {{ data?.text }}
          </h1>

          <!-- save button -->
          <div
            v-if="hasChanges"
            class="flex items-center gap-2"
          >
            <UButton
              :label="$t('palette.resetLabel')"
              @click="resetArrange()"
            />
            <UButton
              type="submit"
              color="primary"
              :label="$t('palette.saveLabel')"
              :loading="isCloning"
              @click="onSave()"
            />
          </div>
        </div>

        <!-- list of colors -->
        <div class="overflow-hidden mb-4 rounded-xl border border-gray-200 divide-x">
          <!-- colors -->
          <ul class="flex">
            <li
              v-for="(item, index) in arrangedColors"
              :key="index"
              class="w-full relative"
            >
              <!-- color button -->
              <div
                :style="{ background: item }"
                class="w-full h-48 relative"
              >
                <UTooltip
                  :text="`Generate a ${ntc.name(item)[1].toString()} palette`"
                  class="bottom-0 left-0 absolute p-2 w-full"
                >
                  <UButton
                    size="2xs"
                    icon="i-heroicons-sparkles"
                    truncate
                    class="max-w-[90%]"
                    :loading="isCreating"
                    @click="onClickExample(`${ntc.name(item)[1].toString()} (${ntc.name(item)[0]})`)"
                  >
                    <span class="hidden sm:block truncate">{{ ntc.name(item)[1].toString() }}</span>
                  </UButton>
                </UTooltip>
              </div>
            </li>
          </ul>

          <!-- color codes -->
          <ul class="hidden sm:flex divide-x">
            <li
              v-for="(item, index) in arrangedColors"
              :key="index"
              class="w-full relative"
            >
              <div class="py-2">
                <div class="flex gap-2 items-center mb-1 ml-2">
                  <!-- color picker -->
                  <ColorPicker
                    :initial-color="item"
                    @select="value => colors[index] = value"
                  />

                  <!-- reset color button -->
                  <UButton
                    v-if="colors[index] !== data.colors[index]"
                    icon="i-heroicons-arrow-path"
                    size="xs"
                    @click="colors[index] = data.colors[index]"
                  />
                </div>

                <ColorCopyButtons :hex="item" />
              </div>
            </li>
          </ul>
        </div>

        <!-- mobile colors list -->
        <ul class="sm:hidden flex flex-col mb-2 divide-y">
          <li
            v-for="(item, index) in colors"
            :key="index"
            class="w-full items-center flex gap-2 py-1"
          >
            <!-- color button -->
            <div
              :style="{ background: item }"
              class="w-6 h-6 rounded-full relative"
            />

            <!-- copy color buttons -->
            <ColorCopyButtons :hex="item" />
          </li>
        </ul>

        <!-- arrange sliders-->
        <div class="border border-gray-200 rounded-xl p-4">
          <ColorArrangeSliders v-model="arrange" />
        </div>

        <!-- share buttons -->
        <div class="mt-8">
          <p class="text-sm font-semibold mb-2">
            {{ $t('palette.shareLabel') }}
          </p>
          <CommonSocialShareButtons
            type="text"
            orientation="horizontal"
            :text="`${t('palette.shareText')} ${data.text ?? ''} with ColorMagic AI!`"
          />
        </div>

        <!-- description with color names -->
        <p class="mt-8 text-base max-w-2xl">
          {{ $t('palette.descriptionPrefix') }}
          <strong>{{ data.text }}</strong>
          {{ $t('palette.descriptionSuffix') }}
          <template v-for="(color, index) in arrangedColors" :key="index">
            <strong :style="{ color }">{{ ntcName(color) }}</strong>
            <span class="text-gray-500">({{ color }})</span><template v-if="index < arrangedColors.length - 1">, </template><template v-else>.</template>
          </template>
        </p>

        <!-- What You Can Do -->
        <div class="mt-12 space-y-4">
          <h2 class="text-xl font-semibold">
            {{ $t('palette.whatYouCanDoTitle') }}
          </h2>
          <p class="text-sm text-gray-600">{{ $t('palette.whatYouCanDoIntro') }}</p>
          <ul class="text-sm space-y-1 list-disc list-inside text-gray-700">
            <li>{{ $t('palette.whatYouCanDoCopy') }}</li>
            <li>{{ $t('palette.whatYouCanDoAdjust') }}</li>
            <li>{{ $t('palette.whatYouCanDoPreview') }}</li>
            <li>{{ $t('palette.whatYouCanDoCss') }}</li>
            <li>{{ $t('palette.whatYouCanDoDownload') }}</li>
            <li>{{ $t('palette.whatYouCanDoShare') }}</li>
          </ul>
        </div>

        <!-- Preview UI Components -->
        <div class="mt-12 space-y-4">
          <h2 class="text-xl font-semibold">
            {{ $t('palette.previewTitle') }}
          </h2>
          <h3 class="text-sm font-medium text-gray-500">
            {{ $t('palette.previewSubtitle') }}
          </h3>
          <p class="text-sm text-gray-600 max-w-xl">
            {{ $t('palette.previewDescriptionPrefix') }}
            <strong>{{ data.text }}</strong>
            {{ $t('palette.previewDescriptionSuffix') }}
          </p>

          <!-- UI Examples grid -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <!-- Card example -->
            <div
              class="rounded-xl overflow-hidden border border-gray-200"
              :style="{ background: arrangedColors[2] }"
            >
              <div class="h-20" :style="{ background: arrangedColors[0] }" />
              <div class="p-4 space-y-3">
                <h4 class="text-base font-semibold" :style="{ color: arrangedColors[3] }">
                  {{ data.text }}
                </h4>
                <p class="text-xs" :style="{ color: arrangedColors[4] }">
                  A preview of how this palette looks on a card component.
                </p>
                <UButton
                  size="xs"
                  :style="{ background: arrangedColors[1], color: arrangedColors[4] }"
                  class="pointer-events-none"
                >
                  Action Button
                </UButton>
              </div>
            </div>

            <!-- Dashboard example -->
            <div
              class="rounded-xl p-4 border border-gray-200 space-y-3"
              :style="{ background: arrangedColors[4] }"
            >
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-semibold" :style="{ color: arrangedColors[3] }">
                  Dashboard
                </h4>
                <div
                  class="w-6 h-6 rounded-md"
                  :style="{ background: arrangedColors[0] }"
                />
              </div>
              <div class="space-y-2">
                <div class="flex justify-between text-xs">
                  <span :style="{ color: arrangedColors[3] }">Revenue</span>
                  <span class="font-semibold" :style="{ color: arrangedColors[0] }">$12,345</span>
                </div>
                <UProgress
                  :value="75"
                  :ui="{ progress: { background: arrangedColors[0] } }"
                  :style="{ '--ui-progress-bg': arrangedColors[1] }"
                />
                <div class="flex justify-between text-xs">
                  <span :style="{ color: arrangedColors[3] }">Users</span>
                  <span class="font-semibold" :style="{ color: arrangedColors[1] }">1,234</span>
                </div>
                <UProgress
                  :value="50"
                  :ui="{ progress: { background: arrangedColors[1] } }"
                />
              </div>
            </div>

            <!-- Navbar example -->
            <div
              class="rounded-xl border border-gray-200 lg:col-span-2"
              :style="{ background: arrangedColors[3] }"
            >
              <div class="flex items-center justify-between p-3">
                <div class="flex items-center gap-2">
                  <div
                    class="w-6 h-6 rounded-md"
                    :style="{ background: arrangedColors[0] }"
                  />
                  <span class="text-sm font-semibold" :style="{ color: arrangedColors[4] }">
                    {{ data.text }}
                  </span>
                </div>
                <div class="hidden sm:flex gap-3 text-xs" :style="{ color: arrangedColors[4] }">
                  <span v-for="(color, index) in arrangedColors" :key="index">Link {{ index + 1 }}</span>
                </div>
                <UButton
                  size="2xs"
                  :style="{ background: arrangedColors[0], color: arrangedColors[4] }"
                  class="pointer-events-none"
                >
                  Get Started
                </UButton>
              </div>
            </div>
          </div>

          <!-- preview share buttons -->
          <div class="pt-4">
            <p class="text-sm font-semibold mb-2">
              {{ $t('palette.shareLabel') }}
            </p>
            <CommonSocialShareButtons
              type="text"
              orientation="horizontal"
              :text="`${t('palette.shareText')} ${data.text ?? ''} with ColorMagic AI!`"
            />
          </div>
        </div>

        <!-- Download PNG -->
        <div class="mt-12 space-y-4">
          <h2 class="text-xl font-semibold">
            {{ $t('palette.downloadTitle') }} {{ data.text }} {{ $t('palette.downloadSuffix') }}
          </h2>
          <UButton
            icon="i-heroicons-arrow-down-tray"
            size="md"
            color="primary"
            :to="`/api/og/get?colors=${encodeURIComponent(arrangedColors.join(':'))}&text=${encodeURIComponent(data.text)}`"
            target="_blank"
          >
            {{ $t('palette.downloadTitle') }} {{ data.text }} {{ $t('palette.downloadSuffix') }}
          </UButton>
        </div>

        <!-- CSS Code -->
        <div class="mt-12 space-y-4">
          <h2 class="text-xl font-semibold">
            {{ $t('palette.cssTitle') }} {{ data.text }} {{ $t('palette.cssSuffix') }}
          </h2>
          <div class="space-y-3">
            <UAlert
              variant="subtle"
              color="gray"
              :description="cssClasses"
            />
            <UAlert
              variant="subtle"
              color="gray"
              :description="cssVariables"
            />
          </div>
        </div>

        <!-- Gradient CSS -->
        <div class="mt-12 space-y-4">
          <h2 class="text-xl font-semibold">
            {{ $t('palette.gradientTitle') }} {{ data.text }} {{ $t('palette.gradientSuffix') }}
          </h2>
          <div class="space-y-3">
            <UAlert
              variant="subtle"
              color="gray"
              :description="linearGradient"
            />
            <UAlert
              variant="subtle"
              color="gray"
              :description="radialGradient"
            />
          </div>

          <!-- live preview of gradients -->
          <div class="grid sm:grid-cols-2 gap-3 pt-2">
            <div>
              <p class="text-xs text-gray-500 mb-1">{{ $t('palette.gradientLinearLabel') }}</p>
              <div
                class="h-16 rounded-lg border border-gray-200"
                :style="{ background: `linear-gradient(0.25turn, ${arrangedColors.join(', ')})` }"
              />
            </div>
            <div>
              <p class="text-xs text-gray-500 mb-1">{{ $t('palette.gradientRadialLabel') }}</p>
              <div
                class="h-16 rounded-lg border border-gray-200"
                :style="{ background: `radial-gradient(circle, ${arrangedColors.join(', ')})` }"
              />
            </div>
          </div>
        </div>

        <!-- Created date -->
        <p
          v-if="createdAtFormatted"
          class="mt-12 text-xs text-gray-400 italic"
        >
          {{ data.text }} {{ $t('palette.createdOn') }} {{ createdAtFormatted }}.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ntc from '~/layers/palette/utils/ntc.util';

const { params } = useRoute();
const id = ref(typeof params.id === 'string' ? params.id : undefined);

const { t, locale } = useI18n();
const localePath = useLocalePath();
const { data, suspense, isError } = usePalette(id);
const { mutate: clone, isPending: isCloning } = useClonePalette();
const { mutate: create, isPending: isCreating } = useCreatePalette();
const notifications = useNotifications();

await suspense();

/** @description redirect home because old palettes will throw 404's otherwise */
if (data.value === undefined) {
  await navigateTo('/', { replace: true });
}

const title = computed(() => `${data.value?.text ?? 'Loading...'} - ${t('palette.seoTitle')}`);
const ogImageUrl = computed(() => (data.value !== undefined ? formatOgUrl(data.value.colors, data.value.text) : ''));
const description = t('palette.seoDescription');

useSeoMeta({
  title,
  description,
  ogTitle: title.value,
  ogDescription: description,
  ogImageUrl: `${useRuntimeConfig().public.siteUrl}${ogImageUrl.value}`,
  robots: {
    noindex: true
  }
});

const paletteTagLinks = getAllPaletteFilters().map(v => ({
  label: v.label[getLocale(locale.value)],
  id: v.id,
  to: localePath(`/palette/explore/${v.id}`)
})).filter(v => data.value?.tags.includes(v.id));

const colors = ref<string[]>([]);

const arrange = ref({
  brightness: 0,
  saturation: 0,
  warmth: 0
});

const hasChanges = computed(() => {
  return arrange.value.brightness !== 0 ||
  arrange.value.saturation !== 0 ||
  arrange.value.warmth !== 0 ||
  (data.value !== undefined && JSON.stringify(data.value.colors) !== JSON.stringify(colors.value));
});

const arrangedColors = computed(() => arrangeColors(colors.value, {
  brightness: arrange.value.brightness,
  saturation: arrange.value.saturation,
  warmth: arrange.value.warmth
}));

function resetArrange(): void {
  arrange.value.brightness = 0;
  arrange.value.saturation = 0;
  arrange.value.warmth = 0;

  if (data.value?.colors !== undefined) {
    colors.value = [...data.value.colors];
  }
}

function onClickExample(prompt: string): void {
  create({ prompt }, {
    onError: (err) => {
      notifications.addError(err.message ?? 'Error creating palette.');
    },
    onSuccess: (value) => {
      notifications.addSuccess(`Successfully created ${prompt} palette.`);
      void navigateTo(localePath(`/palette/${value.id}`));
    }
  });
}

function onSave(): void {
  if (data.value?.id === undefined) {
    return;
  }

  clone({ id: data.value?.id, colors: arrangedColors.value }, {
    onError: (err) => {
      notifications.addError(err.message ?? 'Error cloning palette.');
    },
    onSuccess: (value) => {
      void navigateTo(localePath(`/palette/${value.id}`));
    }
  });
}

watch(data, (newValue) => {
  if (newValue !== undefined) {
    colors.value = [...newValue.colors];
  }
}, { immediate: true });

function ntcName(hex: string): string {
  return ntc.name(hex)[1].toString();
}

const cssClasses = computed(() => {
  const paletteName = data.value?.text ?? 'Palette';
  const lines = [
    `/* ${t('palette.cssClassesLabel')} */`,
    `/* ${paletteName} */`
  ];
  arrangedColors.value.forEach((color, index) => {
    lines.push(`.color-${index + 1} {`);
    lines.push(`  color: ${color};`);
    lines.push(`}`);
  });
  return lines.join('\n');
});

const cssVariables = computed(() => {
  const paletteName = data.value?.text ?? 'Palette';
  const lines = [
    `/* ${t('palette.cssVariablesLabel')} */`,
    `/* ${paletteName} */`,
    ':root {'
  ];
  arrangedColors.value.forEach((color, index) => {
    lines.push(`  --color-${index + 1}: ${color};`);
  });
  lines.push('}');
  return lines.join('\n');
});

const linearGradient = computed(() => {
  const colorsList = arrangedColors.value.join(', ');
  return `/* ${t('palette.gradientLinearLabel')} */\n.linear-gradient {\n  background: linear-gradient(0.25turn, ${colorsList});\n}`;
});

const radialGradient = computed(() => {
  const colorsList = arrangedColors.value.join(', ');
  return `/* ${t('palette.gradientRadialLabel')} */\n.radial-gradient {\n  background: radial-gradient(circle, ${colorsList});\n}`;
});

const createdAtFormatted = computed(() => {
  if (data.value?.createdAt === undefined) {
    return '';
  }
  try {
    const date = new Date(data.value.createdAt);
    return date.toLocaleString(locale.value === 'en' ? 'en-US' : locale.value === 'ja' ? 'ja-JP' : 'it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (error) {
    return data.value.createdAt;
  }
});
</script>
