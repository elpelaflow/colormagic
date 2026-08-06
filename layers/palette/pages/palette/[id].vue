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
                  :text="`Generate a ${arrangedNames[index]} palette`"
                  class="bottom-0 left-0 absolute p-2 w-full"
                >
                  <UButton
                    size="2xs"
                    icon="i-heroicons-sparkles"
                    truncate
                    class="max-w-[90%]"
                    :loading="isCreating"
                    @click="onClickExample(`${ntc.name(item)[1].toString()} (${item})`)"
                  >
                    <span class="hidden sm:block truncate">{{ arrangedNames[index] }}</span>
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
            :text="`${t('palette.shareText')} ${data.text ?? ''} with Magicolor AI!`"
          />
        </div>

        <!-- description with color names -->
        <p class="mt-8 text-base max-w-2xl">
          {{ $t('palette.descriptionPrefix') }}
          <strong>{{ data.text }}</strong>
          {{ $t('palette.descriptionSuffix') }}
          <template v-for="(color, index) in arrangedColors" :key="index">
            <strong :style="{ color }">{{ arrangedNames[index] }}</strong>
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
        <div class="mt-12 space-y-6">
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

          <!-- ============ Componentes principales ============ -->
          <div class="space-y-4">
            <!-- Buttons -->
            <div class="border border-gray-200 rounded-xl p-4 space-y-3">
              <h4 class="text-sm font-semibold">{{ $t('palette.previewSectionButtons') }}</h4>
              <div class="flex flex-wrap gap-2">
                <UButton
                  v-for="(color, index) in arrangedColors"
                  :key="`btn-${index}`"
                  size="xs"
                  :variant="index === 3 ? 'solid' : 'soft'"
                  :style="index === 3
                    ? { background: color, color: arrangedColors[4], outline: `2px solid ${color}` }
                    : { background: color + '20', color: color }"
                  class="pointer-events-none"
                >
                  Button {{ index + 1 }}
                </UButton>
              </div>
            </div>

            <!-- Tags -->
            <div class="border border-gray-200 rounded-xl p-4 space-y-3">
              <h4 class="text-sm font-semibold">{{ $t('palette.previewSectionTags') }}</h4>
              <div class="flex flex-wrap gap-2">
                <UBadge
                  v-for="(color, index) in arrangedColors"
                  :key="`tag-${index}`"
                  size="sm"
                  color="white"
                  :style="index === 3
                    ? { color, border: `2px solid ${color}` }
                    : { color, border: `1px solid ${color}60` }"
                >
                  Tag {{ index + 1 }}
                </UBadge>
              </div>
            </div>

            <!-- Alerts -->
            <div class="border border-gray-200 rounded-xl p-4 space-y-3">
              <h4 class="text-sm font-semibold">{{ $t('palette.previewSectionAlerts') }}</h4>
              <div class="space-y-2">
                <UAlert
                  variant="subtle"
                  :style="{ background: arrangedColors[0] + '20', color: arrangedColors[3] }"
                  :description="`Alert message using ${arrangedColors[0]}`"
                />
                <UAlert
                  variant="subtle"
                  :style="{ background: arrangedColors[1] + '20', color: arrangedColors[3] }"
                  :description="`Alert message using ${arrangedColors[1]}`"
                />
              </div>
            </div>

            <!-- Stats Cards -->
            <div class="border border-gray-200 rounded-xl p-4 space-y-3">
              <h4 class="text-sm font-semibold">{{ $t('palette.previewSectionStats') }}</h4>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div
                  v-for="(stat, i) in statsCards"
                  :key="`stat-${i}`"
                  class="rounded-lg p-3"
                  :style="{ background: arrangedColors[i + 2] + '30' }"
                >
                  <p class="text-xs text-gray-600">{{ stat.label }}</p>
                  <p class="text-lg font-bold" :style="{ color: arrangedColors[i] }">{{ stat.value }}</p>
                  <p class="text-xs" :style="{ color: arrangedColors[3] }">{{ stat.delta }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- ============ Formularios y Controles ============ -->
          <div class="space-y-4">
            <h4 class="text-sm font-semibold text-gray-700">{{ $t('palette.previewSectionForms') }}</h4>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <!-- Login Form -->
              <div class="border border-gray-200 rounded-xl p-4 space-y-3">
                <h5 class="text-xs font-semibold text-gray-600">{{ $t('palette.previewSectionLogin') }}</h5>
                <UForm class="space-y-3">
                  <UFormGroup>
                    <UInput
                      :placeholder="$t('palette.previewEmailPlaceholder')"
                      :style="{ borderColor: arrangedColors[0], color: arrangedColors[3] }"
                      class="w-full pointer-events-none"
                    />
                  </UFormGroup>
                  <UFormGroup>
                    <UInput
                      type="password"
                      :placeholder="$t('palette.previewPasswordPlaceholder')"
                      :style="{ borderColor: arrangedColors[1], color: arrangedColors[3] }"
                      class="w-full pointer-events-none"
                    />
                  </UFormGroup>
                  <UButton
                    size="sm"
                    :style="{ background: arrangedColors[0], color: arrangedColors[4] }"
                    class="pointer-events-none"
                  >
                    {{ $t('palette.previewSignIn') }}
                  </UButton>
                </UForm>
              </div>

              <!-- Settings -->
              <div class="border border-gray-200 rounded-xl p-4 space-y-3">
                <h5 class="text-xs font-semibold text-gray-600">{{ $t('palette.previewSectionSettings') }}</h5>
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="text-sm" :style="{ color: arrangedColors[3] }">{{ $t('palette.previewNotifications') }}</span>
                    <UToggle
                      :model-value="true"
                      :style="{ '--ui-toggle-bg': arrangedColors[0] }"
                      class="pointer-events-none"
                    />
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-sm" :style="{ color: arrangedColors[3] }">{{ $t('palette.previewDarkMode') }}</span>
                    <UToggle
                      :model-value="false"
                      class="pointer-events-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ============ Datos y Utilidades ============ -->
          <div class="space-y-4">
            <h4 class="text-sm font-semibold text-gray-700">{{ $t('palette.previewSectionData') }}</h4>

            <!-- Table -->
            <div class="border border-gray-200 rounded-xl p-4 space-y-3">
              <h5 class="text-xs font-semibold text-gray-600">{{ $t('palette.previewSectionTable') }}</h5>
              <UTable
                :columns="tableColumns"
                :rows="tableRows"
                :ui="{ th: { background: arrangedColors[2], color: arrangedColors[3] }, td: { color: arrangedColors[3] } }"
                class="pointer-events-none"
              />
            </div>

            <!-- Calendar + Move Goal -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <!-- Calendar -->
              <div class="border border-gray-200 rounded-xl p-4 space-y-3">
                <h5 class="text-xs font-semibold text-gray-600">{{ $t('palette.previewSectionCalendar') }}</h5>
                <p class="text-sm font-medium" :style="{ color: arrangedColors[3] }">{{ $t('palette.previewMonthJune') }}</p>
                <div class="grid grid-cols-7 gap-1 text-center">
                  <span
                    v-for="(day, idx) in calendarDays"
                    :key="`day-${idx}`"
                    class="text-xs w-7 h-7 flex items-center justify-center rounded"
                    :style="day === 13
                      ? { background: arrangedColors[0], color: arrangedColors[4], fontWeight: 'bold' }
                      : { color: arrangedColors[3] }"
                  >
                    {{ day || '' }}
                  </span>
                </div>
              </div>

              <!-- Move Goal -->
              <div class="border border-gray-200 rounded-xl p-4 space-y-3">
                <h5 class="text-xs font-semibold text-gray-600">{{ $t('palette.previewMoveGoal') }}</h5>
                <div class="flex items-center justify-between">
                  <UButton
                    size="2xs"
                    variant="soft"
                    color="gray"
                    icon="i-heroicons-minus"
                    class="pointer-events-none"
                  />
                  <span class="text-3xl font-bold" :style="{ color: arrangedColors[0] }">350</span>
                  <UButton
                    size="2xs"
                    variant="soft"
                    color="gray"
                    icon="i-heroicons-plus"
                    class="pointer-events-none"
                  />
                </div>
                <!-- bar chart -->
                <div class="flex items-end gap-1 h-12 pt-2">
                  <div
                    v-for="(h, i) in moveGoalBars"
                    :key="`bar-${i}`"
                    class="flex-1 rounded-t"
                    :style="{ height: h + '%', background: arrangedColors[(i % 5)] }"
                  />
                </div>
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
              :text="`${t('palette.shareText')} ${data.text ?? ''} with Magicolor AI!`"
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

/** @description nombres de los colores, desambiguados (sufijo "· 2" si dos colores de la paleta repiten nombre) */
const arrangedNames = computed(() => ntc.uniqueNames(arrangedColors.value));

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

const statsCards = computed(() => [
  {
    label: t('palette.previewTotalRevenue'),
    value: '$15,231.89',
    delta: '▲ 20.1% vs last month'
  },
  {
    label: t('palette.previewActiveUsers'),
    value: '12,234',
    delta: '▲ 2.3% vs last week'
  },
  {
    label: t('palette.previewConversionRate'),
    value: '3.42%',
    delta: '▲ 0.5% vs yesterday'
  }
]);

const tableColumns = computed(() => [
  { key: 'status', label: t('palette.previewTableStatus') },
  { key: 'email', label: t('palette.previewTableEmail') },
  { key: 'amount', label: t('palette.previewTableAmount') }
]);

const tableRows = computed(() => [
  {
    status: t('palette.previewTableSuccess'),
    email: 'user1@example.com',
    amount: '$62.04'
  },
  {
    status: t('palette.previewTableSuccess'),
    email: 'user2@example.com',
    amount: '$132.28'
  },
  {
    status: t('palette.previewTableSuccess'),
    email: 'user3@example.com',
    amount: '$396.18'
  }
]);

const calendarDays = computed(() => {
  const firstWeekday = 3;
  const daysInMonth = 30;
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
});

const moveGoalBars = [22, 55, 42, 75, 30, 60, 47];
</script>
