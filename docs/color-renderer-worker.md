# Worker color-renderer — Informe técnico (Fases 2a → 2d)

Documentación del servicio `color-renderer`: el worker aislado de **Playwright** que
ejecuta la extracción *en runtime* del [Color Token Extractor](../layers/color-token-extractor/).
Mientras la Fase 1 lee el CSS fuente (custom properties declaradas), este worker carga la
página real en un Chromium headless, espera a que corra el JS y devuelve:

1. **Fase 2a — Paleta de uso**: colores efectivamente renderizados (`getComputedStyle`)
   con su frecuencia de uso y share.
2. **Fase 2b — Contraste WCAG real**: pares texto/fondo con ratio y pases AA/AAA,
   calculados sobre el **fondo efectivo** (no el declarado).
3. **Fase 2c — Screenshot**: imagen JPEG (q60, alto acotado a 9000px, ~56 KB base64)
   del sitio renderizado, opcional por flag.
4. **Fase 2d — Dark mode**: dos renders (`light` + `dark` vía `prefers-color-scheme`),
   detección automática y merge de tokens declarados vs. computados por modo.

---

## 1. Arquitectura

```
  Navegador (usuario)
       │  POST /api/color-token-extractor/runtime
       ▼
  Magicolor (Nuxt/Nitro)  ── proxy HTTP (RENDERER_URL, timeout 30s) ──►  WORKER color-renderer (puerto 3100)
                                                                          Node 22 + Playwright (Chromium headless)
                                                                          ┌──────────────────────────────────┐
                                                                          │ Browser (1 solo, launch-once)    │
                                                                          │  ├─ Context A (job 1)            │
                                                                          │  ├─ Context B (job 2)  max 3      │
                                                                          │  └─ ... (cola si está lleno)      │
                                                                          │ Caché LRU 200 URLs / TTL 1h      │
                                                                          └──────────────────────────────────┘
```

- **Aislamiento**: el worker es un servicio Docker aparte (`workers/color-renderer/`).
  Un crash de Chromium nunca afecta a la app, y el peso de los binarios (imagen ~3.3 GB)
  no ensucia la imagen principal.
- **On-demand**: solo se ejecuta cuando alguien usa la tool; las páginas normales de
  Magicolor nunca lo tocan.

## 2. Componentes

| Archivo | Responsabilidad |
|---|---|
| `index.mjs` | Servidor HTTP (Node nativo, sin deps): rutas, caché, timeout, guards SSRF, health, shutdown graceful |
| `pool.mjs` | Pool de browser: launch-once + `BrowserContext` aislado por job + semáforo con cola; `colorScheme` (`light`/`dark`) por job |
| `render.mjs` | Job: navega → settle 2s → muestreo de computed styles + texto/fondo efectivo para contraste + fondo dominante |
| `lib.mjs` | Funciones puras (testeables sin Playwright): `rgbToHex`, `aggregateUsage`, `createLruCache`, `contrastRatio`, `aggregateContrast`, `detectDarkMode` |
| `Dockerfile` | Base oficial `mcr.microsoft.com/playwright:v1.62.1-jammy` |

## 3. Contrato API

### `POST /render` — body `{ url, screenshot?: boolean, darkMode?: boolean }`

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
  "cached": false
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `usagePalette` | array | Colores renderizados con count y share (%) — top 40 (modo light) |
| `contrast` | array | Pares fg/bg con ratio (1-21) y pases AA/AAA — top 20 (modo light) |
| `cached` | bool | `true` si vino de la caché (en ese caso `durationMs: 0`) |
| `screenshot` | string \| ausente | data URL `data:image/jpeg;base64,...` — solo si se pidió con `screenshot: true` |
| `hasDarkMode` | bool | Solo con `darkMode: true`: `true` si el sitio reacciona a `prefers-color-scheme: dark` |
| `dark` | object \| ausente | Solo con `darkMode: true` y `hasDarkMode`: mismo shape que el resultado raíz, pero del render dark |

Errores: `400` (URL inválida / SSRF), `413` (body grande), `504` (timeout), `500`.

### `GET /health`

```json
{ "ok": true, "connected": false, "active": 0, "queued": 0, "memMB": 135, "cacheEntries": 0 }
```

El browser se lanza **lazy** (en el primer render), por eso `connected` puede ser `false`
con el servicio sano.

