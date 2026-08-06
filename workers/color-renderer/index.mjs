/**
 * color-renderer — servidor HTTP del worker de render (Fase 2a).
 *
 * POST /render  { url }            -> { url, title, durationMs, viewport, sampled, unique, usagePalette, cached }
 * GET  /health                     -> { ok, connected, active, queued, mem }
 *
 * Corre aislado de la app (Docker), con caché LRU por URL + TTL, semáforo de
 * concurrencia (pool de contextos) y timeout por job.
 */
import http from 'node:http';
import { BrowserPool } from './pool.mjs';
import { renderSite } from './render.mjs';
import { createLruCache, detectDarkMode } from './lib.mjs';

const PORT = Number(process.env.PORT || 3100);
const MAX_CONCURRENCY = Number(process.env.MAX_CONCURRENCY || 3);
const JOB_TIMEOUT_MS = Number(process.env.JOB_TIMEOUT_MS || 20000);
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 3_600_000);
const CACHE_MAX = Number(process.env.CACHE_MAX || 200);
const SCREENSHOT_CACHE_MAX = Number(process.env.SCREENSHOT_CACHE_MAX || 50);
const SETTLE_MS = Number(process.env.SETTLE_MS || 2000);

const cache = createLruCache(CACHE_MAX, CACHE_TTL_MS);
// Los screenshots (~200-600KB de base64) NO entran a la caché principal de
// resultados: viven en un LRU aparte y chico para no comerse la memoria.
const screenshotCache = createLruCache(SCREENSHOT_CACHE_MAX, CACHE_TTL_MS);
const pool = new BrowserPool({ maxConcurrency: MAX_CONCURRENCY });

/** Mismos guards anti-SSRF que el endpoint de la app: solo http/https, sin hosts privados. */
function assertSafeUrl(raw) {
  if (!raw) throw httpError(400, 'Missing or invalid "url". Expected an http(s) URL.');
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw httpError(400, 'Missing or invalid "url". Expected an http(s) URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw httpError(400, 'Missing or invalid "url". Expected an http(s) URL.');
  }
  const host = parsed.hostname.toLowerCase();
  const isPrivate =
    host === 'localhost' || host.endsWith('.local') || host === '0.0.0.0'
    || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (isPrivate) {
    throw httpError(400, 'URL not allowed.');
  }
  return parsed;
}

function httpError(statusCode, statusMessage) {
  return Object.assign(new Error(statusMessage), { statusCode, statusMessage });
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(httpError(504, 'Render timed out.')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

async function runRender(url, key, { screenshot, colorScheme }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JOB_TIMEOUT_MS);
  try {
    // Si el job expiró mientras esperaba slot en la cola, ni arrancar.
    if (controller.signal.aborted) throw httpError(504, 'Render timed out.');
    return await withTimeout(
      pool.run(
        (context) => renderSite(context, url.toString(), { signal: controller.signal, settleMs: SETTLE_MS, screenshot }),
        { colorScheme }
      ),
      JOB_TIMEOUT_MS + 3000
    );
  } finally {
    clearTimeout(timer);
  }
}

async function handleRender(body, wantScreenshot, wantDark) {
  const url = assertSafeUrl(typeof body?.url === 'string' ? body.url.trim() : '');
  const key = url.toString();
  const darkKey = `${key}#dark`;

  if (!wantDark) {
    if (!wantScreenshot) {
      const hit = cache.get(key);
      if (hit) {
        // durationMs del hit reflejaría el render original: se limpia y la UI
        // muestra "cached" en su lugar.
        return { ...hit, durationMs: 0, cached: true };
      }
      const result = await runRender(url, key, { screenshot: false, colorScheme: 'light' });
      delete result.screenshot; // normaliza: el path cacheado también omite el campo
      cache.set(key, result);
      return { ...result, cached: false };
    }

    // Con screenshot: si ambos caches están calientes, respuesta instantánea.
    const shot = screenshotCache.get(key);
    const hit = cache.get(key);
    if (shot && hit) {
      return { ...hit, durationMs: 0, cached: true, screenshot: shot };
    }

    const result = await runRender(url, key, { screenshot: true, colorScheme: 'light' });
    const { screenshot, ...rest } = result;
    if (screenshot) {
      screenshotCache.set(key, screenshot);
    }
    cache.set(key, rest);
    return { ...result, cached: false };
  }

  // Dark mode: dos renders (light + dark) para detectar prefers-color-scheme.
  const lightHit = cache.get(key);
  const darkHit = cache.get(darkKey);
  const shot = wantScreenshot ? screenshotCache.get(key) : undefined;
  if (lightHit && darkHit && (!wantScreenshot || shot)) {
    return {
      ...lightHit,
      durationMs: 0,
      cached: true,
      hasDarkMode: darkHit.hasDarkMode,
      dark: darkHit.dark,
      ...(shot ? { screenshot: shot } : {})
    };
  }

  const light = await runRender(url, key, { screenshot: wantScreenshot, colorScheme: 'light' });
  const dark = await runRender(url, key, { screenshot: false, colorScheme: 'dark' });
  const hasDarkMode = detectDarkMode(light.usagePalette, dark.usagePalette, light.dominantBg, dark.dominantBg);
  const darkEntry = {
    hasDarkMode,
    dark: hasDarkMode
      ? { usagePalette: dark.usagePalette, contrast: dark.contrast, dominantBg: dark.dominantBg }
      : null
  };

  const { screenshot, ...lightRest } = light;
  if (screenshot) {
    screenshotCache.set(key, screenshot);
  }
  cache.set(key, lightRest);
  cache.set(darkKey, darkEntry);

  return { ...light, cached: false, hasDarkMode, dark: darkEntry.dark };
}

function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(httpError(413, 'Request body too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (size === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(httpError(400, 'Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const { method, url } = req;

  if (url === '/health' && method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      ...pool.status(),
      memMB: Math.round(process.memoryUsage().rss / 1048576),
      cacheEntries: cache.size(),
      screenshotEntries: screenshotCache.size()
    });
    return;
  }

  if (url === '/render' && method === 'POST') {
    readJson(req, 100_000)
      .then((body) => handleRender(body, body?.screenshot === true, body?.darkMode === true))
      .then((data) => sendJson(res, 200, data))
      .catch((error) => {
        sendJson(res, error.statusCode || 500, { error: error.statusMessage || error.message });
      });
    return;
  }

  sendJson(res, 404, { error: 'Not found. Use POST /render or GET /health.' });
});

server.listen(PORT, () => {
  console.log(`[color-renderer] escuchando en :${PORT} | concurrencia: ${MAX_CONCURRENCY} | timeout: ${JOB_TIMEOUT_MS}ms | cache: ${CACHE_MAX}/${CACHE_TTL_MS}ms`);
});

async function shutdown() {
  console.log('[color-renderer] apagando...');
  server.close();
  await pool.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
