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
      <div class="flex flex-wrap items-center gap-3 p-4 border-t border-gray-200">
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
      <ul class="flex flex-wrap gap-4 sm:gap-8 p-4 border-t border-gray-200">
        <li>
          <p class="font-semibold text-sm">
            {{ $t('contrastChecker.contrastRatio') }}:
          </p>
          <UBadge
            color="white"
            :label="contrastRatio.toFixed(2)"
          />
        </li>
        <li>
          <p class="font-semibold text-sm">
            {{ $t('contrastChecker.normalText') }}:
          </p>
          <UBadge
            :color="contrastRatio >= 4.5 ? 'green' : 'red'"
            :label="contrastRatio < 4.5 ? $t('contrastChecker.failText') : contrastRatio < 7 ? 'AA' : 'AAA'"
          />
        </li>
        <li>
          <p class="font-semibold text-sm">
            {{ $t('contrastChecker.largeText') }}:
          </p>
          <UBadge
            :color="contrastRatio >= 3 ? 'green' : 'red'"
            :label="contrastRatio < 3 ? $t('contrastChecker.failText') : contrastRatio < 4.5 ? 'AA' : 'AAA'"
          />
        </li>
        <li>
          <p class="font-semibold text-sm">
            {{ $t('contrastChecker.uiComponents') }}:
          </p>
          <UBadge
            :color="contrastRatio >= 3 ? 'green' : 'red'"
            :label="contrastRatio < 3 ? $t('contrastChecker.failText') : 'AA'"
          />
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
      class="grid sm:grid-cols-2 gap-4 items-start"
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

    <!-- description + links -->
    <div class="my-8 text-sm">
      <p class="mb-4">
        {{ $t('contrastChecker.legibilityDescription') }}
      </p>
      <ul class="list-inside list-decimal pl-4 flex flex-col gap-2">
        <li>
          <UButton
            variant="link"
            :padded="false"
            to="https://www.w3.org/TR/WCAG21/#contrast-minimum"
            label="1.4.3 Minimum Contrast (AA)"
          />
        </li>
        <li>
          <UButton
            variant="link"
            :padded="false"
            to="https://www.w3.org/TR/WCAG21/#contrast-enhanced"
            label="1.4.6 Enhanced Contrast (AAA)"
          />
        </li>
        <li>
          <UButton
            variant="link"
            :padded="false"
            to="https://www.w3.org/TR/WCAG21/#non-text-contrast"
            label="1.4.11 Non-Text Contrast (AA)"
          />
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

const state = ref({
  primary: '#fae8c7',
  secondary: '#9a6acd'
});

const FormSchema = object({
  primary: string().required(),
  secondary: string().required()
});

export type Form = InferType<typeof FormSchema>;

const arrangePrimary = ref({
  brightness: 0,
  saturation: 0,
  warmth: 0
});

const arrangeSecondary = ref({
  brightness: 0,
  saturation: 0,
  warmth: 0
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
