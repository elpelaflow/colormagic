<template>
  <div>
    <!-- header-->
    <div class="mb-8">
      <!-- title -->
      <h1>
        {{ $t('colorMixer.title') }}
      </h1>

      <!-- description-->
      <p class="text-xl font-medium mb-4 max-w-xl">
        {{ $t('colorMixer.seoDescription') }}
      </p>
    </div>

    <!-- preview: color A | mixed result | color B -->
    <div class="grid sm:grid-cols-3 gap-4 mb-6">
      <!-- color A -->
      <div class="border border-gray-200 rounded-2xl overflow-hidden">
        <div
          class="h-32 sm:h-44 w-full relative"
          :style="{ background: state.colorA }"
        >
          <ColorNameBadge
            :name="colorAName"
            class="bottom-2 left-2 absolute"
          />
        </div>
        <div class="flex items-center justify-between p-2 bg-white">
          <p class="text-sm font-semibold">
            {{ $t('colorMixer.colorALabel') }}
          </p>
          <span class="text-xs text-gray-500">{{ state.colorA }}</span>
        </div>
      </div>

      <!-- mixed result -->
      <div class="border border-gray-200 rounded-2xl overflow-hidden">
        <div
          class="h-32 sm:h-44 w-full relative"
          :style="{ background: mixedResult.hex }"
        >
          <!-- ratio badge -->
          <UBadge
            size="sm"
            class="absolute top-2 left-1/2 -translate-x-1/2"
          >
            {{ ratioLabel }}
          </UBadge>

          <ColorNameBadge
            :name="mixedName"
            class="bottom-2 left-2 absolute"
          />
        </div>
        <div class="flex items-center justify-between p-2 bg-white">
          <p class="text-sm font-semibold">
            {{ $t('colorMixer.mixedResult') }}
          </p>
          <span class="text-xs text-gray-500">{{ mixedResult.hex }}</span>
        </div>
      </div>

      <!-- color B -->
      <div class="border border-gray-200 rounded-2xl overflow-hidden">
        <div
          class="h-32 sm:h-44 w-full relative"
          :style="{ background: state.colorB }"
        >
          <ColorNameBadge
            :name="colorBName"
            class="bottom-2 left-2 absolute"
          />
        </div>
        <div class="flex items-center justify-between p-2 bg-white">
          <p class="text-sm font-semibold">
            {{ $t('colorMixer.colorBLabel') }}
          </p>
          <span class="text-xs text-gray-500">{{ state.colorB }}</span>
        </div>
      </div>
    </div>

    <!-- form: color A | swap | color B -->
    <UForm
      :state="state"
      :schema="FormSchema"
      class="grid sm:grid-cols-[1fr_auto_1fr] gap-4 items-center"
    >
      <!-- color A -->
      <div class="border border-gray-200 rounded-2xl overflow-hidden">
        <div class="p-4 space-y-4">
          <UFormGroup
            name="colorA"
            :label="$t('colorMixer.colorALabel')"
          >
            <div class="flex gap-2 items-center">
              <!-- color picker -->
              <ColorPicker
                :initial-color="state.colorA"
                @select="value => state.colorA = value"
              />

              <!-- input -->
              <UInput
                v-model="state.colorA"
                placeholder="#000000"
              />
            </div>
          </UFormGroup>

          <!-- copy buttons -->
          <ColorCopyButtons :hex="state.colorA" />
        </div>
      </div>

      <!-- swap button -->
      <div class="flex justify-center">
        <UButton
          icon="i-heroicons-arrow-path"
          variant="soft"
          color="gray"
          size="md"
          :aria-label="$t('colorMixer.swapColors')"
          circle
          @click="swapColors"
        />
      </div>

      <!-- color B -->
      <div class="border border-gray-200 rounded-2xl overflow-hidden">
        <div class="p-4 space-y-4">
          <UFormGroup
            name="colorB"
            :label="$t('colorMixer.colorBLabel')"
          >
            <div class="flex gap-2 items-center">
              <!-- color picker -->
              <ColorPicker
                :initial-color="state.colorB"
                @select="value => state.colorB = value"
              />

              <!-- input -->
              <UInput
                v-model="state.colorB"
                placeholder="#000000"
              />
            </div>
          </UFormGroup>

          <!-- copy buttons -->
          <ColorCopyButtons :hex="state.colorB" />
        </div>
      </div>
    </UForm>

    <!-- mix ratio slider -->
    <div class="mt-6 border border-gray-200 rounded-2xl p-4">
      <div class="flex items-center justify-between mb-4">
        <p class="font-semibold text-sm">
          {{ $t('colorMixer.mixRatio') }}
        </p>
        <p class="font-semibold text-sm">
          {{ ratioLabel }}
        </p>
      </div>
      <URange
        v-model="ratioPercent"
        :min="0"
        :max="100"
        :step="1"
        size="lg"
      />
    </div>

    <!-- mixed result details -->
    <div class="mt-6 border border-gray-200 rounded-2xl overflow-hidden">
      <div class="p-4 flex flex-wrap gap-4 items-center justify-between">
        <!-- copy buttons -->
        <ColorCopyButtons :hex="mixedResult.hex" />

        <!-- open color page -->
        <UButton
          icon="i-heroicons-arrow-top-right-on-square"
          :label="$t('colorMixer.openColorPage')"
          :to="colorPageUrl"
          target="_blank"
          @click="onOpenColorPage"
        />
      </div>
    </div>

    <!-- preset mixes -->
    <div class="mt-8">
      <p class="font-semibold text-sm mb-3">
        {{ $t('colorMixer.presetsTitle') }}
      </p>
      <ul class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <li
          v-for="preset in MIX_PRESETS"
          :key="preset.id"
          class="border rounded-xl overflow-hidden cursor-pointer hover:border-gray-400 transition-colors"
          role="button"
          tabindex="0"
          :aria-label="$t(`colorMixer.presets.${preset.nameKey}`)"
          @click="loadPreset(preset)"
          @keyup.enter="loadPreset(preset)"
        >
          <!-- preview: A + B split -->
          <div class="h-10 flex">
            <div
              class="w-1/2"
              :style="{ background: preset.a }"
            />
            <div
              class="w-1/2"
              :style="{ background: preset.b }"
            />
          </div>

          <!-- info -->
          <div class="p-2 bg-white">
            <p class="text-xs font-semibold text-center">
              {{ $t(`colorMixer.presets.${preset.nameKey}`) }}
            </p>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { object, type InferType, string } from 'yup';
