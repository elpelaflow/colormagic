/**
 * Color Token Extractor — endpoint de extracción.
 *
 * El navegador no puede fetchear URLs arbitrarias por CORS, así que el HTML y
 * las hojas CSS se descargan server-side (mismos guards anti-SSRF que el proxy
 * de imágenes del Image Color Picker) y se parsean en busca de CSS custom
 * properties de color.
 *
 * POST /api/color-token-extractor  body: { url }
 */
import { extractColorTokens, parseCssColor, colorToHex } from '../../../utils/token-extractor.util';

const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_CSS_BYTES = 2 * 1024 * 1024;
const MAX_CSS_SOURCES = 15;
const FETCH_TIMEOUT_MS = 12_000;

function assertSafeUrl(raw: string, message: string): URL {
  if (!raw) {
    throw createError({ statusCode: 400, statusMessage: message });
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw createError({ statusCode: 400, statusMessage: message });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw createError({ statusCode: 400, statusMessage: message });
  }

  // Guard anti-SSRF: no fetchear hosts locales/privados.
  const host = parsed.hostname.toLowerCase();
  const isPrivate =
    host === 'localhost'
    || host.endsWith('.local')
    || host === '0.0.0.0'
    || /^127\./.test(host)
    || /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (isPrivate) {
    throw createError({ statusCode: 400, statusMessage: 'URL not allowed.' });
  }
  return parsed;
}

async function fetchText(url: URL, maxBytes: number, timeoutMs: number): Promise<{ text: string; contentType: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; MagicolorColorTokenExtractor/1.0; +https://magicolor.app)',
        'accept': 'text/html,text/css,*/*;q=0.8'
      }
    });
    if (!response.ok) return null;
    const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) return null;
    return { text: bytes.toString('utf8'), contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractMeta(html: string, base: URL): { title: string | null; themeColor: string | null; favicon: string | null } {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim().replace(/\s+/g, ' ') ?? null;

  const themeColor =
    html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i)?.[1]
    ?? null;

  let favicon: string | null = null;
  const iconLink = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/i)?.[0];
  const iconHref = iconLink?.match(/href=["']([^"']+)["']/i)?.[1];
  if (iconHref) {
    try {
      favicon = new URL(iconHref, base).toString();
    } catch {
      favicon = null;
    }
  }
  if (!favicon) {
    try {
      favicon = new URL('/favicon.ico', base).toString();
    } catch {
      favicon = null;
    }
  }
  return { title, themeColor, favicon };
}

function extractStyleBlocks(html: string): string[] {
  const blocks: string[] = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && blocks.length < MAX_CSS_SOURCES) {
    blocks.push(m[1]);
  }
  return blocks;
}

function extractStylesheetHrefs(html: string, base: URL): string[] {
  const hrefs: string[] = [];
  const re = /<link[^>]+rel=["']stylesheet["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && hrefs.length < MAX_CSS_SOURCES) {
    const href = m[0].match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      hrefs.push(new URL(href, base).toString());
    } catch {
      // ignorar hrefs rotos
    }
  }
  return hrefs;
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ url?: unknown }>(event).catch((): { url?: unknown } => ({}));
  const raw = typeof body?.url === 'string' ? body.url.trim() : '';
  const url = assertSafeUrl(raw, 'Missing or invalid "url". Expected an http(s) URL.');

  const htmlRes = await fetchText(url, MAX_HTML_BYTES, FETCH_TIMEOUT_MS);
  if (!htmlRes) {
    throw createError({ statusCode: 400, statusMessage: 'Could not fetch the page.' });
  }
  if (/^(image|audio|video|application\/(?:pdf|zip|octet))/i.test(htmlRes.contentType)) {
    throw createError({ statusCode: 400, statusMessage: 'The URL does not point to a web page.' });
  }

  const { title, themeColor, favicon } = extractMeta(htmlRes.text, url);

  const cssSources: { text: string; source: string }[] = extractStyleBlocks(htmlRes.text)
    .map((text, i) => ({ text, source: `${url.hostname} (inline ${i + 1})` }));

  const hrefs = extractStylesheetHrefs(htmlRes.text, url);
  for (const href of hrefs) {
    let cssUrl: URL;
    try {
      cssUrl = assertSafeUrl(href, 'URL not allowed.');
    } catch {
      continue;
    }
    const cssRes = await fetchText(cssUrl, MAX_CSS_BYTES, 10_000);
    if (cssRes) {
      cssSources.push({ text: cssRes.text, source: href });
    }
  }

  const themeColorHex = themeColor ? (() => {
    const c = parseCssColor(themeColor);
    return c ? colorToHex(c) : null;
  })() : null;

  const { tokens, palette } = extractColorTokens(cssSources);

  return {
    url: url.toString(),
    title,
    themeColor,
    themeColorHex,
    favicon,
    tokens,
    palette,
    cssSources: cssSources.length
  };
});
