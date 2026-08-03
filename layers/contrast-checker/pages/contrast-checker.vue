<template>
  <div>
    <!-- header-->
    <div class="mb-8">
      <!-- title -->
      <h1>
        {{ $t('contrastChecker.title') }}
      </h1>

      <!-- description-->
      <p class="text-xl font-medium mb-4 max-w-xl">
        {{ $t('contrastChecker.seoDescription') }}
      </p>
    </div>

    <!-- color -->
    <div class="overflow-hidden border border-gray-200 rounded-2xl mb-4">
      <!-- the color block -->
      <div
        class="h-44 w-full flex justify-center items-center relative"
        :class="visionDivides ? 'divide-x-0' : ''"
      >
        <!-- normal vision (full width) -->
        <div
          v-if="!visionDivides"
          class="absolute inset-0 flex justify-center items-center"
          :style="{ background: arrangedSecondaryColor[0] }"
        >
          <p
            :style="{ color: arrangedPrimaryColor[0] }"
            class="font-semibold text-xl"
          >
            {{ $t('contrastChecker.exampleText') }}
          </p>
        </div>

        <!-- split: left = normal vision, right = simulated vision -->
        <template v-else>
          <!-- left: normal -->
          <div
            class="absolute left-0 top-0 h-full w-1/2 flex justify-center items-center"
            :style="{ background: arrangedSecondaryColor[0] }"
          >
            <p
              :style="{ color: arrangedPrimaryColor[0] }"
              class="font-semibold text-xl"
            >
              {{ $t('contrastChecker.exampleText') }}
            </p>
          </div>
          <!-- right: simulated -->
          <div
            class="absolute right-0 top-0 h-full w-1/2 flex justify-center items-center"
            :style="{ background: simulatedSecondary }"
          >
            <p
              :style="{ color: simulatedPrimary }"
              class="font-semibold text-xl"
            >
              {{ $t('contrastChecker.exampleText') }}
            </p>
          </div>
        </template>

        <!-- vision badge corner (top-right) -->
        <UBadge
          color="black"
          variant="solid"
          size="sm"
          class="absolute top-3 right-3 pointer-events-none"
          :label="currentVisionLabel"
        />
      </div>

      <!-- vision simulator selector -->
      <div class="flex flex-wrap items-center gap-3 p-4 border-t border-gray-200 print:hidden">
        <p class="font-semibold text-sm">
          {{ $t('contrastChecker.visionSimulator') }}:
        </p>
        <div class="w-56">
          <USelectMenu
            v-model="selectedVision"
            size="sm"
            by="id"
            value-attribute="id"
            option-attribute="label"
            :options="visionOptions"
            :popper="{ placement: 'bottom-start' }"
            :ui-menu="{ container: 'min-w-56' }"
          />
        </div>
      </div>

      <!-- all contrast ratio checks -->
      <ul class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4 border-t border-gray-200">
        <!-- contrast ratio -->
        <li class="col-span-2 md:col-span-3 lg:col-span-6">
          <p class="font-semibold text-sm">
            {{ $t('contrastChecker.contrastRatio') }}:
          </p>
          <UBadge
            color="white"
            size="lg"
            :label="contrastRatio.toFixed(2)"
          />
        </li>

        <!-- AA Normal Text (>=4.5) -->
        <li>
          <p class="font-semibold text-xs mb-1">
            {{ $t('contrastChecker.wcag.aaNormal') }}
          </p>
          <UBadge
            :color="contrastRatio >= 4.5 ? 'green' : 'red'"
            :label="contrastRatio >= 4.5 ? $t('contrastChecker.passText') : $t('contrastChecker.failText')"
            :ui="{ rounded: 'rounded-full' }"
          />
          <p class="text-xs text-gray-500 mt-1">
            ≥ 4.5
          </p>
        </li>

        <!-- AA Large Text (>=3) -->
        <li>
          <p class="font-semibold text-xs mb-1">
            {{ $t('contrastChecker.wcag.aaLarge') }}
          </p>
          <UBadge
            :color="contrastRatio >= 3 ? 'green' : 'red'"
            :label="contrastRatio >= 3 ? $t('contrastChecker.passText') : $t('contrastChecker.failText')"
            :ui="{ rounded: 'rounded-full' }"
          />
          <p class="text-xs text-gray-500 mt-1">
            ≥ 3
          </p>
        </li>

        <!-- AAA Normal Text (>=7) -->
        <li>
          <p class="font-semibold text-xs mb-1">
            {{ $t('contrastChecker.wcag.aaaNormal') }}
          </p>
          <UBadge
            :color="contrastRatio >= 7 ? 'green' : 'red'"
            :label="contrastRatio >= 7 ? $t('contrastChecker.passText') : $t('contrastChecker.failText')"
            :ui="{ rounded: 'rounded-full' }"
          />
          <p class="text-xs text-gray-500 mt-1">
            ≥ 7
          </p>
        </li>

        <!-- AAA Large Text (>=4.5) -->
        <li>
          <p class="font-semibold text-xs mb-1">
            {{ $t('contrastChecker.wcag.aaaLarge') }}
          </p>
          <UBadge
            :color="contrastRatio >= 4.5 ? 'green' : 'red'"
            :label="contrastRatio >= 4.5 ? $t('contrastChecker.passText') : $t('contrastChecker.failText')"
            :ui="{ rounded: 'rounded-full' }"
          />
          <p class="text-xs text-gray-500 mt-1">
            ≥ 4.5
          </p>
        </li>

        <!-- UI Components (>=3, AA) -->
        <li>
          <p class="font-semibold text-xs mb-1">
            {{ $t('contrastChecker.uiComponents') }}
          </p>
          <UBadge
            :color="contrastRatio >= 3 ? 'green' : 'red'"
            :label="contrastRatio >= 3 ? $t('contrastChecker.passText') : $t('contrastChecker.failText')"
            :ui="{ rounded: 'rounded-full' }"
          />
          <p class="text-xs text-gray-500 mt-1">
            ≥ 3
          </p>
        </li>
      </ul>
    </div>

    <!-- Smart suggestions (WCAG fails) -->
    <div
      v-if="showSmartSuggestions"
      class="mb-4 border border-amber-200 rounded-2xl overflow-hidden bg-amber-50"
    >
      <div class="p-4">
        <div class="flex items-start gap-3 mb-4">
          <UIcon
            name="i-heroicons-light-bulb"
            class="text-amber-500 text-xl mt-0.5 shrink-0"
          />
          <div>
            <p class="font-semibold text-sm mb-1">
              {{ $t('contrastChecker.smartSuggestionsTitle') }}
            </p>
            <p class="text-sm text-gray-700">
              {{ $t('contrastChecker.smartSuggestionsDescription') }}
            </p>
          </div>
        </div>

        <ul class="grid sm:grid-cols-2 gap-3">
          <li
            v-for="(suggestion, index) in suggestions"
            :key="index"
            class="border border-gray-200 rounded-xl overflow-hidden bg-white"
          >
            <!-- preview -->
            <div
              class="h-16 flex items-center justify-center"
              :style="{ background: suggestion.secondary }"
            >
              <p
                :style="{ color: suggestion.primary }"
                class="font-semibold text-base"
              >
                Aa
              </p>
            </div>

            <!-- info + apply -->
            <div class="p-3">
              <div class="flex items-center justify-between gap-2 mb-2">
                <div class="flex items-center gap-2">
                  <UBadge
                    color="white"
                    size="sm"
                    :label="suggestion.ratio.toFixed(2)"
                  />
                  <UBadge
                    :color="suggestion.ratio >= 7 ? 'green' : 'yellow'"
                    size="sm"
                    :label="suggestion.ratio >= 7 ? 'AAA' : 'AA'"
                  />
                </div>
                <UButton
                  size="xs"
                  variant="soft"
                  class="print:hidden"
                  :label="$t('contrastChecker.applySuggestion')"
                  @click="applySuggestion(suggestion)"
                />
              </div>
              <div class="flex gap-2 text-xs font-mono">
                <span :style="{ color: suggestion.primary }">●</span>
                <span class="text-gray-600">{{ suggestion.primary }}</span>
                <span class="text-gray-400">/</span>
                <span :style="{ color: suggestion.secondary }">●</span>
                <span class="text-gray-600">{{ suggestion.secondary }}</span>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <!-- form -->
    <UForm
      :state="state"
      :schema="FormSchema"
      class="grid sm:grid-cols-[1fr_auto_1fr] gap-4 items-center print:hidden"
    >
      <!-- primary -->
      <div class="border rounded-2xl overflow-hidden">
        <div class="p-4 space-y-4">
          <UFormGroup
            name="primary"
            :label="$t('contrastChecker.primaryLabel')"
          >
            <div class="flex gap-2 items-center">
              <!-- color picker -->
              <ColorPicker
                :initial-color="state.primary"
                @select="value => state.primary = value"
              />

              <!-- input -->
              <UInput
                v-model="state.primary"
                placeholder="#000000"
              />
            </div>
          </UFormGroup>

          <!-- arrange sliders-->
          <ColorArrangeSliders v-model="arrangePrimary" />

          <!-- reset button -->
          <UButton
            v-if="primaryHasChanges"
            :label="$t('palette.resetLabel')"
            block
            @click="resetPrimaryArrange()"
          />
        </div>

        <!-- color block -->
        <div
          v-if="primaryHasChanges"
          class="flex gap-4 items-center border-t bg-white"
        >
          <div
            class="w-20 h-20"
            :style="{ background: arrangedPrimaryColor[0] }"
          />

          <!-- copy buttons-->
          <ColorCopyButtons :hex="arrangedPrimaryColor[0]" />
        </div>
      </div>

      <!-- swap button -->
      <div class="flex justify-center">
        <UButton
          icon="i-heroicons-arrow-path"
          variant="soft"
          color="gray"
          size="md"
          :aria-label="$t('contrastChecker.swapColors')"
          circle
          class="print:hidden"
          @click="swapColors"
        />
      </div>

      <!-- secondary -->
      <div class="border rounded-2xl overflow-hidden">
        <div class="p-4 space-y-4">
          <UFormGroup
            name="secondary"
            :label="$t('contrastChecker.secondaryLabel')"
          >
            <div class="flex gap-2 items-center">
              <!-- color picker -->
              <ColorPicker
                :initial-color="state.secondary"
                @select="value => state.secondary = value"
              />

              <!-- input -->
              <UInput
                v-model="state.secondary"
                placeholder="#000000"
              />
            </div>
          </UFormGroup>

          <!-- arrange sliders-->
          <ColorArrangeSliders v-model="arrangeSecondary" />

          <!-- reset button -->
          <UButton
            v-if="secondaryHasChanges"
            :label="$t('palette.resetLabel')"
            block
            @click="resetSecondaryArrange()"
          />
        </div>

        <!-- color block -->
        <div
          v-if="secondaryHasChanges"
          class="flex gap-4 items-center border-t bg-white"
        >
          <div
            class="w-20 h-20"
            :style="{ background: arrangedSecondaryColor[0] }"
          />

          <!-- copy buttons-->
          <ColorCopyButtons :hex="arrangedSecondaryColor[0]" />
        </div>
      </div>
    </UForm>

    <!-- About WCAG Contrast -->
    <div class="my-8 border border-gray-200 rounded-2xl overflow-hidden">
      <div class="p-4 space-y-3 text-sm">
        <!-- title -->
        <p class="font-semibold text-base">
          {{ $t('contrastChecker.aboutWcagTitle') }}
        </p>

        <!-- intro -->
        <p class="text-gray-700">
          {{ $t('contrastChecker.aboutWcagIntro') }}
        </p>

        <!-- UI components note -->
        <p class="text-gray-700">
          <span class="font-semibold">{{ $t('contrastChecker.uiComponents') }}:</span>
          {{ $t('contrastChecker.uiComponentsDescription') }}
        </p>

        <!-- table -->
        <UTable
          :columns="wcagTableColumns"
          :rows="wcagTableRows"
          :ui="{ wrapper: 'mt-2' }"
        />

        <!-- references -->
        <div class="pt-2 border-t border-gray-100">
          <p class="font-semibold mb-2">
            {{ $t('contrastChecker.referencesLabel') }}:
          </p>
          <ul class="list-inside list-disc pl-2 flex flex-col gap-1.5">
            <li>
              <UButton
                variant="link"
                :padded="false"
                to="https://www.w3.org/TR/WCAG21/#contrast-minimum"
                :label="$t('contrastChecker.reference.143')"
              />
            </li>
            <li>
              <UButton
                variant="link"
                :padded="false"
                to="https://www.w3.org/TR/WCAG21/#contrast-enhanced"
                :label="$t('contrastChecker.reference.146')"
              />
            </li>
            <li>
              <UButton
                variant="link"
                :padded="false"
                to="https://www.w3.org/TR/WCAG21/#non-text-contrast"
                :label="$t('contrastChecker.reference.1411')"
              />
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- share + export -->
    <div class="my-8 print:hidden">
      <p class="font-semibold text-sm mb-3">
        {{ $t('contrastChecker.shareExportTitle') }}
      </p>
      <div class="flex flex-wrap gap-3 items-center">
        <!-- share buttons -->
        <CommonSocialShareButtons
          type="text"
          orientation="horizontal"
          :text="`${t('contrastChecker.shareText')}`"
        />

        <!-- divider -->
        <span class="hidden sm:block h-6 w-px bg-gray-200" />

        <!-- copy link -->
        <UButton
          icon="i-heroicons-link"
          :color="copiedLink ? 'green' : 'primary'"
          :variant="copiedLink ? 'solid' : 'soft'"
          :label="copiedLink ? $t('contrastChecker.copiedLink') : $t('contrastChecker.copyLink')"
          @click="copyShareLink"
        />

        <!-- export PDF -->
        <UButton
          icon="i-heroicons-document-arrow-down"
          variant="soft"
          :label="$t('contrastChecker.exportPdf')"
          @click="exportPdf"
        />
      </div>
    </div>

    <!-- popular accessible color combinations -->
    <div class="my-8">
      <p class="font-semibold text-sm mb-3">
        {{ $t('contrastChecker.accessibleCombinations') }}
      </p>
      <ul class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <li
          v-for="palette in accessiblePalettes"
          :key="palette.id"
          class="border rounded-xl overflow-hidden cursor-pointer hover:border-gray-400 transition-colors"
          role="button"
          tabindex="0"
          :aria-label="`${palette.label} - ratio ${palette.ratio.toFixed(2)}:1 ${palette.level}`"
          @click="loadAccessiblePalette(palette)"
          @keyup.enter="loadAccessiblePalette(palette)"
        >
          <!-- preview -->
          <div
            class="h-14 flex items-center justify-center"
            :style="{ background: palette.secondary }"
          >
            <p
              :style="{ color: palette.primary }"
              class="font-semibold text-base"
            >
              Aa
            </p>
          </div>

          <!-- info -->
          <div class="p-2 bg-white">
            <p class="text-xs font-semibold mb-1">
              {{ palette.label }}
            </p>
            <div class="flex items-center gap-1.5">
              <UBadge
                color="white"
                size="sm"
                :label="`${palette.ratio.toFixed(2)}:1`"
              />
              <UBadge
                :color="palette.level === 'AAA' ? 'green' : 'yellow'"
                size="sm"
                :label="palette.level"
              />
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { object, type InferType, string } from 'yup';
import ntc from '~/layers/palette/utils/ntc.util';
import { simulateVision, VISION_OPTIONS, type VisionType } from '~/layers/contrast-checker/utils/color-vision.util';
import { suggestAccessibleColors, getAccessibilityFails, hasAnyFail, type ColorSuggestion } from '~/layers/contrast-checker/utils/color-suggestions.util';
import { ACCESSIBLE_PALETTES, type AccessiblePalette } from '~/layers/contrast-checker/utils/accessible-palettes.util';

