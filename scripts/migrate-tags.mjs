#!/usr/bin/env node
/**
 * Migracion de tags en db.palettes (container colormagic_database).
 *
 * Uso (desde la raiz del repo):
 *   node scripts/migrate-tags.mjs
 *
 * Que hace:
 *   1) rename tag "Monochrome"  -> "monochromatic"  (ya existe en el repo)
 *   2) lowercase todos los tags restantes (Autumn -> autumn, etc.)
 *
 * Idempotente: se puede correr mas de una vez sin romper nada.
 *
 * Tags nuevos "trending", "neon", "corporate" se agregan en
 * layers/palette/utils/palette-filters.util.ts (no aca) — los docs ya los
 * tienen como ["trending"] etc. desde la importacion.
 */

import { MongoClient } from 'mongodb';

const URI = process.env.MONGO_URI
  ?? 'mongodb://colormagic:secret@localhost:27018/colormagic?authSource=admin';

function die(msg) { console.error('\n[ERROR] ' + msg); process.exit(1); }

async function main() {
  console.log('--- Migrador de tags ColorMagic ---');
  console.log(`MONGO : ${URI}\n`);

  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const col = client.db('colormagic').collection('palettes');

    const before = await col.aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', n: { $sum: 1 } } },
      { $sort: { n: -1 } }
    ]).toArray();
    console.log('Antes:');
    for (const t of before) console.log(`  ${t._id.padEnd(14)} ${t.n}`);

    // 1) Monochrome -> monochromatic
    const r1 = await col.updateMany(
      { tags: 'Monochrome' },
      { $set: { 'tags.$': 'monochromatic' } }
    );
    console.log(`\nMonochrome -> monochromatic: ${r1.modifiedCount} docs`);

    // 2) lowercase del resto
    const tagsUpper = await col.aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags' } },
      { $match: { _id: /[A-Z]/ } }
    ]).toArray();

    console.log('\nLowercase pass:');
    let total = 0;
    for (const t of tagsUpper) {
      const oldTag = t._id;
      const newTag = oldTag.toLowerCase();
      const r = await col.updateMany({ tags: oldTag }, { $set: { 'tags.$': newTag } });
      console.log(`  ${oldTag.padEnd(14)} -> ${newTag.padEnd(14)} : ${r.modifiedCount}`);
      total += r.modifiedCount;
    }
    console.log(`Total lowercase: ${total} docs`);

    const after = await col.aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', n: { $sum: 1 } } },
      { $sort: { n: -1 } }
    ]).toArray();
    console.log('\nDespues:');
    for (const t of after) console.log(`  ${t._id.padEnd(14)} ${t.n}`);

    console.log(`\nTotal palettes: ${await col.countDocuments({})}`);
    console.log('\nListo.');
  } catch (e) {
    die(e.message);
  } finally {
    await client.close();
  }
}

main().catch(die);