## 4. Pool y concurrencia

- **Un solo `chromium.launch()`** al primer job (promesa compartida, safe bajo concurrencia).
- **Un `BrowserContext` por job** (aislado, como incógnito) + `page.close()` en `finally`.
  Contextos: livianos (~decenas de MB) vs. lanzar un browser por request (150-300 MB).
- **Semáforo** `MAX_CONCURRENCY` (default 3): los excedentes esperan en cola; el release
  despierta exactamente a un waiter (sin lost wakeups).
- **Timeout de 20s por job** (`AbortController`): si el job expira mientras espera en cola,
  ni arranca (pre-check de señal); si un `goto` está colgado, el handler de abort cierra la
  página → el `goto` rechaza al instante y libera el slot.
- **Límite de memoria** del contenedor: `mem_limit: 1536m` (medido: 215 MB con 2 jobs activos → mucho margen).

## 5. Caché

- `createLruCache(200, 1h)`: LRU en memoria con TTL, clave = URL (viewport fijo 1440×900).
- Un segundo render de la misma URL responde **instantáneo** con `cached: true`.
- **Los screenshots NO entran a la caché principal** (200 entradas × ~57 KB sería mucha
  memoria): viven en un **LRU aparte** (`SCREENSHOT_CACHE_MAX`, default 50 ≈ 3 MB) y se
  adjuntan solo cuando el request pide `screenshot: true`. Si el screenshot expira pero
  el resultado no, se re-renderiza (~3s) para refrescar ambos.
- Suficiente para 1 instancia; si el worker escala a N réplicas, migrar a Redis es el paso natural.

## 6. Seguridad (guards anti-SSRF)

Mismos guards que el endpoint de la app (`assertSafeUrl`): solo `http/https`, bloqueo de
`localhost`, `.local`, rangos privados (127.x, 10.x, 192.168.x, 172.16-31.x). El worker los
**duplica a propósito**: es un servicio independiente y debe ser seguro por sí mismo.
Limitación conocida: DNS rebinding no está mitigado (resolver la IP y re-chequear es la
mejora pendiente).

## 6bis. Dark mode (Fase 2d) — cómo funciona

- Con `darkMode: true` el worker hace **dos renders** del sitio: uno con
  `colorScheme: 'light'` y otro con `colorScheme: 'dark'` (emula `prefers-color-scheme`
  en el `BrowserContext`). La caché se particiona por `url#dark` para no mezclar modos.
- **Detección** (`detectDarkMode`, función pura): la señal principal es la **luminancia
  del fondo dominante** (el color más usado del body) — si difiere en > 0.25 entre
  modos (light claro vs. dark oscuro), es dark mode. Señal secundaria (solo si el fondo
  no cambió): las paletas top-10 casi no se solapan (< 10% de intersección).
- **Merge en la UI**: los tokens declarados (Fase 1) se marcan con un badge
  `used on page` según el **modo activo** del toggle Light/Dark (no la unión de
  ambos modos) — coherente con la paleta y el contraste que se muestran. El
  screenshot es del render light y se atenúa visualmente cuando el toggle está en
  Dark (la captura no coincide con la paleta dark, así se indica).
- **Coste**: dos renders secuenciales (~2× el tiempo de un render: 3.1s medido en
  picocss). El pool soporta hasta 3 concurrentes; paralelizar con `Promise.all` es
  la mejora pendiente (mismo resultado, ~mitad de tiempo).

### Resultados reales (picocss.com, medidos)

```
hasDarkMode: true | light: 23 colores | dark: 24 colores | 2.9 s total
  dark top3:  #000000 x339 | #969eaf x129 | #c2c7d0 x101   (fondo negro real)
  dark contrast: 20 pares
```

## 7. Contraste WCAG (Fase 2b) — cómo funciona

1. **Muestreo**: por cada elemento con texto directo, se lee `color`, `fontSize`,
   `fontWeight`, `opacity` y se calcula el **fondo efectivo**.
2. **Fondo efectivo**: se recorren los ancestros componiendo sus `background-color` con
   composición *source-over* **de abajo hacia arriba** (la bg del elemento se pinta encima
   de la del ancestro) hasta encontrar un fondo opaco; si ninguno lo es, el canvas blanco
   del navegador. Se usa un `WeakMap` para cachear el bg parseado por nodo.
