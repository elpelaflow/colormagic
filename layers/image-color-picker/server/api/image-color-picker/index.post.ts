import sharp from 'sharp';

interface Pixel { r: number; g: number; b: number; count: number };

function parseDataUrl(input: string): Buffer | null {
  const match = /^data:image\/[a-zA-Z+]+;base64,(.+)$/.exec(input.trim());
  if (match !== null) {
    return Buffer.from(match[1], 'base64');
  }
  return null;
}

function quantize(pixels: Pixel[], bucketSize: number): Pixel[] {
  const buckets = new Map<string, Pixel>();
  for (const px of pixels) {
    const key = `${Math.floor(px.r / bucketSize)}-${Math.floor(px.g / bucketSize)}-${Math.floor(px.b / bucketSize)}`;
    const existing = buckets.get(key);
    if (existing !== undefined) {
      existing.r += px.r * px.count;
      existing.g += px.g * px.count;
      existing.b += px.b * px.count;
      existing.count += px.count;
    } else {
      buckets.set(key, {
        r: px.r * px.count,
        g: px.g * px.count,
        b: px.b * px.count,
        count: px.count
      });
    }
  }
  return [...buckets.values()].map(b => ({
    r: Math.round(b.r / b.count),
    g: Math.round(b.g / b.count),
    b: Math.round(b.b / b.count),
    count: b.count
  }));
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ image?: string; count?: number }>(event).catch(() => ({}));

  if (body.image === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Missing "image" field (base64 data URL).' });
  }

  const buf = parseDataUrl(body.image);
  if (buf === null) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid image. Expected base64 data URL: data:image/png;base64,...'
    });
  }

  const count = Math.min(Math.max(Number(body.count ?? 5), 1), 10);

  const { data, info } = await sharp(buf)
    .resize(64, 64, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelMap = new Map<string, Pixel>();
  for (let i = 0; i < info.width * info.height; i += 1) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    const key = `${r}-${g}-${b}`;
    const existing = pixelMap.get(key);
    if (existing !== undefined) {
      existing.count += 1;
    } else {
      pixelMap.set(key, { r, g, b, count: 1 });
    }
  }

  const quantized = quantize([...pixelMap.values()], 32);
  quantized.sort((a, b) => b.count - a.count);
  const top = quantized.slice(0, count);

  const palette = top.map(px => ({
    hex: `#${px.r.toString(16).padStart(2, '0')}${px.g.toString(16).padStart(2, '0')}${px.b.toString(16).padStart(2, '0')}`,
    rgb: { r: px.r, g: px.g, b: px.b },
    prevalence: Number(((px.count / quantized.reduce((s, p) => s + p.count, 0)) * 100).toFixed(2))
  }));

  return {
    count: palette.length,
    palette
  };
});
