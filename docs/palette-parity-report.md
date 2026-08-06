# Informe de paridad numérica — Color Palette Creator vs pro-color-harmonies

Fecha: 2026-08-05 · Repo: `magicolor` · Librería original: **pro-color-harmonies v0.11.0** (meodai, MIT)

## Resumen ejecutivo

La implementación previa de `layers/color-palette-creator/utils/palette-generator.util.ts` era una
reconstrucción a partir del informe interno (`docs/informe-pro-color-harmonies-DEFINITIVO.md`), NO una
traducción del código real. Al auditarla numéricamente contra la librería original (copia literal en
`layers/color-palette-creator/utils/__tests__/reference/pro-color-harmonies/`):

| Métrica | Antes | Después |
|---|---|---|
| Comparaciones (batería) | 1.578 | **2.424** (16 colores base) |
| Diffs por encima de tolerancia 0.0005 | **14.539** | **0** |
| Delta máximo | **175,87** (60° de hue en triadic/circle) | **0,000000** |
| Typecheck | 8 errores preexistentes | 8 errores preexistentes (ninguno nuevo) |

**La paridad es completa**: cada combinación (tipo × estilo × interpolation × modificadores ×
expansión a N) produce salidas OKLCH idénticas a la librería original, componente a componente
(l, c, h), con delta 0.000000 en todos los casos de la batería.

---

## Metodología (regla de oro)

1. Se clonó el repo original (`git clone --depth 1 https://github.com/meodai/pro-color-harmonies`).
2. Los 12 archivos fuente se copiaron **carácter por carácter** (verificado por md5) a
   `layers/color-palette-creator/utils/__tests__/reference/pro-color-harmonies/`. El único parcheo es
   mecánico y en runtime: agregar extensiones `.ts` a los imports relativos (para que Node los
   resuelva) y sustituir el import de `'culori'` por un shim local
   (`reference/pro-color-harmonies/culori-shim.ts`), validado numéricamente contra culori real (ver §7).
3. El harness (`layers/color-palette-creator/utils/__tests__/palette-parity.test.ts`) ejecuta AMBAS
   implementaciones con los mismos inputs y compara los objetos OKLCH resultado componente por
   componente (tolerancia 0.0005). No compara hex ni "a ojo".

```bash
npm run test:parity
# node --experimental-strip-types layers/color-palette-creator/utils/__tests__/palette-parity.test.ts
```

**Batería**: 16 colores base — los 10 pedidos (oscuro puro, borde de umbral 0.25-0.35, medio, borde
0.65-0.75, claro puro, hue banda roja 345-30°, hue banda cian 150-210°, claro+poco saturado,
saturado+oscuro y acromático) + 6 extras que cierran los huecos de cobertura de branches detectados en
la revisión de código: hue [30,90) y [45,90) en todas las hue-strategies, zonas de blend de triangle
l ∈ [0.35,0.45] y [0.55,0.65], condiciones compuestas de diamond (hue [180,240) con l<0.5 y hue
[30,90) con l>0.6) y bordes de banda hue = 30/90 — × 6 tipos × 5 estilos
(default/square/triangle/circle/diamond) × interpolation on/off, + 5 combinaciones de modificadores +
expansión a N ∈ {1, 2, 3, 5, 8, 12, 30}.

---

## Fase 1 — Mapeo archivo por archivo (original → mi implementación)

| Original (v0.11.0) | Equivalente local (nuevo) | Estado |
|---|---|---|
| `src/index.ts` — tipos, `ColorPaletteGenerator.generate/generateAll`, los 5 ensambladores | `palette-generator.util.ts` §ensambladores + `generateFromOklch` | ✅ port 1:1 |
| `src/utils/color.ts` — `normalizeHue`, `clampOKLCH`, `avoidMuddyZones`, `safeColor` | `oklch.util.ts` (`normalizeHue`) + `palette-generator.util.ts` | ✅ port 1:1 |
| `src/utils/constants.ts` — `OKLCH_LIMITS` | `palette-generator.util.ts` | ✅ idéntico |
| `src/utils/palette.ts` — `resolvePaletteStyle`, `isAchromatic`, `generateNeutralPalette`, `createPaletteGenerator` | `palette-generator.util.ts` | ✅ port 1:1 |
| `src/utils/hue-strategies.ts` — 5 funciones de hue | `palette-generator.util.ts` | ✅ port 1:1 (antes: reconstrucción errónea) |
| `src/utils/variations.ts` — 5 funciones de variaciones + `interpolateDeep` | `palette-generator.util.ts` | ✅ port 1:1 (antes: sets estáticos erróneos) |
| `src/utils/enhancer.ts` — `getChromaNarrative`, `getColorHierarchy`, `enhancePalette`, `polishPalette` | `palette-generator.util.ts` | ✅ port 1:1 (las tablas ya coincidían) |
| `src/utils/modifiers.ts` — sine/wave/zap/block + `applyModifiers` | `palette-generator.util.ts` | ✅ port 1:1 |
| `src/utils/tintsShades.ts` — `generateTintsAndShades` | `palette-generator.util.ts` | ✅ port 1:1 |
| `src/utils/demo-palette.ts` — `extendPalette` | `expandPalette` | ✅ port 1:1 |
| `src/utils/gamut.ts` — `clampColorToGamut`/`clampPaletteToGamut` (vía culori) | `clampChroma` de `oklch.util.ts` | ✅ equivalente validado (Δ ≤ 4,8e-5) |
| `src/utils/interpolation.ts` — `lerp`, `interpolateDeep` | `oklch.util.ts` (`lerp`) + local | ✅ port 1:1 |

