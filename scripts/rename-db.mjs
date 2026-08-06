#!/usr/bin/env node
/**
 * Migra la base local de `colormagic` -> `magicolor` (renameCollection).
 *
 * Contexto: el repo fue rebrandead a Magicolor (container `magicolor_database`,
 * user `magicolor`, db `magicolor`), pero la DB local existente se llama
 * `colormagic` con el user root `colormagic:secret`.
 *
 * Uso (desde la raiz del repo):
 *   node scripts/rename-db.mjs              # renombra db + asegura user nuevo
 *   node scripts/rename-db.mjs --dry-run    # solo muestra que haria
 *   node scripts/rename-db.mjs --drop-old-user  # ademas borra el user colormagic
 *   node scripts/rename-db.mjs --uri mongodb://user:pass@host:27018/admin?authSource=admin
 *   MONGO_URI=... node scripts/rename-db.mjs   # o por env (patron de scripts hermanos)
 *
 * Que hace:
 *   1) Conecta a la instancia Mongo local (prueba MONGO_URI / --uri, luego
 *      credenciales NUEVAS y VIEJAS, para funcionar con el container ya
 *      recreado o no).
 *   2) Asegura el user root `magicolor` (password `secret` o MONGO_PASSWORD)
 *      en `admin` — SIEMPRE, incluso si la db ya fue migrada (idempotente).
 *   3) Si la db `colormagic` existe, renombra TODAS sus collections a
 *      `magicolor.<collection>` (Mongo crea la db destino implicitamente).
 *   4) Opcional (`--drop-old-user`): borra el user viejo `colormagic`.
 *   5) Verifica: listado de collections en `magicolor` + conteo de docs.
 *
 * Idempotente: si ya migraste y lo corres de nuevo no rompe nada (y se puede
 * usar para reparar una migración a medias: p.ej. collections renombradas
 * pero user no creado por un corte).
 *
 * IMPORTANTE — recrear el container DESPUES:
 *   Al correr `docker compose up -d` con el compose nuevo (container
 *   `magicolor_database`), Docker preserva el volumen y los DATOS, pero el
 *   init de Mongo NO vuelve a correr (solo corre con volumen nuevo), asi que
 *   el user `magicolor` lo crea este script. Si en cambio arrancas desde cero
 *   (volumen nuevo), no hay nada que migrar: la db ya nace como `magicolor`.
 */

import { MongoClient } from 'mongodb';

const OLD_DB = 'colormagic';
const NEW_DB = 'magicolor';
const PASSWORD = process.env.MONGO_PASSWORD ?? 'secret';

// Orden de conexion: env explicito > --uri > credenciales nuevas > viejas.
const DEFAULT_URIS = [
  `mongodb://${NEW_DB}:${PASSWORD}@localhost:27018/admin?authSource=admin`,
  `mongodb://${OLD_DB}:${PASSWORD}@localhost:27018/admin?authSource=admin`
];

function die(msg) { console.error('\n[ERROR] ' + msg); process.exit(1); }

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const DROP_OLD_USER = args.has('--drop-old-user');
const uriIdx = process.argv.indexOf('--uri');
const uriFlag = uriIdx > -1 ? process.argv[uriIdx + 1] : undefined;
if (uriIdx > -1 && (typeof uriFlag !== 'string' || !uriFlag.startsWith('mongodb'))) {
  die('El flag --uri necesita un valor tipo mongodb://user:pass@host:27018/admin?authSource=admin');
}

async function tryConnect(uri) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 4000 });
  try {
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    return client;
  } catch {
    await client.close().catch(() => {});
    return null;
  }
}

async function connect() {
  const uris = uriFlag ? [uriFlag] : [
    ...(process.env.MONGO_URI ? [process.env.MONGO_URI] : []),
    ...DEFAULT_URIS
  ];
  for (const uri of uris) {
    console.log(`Probando: ${uri.replace(/\/\/[^@]+@/, '//***:***@')}`);
    const client = await tryConnect(uri);
    if (client) return { client };
  }
  die('No pude conectarme a Mongo en localhost:27018. ¿Docker está corriendo?\n' +
      '   Si tu password/user difieren, usá --uri mongodb://user:pass@host:27018/admin?authSource=admin');
}

