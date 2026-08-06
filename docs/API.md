# Magicolor API — Documentación de endpoints

Documentación de todos los endpoints del server de Magicolor. Corriendo localmente con `npm run dev` (por defecto en `http://localhost:3000`, en este doc asumimos `http://localhost:3011` cuando hay conflicto de puerto).

Base URL: `http://localhost:3011/api`

Todos los endpoints devuelven JSON, excepto los marcados como binarios. La validación de bodies usa `@sinclair/typebox` (validación en runtime, schemas en `layers/*/server/dtos/`).

---

## Tabla resumen

| Método | Ruta | Origen | Descripción |
|--------|------|--------|-------------|
| `GET` | `/palette/{id}` | original | Obtener una paleta por su ID de MongoDB |
| `POST` | `/palette/list` | original | Listar paletas paginadas (con optional filter por tag) |
| `POST` | `/palette/create` | original | Generar paleta con IA desde un prompt de texto |
| `POST` | `/palette/clone` | original | Clonar paleta existente cambiando colores |
| `GET` | `/palette/count` | original | Cantidad de paletas creadas en las últimas 24h (cacheado 5min) |
| `GET` | `/og/get` | original | Imagen PNG OpenGraph de una paleta |
| `GET` | `/og/tag` | original | Imagen PNG OpenGraph de grid de paletas por tag |
| `POST` | `/feedback` | original | Enviar feedback por email |
| `GET` | `/random-color` | nuevo | Color aleatorio en HEX + RGB |
| `GET` | `/contrast-checker` | nuevo | Ratio de contraste WCAG entre dos colores |
| `GET` | `/color-mixer` | nuevo | Mezcla dos colores (HSL + RGB lineal) |
| `POST` | `/image-color-picker` | nuevo | Extrae N colores dominantes de una imagen base64 |
| `GET` | `/harmonies` | nuevo | Genera paletas de armonía con el generador OKLCH (pro-color-harmonies) |
| `GET` | `/pantone` | nuevo | Busca en el dataset Pantone (3.219 muestras): por hex, código o nombre |
| `GET` | `/color-name` | nuevo | Nombre del color más cercano del diccionario (14.394 nombres) |
| `POST` | `/color-token-extractor` | nuevo | Extrae los CSS custom properties de color de una URL (Fase 1) |
| `POST` | `/color-token-extractor/runtime` | nuevo | Analiza la página renderizada en Chromium: paleta de uso + contraste WCAG + screenshot (Fase 2, requiere worker Docker) |

---

## Endpoints originales

### `GET /palette/{id}`

Obtiene una paleta específica desde MongoDB por su `_id`.

- **URL params:** `id` (24 hex chars, ObjectId de MongoDB)
- **Response 200:**
  ```json
  {
    "id": "671fd5edab6cc866507fe7cf",
    "colors": ["#44562f", "#83934d", "#b7c88d", "#e9dfb4", "#efbfb3"],
    "text": "Florest Moth",
    "tags": ["earthy", "olive", "green", "khaki", "beige"]
  }
  ```
- **Response 404:** `{ "statusCode": 404 }` si no existe.
- **Archivo:** `layers/palette/server/api/palette/[id].get.ts`
- **Dependencia:** solo Mongo (sin IA, sin auth).

### `POST /palette/list`

Lista paletas paginadas, ordenadas por `createdAt` desc. Permite filtro por tag.

- **Body:**
  ```json
  { "page": 0, "size": 10, "filter": { "tag": "green" } }
  ```
  - `page`: número de página (0-indexed)
  - `size`: items por página (máx 100)
  - `filter`: opcional — si se pasa, filtra paletas que tengan el tag en su array `tags`
- **Response 200:**
  ```json
  {
    "items": [ /* PaletteDto[] */ ],
    "count": 1234
  }
  ```
  `count` es el total que matchea el filtro (no solo los de esta página).
- **Archivo:** `layers/palette/server/api/palette/list.ts`
- **Dependencia:** solo Mongo.

### `POST /palette/create`

Genera una paleta nueva usando OpenAI a partir de un prompt de texto. El prompt puede ser cualquier descripción ("sunset", "retro 80s", hex codes, etc.).

- **Body:**
  ```json
  { "prompt": "green forest", "colors": ["#ff0000", ...] }
  ```
  - `prompt`:obligatorio — descripción libre
  - `colors`: opcional — si se pasa, la IA genera una paleta "similar pero más linda" a estos hex codes
