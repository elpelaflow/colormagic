/**
 * color-renderer — job de render.
 * Navega a la URL, deja correr el JS, y muestrea los colores COMPUTADOS
 * (getComputedStyle) de los elementos visibles para armar la paleta de uso
 * y el contraste WCAG de los textos (fg sobre fondo efectivo).
 *
 * Limitaciones conocidas:
 * - Colores devueltos por getComputedStyle en `color(srgb ...)` (espacios de
 *   color modernos) no se parsean y se descartan silenciosamente.
 * - La `opacity` del elemento se aplica al color de texto, pero no a los
 *   backgrounds de la cadena de ancestros.
 * - El screenshot se captura milisegundos después del muestreo: en páginas
 *   animadas/lazy puede no coincidir al 100% con el estado muestreado.
 */
import { aggregateContrast, aggregateUsage, VIEWPORT } from './lib.mjs';

function timeoutError() {
  const error = new Error('Render timed out.');
  error.statusCode = 504;
  error.statusMessage = 'Render timed out.';
  return error;
}

/** Alto máximo de screenshot (evita respuestas gigantes en páginas muy largas). */
const SCREENSHOT_MAX_HEIGHT = 9000;

/**
 * @param {import('playwright').BrowserContext} context
 * @param {string} url
 * @param {{ signal?: AbortSignal, maxElements?: number, settleMs?: number, screenshot?: boolean }} opts
 */
export async function renderSite(context, url, { signal, maxElements = 5000, settleMs = 2000, screenshot: wantScreenshot = false } = {}) {
  const page = await context.newPage();
  const started = Date.now();

  // Si el job expira mientras un goto está colgado, cerrar la página hace que
  // el goto rechace de inmediato y libere el slot del pool sin esperar 15s.
  const onAbort = () => { page.close().catch(() => {}); };
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    if (signal?.aborted) throw timeoutError();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (signal?.aborted) throw timeoutError();

    // Dejar que scripts/fuentes/fuentes de iconos terminen de pintar.
    await page.waitForTimeout(settleMs);
    if (signal?.aborted) throw timeoutError();

    const data = await page.evaluate((maxElems) => {
      const parseRgba = (value) => {
        const m = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!m) return null;
        return { r: +m[1], g: +m[2], b: +m[3], a: +(m[4] ?? 1) };
      };
      const toHex = (value) => {
        const rgb = parseRgba(value);
        if (!rgb || rgb.a === 0) return null;
        return '#' + [rgb.r, rgb.g, rgb.b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');
      };
      const rgbToHex = (rgb) =>
        '#' + [rgb.r, rgb.g, rgb.b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
      const composite = (top, bottom) => {
        const a = top.a + bottom.a * (1 - top.a);
        if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
        return {
          r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a,
          g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a,
          b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a,
          a
        };
      };
      // Fondo EFECTIVO: compone los backgrounds desde el elemento hacia arriba
      // hasta un fondo opaco; si ninguno lo es, el canvas blanco del navegador.
      // El orden importa: la bg del elemento se pinta ENCIMA de la del ancestro,
      // así que se compone de abajo (canvas) hacia arriba (elemento).
      const bgCache = new WeakMap();
      const effectiveBg = (el) => {
        const layers = [];
        let node = el;
        while (node) {
          let bg = bgCache.get(node);
          if (bg === undefined) {
            bg = parseRgba(getComputedStyle(node).backgroundColor);
            bgCache.set(node, bg ?? null);
          }
          if (bg && bg.a > 0) layers.push(bg);
          if (bg && bg.a >= 1) break;
          node = node.parentElement;
        }
        let result = { r: 255, g: 255, b: 255, a: 1 };
        for (let i = layers.length - 1; i >= 0; i--) result = composite(layers[i], result);
        return result;
      };
      const hasDirectText = (el) => {
        for (const node of el.childNodes) {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) return true;
        }
        return false;
      };
      const props = ['color', 'backgroundColor', 'fill', 'stroke'];
      const samples = [];
      const contrastSamples = [];
      for (const el of Array.from(document.querySelectorAll('body *')).slice(0, maxElems)) {
        const cs = getComputedStyle(el);
        for (const prop of props) {
          const hex = toHex(cs[prop]);
          if (hex) samples.push(hex);
        }
        if (hasDirectText(el)) {
          const fg = parseRgba(cs.color);
          if (fg && fg.a > 0) {
            const opacity = parseFloat(cs.opacity) || 1;
            if (opacity < 1) fg.a *= opacity; // texto atenuado (muted/disabled)
            const bg = effectiveBg(el);
            const blendedFg = fg.a >= 1 ? fg : composite(fg, bg);
            const size = parseFloat(cs.fontSize) || 16;
            const weight = parseInt(cs.fontWeight, 10) || 400;
            const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
            contrastSamples.push({ fg: rgbToHex(blendedFg), bg: rgbToHex(bg), isLarge });
          }
        }
      }
      return { title: document.title, samples, contrastSamples };
    }, maxElements);

    let screenshot = null;
    if (wantScreenshot) {
      if (signal?.aborted) throw timeoutError();
      const height = await page.evaluate(() =>
        Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, window.innerHeight)
      );
      const buffer = await page.screenshot({
        type: 'jpeg',
        quality: 60,
        clip: { x: 0, y: 0, width: VIEWPORT.width, height: Math.max(1, Math.min(height, SCREENSHOT_MAX_HEIGHT)) }
      });
      screenshot = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    }

    const usagePalette = aggregateUsage(data.samples);
    const contrast = aggregateContrast(data.contrastSamples);
    return {
      url,
      title: data.title || null,
      durationMs: Date.now() - started,
      viewport: '1440x900',
      sampled: data.samples.length,
      unique: usagePalette.length,
      usagePalette,
      contrast,
      screenshot
    };
  } finally {
    signal?.removeEventListener('abort', onAbort);
    await page.close().catch(() => {});
  }
}