async function ensureNewUser(admin) {
  const users = await admin.command({ usersInfo: { user: NEW_DB, db: 'admin' } });
  const exists = (users.users ?? []).length > 0;
  console.log(`User '${NEW_DB}' en admin: ${exists ? 'existe (actualizo password/roles)' : 'no existe (lo creo)'}`);
  if (DRY) return;
  if (exists) {
    await admin.command({ updateUser: NEW_DB, pwd: PASSWORD, roles: [{ role: 'root', db: 'admin' }] });
  } else {
    await admin.command({ createUser: NEW_DB, pwd: PASSWORD, roles: [{ role: 'root', db: 'admin' }] });
  }
}

async function dropOldUser(admin) {
  const oldUsers = await admin.command({ usersInfo: { user: OLD_DB, db: 'admin' } });
  const oldExists = (oldUsers.users ?? []).length > 0;
  console.log(`\nUser viejo '${OLD_DB}': ${oldExists ? 'lo borro (--drop-old-user)' : 'no existe'}`);
  if (oldExists && !DRY) await admin.command({ dropUser: OLD_DB });
}

async function listCollections(client, db) {
  const colls = await client.db(db).listCollections().toArray();
  if (colls.length === 0) {
    console.log(`  db '${db}': sin collections.`);
    return;
  }
  console.log(`  db '${db}':`);
  for (const c of colls) {
    const count = await client.db(db).collection(c.name).countDocuments({});
    console.log(`    ${c.name}: ${count} docs`);
  }
}

async function main() {
  console.log('--- Migrador de DB Magicolor (colormagic -> magicolor) ---');
  console.log(`modo : ${DRY ? 'DRY-RUN (no escribe nada)' : 'EJECUTANDO'}\n`);

  const { client } = await connect();
  try {
    const admin = client.db('admin');

    // 1) Asegurar user root nuevo — SIEMPRE (idempotente, repara migraciones parciales)
    await ensureNewUser(admin);

    // 2) Chequear si la db vieja existe
    const dbs = (await admin.command({ listDatabases: 1 })).databases.map(d => d.name);
    if (!dbs.includes(OLD_DB)) {
      console.log(`\nLa db '${OLD_DB}' no existe.`);
      if (dbs.includes(NEW_DB)) {
        console.log(`La db '${NEW_DB}' ya existe -> nada que migrar.`);
        await listCollections(client, NEW_DB);
      } else {
        console.log(`La db '${NEW_DB}' tampoco existe. Parece una instancia nueva (sin datos).`);
      }
    } else {
      // 3) Renombrar collections
      const oldColls = await client.db(OLD_DB).listCollections().toArray();
      console.log(`\nDb '${OLD_DB}': ${oldColls.length} collection(s) a renombrar.`);
      for (const c of oldColls) {
        const from = `${OLD_DB}.${c.name}`;
        const to = `${NEW_DB}.${c.name}`;
        const count = await client.db(OLD_DB).collection(c.name).countDocuments({});
        console.log(`  ${from} (${count} docs) -> ${to}`);
        if (!DRY) {
          await admin.command({ renameCollection: from, to, dropTarget: false });
        }
      }

      // 4) Borrar user viejo (opcional)
      if (DROP_OLD_USER) {
        await dropOldUser(admin);
      } else {
        console.log(`\nUser viejo '${OLD_DB}' se conserva (usá --drop-old-user para borrarlo).`);
      }

      // 5) Verificacion
      console.log('\n--- Verificacion ---');
      await listCollections(client, NEW_DB);
    }

    if (!DRY) console.log('\nListo. La app ya conecta con mongodb://magicolor:secret@localhost:27018/magicolor');
  } catch (e) {
    die(e.message);
  } finally {
    await client.close();
  }
}

main().catch(die);
