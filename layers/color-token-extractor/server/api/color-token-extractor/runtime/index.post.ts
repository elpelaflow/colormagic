/**
 * Color Token Extractor — extracción en RUNTIME (Fase 2a).
 *
 * La Fase 1 lee el CSS fuente (custom properties declaradas). Esta Fase 2
 * delega en el worker `color-renderer` (Playwright headless, servicio Docker
 * aparte): carga la página real, espera el JS y devuelve la paleta de colores
 * efectivamente renderizados (getComputedStyle) con su frecuencia de uso.
 *
 * Si el worker está offline (no levantado), responde 502 con un mensaje claro:
 * la UI degrada mostrando solo los tokens de la Fase 1.
 *
 * POST /api/color-token-extractor/runtime  body: { url }
 */
const RENDER_TIMEOUT_MS = 30_000;

export default defineEventHandler(async (event) => {
  const body = await readBody<{ url?: unknown; screenshot?: unknown }>(event).catch((): { url?: unknown; screenshot?: unknown } => ({}));
  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  if (!url) {
    throw createError({ statusCode: 400, statusMessage: 'Missing or invalid "url". Expected an http(s) URL.' });
  }
  const wantScreenshot = body?.screenshot === true;

  const { rendererUrl } = useRuntimeConfig(event);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS);
  try {
    const response = await fetch(`${rendererUrl}/render`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, screenshot: wantScreenshot }),
      signal: controller.signal
    });
    if (!response.ok) {
      // Propagar errores útiles del worker (400 SSRF, 504 timeout, 413 body);
      // solo usar el 502 genérico cuando el worker está realmente caído.
      let workerMessage = '';
      try {
        const body = await response.json() as { error?: string };
        workerMessage = body.error ?? '';
      } catch {
        // body no-JSON: no importa, usamos el mensaje genérico
      }
      if (response.status === 400 || response.status === 413 || response.status === 504) {
        throw createError({ statusCode: response.status, statusMessage: workerMessage || 'Render failed.' });
      }
      throw createError({ statusCode: 502, statusMessage: 'Rendered analysis unavailable. The renderer worker is offline.' });
    }
    return await response.json();
  } catch (error: any) {
    if (error?.statusCode) throw error;
    throw createError({ statusCode: 502, statusMessage: 'Rendered analysis unavailable. The renderer worker is offline.' });
  } finally {
    clearTimeout(timer);
  }
});
