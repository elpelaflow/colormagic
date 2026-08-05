/**
 * culori-shim.ts — Mini-culori para el harness de paridad (NO forma parte de
 * la app ni de la referencia).
 *
 * La copia literal de pro-color-harmonies importa `culori` en 3 archivos
 * (utils/gamut.ts, utils/interpolation.ts, utils/demo-palette.ts). Este shim
 * reimplementa SOLO las funciones que esos archivos usan, con el
 * comportamiento verificado contra culori ^4.0.2 (instalado en scratch y
 * comparado numéricamente, ver informe PARITY-REPORT.md):
 *   - oklch()/oklab(): conversión OKLCH <-> OKLab. El hue que devuelve
 *     oklab->oklch queda normalizado a [0, 360) (culori hace lo mismo).
 *   - interpolate(colors, 'oklab'): interpolación lineal por tramos
 *     (la opción por defecto de culori.interpolate).
 *   - clampChroma(): NO implementado (lanza). El core del generador no lo usa:
 *     la paridad corre con clampToGamut off (default del original). La paridad
 *     del clamp de gamut se valida por separado contra culori real.
 */
type ColorLike = { mode: string; l: number; c?: number; h?: number; a?: number; b?: number };

export function clampChroma(): never {
  throw new Error(
    'culori-shim: clampChroma no está implementado. La paridad del gamut-clamp se valida contra culori real (ver informe).'
  );
}

export function oklab(color: ColorLike): { mode: 'oklab'; l: number; a: number; b: number } {
  if (color.mode === 'oklab') {
    return { mode: 'oklab', l: color.l, a: color.a ?? 0, b: color.b ?? 0 };
  }
  if (color.mode === 'oklch') {
    const rad = ((color.h ?? 0) * Math.PI) / 180;
    return { mode: 'oklab', l: color.l, a: (color.c ?? 0) * Math.cos(rad), b: (color.c ?? 0) * Math.sin(rad) };
  }
  throw new Error(`culori-shim: oklab() sin soporte para mode '${color.mode}'`);
}

export function oklch(color: ColorLike): { mode: 'oklch'; l: number; c: number; h: number } {
  if (color.mode === 'oklch') {
    return { mode: 'oklch', l: color.l, c: color.c ?? 0, h: color.h ?? 0 };
  }
  if (color.mode === 'oklab') {
    const a = color.a ?? 0;
    const b = color.b ?? 0;
    const c = Math.sqrt(a * a + b * b);
    const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
    return { mode: 'oklch', l: color.l, c, h };
  }
  throw new Error(`culori-shim: oklch() sin soporte para mode '${color.mode}'`);
}

/**
 * Interpolación lineal por tramos (default de culori.interpolate) en el modo
 * indicado. Solo se usa con 'oklab'.
 */
export function interpolate(colors: ColorLike[], mode: 'oklab' | string): (t: number) => { mode: string; l: number; a: number; b: number } {
  const stops = colors.map((c) => (mode === 'oklab' ? oklab(c) : c));
  return (t: number) => {
    const pos = t * (stops.length - 1);
    const i0 = Math.min(Math.max(Math.floor(pos), 0), stops.length - 2);
    const f = pos - i0;
    const from = stops[i0];
    const to = stops[i0 + 1];
    const lerp = (x: number, y: number) => x + f * (y - x);
    return { mode, l: lerp(from.l, to.l), a: lerp(from.a ?? 0, to.a ?? 0), b: lerp(from.b ?? 0, to.b ?? 0) };
  };
}