- **Response 201:** `PaletteDto` (id, colors, text, tags)
- **Response 401:** si `OPENAI_API_KEY` no está configurada en `.env` → error `Incorrect API key provided: ''`.
- **Archivo:** `layers/palette/server/api/palette/create.ts`
- **Dependencia:** MongoDB + OpenAI (requiere `OPENAI_API_KEY`).

### `POST /palette/clone`

Clona una paleta existente manteniendo el nombre y calculando nuevos tags con IA para los colores que pases.

- **Body:**
  ```json
  {
    "id": "671fd5edab6cc866507fe7cf",
    "colors": ["#111111", "#222222", "#333333", "#444444", "#555555"]
  }
  ```
- **Response:** `PaletteDto` (la paleta nueva generada, con el `text` de la original).
- **Archivo:** `layers/palette/server/api/palette/clone.ts`
- **Dependencia:** Mongo + OpenAI (usa IA para generar los tags).

### `GET /palette/count`

Devuelve la cantidad de paletas creadas en las últimas 24 horas. Endpoint cacheado (60s × 5 = 5 min).

- **Query:** ninguna.
- **Response 200:** `{ "count": 1234 }`
- **Archivo:** `layers/palette/server/api/palette/count.get.ts`
- **Dependencia:** solo Mongo. Cacheado con `defineCachedEventHandler`.

### `GET /og/get`

Genera una imagen PNG OpenGraph de una paleta (para previews en redes sociales).

- **Query:**
  - `colors`: string con hex codes separados por `:` (ej: `#ff0000:#00ff00:#0000ff:#ffff00:#ff00ff`)
  - `text`: nombre de la paleta
- **Response 200:** `Content-Type: image/png` (binario)
- **Archivo:** `layers/og/server/api/og/get.get.ts`

### `GET /og/tag`

Genera una imagen PNG OpenGraph tipo grid con todas las paletas que tienen un tag.

- **Query:**
  - `tag`: nombre del tag (case-insensitive)
  - `text`: título
- **Response 200:** `Content-Type: image/png` (binario)
- **Archivo:** `layers/og/server/api/og/tag.get.ts`

### `POST /feedback`

Guarda feedback enviado desde el formulario del sitio.

- **Body:**
  ```json
  { "email": "user@example.com", "feedback": "..." }
  ```
  - `email`: formato email válido
  - `feedback`: string, máx 5000 chars
- **Response 201:** sin body.
- **Archivo:** `layers/feedback/server/api/feedback/create.ts`

---

## Endpoints nuevos

> Estos endpoints se agregaron en esta sesión. No requieren autenticación ni OpenAI (excepto `/palette/create` que sí).

### `GET /random-color`

Devuelve un color aleatorio en HEX y RGB.

- **Query:** ninguna.
- **Response 200:**
  ```json
  {
    "hex": "#d8e191",
    "rgb": { "r": 216, "g": 225, "b": 145 }
  }
  ```
- **Archivo:** `layers/random-color/server/api/random-color/index.get.ts`
- **Dependencias:** ninguna (solo `Math.random`).

### `GET /contrast-checker`

Calcula el ratio de contraste WCAG entre dos colores y devuelve los niveles de aprobación (AA/AAA/Fail) para texto normal, texto grande y componentes UI.

- **Query (URL-encoded):**
  - `primary`: hex code con o sin `#` (ej: `%23ffffff` o `ffffff`)
  - `secondary`: hex code con o sin `#`
- **Response 200:**
  ```json
  {
    "primary": "#ffffff",
    "secondary": "#000000",
    "contrastRatio": 21,
    "wcag": {
      "normalText": "AAA",
      "largeText": "AAA",
      "uiComponents": "AA"
    }
  }
  ```
- **Umbrales WCAG usados:**
  - Texto normal: `Fail` si <4.5, `AA` si <7, `AAA` si ≥7
  - Texto grande: `Fail` si <3, `AA` si <4.5, `AAA` si ≥4.5
  - UI Components: `AA` si ≥3, `Fail` si <3
- **Response 400:** si los hex no son válidos → `"Invalid hex colors. Use ?primary=#RRGGBB&secondary=#RRGGBB"`
- **Archivo:** `layers/contrast-checker/server/api/contrast-checker/index.get.ts`
- **Dependencias:** `hexToRgb` (from `color-converter.util`) + `calculateContrastRatio` (from `color-contrast.util`).