Nada del original quedó sin equivalente local.

---

## Fase 3/5 — Diffs encontrados (14.539) y correcciones

Distribución de los diffs previos: **analogous 3.365 · complementary 2.878 · triadic 1.909 ·
tetradic 3.413 · splitComplementary 2.863 · tintsShades 111** · (canales: l 5.999, c 4.986, h 3.554).
Los deltas iban de 0,0015 (chroma) hasta **60° de hue** (triadic|circle: offsets reales 130/230 vs
inventados 120±sin·6).

### 1. Hue strategies — reescritas (función por función)

La implementación anterior inventó buckets de 60° y fórmulas trigonométricas (`sin(h·π/180)·6`, etc.)
que **no existen** en la librería. La real usa bandas de hue con offsets fijos y funciones lineales por
tramos. Ejemplos incorrecto → correcto:

- `getAnalogousHues` triangle: la real usa bandas `<30`, `<50`, `<90`, `<180`, `<240` con offsets
  distintos por banda (p.ej. `[0, -25, -12, 10, 20, 30]` para hue<50); la anterior usaba 6 buckets de
  60° con otros offsets.
- `getComplementaryHue` triangle: la real es por tramos lineales (`hue<30 → 170 + hue·0,3`,
  `hue<90 → 240 + (hue-30)·0,5`, …); la anterior usaba `h + 173/185/192/…` según bucket.
- `getTriadicHues`/`getTetradicHues`/`getSplitComplementaryHues`: idem, todos reescritos con las
  bandas y constantes exactas (incluido el branch de `chroma > 0.8 && lightness < 0.4` de diamond,
  que es **código muerto en la práctica** porque OKLCH_LIMITS.c.max = 0.37 — pero se copia literal,
  condición incluida, para fidelidad).
- Circle: la real **no** usa trigonometría para analogous (usa bandas de hue con offsets fijos);
  solo complementary/triadic/tetradic/split usan `sin/cos` en ramas puntuales (p.ej.
  `180 + sin(hue)·20` para la banda 345-30 de complementary).

### 2. Variations — reescritas (el mayor foco de divergencia)

La anterior tenía `VariantSet` estáticos por tipo con un blend genérico 0.3/0.7. La real tiene
`getXxxVariations(base, style, interpolate)` con:

- `getDefault(l)`: tres ramas (`l < 0.3`, `l > 0.7`, medio) con valores distintos por tipo.
- Estilo `triangle`: `getTriangle(l)` con `mod = l<0.4 ? 0.1 : l>0.6 ? -0.1 : 0` y **blend de ancho
  0.1** en los umbrales 0.4 y 0.6 vía `interpolateDeep(getTriangle(0.35), getTriangle(0.45), t)`.
- Estilo `circle`: `mod` propio (0.15/0.2 según tipo) + solo 2 bandas de hue (345-30 y 150-210);
  **todo lo demás cae al default** (se verificó que la implementación anterior, al usar un sistema
  propio, nunca caía al default real).
- Estilo `diamond`: condiciones compuestas (`lightness > 0.8 && chroma < 0.3`, `chroma > 0.8 &&
  lightness < 0.4`, bandas de hue con condiciones de lightness); lo no cubierto cae al default.
- Blend default en 0.3/0.7 con `interpolateDeep(getDefault(0.25), getDefault(0.35), t)` cuando
  `interpolate` es true.

