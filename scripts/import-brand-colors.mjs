/**
 * Importa el dataset de brand colors desde https://github.com/pickcoloronline/brands
 * (licencia ISC, permisiva) y lo consolida en:
 *   layers/brand-colors/utils/brand-colors-data.json
 *
 * Uso:  node scripts/import-brand-colors.mjs
 *
 * Qué hace:
 *   1. Descarga el tarball de la rama main del repo.
 *   2. Lee los ~910 archivos `brands/*.json`.
 *   3. Normaliza: hex sin `#`, mayúsculas, expande 3-dígitos a 6, descarta
 *      valores no parseables (ej. "9999").
 *   4. Conserva solo { title, slug, colors, category, brandUrl } (sin
 *      description/sourceUrl para mantener el JSON liviano, ~130 KB).
 *   5. Ordena alfabéticamente por título.
 *
 * Nota Windows: el tar de Windows (bsdtar) falla con rutas absolutas con
 * drive letter (interpreta `C:` como URL), así que se extrae con `cwd` +
 * nombre de archivo relativo.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO_URL = 'https://github.com/pickcoloronline/brands/archive/refs/heads/main.tar.gz';
const OUT_PATH = 'layers/brand-colors/utils/brand-colors-data.json';

const WORKDIR = join(tmpdir(), `magicolor-brands-${Date.now()}`);
mkdirSync(WORKDIR, { recursive: true });

/** Expande un hex de 3 dígitos a 6; devuelve null si no es parseable. */
function normalizeHex(raw) {
  let hex = String(raw || '').trim().replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{3}$/.test(hex)) {
    hex = hex.split('').map(ch => `${ch}${ch}`).join('');
  }
  return /^[0-9A-F]{6}$/.test(hex) ? `#${hex}` : null;
}

console.log(`[1/3] Descargando tarball de ${REPO_URL} …`);
const tarPath = join(WORKDIR, 'brands.tar.gz');
const res = await fetch(REPO_URL);
if (!res.ok) {
  rmSync(WORKDIR, { recursive: true, force: true });
  throw new Error(`Error descargando el tarball: HTTP ${res.status}`);
}
writeFileSync(tarPath, Buffer.from(await res.arrayBuffer()));

console.log('[2/3] Extrayendo …');
const r = spawnSync('tar', ['-xzf', 'brands.tar.gz'], { cwd: WORKDIR, encoding: 'utf8' });
if (r.status !== 0) {
  rmSync(WORKDIR, { recursive: true, force: true });
  throw new Error(`Error extrayendo el tarball: ${r.stderr || r.error || r.status}`);
}

const brandsDir = join(WORKDIR, 'brands-main', 'brands');
if (!existsSync(brandsDir)) {
  rmSync(WORKDIR, { recursive: true, force: true });
  throw new Error('No se encontró el directorio brands/ en el tarball');
}

const files = readdirSync(brandsDir).filter(f => f.endsWith('.json'));
const brands = [];
let dropped = 0;

for (const file of files) {
  const raw = JSON.parse(readFileSync(join(brandsDir, file), 'utf8'));
  const colors = [];
  for (const c of raw.colors || []) {
    const hex = normalizeHex(c);
    if (hex === null) {
      dropped += 1;
    } else if (!colors.includes(hex)) {
      colors.push(hex);
    }
  }

  brands.push({
    title: raw.title || file.replace('.json', ''),
    slug: (raw.slug || file.replace('.json', '')).toLowerCase(),
    colors,
    category: raw.category || '',
    brandUrl: raw.brandUrl || ''
  });
}

brands.sort((a, b) => a.title.localeCompare(b.title));

mkdirSync(join(process.cwd(), 'layers', 'brand-colors', 'utils'), { recursive: true });
writeFileSync(join(process.cwd(), OUT_PATH), JSON.stringify(brands), 'utf8');

const totalColors = brands.reduce((s, b) => s + b.colors.length, 0);
console.log(`[3/3] ${brands.length} marcas · ${totalColors} colores → ${OUT_PATH} (${(JSON.stringify(brands).length / 1024).toFixed(0)} KB)`);
if (dropped > 0) {
  console.log(`⚠️  ${dropped} valores hex descartados por inválidos`);
}

rmSync(WORKDIR, { recursive: true, force: true });