const { t } = useI18n();

const title = t('contrastChecker.seoTitle');
const description = t('contrastChecker.seoDescription');

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImageUrl: `${useRuntimeConfig().public.siteUrl}/img/og.png`
});

const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();

const HEX_QUERY_RE = /^#?[0-9a-fA-F]{6}$/;
const INT_QUERY_RE = /^-?\d+$/;

function readHexQuery(q: Record<string, any>, key: string, fallback: string): string {
  const v = q[key];
  return typeof v === 'string' && HEX_QUERY_RE.test(v)
    ? (v.startsWith('#') ? v : '#' + v)
    : fallback;
}
function readIntQuery(q: Record<string, any>, key: string, fallback: number): number {
  const v = q[key];
  return typeof v === 'string' && INT_QUERY_RE.test(v) ? Math.max(-100, Math.min(100, parseInt(v, 10))) : fallback;
}

const initialized = ref(false);
const state = ref({
  primary: readHexQuery(route.query, 'primary', '#fae8c7'),
  secondary: readHexQuery(route.query, 'secondary', '#9a6acd')
});

const FormSchema = object({
  primary: string().required(),
  secondary: string().required()
});

export type Form = InferType<typeof FormSchema>;

const arrangePrimary = ref({
  brightness: readIntQuery(route.query, 'pBrightness', 0),
  saturation: readIntQuery(route.query, 'pSaturation', 0),
  warmth: readIntQuery(route.query, 'pWarmth', 0)
});