3. **Blend del texto**: si el color tiene alpha < 1 (o `opacity` < 1), se compone sobre el
   fondo efectivo antes de medir.
4. **Luminancia relativa** WCAG 2.x: `c' = c/12.92` si `c ≤ 0.03928`, si no `((c+0.055)/1.055)^2.4`;
   `L = 0.2126R + 0.7152G + 0.0722B`.
5. **Umbrales**: texto normal AA ≥ 4.5 / AAA ≥ 7; *large text* (≥ 24px, o ≥ 18.66px bold)
   AA ≥ 3 / AAA ≥ 4.5. Si un par aparece con texto normal y large, se usa el umbral estricto.

### Resultados reales (picocss.com)

```
15 pares de contraste
  #5c6370 on #ffffff →  6.05:1  AA ✓
  #373c44 on #ffffff → 11.10:1  AA+AAA ✓
  #ffffff on #181c25 → 17.05:1  AA+AAA   (bloques de código, fondo OSCURO real)
  #ffffff on #0172ad →  5.23:1  AA ✓     (texto blanco sobre botón azul)
```

## 8. Integración con la app

- Endpoint proxy: `layers/color-token-extractor/server/api/color-token-extractor/runtime/index.post.ts`
  → `POST {RENDERER_URL}/render` con timeout de 30s.
- **Propagación de errores**: 400/413/504 del worker se pasan tal cual al cliente; el 502
  genérico solo aparece si el worker está caído (fetch falla).
- **Degradación elegante**: si el worker está offline, la UI muestra un error claro y la
  Fase 1 (tokens declarados) sigue funcionando sola.
- Config: `runtimeConfig.rendererUrl` (env `RENDERER_URL`, default `http://localhost:3100`).

## 9. Deploy

```yaml
# compose.yml
renderer:
  container_name: magicolor_renderer
  build: ./workers/color-renderer
  environment:
    PORT: "3100"
    MAX_CONCURRENCY: "3"
    JOB_TIMEOUT_MS: "20000"
    CACHE_TTL_MS: "3600000"
  ports:
    - "3100:3100"
  mem_limit: 1536m
  restart: always
```

Dockerfile: base `mcr.microsoft.com/playwright:v1.62.1-jammy` (ya trae Chromium + deps del
SO) + `npm install --omit=dev` de `playwright@1.62.1` (versión pinneada a la imagen).
Correr en local sin Docker: no — necesita los binarios del sistema.

## 10. Métricas medidas (POC en Docker Desktop, Windows)

| Métrica | Valor |
|---|---|
| Launch de Chromium | 274–942 ms |
| Job single (picocss.com) | ~2.9–3.1 s (domina la carga de la página) |
| 2 jobs concurrentes | ~6.9 s wall (comparten el browser, sin penalización lineal) |
| Memoria con 2 jobs activos | 215 MB (límite 1.5 GB) |
| Imagen Docker | ~3.3 GB en disco |
| Screenshot JPEG (picocss.com) | ~56 KB base64 (clip ≤ 9000px, q60) |

## 11. Limitaciones conocidas

- **Sitios con ambos modos oscuros** (p. ej. light = `#333`, dark = `#111`): la
  diferencia de luminancia del fondo no supera 0.25 → `hasDarkMode: false` silencioso.
  Degradación aceptable (el modo dark no existe para esos sitios en la práctica).
- **Señal secundaria de detección deliberadamente estricta** (solapamiento < 10% de
  paletas top-10): en la práctica domina la señal principal (ΔL > 0.25); la secundaria
  solo cubre el caso raro de fondos idénticos con paletas completamente distintas.
- Colores que `getComputedStyle` devuelve en `color(srgb ...)` (espacios modernos) no se
  parsean y se descartan silenciosamente (fg y bg).
- La `opacity` se aplica al color de texto, pero no a los backgrounds de la cadena de ancestros.
- DNS rebinding no mitigado en los guards SSRF del worker.
- El muestreo está capado a 5.000 elementos y 40/20 entradas de salida (diseñado así a propósito).

## 12. Roadmap

- Caché distribuida (Redis) si el worker escala a N réplicas.
- Preferencias de tema manuales por sitio (forzar dark aunque el sitio no lo tenga).
- Mitigación de DNS rebinding en los guards SSRF.