Ejemplo concreto (analogous, square, base L0.15/C0.20/H20, índice 1): la real aplica la variación
`{l: 0.25, c: 0.8}` → `l = 0.15 + 0.25 = 0.40`; la anterior aplicaba `{l: 0.1, c: 0.9}` → `l = 0.30`
(Δ0,10 en l).

### 3. `safeColor` — sin clamp en modo no-enhanced

La anterior clampeaba siempre (`clampOKLCH` dentro de `safeColor`). La real, con `enhanced = false`
(square/default), devuelve `{l, c, h}` **crudos**. Además, en triadic y splitComplementary el
"baseDark" (índice 1) va **sin pasar por `safeColor`** (la anterior lo pasaba). Esto cambia el
resultado en square cuando las variaciones exceden los límites.

### 4. Pipeline — sin clamp global final

La anterior terminaba con `palette.map(c => clampOKLCH(...))` (que además normalizaba hue). La real
**no clampa al final**: el clamping ocurre solo dentro de `safeColor` (enhanced), `enhancePalette`,
`polishPalette`, los modificadores y `generateTintsAndShades`. `clampOKLCH` de la real además **no
toca el hue** (la anterior lo normalizaba). Se eliminó el clamp final y se alineó `clampOKLCH`.

### 5. Neutral palette — el base va primero

La anterior insertaba el base en su slot dentro de la rampa (`[rampa con base en slot]`). La real
devuelve `[base, ...rampa sin el slot más cercano]`. Verificado contra el test del propio repo
original (`result[0]` debe ser el gray y todos `c < 0.002`).

### 6. `generateTintsAndShades` — 111 diffs

- Bezold-Brücke: la real usa `lDelta` **con signo** (`(targetL - lightness)·cos(...)·4`); la anterior
  usaba `|Δl|`.
- `chromaReduction = Math.max(0, 1 - chromaMult)` (la anterior no clampeaba a ≥ 0).
- Circle: clamp explícito `Math.max(0, Math.min(0.37, targetChroma))`.
- Todos los resultados pasan por `clampOKLCH` (la anterior devolvía crudos).
- `baseSlotIndex` por `reduce` con `<` estricto (empates van al primer slot) — igual en ambas, se
  mantuvo el criterio real.

### 7. enhance/polish/narratives/hierarchies — ya coincidían

Las tablas de `ChromaNarrative` (patrones de 6 multiplicadores + `breathingRoom`) y `ColorHierarchy`
(rol, chromaMultiplier, lightnessShift) ya eran correctas (se copiaron del informe, que en esto sí era
fiel). Se reescribieron con la estructura exacta del original (fallbacks `|| hierarchy[0]` /
`|| 1.0`, `clampOKLCH` por color) pero sin cambio numérico. Confirmado: **ColorHierarchy NO depende
del estilo** (solo del tipo).

### 8. `expandPalette` (port de `extendPalette`) — algoritmo ya correcto

- Downsample (N ≤ 6): `Math.floor(i * step)` con `step = length/N` — ya era correcto.
- Upsample (N > 6): interpolación lineal por tramos en OKLab sobre TODOS los stops (equivalente a
  `culori.interpolate(colors, 'oklab')`) — ya era correcto.
- Los 5.890 diffs de la fase extend eran **heredados** de las paletas base divergentes (sobre todo
  triangle/circle), no del algoritmo en sí: al corregir el pipeline, extend quedó en 0.
- Detalle alineado: el hue del upsample se normaliza a [0,360) y se aplica `h || 0` para grises
  (comportamiento verificado de culori: `oklch()` normaliza; `h || 0` protege el gray).

---

## Fase 4 — Verificaciones del pipeline

| Verificación | Resultado |
|---|---|
| `avoidMuddyZones`: 3 zonas exactas `[25,65]`, `[100,140]`, `[180,200]`; fuga 10° + chroma ×1,1 (o ×0,5 si `c<0.15`); solo con `enhanced=true` | ✅ |
| Orden de aplicación: generar → safeColor/muddy (si enhanced) → enhance → polish → modifiers (sine→wave→zap→block) → clampToGamut | ✅ |
| `chromaAdjust = 0.9` SOLO en complementary y analogous | ✅ (verificado en el código del original) |
| Modificadores: solo se aplican si el valor es truthy; 0 = off; negativo invierte | ✅ |
| Base (índice 0) nunca se toca en enhance/polish | ✅ |
| `default` ≡ `square` (resolvePaletteStyle) | ✅ (assert en el harness para ambas) |
| `interpolation` default `true`; con `false` usa cortes duros (sin blend) | ✅ (ambas ramas en la batería) |
| Clamp de gamut off por defecto en el original | ✅ confirmado (§6, decisión abajo) |

