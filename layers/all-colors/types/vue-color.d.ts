export {};

declare module '@ckpack/vue-color' {
  import type { DefineComponent } from 'vue';

  interface ColorPayload {
    a: number
    hex?: string
    hsl?: { h: number, s: number, l: number, a: number }
    hsv?: { h: number, s: number, v: number, a: number }
    rgb?: { r: number, g: number, b: number, a: number }
    source?: string
  }

  export const Saturation: DefineComponent<{
    value?: ColorPayload
  }, {}, {
    change: [data: { h: number, s: number, v: number, a: number, source: string }]
  }>;

  export const Hue: DefineComponent<{
    value?: ColorPayload
    direction?: 'horizontal' | 'vertical'
  }, {}, {
    change: [data: { h: number, s: number, l: number, a: number, source: string }]
  }>;
}