### `GET /color-mixer`

Mezcla dos colores en una proporción dada. Devuelve dos resultados en paralelo: mezcla en espacio HSL (interpolando hue shortest-path) y mezcla en RGB lineal.

- **Query (URL-encoded):**
  - `a` (alias: `color1`): hex code
  - `b` (alias: `color2`): hex code
  - `ratio`: número entre 0 y 1 (default 0.5). 0 → todo `a`, 1 → todo `b`.
- **Response 200:**
  ```json
  {
    "inputs": { "a": "#ff0000", "b": "#0000ff", "ratio": 0.5 },
    "mixed":       { "hex": "#ff00ff", "rgb": { "r":255,"g":0,"b":255 }, "method": "hsl" },
    "mixedRgb":    { "hex": "#ff00ff", "rgb": { "r":255,"g":0,"b":255 }, "method": "rgb-linear" }
  }
  ```
  Para `ratio=0.75` (más azul): `mixed.hex = "#7f00ff"`.
- **Response 400:** si algún hex no es válido.
- **Archivo:** `layers/palette/server/api/color-mixer/index.get.ts`
- **Dependencias:** `hexToRgb`, `rgbToHsl`, `hslToRgb`, `rgbToHex` (de `color-converter.util`).

### `GET /harmonies`

Genera una paleta de armonía de colores con la **misma lógica** que la tool "Color Palette Creator" (port 1:1 de `pro-color-harmonies`, espacio perceptual OKLCH). Sin dependencias externas — toda la matemática corre en el server.

- **Query:**
  - `base` (obligatorio): hex code del color base (con o sin `#`)
  - `type` (opcional): `analogous` (default) | `complementary` | `triadic` | `tetradic` | `splitComplementary` | `tintsShades`
  - `style` (opcional): `default` | `square` (default) | `triangle` | `circle` | `diamond`
  - `count` (opcional): cantidad de colores, **3..30** (default 6). Menos de 6 se hace por downsample, más de 6 por interpolación en OKLab
  - `sine`/`wave`/`zap`/`block` (opcional): modificadores, **-1..1** (default 0)
  - `clamp` (opcional): `true` (default, igual que la UI) | `false` — clampa a sRGB reduciendo chroma; `false` devuelve colores que pueden quedar fuera de gamut (crudos)
  - `interpolation` (opcional): `true` (default) | `false` — blend suave de variaciones en los umbrales de lightness
- **Response 200:**
  ```json
  {
    "base": "#2d6a4f",
    "type": "analogous",
    "style": "circle",
    "count": 8,
    "clampToGamut": true,
    "interpolation": true,
    "modifiers": {},
    "colors": ["#2d6a4f", "#184922", "#1f4723", "#365b43", "#4a7967", "#5a9b8b", "#80c1b5", "#c3e9e7"]
  }
  ```
- **Response 400:** si `base` no es un hex válido → `"Invalid hex color. Use ?base=#RRGGBB"`
- **Archivo:** `layers/color-palette-creator/server/api/harmonies/index.get.ts`
- **Dependencias:** ninguna (OKLCH implementado a mano, sin librerías).

### `GET /pantone`

Busca en el dataset Pantone (3.219 muestras de la guía Solid Coated, las mismas de la tool "All Colors"). Soporta 3 modos según el query:

- **Modo hex (match perceptual):** `?hex=#RRGGBB&limit=12`
  - Devuelve los `limit` Pantone más cercanos al color de referencia, ordenados por **ΔE2000** (CIEDE2000). `limit` entre 1 y 50 (default 12).
  ```json
  {
    "mode": "match",
    "hex": "#f6eb64",
    "matches": [
      { "code": "PANTONE 100 C", "name": "100 C", "category": "Solid Coated", "hex": "#f6eb64", "deltaE": 0 },
      { "code": "PANTONE 3935 C", "name": "3935 C", "category": "Solid Coated", "hex": "#f2ec61", "deltaE": 1.12 }
    ]
  }
  ```
- **Modo código:** `?code=PANTONE 185 C` (case-insensitive, acepta `185 C`)
  ```json
  { "mode": "code", "swatch": { "code": "PANTONE 185 C", "name": "185 C", "category": "Solid Coated", "hex": "#e4092d" } }
  ```