const arrangeSecondary = ref({
  brightness: readIntQuery(route.query, 'sBrightness', 0),
  saturation: readIntQuery(route.query, 'sSaturation', 0),
  warmth: readIntQuery(route.query, 'sWarmth', 0)
});

// Sincronizar estado -> URL (query params). Se desactiva brevemente cuando
// cargamos desde query para no pisar la URL original antes del primer render.
watch([state, arrangePrimary, arrangeSecondary], () => {
  if (initialized.value === false) return;
  const q = {
    primary: state.value.primary,
    secondary: state.value.secondary,
    pBrightness: String(arrangePrimary.value.brightness),
    pSaturation: String(arrangePrimary.value.saturation),
    pWarmth: String(arrangePrimary.value.warmth),
    sBrightness: String(arrangeSecondary.value.brightness),
    sSaturation: String(arrangeSecondary.value.saturation),
    sWarmth: String(arrangeSecondary.value.warmth)
  };
  router.replace({ query: q });
}, { deep: true });

onMounted(() => {
  initialized.value = true;
});

const arrangedPrimaryColor = computed(() => arrangeColors([state.value.primary], {
  brightness: arrangePrimary.value.brightness,
  saturation: arrangePrimary.value.saturation,
  warmth: arrangePrimary.value.warmth
}));

