/**
 * color-renderer — job de render.
 * Navega a la URL, deja correr el JS, y muestrea los colores COMPUTADOS
 * (getComputedStyle) de los elementos visibles para armar la paleta de uso.
 */
import { aggregateUsage } from './lib.mjs';

function timeoutError() {
  const error = new Error('Render timed out.');
  error.statusCode = 504;
  error.statusMessage = 'Render timed out.';
  return error;
}

/**
 * @param {import('playwright').BrowserContext} context
 * @param {string} url
 * @param {{ signal?: AbortSignal, maxElements?: number, settleMs?: number }} opts
 */
export async function renderSite(context, url, { signal, maxElements = 5000, settleMs = 2000 } = {}) {
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
      const toHex = (value) => {
        const m = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!m) return null;
        if (Number(m[4] ?? 1) === 0) return null;
        return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
      };
      const props = ['color', 'backgroundColor', 'fill', 'stroke'];
      const samples = [];
      for (const el of Array.from(document.querySelectorAll('body *')).slice(0, maxElems)) {
        const cs = getComputedStyle(el);
        for (const prop of props) {
          const hex = toHex(cs[prop]);
          if (hex) samples.push(hex);
        }
      }
      return { title: document.title, samples };
    }, maxElements);

    const usagePalette = aggregateUsage(data.samples);
    return {
      url,
      title: data.title || null,
      durationMs: Date.now() - started,
      viewport: '1440x900',
      sampled: data.samples.length,
      unique: usagePalette.length,
      usagePalette
    };
  } finally {
    signal?.removeEventListener('abort', onAbort);
    await page.close().catch(() => {});
  }
}