- **Modo búsqueda:** `?q=green` (substring case-insensitive en nombre/código, máx 50 resultados)
  ```json
  { "mode": "search", "query": "green", "results": [ { "code": "PANTONE Green C", "name": "Green C", "category": "Solid Coated", "hex": "#00ab84" } ] }
  ```
- **Errores:** 400 si falta query o el hex es inválido; **404** si el código no existe.
- **Archivo:** `layers/all-colors/server/api/pantone/index.get.ts`
- **Dependencias:** ninguna (dataset JSON + CIEDE2000 propio).

### `GET /color-name`

Resuelve el **nombre del color** más cercano del diccionario ampliado (14.394 nombres, el mismo que usa toda la app). Usa la misma métrica que ntc (distancia RGB + 2× HSL) pero implementada en TS puro — no importa el `.js` legacy por el bug de Windows+Nitro.

- **Query:**
  - `hex` (obligatorio): hex code con o sin `#`
- **Response 200:**
  ```json
  {
    "hex": "#2C3E50",
    "name": "Cloud Burst",
    "exactMatch": false,
    "matchedHex": "#2D3A52"
  }
  ```
  `exactMatch: true` cuando el hex existe en el diccionario (ej. `#FFFFFF` → `White`).
- **Response 400:** hex inválido → `"Invalid hex color. Use ?hex=#RRGGBB"`
- **Archivo:** `layers/all-colors/server/api/color-name/index.get.ts`
- **Dependencias:** `color-names-data.json` (367 KB, incluido en el repo).

### `POST /image-color-picker`

Extrae los N colores dominantes de una imagen pasada como data URL base64. Usa `sharp` para procesar la imagen en el server (no necesita Canvas ni navegador).

- **Body:**
  ```json
  {
    "image": "data:image/jpeg;base64,/9j/4AAQ...",
    "count": 5
  }
  ```
  - `image`: data URL completa (con `data:image/...;base64,`). Obligatorio.
  - `count`: cantidad de colores a devolver, entre 1 y 10 (default 5).
- **Response 200:**
  ```json
  {
    "count": 5,
    "palette": [
      { "hex": "#4b562c", "rgb": { "r":75,"g":86,"b":44 }, "prevalence": 9.96 },
      { "hex": "#566830", "rgb": { "r":86,"g":104,"b":48 }, "prevalence": 7.96 },
      ...
    ]
  }
  ```
  `prevalence` = porcentaje de píxeles de la imagen que caen en ese bucket de color.
- **Algoritmo:**
  1. `sharp` redimensiona a 64×64 (cover)
  2. Lee pixels crudos RGB
  3. Quantization por buckets de 32 niveles por canal
  4. Ordena por cantidad de píxeles descendente
  5. Toma los primeros `count`
- **Response 400:**
  - Sin campo `image`: `"Missing 'image' field (base64 data URL)."`
  - Data URL inválida: `"Invalid image. Expected base64 data URL: data:image/png;base64,..."`
- **Archivo:** `layers/image-color-picker/server/api/image-color-picker/index.post.ts`
- **Dependencias:** `sharp` (procesamiento de imagen nativo en Node).

### `POST /color-token-extractor`

Extrae los **CSS custom properties de color** (design tokens) de una página web. El navegador no
puede fetchear URLs arbitrarias por CORS, así que el HTML y las hojas CSS se descargan
server-side (con los mismos guards anti-SSRF del proxy de imágenes) y se parsean en busca de
tokens de color declarados (`--color-primary`, `--bg-*`, etc.).