---

## Decisiones documentadas (lo que NO se alineó y por qué)

### a) `clampToGamut` — el original lo tiene OFF por defecto; la UI lo usa en `true`

Confirmado en `src/index.ts` del original: `clampToGamut?: boolean | GamutTarget`, documentado como
"Off by default: raw OKLCH values may exceed the target gamut... but clips with hue shifts when
converted to hex/rgb in JS". En `ColorPaletteGenerator.generate` el clamp solo corre
`if (baseOptions.clampToGamut)`.

Mi página (`color-palette-creator.vue`) llama `generateAllPalettes(..., { clampToGamut: true })`.
**Decisión: se mantiene `true` a propósito — CONFIRMADO por el usuario (2026-08-05).** Razones: la
UI convierte a hex en JS (donde el clipping sin clamp produce hex con hue-shift, exactamente lo que
la doc del original advierte); el clamp por reducción de chroma preserva hue y lightness; y mi
`clampChroma` está validado contra `culori.clampChroma` (Δ máx 4,8e-5, dentro de tolerancia). La
paridad numérica no se ve afectada: el harness corre con el default del original (off).

### b) Gamut 'p3'

El original acepta `clampToGamut: 'p3'` (vía culori). Mi `clampChroma` solo apunta a sRGB. Se acotó
el tipo local a `boolean` y la UI nunca pide 'p3'. Si algún día se necesita P3, habría que añadir
culori como dependencia o implementar el gamut P3 a mano.

### c) Sin dependencias nuevas

El harness y la referencia no requieren culori: el shim local reimplementa solo `oklch`, `oklab` e
`interpolate` (validado contra culori real: Δ ≤ 3,8e-12) y `clampChroma` del shim lanza (no se usa en
la paridad). El proyecto no gana ninguna dependencia.

### d) `createPaletteGenerator` sin try/catch

El wrapper del original envuelve en try/catch para mensajes de error; se omitió por ser boilerplate
sin efecto numérico (documentado).

---

## Fase 5 — Validaciones

- **Harness de paridad**: 2.424 comparaciones, 0 diffs, delta máx 0.000000. Se ejecuta con
  `npm run test:parity` (queda como test permanente para CI). Nota: requiere Node ≥ 22.6
  (`--experimental-strip-types`).
- **Shim de culori vs culori real ^4.0.2** (scratch, 3.000-5.000 muestras aleatorias):
  `oklch/oklab` Δ ≤ 3,5e-16 · `interpolate` Δ ≤ 1,4e-12 · `extendPalette` shim vs real Δ ≤ 3,8e-12.
- **`clampChroma` (oklch.util) vs `culori.clampChroma`**: Δ máx 4,8e-5 sobre 5.000 muestras; 0 casos
  por encima de 0.0005.
- **Typecheck**: `npx nuxi typecheck` → solo los 8 errores preexistentes (image-color-picker y
  palette/[id].vue); 0 errores en la layer ni en tsconfig.
- **Estructura**: `__tests__` queda excluida del typecheck (contiene la referencia literal que
  importa 'culori', no es dependencia del proyecto) vía `tsconfig.json`.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `layers/color-palette-creator/utils/palette-generator.util.ts` | Reescrito como port 1:1 (antes: reconstrucción con 14.539 divergencias). Diff completo en `docs/palette-parity-code-diff.diff` |
| `layers/color-palette-creator/utils/__tests__/palette-parity.test.ts` | **Nuevo** — harness de paridad permanente |
| `layers/color-palette-creator/utils/__tests__/reference/pro-color-harmonies/**` | **Nuevo** — copia literal v0.11.0 (12 archivos, md5 verificados) |
| `layers/color-palette-creator/utils/__tests__/reference/pro-color-harmonies/culori-shim.ts` | **Nuevo** — shim validado |
| `docs/palette-parity-report.md` | Este informe |
| `docs/palette-parity-code-diff.diff` | Diff unificado antes/después del generador |
| `tsconfig.json` | Excluye `__tests__` del typecheck (replicando el exclude de nuxi) |
| `package.json` | Script `test:parity` |

Nota: NO se tocó la UI (`color-palette-creator.vue`) ni los estilos, conforme a los límites de la
tarea. El cambio de comportamiento visible es que las paletas ahora son las reales de la librería
(hue-strategies y variations correctas).