const arrangedSecondaryColor = computed(() => arrangeColors([state.value.secondary], {
  brightness: arrangeSecondary.value.brightness,
  saturation: arrangeSecondary.value.saturation,
  warmth: arrangeSecondary.value.warmth
}));

// --- Vision simulator ---
const selectedVision = ref<VisionType>('normal');

const visionOptions = computed(() => VISION_OPTIONS.map(v => ({
  id: v.id,
  label: t(`contrastChecker.vision.${v.id}`)
})));

const visionDivides = computed(() => {
  const opt = VISION_OPTIONS.find(o => o.id === selectedVision.value);
  return opt?.divides ?? false;
});

const currentVisionLabel = computed(() => {
  if (selectedVision.value === 'normal') {
    return t('contrastChecker.vision.normalVision');
  }
  return t(`contrastChecker.vision.${selectedVision.value}`);
});

const simulatedPrimary = computed(() => simulateVision(arrangedPrimaryColor.value[0], selectedVision.value));
const simulatedSecondary = computed(() => simulateVision(arrangedSecondaryColor.value[0], selectedVision.value));

const contrastRatio = computed(() => {
  return calculateContrastRatio(
    ntc.rgb(arrangedPrimaryColor.value[0]),
    ntc.rgb(arrangedSecondaryColor.value[0])
  );
});

