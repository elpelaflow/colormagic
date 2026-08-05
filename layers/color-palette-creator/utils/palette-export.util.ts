/**
 * Exportaciones del Color Palette Creator: PNG (canvas) y ASE
 * (Adobe Swatch Exchange, formato binario compatible con Photoshop/Illustrator).
 *
 * ASE layout:
 *   'ASEF' | major u16=1 | minor u16=0 | count u32 | bloques | trailer u16
 *   bloque color: type u16=1 | len u32 | nameLen u16 + name (UTF-16BE)
 *                 | model 4 ascii | values f32BE (3 o 4) | colorType u16
 */

import { hexToRgb } from './oklch.util';

const isBrowser = (): boolean => typeof document !== 'undefined';

/** Luminancia relativa simple para elegir texto claro/oscuro sobre un swatch */
function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export interface PaletteRow {
  title: string
  hexes: string[]
}

/**
 * Genera un PNG (data URL) con una grilla: una fila por armonia, un swatch
 * por color, con el nombre de la armonia en cada fila.
 */
export function renderPalettePng(rows: PaletteRow[]): string {
  if (!isBrowser()) return '';
  const swatchW = 120;
  const swatchH = 64;
  const rowH = swatchH + 24;
  const maxCols = Math.max(...rows.map((r) => r.hexes.length));
  const width = Math.max(2, maxCols) * swatchW + 24;
  const height = rows.length * rowH + 24;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  rows.forEach((row, ri) => {
    const y = 12 + ri * rowH;
    ctx.fillStyle = '#111111';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(row.title, 12, y + swatchH + 4);

    row.hexes.forEach((hex, ci) => {
      const x = 12 + ci * swatchW;
      ctx.fillStyle = hex;
      ctx.fillRect(x, y, swatchW - 4, swatchH);
      ctx.fillStyle = luminance(hex) > 0.6 ? '#111111' : '#ffffff';
      ctx.font = '500 11px ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(hex.toUpperCase(), x + 6, y + swatchH / 2);
    });
  });

  return canvas.toDataURL('image/png');
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  if (!isBrowser()) return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function encodeAscii(s: string): Buffer {
  return Buffer.from(s, 'ascii');
}

function encodeUtf16be(s: string): Buffer {
  const buf = Buffer.alloc(s.length * 2);
  for (let i = 0; i < s.length; i++) buf.writeUInt16BE(s.charCodeAt(i), i * 2);
  return buf;
}

/**
 * Construye un archivo ASE binario a partir de { nombre, hex } por color.
 * Los colores se guardan como RGB (modelo 'RGB ', floats 0..1).
 */
export function buildAseFile(colors: Array<{ name: string, hex: string }>): Uint8Array {
  const parts: Buffer[] = [encodeAscii('ASEF')];
  const header = Buffer.alloc(8);
  header.writeUInt16BE(1, 0); // major
  header.writeUInt16BE(0, 2); // minor
  header.writeUInt32BE(colors.length, 4);
  parts.push(header);

  for (const { name, hex } of colors) {
    const { r, g, b } = hexToRgb(hex);
    const nameBuf = encodeUtf16be(name);
    const nameLen = Buffer.alloc(2);
    nameLen.writeUInt16BE(nameBuf.length, 0);
    const values = Buffer.alloc(12);
    values.writeFloatBE(r / 255, 0);
    values.writeFloatBE(g / 255, 4);
    values.writeFloatBE(b / 255, 8);

    const content = Buffer.concat([
      nameLen,
      nameBuf,
      encodeAscii('RGB '),
      values,
      Buffer.from([0, 2]) // colorType: normal
    ]);

    const block = Buffer.alloc(6);
    block.writeUInt16BE(1, 0); // blockType: color entry
    block.writeUInt32BE(content.length, 2);
    parts.push(block, content);
  }

  const body = Buffer.concat(parts);
  const trailer = Buffer.alloc(2);
  trailer.writeUInt16BE(body.length + 2, 0);
  return new Uint8Array(Buffer.concat([body, trailer]));
}

export function downloadBlob(bytes: Uint8Array, filename: string, mime: string): void {
  if (!isBrowser()) return;
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