import { PlausibleEventName } from '~/layers/plausible/types';
import ntc from '~/layers/palette/utils/ntc.util';
import { formatOgUrl } from '~/layers/og/utils/og.util';
import { MIX_PRESETS, mixColorsRyb, type MixPreset } from '~/layers/color-mixer/utils/color-mixer.util';

const { t } = useI18n();

const title = t('colorMixer.seoTitle');
const description = t('colorMixer.seoDescription');

const state = ref({
  colorA: '#FE2712',
  colorB: '#FEFE33'
});

const FormSchema = object({
  colorA: string().required(),
  colorB: string().required()
});

export type Form = InferType<typeof FormSchema>;

const ratioPercent = ref(50);

const ratioLabel = computed(() => `${ratioPercent.value}% A · ${100 - ratioPercent.value}% B`);

const mixedResult = computed(() => mixColorsRyb(state.value.colorA, state.value.colorB, ratioPercent.value / 100));

const colorAName = computed(() => ntc.name(state.value.colorA)[1].toString());
const colorBName = computed(() => ntc.name(state.value.colorB)[1].toString());
const mixedName = computed(() => ntc.name(mixedResult.value.hex)[1].toString());

const siteUrl = useRuntimeConfig().public.siteUrl;

const colorPageUrl = computed(() => `${siteUrl}${formatOgUrl([mixedResult.value.hex], encodeURIComponent(mixedName.value))}`);

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImageUrl: colorPageUrl
});

function onOpenColorPage(): void {
  sendPlausibleEvent(PlausibleEventName.COLOR_MIXER_OPENED);
}

function swapColors(): void {
  const tmp = state.value.colorA;
  state.value.colorA = state.value.colorB;
  state.value.colorB = tmp;
}

function loadPreset(preset: MixPreset): void {
  state.value.colorA = preset.a;
  state.value.colorB = preset.b;
  ratioPercent.value = preset.ratio;
  sendPlausibleEvent(PlausibleEventName.COLOR_MIXER_PRESET_LOADED);
}
</script>