// --- Smart suggestions (WCAG fails) ---
const accessibilityFails = computed(() => getAccessibilityFails(contrastRatio.value));
const showSmartSuggestions = computed(() => hasAnyFail(accessibilityFails.value));
const suggestions = computed<ColorSuggestion[]>(() =>
  suggestAccessibleColors(arrangedPrimaryColor.value[0], arrangedSecondaryColor.value[0])
);

function applySuggestion(suggestion: ColorSuggestion): void {
  state.value.primary = suggestion.primary;
  state.value.secondary = suggestion.secondary;
  arrangePrimary.value.brightness = 0;
  arrangePrimary.value.saturation = 0;
  arrangePrimary.value.warmth = 0;
  arrangeSecondary.value.brightness = 0;
  arrangeSecondary.value.saturation = 0;
  arrangeSecondary.value.warmth = 0;
}

const accessiblePalettes = ACCESSIBLE_PALETTES;

const wcagTableColumns = computed(() => [
  { key: 'level', label: t('contrastChecker.wcagTableLevel') },
  { key: 'textSize', label: t('contrastChecker.wcagTableTextSize') },
  { key: 'ratio', label: t('contrastChecker.wcagTableRatio') }
]);

const wcagTableRows = computed(() => [
  { level: 'AA', textSize: t('contrastChecker.normalText'), ratio: '4.5:1' },
  { level: 'AA', textSize: t('contrastChecker.largeText'), ratio: '3:1' },
  { level: 'AAA', textSize: t('contrastChecker.normalText'), ratio: '7:1' },
  { level: 'AAA', textSize: t('contrastChecker.largeText'), ratio: '4.5:1' }
]);

