# Scripts

Scripts para poblar y migrar la base local de paletas (`db.palettes` en el container `magicolor_database`).

## Secuencia completa (en cualquier PC nueva)

Requisitos previos:
- Docker Desktop corriendo
- Node 18+
- `.env` (opcional, solo necesario si vas a usar `/api/palette/create` con OpenAI)

```powershell
# 1) Levantar la base
docker compose up -d

# 2) Instalar dependencias
npm install

# 3) Importar las 17.388 paletas desde colorpalettes.json (raiz del repo)
#    Reemplaza el contenido de la collection (modo REPLACE).
#    Demora <1s. Para conservar docs existentes, agregar --keep.
node scripts/import-palettes.mjs

# 4) Migrar tags a lowercase + rename Monochrome -> monochromatic
#    Idempotente: se puede correr varias veces sin romper nada.
node scripts/migrate-tags.mjs

# 5) Levantar el server
npm run dev
# -> http://localhost:3005/palette/explore
```

## import-palettes.mjs

Importa paletas desde `colorpalettes.json` (raiz del repo, gitignored).

Formato aceptado: array de objetos `{ name, colors[5], category }` (string label humano como "Trending").

Mapeo al esquema `PaletteEntity` del repo:
- `name`     -> `text`
- `colors`   -> `colors` (5 hex, lowercase, validados con regex)
- `category` -> `tags: [category]`  (array de 1 elemento, preserva estructura para uso futuro)
- (auto)     -> `_id` (ObjectId autogenerado por Mongo)
- (auto)     -> `createdAt` repartido entre `aiNamesStartDateMs` (17/10/2024) y un END fijo

END_MS está hardcodeado (`scripts/import-palettes.mjs`) para que el resultado sea deterministico en cualquier PC.

Flags:
- `--keep`    no borra docs existentes (append)
- `--dry-run` no escribe, solo valida el JSON

## migrate-tags.mjs

Lleva los `tags[]` de docs existentes a un estado compatible con el sistema de filtros del repo (`layers/palette/utils/palette-filters.util.ts`):
1. `Monochrome` -> `monochromatic` (ya existe en el repo)
2. Todos los tags a lowercase (`Autumn` -> `autumn`, etc.)

Tags nuevos que no estaban en el repo (`trending`, `neon`, `corporate`) se agregaron directamente en `layers/palette/utils/palette-filters.util.ts` con label i18n (en/ja/it) y hex representativo.

El tag `all` (1102 paletas en el JSON original) queda en la DB pero no se filtra (no esta en `palette-filters.util.ts`); las paletas se listan normalmente en `/palette/explore` sin filtro.

## rename-db.mjs

Migra la base local `colormagic` -> `magicolor` tras el rebrand a Magicolor.

```powershell
# Primero: ver que haria (no escribe nada)
node scripts/rename-db.mjs --dry-run

# Despues: ejecutar la migracion
node scripts/rename-db.mjs

# Opcional: borrar tambien el user viejo colormagic de admin
node scripts/rename-db.mjs --drop-old-user
```

Que hace:
1. Conecta a Mongo local (prueba credenciales nuevas `magicolor:secret` y si falla, las viejas `colormagic:secret`).
2. Renombra todas las collections de `colormagic.*` a `magicolor.*` (`renameCollection`).
3. Crea (o actualiza) el user root `magicolor` en `admin`.
4. Con `--drop-old-user`, borra el user viejo `colormagic`.

Idempotente: si ya migraste, la segunda corrida no rompe nada (reporta que `magicolor` ya existe).

> **Por que hace falta**: al recrear el container (`docker compose up -d` con el compose nuevo) Docker preserva el volumen y los datos, pero el init de Mongo NO vuelve a correr — el user `magicolor` lo crea este script. Si arrancas de cero (volumen nuevo), no hace falta: la db ya nace como `magicolor`.

## Notas

- Los scripts son idempotentes: si los corren dos veces no rompen nada (la segunda iteracion no encuentra nada que migrar).
- Ambos usan el driver `mongodb` ya instalado por el repo.
- No modifican indices (los crea `palette.setup()` del server al arranque).