Portado conceptualmente del mecanismo de [dembrandt](https://github.com/dembrandt/dembrandt)
(MIT): filtros de ruido de frameworks, parser CSS Color Level 4 completo
(hex, rgb/hsl/hwb, lab/lch D50, oklab/oklch, `color()` display-p3/xyz, nombres CSS), resolución
de `var()` encadenadas (hasta 6 niveles) y clasificación en `brand` / `semantic` / `custom`.

- **Body:**
  ```json
  { "url": "https://picocss.com" }
  ```
  - `url`: obligatorio — URL `http(s)` del sitio a analizar. Hosts privados/locales bloqueados (SSRF).
- **Response 200:**
  ```json
  {
    "url": "https://picocss.com/",
    "title": "Pico CSS • Minimal CSS Framework...",
    "themeColor": "#0172ad",
    "themeColorHex": "#0172ad",
    "favicon": "https://picocss.com/favicon.ico",
    "tokens": [
      { "name": "--pico-primary", "value": "#0172ad", "hex": "#0172ad", "type": "brand", "scope": "root" }
    ],
    "palette": [
      { "hex": "#0172ad", "count": 3, "names": ["--pico-primary", "--pico-primary-hover"] }
    ],
    "cssSources": 2
  }
  ```
  - `tokens`: cada token con su nombre (`--x`), valor declarado, `hex` resuelto (o `null` si no
    se pudo resolver), `type` (`brand` | `semantic` | `custom`) y `scope` (`root` si está en
    `:root`/`html`, `scoped` si está en un selector). Los namespaces de frameworks completos
    (`--wp--preset`, `--el-`, `--chakra-`, `--ant-`, `--bs-`...) y las utilidades no-color de
    Tailwind (`--tw-shadow`, `--tw-blur`...) se filtran a propósito.
  - `palette`: colores únicos con su frecuencia entre tokens y hasta 3 nombres por hex.
  - `cssSources`: cantidad de fuentes CSS analizadas (inline + hojas externas, máx 15).
- **Response 400:**
  - URL faltante/inválida: `"Missing or invalid \"url\". Expected an http(s) URL."`
  - Host privado/local: `"URL not allowed."`
  - No se pudo fetchear la página (timeout 12s, >5MB HTML, >2MB CSS): `"Could not fetch the page."`
  - La URL no apunta a una página web (imagen, PDF...): `"The URL does not point to a web page."`
- **Archivo:** `layers/color-token-extractor/server/api/color-token-extractor/index.post.ts`
- **Dependencias:** ninguna (fetch nativo de Node + parser propio, sin librerías).

### `POST /color-token-extractor/runtime`

Analiza la página **realmente renderizada** en un Chromium headless (worker Docker `color-renderer`,
ver `docs/color-renderer-worker.md`): espera a que corra el JS y devuelve la paleta de colores
efectivamente usados, el contraste WCAG de texto real y (opcional) un screenshot. Soporta
detección de **dark mode** con dos renders (light + dark).

- **Body:**
  ```json
  { "url": "https://picocss.com", "screenshot": true, "darkMode": true }
  ```
  - `url`: obligatorio — URL `http(s)`. Mismos guards anti-SSRF.
  - `screenshot`: opcional — `true` para incluir un JPEG del sitio (~56 KB base64, clip ≤9000px).
  - `darkMode`: opcional — `true` para hacer un segundo render con `prefers-color-scheme: dark`
    y detectar dark mode automáticamente.
- **Response 200:**
  ```json
  {
    "url": "https://picocss.com/",
    "title": "Pico CSS • Minimal CSS Framework...",
    "durationMs": 3106,
    "viewport": "1440x900",
    "sampled": 880,
    "unique": 23,
    "usagePalette": [
      { "hex": "#0172ad", "count": 73, "share": 8.3 }
    ],
    "contrast": [
      { "fg": "#5c6370", "bg": "#ffffff", "count": 47, "ratio": 6.05, "passesAA": true, "passesAAA": false }
    ],
    "hasDarkMode": true,
    "dark": {
      "usagePalette": [ { "hex": "#000000", "count": 339, "share": 12.4 } ],
      "contrast": [ /* pares del render dark */ ]
    },
    "screenshot": "data:image/jpeg;base64,...",
    "cached": false
  }
  ```
  - `usagePalette`: colores renderizados (`getComputedStyle`) con count y share (%) — top 40.
  - `contrast`: pares texto/fondo con ratio WCAG (1-21), conteo de uso y pases AA/AAA — top 20.
    Umbrales: normal 4.5/7, large text (≥24px o ≥18.66px bold) 3/4.5.
  - `hasDarkMode` / `dark`: solo con `darkMode: true`. `hasDarkMode: true` si el sitio reacciona a
    `prefers-color-scheme`; `dark` contiene el mismo shape que el resultado raíz para el render dark.
  - `cached`: `true` si vino de la caché del worker (LRU 200 URLs / TTL 1h) — en ese caso `durationMs: 0`.
- **Response 400/413/504:** errores útiles del worker propagados tal cual (URL inválida/SSRF, body grande, timeout de render).
- **Response 502:** `"Rendered analysis unavailable. The renderer worker is offline."` si el worker no está levantado.
- **Archivo:** `layers/color-token-extractor/server/api/color-token-extractor/runtime/index.post.ts`
- **Dependencias:** worker Docker `magicolor-renderer` (Playwright, puerto 3100 por default, env `RENDERER_URL`). Sin el worker, este endpoint responde 502 — la Fase 1 sigue funcionando sola.

---

## Esquemas de validación (typebox)

Todos los bodies se validan con `@sinclair/typebox` vía `validateBody` (`layers/common/utils/validate.util.ts`).

### `PaletteDto` (response estándar de una paleta)
```ts
{
  id: string (24 hex chars),
  colors: string[5],
  text: string,
  tags: string[]
}
```

### `CreatePaletteInputDto`
```ts
{ prompt: string, colors?: string[5] }
```

### `ListPaletteInputDto`
```ts
{ page: number, size: number (max 100), filter?: { tag: string } }
```

### `ClonePaletteInputDto`
```ts
{ id: string, colors: string[5] }
```

### `CreateFeedbackInputDto`
```ts
{ email: string (format email), feedback: string (max 5000) }
```

### `OgInputDto` (query)
```ts
{ colors: string, text: string }
```

---

## Cómo levantar el server

```bash
# 1) Mongo
docker compose up -d

# 2) .env en la raíz
#    OPENAI_API_KEY=sk-...   (requerido para /palette/create y /palette/clone)
#    MONGO_URL=mongodb://... (opcional, hay default para Docker local)

# 3) Instalar deps
npm install

# 4) Correr dev
npm run dev
# o en otro puerto si 3000 está tomado:
# PORT=3011 npm run dev   (Windows PowerShell: $env:PORT="3011"; npm run dev)
```

Por default el server escucha en `http://localhost:3000`. Si el puerto está ocupado, Nuxt rebota al siguiente libre.

---

## Notas importantes

1. **Sin autenticación local** — el repo no implementa ningún middleware de auth. Todos los endpoints son públicos. En el sitio público `api.magicolor.app` sí piden un token de "desktop client" (401), pero eso es específico del deployment del autor, no del código del repo.

2. **Requiere `OPENAI_API_KEY` para IA** — solo `/palette/create` y `/palette/clone` llaman a OpenAI. Los demás endpoints funcionan sin la key.

3. **Mongo URL configurable** — viene de `useRuntimeConfig().mongo.url` (variable `MONGO_URL`). Default: `mongodb://magicolor:secret@localhost:27018/magicolor?authSource=admin` (levantado por `compose.yml`).

4. **Bug conocido en Windows + Nitro 2.9.7** — no importar archivos `.js` sin extensión desde el server side con path absoluto. El handler original `contrast-checker` usaba `ntc.rgb()` (que es `.js`); los endpoints nuevos usan solo utilidades `.ts` para evitar este issue.

5. **Disclaimer del README oficial** — "This API may be removed or changed at anytime, without warning." Esto aplica al sitio público, no a tu instancia local.

---

## Ejemplos rápidos (PowerShell)

```powershell
# Random color
Invoke-WebRequest -Uri "http://localhost:3011/api/random-color" -Method GET

# Contrast checker
Invoke-WebRequest -Uri "http://localhost:3011/api/contrast-checker?primary=%23ffffff&secondary=%23000000" -Method GET

# Color mixer
Invoke-WebRequest -Uri "http://localhost:3011/api/color-mixer?a=%23ff0000&b=%230000ff&ratio=0.5" -Method GET

# Listar paletas
Invoke-WebRequest -Uri "http://localhost:3011/api/palette/list" -Method POST -Body '{"page":0,"size":10}' -ContentType "application/json"

# Contar paletas
Invoke-WebRequest -Uri "http://localhost:3011/api/palette/count" -Method GET

# Crear paleta (requiere OPENAI_API_KEY)
Invoke-WebRequest -Uri "http://localhost:3011/api/palette/create" -Method POST -Body '{"prompt":"green forest"}' -ContentType "application/json"

# Extraer tokens de color de una web (Fase 1)
Invoke-WebRequest -Uri "http://localhost:3011/api/color-token-extractor" -Method POST -Body '{"url":"https://picocss.com"}' -ContentType "application/json"

# Analizar colores renderizados + contraste + dark mode (Fase 2, requiere worker Docker)
Invoke-WebRequest -Uri "http://localhost:3011/api/color-token-extractor/runtime" -Method POST -Body '{"url":"https://picocss.com","screenshot":true,"darkMode":true}' -ContentType "application/json"
```