function loadAccessiblePalette(palette: AccessiblePalette): void {
  state.value.primary = palette.primary;
  state.value.secondary = palette.secondary;
  arrangePrimary.value.brightness = 0;
  arrangePrimary.value.saturation = 0;
  arrangePrimary.value.warmth = 0;
  arrangeSecondary.value.brightness = 0;
  arrangeSecondary.value.saturation = 0;
  arrangeSecondary.value.warmth = 0;
}

function swapColors(): void {
  const tmpPrimary = state.value.primary;
  state.value.primary = state.value.secondary;
  state.value.secondary = tmpPrimary;

  const tmpArr = { ...arrangePrimary.value };
  arrangePrimary.value = { ...arrangeSecondary.value };
  arrangeSecondary.value = tmpArr;
}

// --- Share + Export ---
const copiedLink = ref(false);

async function copyShareLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(window.location.href);
    copiedLink.value = true;
    setTimeout(() => { copiedLink.value = false; }, 2000);
  } catch {
    // ignore: el navegador no permite clipboard
  }
}

function exportPdf(): void {
  if (typeof window !== 'undefined') {
    window.print();
  }
}

const primaryHasChanges = computed(() => {
  return arrangePrimary.value.brightness !== 0 ||
  arrangePrimary.value.saturation !== 0 ||
  arrangePrimary.value.warmth !== 0;
});

const secondaryHasChanges = computed(() => {
  return arrangeSecondary.value.brightness !== 0 ||
  arrangeSecondary.value.saturation !== 0 ||
  arrangeSecondary.value.warmth !== 0;
});

function resetPrimaryArrange(): void {
  arrangePrimary.value.brightness = 0;
  arrangePrimary.value.saturation = 0;
  arrangePrimary.value.warmth = 0;
}

function resetSecondaryArrange(): void {
  arrangeSecondary.value.brightness = 0;
  arrangeSecondary.value.saturation = 0;
  arrangeSecondary.value.warmth = 0;
}
</script>
