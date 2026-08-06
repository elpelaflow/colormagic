#!/usr/bin/env node
/**
 * Importa paletas desde colorpalettes.json a la collection `palettes`
 * del container Docker magicolor_database (Mongo 7.0).
 *
 * Uso:
 *   node scripts/import-palettes.mjs             # borra la collection antes
 *   node scripts/import-palettes.mjs --keep      # NO borra; solo append
 *   node scripts/import-palettes.mjs --dry-run   # no escribe, solo cuenta
 *
 * Mapeo:
 *   name     -> text
 *   colors[] -> colors  (lowercase, valida 5 hex)
 *   category -> tags: [category]   (array para uso futuro)
 *   (auto)   -> _id  ObjectId autogenerado por Mongo
 *   (auto)   -> createdAt Date  (repartida entre AI_NAMES_START y hoy)
 *
 * Las fechas se reparten de la MAS VIEJA a la MAS NUEVA en el orden del JSON,
 * así /palette/explore (ordenado por createdAt desc) muestra las últimas del
 * archivo primero. createdAt SIEMPRE > aiNamesStartDateMs para que el helper
 * respete el `text` (si no, lo reemplaza por "Cool Palette").
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MongoClient } from 'mongodb';

const URI = process.env.MONGO_URI
  ?? 'mongodb://magicolor:secret@localhost:27018/magicolor?authSource=admin';
const DB_NAME = process.env.MONGO_DB ?? 'magicolor';
const COLL = process.env.PALETTE_COLLECTION ?? 'palettes';
const HERE = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = process.env.PALETTES_FILE
  ?? join(HERE, '..', 'colorpalettes.json');

// 17/10/2024 03:55:12.549 UTC  (valor de aiNamesStartDateMs en layers/palette/nuxt.config.ts)
const AI_NAMES_START_MS = 1729116912549;
const START_MS = AI_NAMES_START_MS + 60_000; // 1 min despues, para estar seguros
// END fijo (no Date.now()) asi el resultado es identico en cualquier PC.
// 03/08/2026 03:46:25 UTC (fecha de importacion original).
const END_MS = 1785728785000;
const BATCH_SIZE = 1000;

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;
const args = new Set(process.argv.slice(2));
const KEEP = args.has('--keep');
const DRY = args.has('--dry-run');

const norm = (s) => (typeof s === 'string' ? s.trim() : '');
const toHex = (c) => {
  const v = norm(c);
  return HEX_RE.test(v) ? (v.startsWith('#') ? v.toLowerCase() : '#' + v.toLowerCase()) : null;
};

function die(msg) { console.error('\n[ERROR] ' + msg); process.exit(1); }

async function main() {
  console.log('--- Importador de paletas Magicolor ---');
  console.log(`MONGO : ${URI}`);
  console.log(`DB    : ${DB_NAME}  / collection: ${COLL}`);
  console.log(`JSON  : ${JSON_PATH}`);
  console.log(`modo  : ${DRY ? 'DRY-RUN (no escribe)' : KEEP ? 'APPEND (conserva datos existentes)' : 'REPLACE (borra collection primero)'}`);
  console.log('');

  console.log('Leyendo JSON...');
  let raw;
  try {
    raw = JSON.parse(await readFile(JSON_PATH, 'utf8'));
  } catch (e) {
    die('No se pudo leer el JSON: ' + e.message);
  }
  const arr = Array.isArray(raw) ? raw : (raw?.items ?? raw?.palettes ?? null);
  if (!Array.isArray(arr)) die('El JSON no es un array ni tiene .items/.palettes');
  console.log(`OK: ${arr.length} paletas en el archivo`);

  // Normalizar
  const docs = [];
  let skipped = 0;
  for (const p of arr) {
    const colors = Array.isArray(p.colors) ? p.colors.map(toHex) : null;
    if (!colors || colors.length !== 5 || colors.some(c => c === null)) {
      skipped++;
      continue;
    }
    const text = norm(p.name);
    const tags = Array.isArray(p.tags) ? p.tags.map(norm).filter(Boolean)
      : (norm(p.category) ? [norm(p.category)] : []);
    docs.push({
      colors,
      text: text || 'Cool Palette',
      tags,
    });
  }
  if (skipped) console.log(`${skipped} paletas con colors invalido/ausente seran ignoradas.`);
  console.log(`${docs.length} paletas validas para importar.`);

  if (DRY) {
    console.log('\n[DRY-RUN] fin.');
    printCategoryReport(docs);
    return;
  }

  // Reparto de createdAt entre START y END en orden del JSON
  const total = docs.length;
  const span = END_MS - START_MS;
  const step = total > 1 ? span / (total - 1) : 0;
  for (let i = 0; i < total; i++) {
    docs[i].createdAt = new Date(START_MS + i * step);
  }

  console.log('\nConectando a Mongo...');
  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const col = db.collection(COLL);

    if (!KEEP) {
      console.log('Borrando collection existente (modo REPLACE)...');
      const r = await col.deleteMany({});
      console.log(`eliminados: ${r.deletedCount}`);
    } else {
      const existing = await col.estimatedDocumentCount();
      console.log(`Modo APPEND: ${existing} docs ya existen en la collection.`);
    }

    console.log(`\nInsertando ${total} paletas en lotes de ${BATCH_SIZE}...`);
    let inserted = 0;
    const t0 = Date.now();
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);
      const res = await col.insertMany(batch, { ordered: false });
      inserted += res.insertedCount;
      const pct = Math.min(100, Math.round(((i + batch.length) / total) * 100));
      const segs = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  [${pct}%] ${inserted}/${total}  (${segs}s)`);
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(2);
    console.log(`\nFin. ${inserted} paletas insertadas en ${secs}s`);

    console.log('\nVerificando...');
    const count = await col.countDocuments({});
    console.log(`countDocuments() = ${count}`);

    console.log('\nSample de 3 paletas:');
    const sample = await col.find({}).sort({ createdAt: -1 }).limit(3).toArray();
    for (const s of sample) {
      console.log(`  _id=${s._id} text="${s.text}" tags=${JSON.stringify(s.tags)} createdAt=${s.createdAt.toISOString()} colors=${JSON.stringify(s.colors)}`);
    }

    console.log('\nDistribucion por tag (top):');
    const agg = await col.aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 20 }
    ]).toArray();
    for (const a of agg) console.log(`  ${String(a._id).padEnd(14)} ${a.n}`);

    console.log(`\nListo. Ahora corré /palette/explore y /api/palette/list en localhost:3005.`);
  } catch (e) {
    die(e.message);
  } finally {
    await client.close();
  }
}

function printCategoryReport(docs) {
  const m = new Map();
  for (const d of docs) {
    const k = d.tags[0] ?? '(sin tag)';
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  console.log('\nDistribucion por tag:');
  for (const [k, n] of [...m.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(14)} ${n}`);
  }
}

main().catch(die);
