/**
 * Genera `layers/palette/utils/color-names-data.json` a partir de:
 *   1. `colordatabase.json` (raíz del repo, ~13.6k colores con {id, name, hex, ...}) como base
 *   2. Los hex de ntc (Name that Color) que colordatabase no cubre, como relleno.
 *
 * Fuente del relleno (idempotente):
 *   - Si `layers/palette/utils/ntc.util.js` todavía tiene el array inline `names: [...]`,
 *     se extraen los pares de ahí (primer run).
 *   - Si el array inline ya fue reemplazado por el import (runs siguientes), se reutilizan
 *     las entradas del `color-names-data.json` existente que no estén en colordatabase,
 *     de modo que el dataset nunca se reduce al re-generar.
 *
 * Salida: array de pares [hex, name] (hex sin '#', mayúsculas), igual al formato que
 * usaba `ntc.names` en ntc.util.js.
 *
 * Uso: node scripts/generate-color-names.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NTC_PATH = path.join(ROOT, 'layers/palette/utils/ntc.util.js');
const DATA_PATH = path.join(ROOT, 'layers/palette/utils/color-names-data.json');

const dbRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'colordatabase.json'), 'utf8'));
const ntcSrc = fs.readFileSync(NTC_PATH, 'utf8');

// --- base: colordatabase.json ---
const merged = new Map();
for (const c of dbRaw) {
  if (c && c.hex && c.name) {
    merged.set(c.hex.slice(1).toUpperCase(), String(c.name));
  }
}
const dbCount = merged.size;

// --- relleno: hex de ntc que colordatabase no cubre ---
const re = /\["([0-9A-F]{6})", "([^"]+)"\]/g;
let m;
let ntcFilled = 0;
let fillSource = 'inline names array de ntc.util.js';

// 1) intentar extraer del array inline de ntc.util.js (existe solo en el primer run)
while ((m = re.exec(ntcSrc)) !== null) {
  if (!merged.has(m[1])) {
    merged.set(m[1], m[2]);
    ntcFilled++;
  }
}

// 2) si el array inline ya no está (reemplazado por el import), reutilizar el dataset
//    existente como relleno para que la regeneración sea estable
if (ntcFilled === 0 && fs.existsSync(DATA_PATH)) {
  const prev = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  fillSource = 'dataset existente color-names-data.json';
  for (const [hex, name] of prev) {
    if (!merged.has(hex)) {
      merged.set(hex, name);
      ntcFilled++;
    }
  }
}

const out = [...merged.entries()].map(([hex, name]) => [hex, name]);
const payload = JSON.stringify(out);

fs.writeFileSync(DATA_PATH, payload);

console.log('colordatabase (base):', dbCount);
console.log('relleno desde:', fillSource, '->', ntcFilled, 'hex');
console.log('total:', out.length);
console.log('peso del JSON derivado:', (fs.statSync(DATA_PATH).size / 1024).toFixed(0), 'KB');
console.log('destino:', DATA_PATH);
