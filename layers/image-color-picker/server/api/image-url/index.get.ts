/**
 * Proxy de imágenes por URL para el Image Color Picker.
 *
 * El navegador no puede fetchear URLs arbitrarias por CORS, así que la imagen
 * se descarga server-side y se devuelve como data URL base64 (mismo formato
 * que produce el <input type="file">). El cliente la procesa igual que una
 * imagen subida localmente.
 *
 * GET /api/image-url?url=https://...
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const raw = typeof query.url === 'string' ? query.url.trim() : '';

  if (raw === '') {
    throw createError({ statusCode: 400, statusMessage: 'Missing "url" query parameter.' });
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid image URL. Expected http(s) URL.' });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid image URL. Expected http(s) URL.' });
  }

  // Guard básico anti-SSRF: no fetchear hosts locales/privados.
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let response: Response;
  try {
    response = await fetch(parsed.toString(), {
      redirect: 'follow',
      signal: controller.signal
    });
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Could not fetch the image URL.' });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw createError({ statusCode: 400, statusMessage: `Could not fetch the image URL (HTTP ${response.status}).` });
  }

  const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!contentType.startsWith('image/')) {
    throw createError({ statusCode: 400, statusMessage: 'The URL does not point to an image.' });
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 10 * 1024 * 1024) {
    throw createError({ statusCode: 400, statusMessage: 'Image is too large (max 10 MB).' });
  }

  return {
    dataUrl: `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}`
  };
});
