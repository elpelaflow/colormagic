# Informe técnico DEFINITIVO: `pro-color-harmonies` (meodai)
### Lógica completa del generador — basado en el código fuente real (12/12 archivos)

> **Este informe reemplaza al anterior.** La primera versión se armó reconstruyendo el comportamiento desde el README y fuentes secundarias, porque GitHub bloqueaba el acceso automatizado al repo. Esta versión está basada en la lectura directa de **los 12 archivos `.ts` reales** que me pasaste (`constants.ts`, `color.ts`, `hue-strategies.ts`, `variations.ts`, `tintsShades.ts`, `enhancer.ts`, `modifiers.ts`, `palette.ts`, `gamut.ts`, `interpolation.ts`, `demo-palette.ts`, y el `src/index.ts` raíz que faltaba). Cero especulación: cada número, umbral y fórmula de este informe está tomado del código.

---

## 1. Mapa mental: el pipeline completo, extremo a extremo

Esta es la secuencia **real y exacta** que ejecuta `ColorPaletteGenerator.generate(baseColor, paletteType, options)`:

```
1. options = { interpolation: true, ...options }      // interpolation ON por defecto

2. ¿paletteType === 'tintsShades'?
   SÍ → generateTintsAndShades(base, style) directo.
        ⚠️ Este camino NO pasa por los pasos 3-7. Es 100% autónomo.
   NO → sigue el camino normal (pasos 3-7):

3. createPaletteGenerator wrapper (palette.ts):
   a) ¿base.c < 0.002 (achromatic)? 
      SÍ → generateNeutralPalette(base) y CORTA ACÁ. No hay hues, no hay estilo.
      NO → sigue.
   b) style = (style === 'default') ? 'square' : style
   c) enhanced = (style !== 'square')        // 'square' nunca se "mejora"
   d) llama al generador específico del tipo (paso 4)
   e) si enhanced: enhancePalette(colors) → polishPalette(colors)

4. Generador específico (uno de los 5, en el src/index.ts raíz):
   a) hues = getXxxHues(base, style)              // hue-strategies.ts
   b) variations = getXxxVariations(base, style, options.interpolation)  // variations.ts
   c) por cada color: safeColor(hue, l, c, enhanced)
      → si enhanced: aplica avoidMuddyZones (color.ts)
      → si NO enhanced (square): devuelve {l,c,h} crudo, sin tocar

5. [de vuelta en ColorPaletteGenerator.generate]
   result = applyModifiers(palette, modifiers)     // sine→wave→zap→block, EN ESTE ORDEN

6. if (clampToGamut) result = clampPaletteToGamut(result, gamut)  // sRGB o P3

7. return result   // siempre 6 colores OKLCH
```

**Hallazgos clave que esto revela (y que la documentación pública no explicita):**

- **`tintsShades` es un ciudadano de segunda clase, arquitectónicamente**: no pasa por el atajo de acromáticos, ni por `enhancePalette`, ni por `polishPalette`. Tiene su propia lógica interna por estilo (ver §7). Sí recibe `modifiers` y `clampToGamut`, porque esos se aplican *después*, a nivel de `ColorPaletteGenerator.generate`.
- **El sistema de umbrales adaptativos por lightness (0.3/0.7) es universal**: se aplica a **todos** los estilos, incluido `square`. Lo que cambia entre estilos no es *si* hay adaptación por lightness, sino si además hay lógica extra encima (triangle/circle/diamond).
- **`avoidMuddyZones` está condicionado exactamente por `enhanced`**: nunca se ejecuta en estilo `square`/`default`. Los colores "cuadrados" son 100% matemáticos, sin ninguna corrección perceptual.
- **El orden de aplicación es: generar → enhance → polish → modifiers → gamut clamp.** Los modificadores (sine/wave/etc.) actúan sobre la paleta *ya* mejorada y pulida, y el gamut-clamp es siempre el último paso.
- **Colores acromáticos (grises puros, `c < 0.002`) cortocircuitan todo el sistema de armonías** — el hue no tiene sentido para un gris, así que ni siquiera se calcula.

---

## 2. Tipos exactos (`src/index.ts`)

```ts
export interface OKLCH {
  l: number;  // 0 a 1 (puede superar 1 en HDR, aunque el clamp práctico es 0.01-0.99)
  c: number;  // 0 a ~0.4
  h: number;  // 0 a 360
}

export type PaletteStyle = 'default' | 'square' | 'triangle' | 'circle' | 'diamond';
export type PaletteType = 'analogous' | 'complementary' | 'triadic' | 'tetradic' | 'splitComplementary' | 'tintsShades';
export type PaletteColor = OKLCH;

export interface PaletteModifiers {
  sine?: number;
  wave?: number;
  zap?: number;
  block?: number;
  // Rango real: -1 a 1. 0 desactiva el efecto. Negativo INVIERTE la dirección.
}

export interface GeneratorOptions {
  style: PaletteStyle;
  modifiers?: PaletteModifiers;
  interpolation?: boolean;              // default: true
  clampToGamut?: boolean | 'rgb' | 'p3'; // default: sin clamp
}
```

---

## 3. `constants.ts` — los límites duros

```ts
export const OKLCH_LIMITS = {
  l: { min: 0.01, max: 0.99 },   // nunca negro ni blanco puro
  c: { min: 0,    max: 0.37 },   // techo de chroma arbitrario (no es el límite real de gamut, ver §12)
  h: { min: 0,    max: 360 },
};
```

Todo color que sale de cualquier generador pasa, en algún punto, por `clampOKLCH`, que aplica estos límites a `l` y `c` (el `h` se normaliza aparte con `normalizeHue`, nunca se clampea).

---

## 4. `color.ts` — utilidades base

```ts
normalizeHue(hue)              → ((hue % 360) + 360) % 360
clampOKLCH(l, c, h)            → clampea l y c a OKLCH_LIMITS, h queda intacto
```

### `avoidMuddyZones` — exacto, con zonas reales

```ts
const mudZones = [
  { range: [25, 65],   name: 'brown-olive' },   // naranjas/amarillos oscuros
  { range: [100, 140], name: 'sick-green' },    // verdes "enfermizos"
  { range: [180, 200], name: 'corpse-cyan' },   // cian apagado
];
```

Lógica exacta cuando el hue cae dentro de una zona (**las zonas no se solapan; gana el primer match**):

- **Si `chroma < 0.15`** (ya venía apagado): se interpreta como "neutro sofisticado" intencional → **reduce el chroma a la mitad** (`c * 0.5`), deja el hue igual. No lo empuja, asume que el usuario/generador *quería* algo apagado ahí.
- **Si `chroma >= 0.15`** (venía con intensidad, así que probablemente es un accidente matemático, no una intención): **empuja el hue fuera de la zona** — calcula hacia qué borde está más cerca (`pushDirection` según si está antes o después del punto medio de la zona), y lo manda **10° más allá de ese borde** (`escapeMargin = 10`). Además **sube el chroma un 10%** (`c * 1.1`) para "reforzar la fuga" — la idea es que si vas a moverte, que el resultado se vea con más convicción, no menos.

```ts
safeColor(hue, l, c, enhanced)
  → si !enhanced: devuelve { l, c, h: hue } crudo
  → si enhanced: devuelve avoidMuddyZones(hue, l, c)
```

`safeHue` existe pero está **deprecado** (solo devuelve el `.h` de `safeColor`, tirando los ajustes de chroma — el propio código lo marca como incorrecto de usar).

---

## 5. `hue-strategies.ts` — cálculo de hues por estilo

Cinco funciones puras: `getComplementaryHue`, `getAnalogousHues`, `getTriadicHues`, `getTetradicHues`, `getSplitComplementaryHues`. Todas siguen el mismo patrón: un `switch(style)` con una rama por estilo, y `square`/`default` siempre cae al `default:` con la fórmula geométrica pura.

**Patrón general por estilo (constante en las 5 funciones):**

| Style | Cómo decide el ángulo |
|---|---|
| `square` | Rotación fija exacta. Complementario `+180`, triádico `+120/+240`, tetrádico `+90/+180/+270`, split `hue±30` desde el complemento. |
| `triangle` | El círculo de hue se parte en 6-8 **buckets fijos** (ej. `hue < 30`, `hue < 90`, `hue < 150`...) y cada bucket tiene su propio offset o fórmula lineal (`170 + hue*0.3`, etc.). Nunca usa trig, son rectas por tramos. |
| `circle` | Bandas de hue con **funciones trigonométricas** (`sin`, `cos`) para dar variación orgánica, y en algunas bandas el offset depende de `chroma * lightness` (ej. rojo/naranja `30-90°`). Cubre el círculo completo con ramas `if/else if` encadenadas. |
| `diamond` | Condiciones **compuestas** (no solo hue — combina `lightness` y `chroma`): "muy claro y poco saturado", "cálido y claro", "frío y oscuro", "muy saturado y oscuro", más una rama final que sí es una fórmula general (`hue + 180 + (lightness*20-10)` para complementario) que actúa de catch-all. |

### Ejemplo real — `getComplementaryHue`, caso `diamond` (así es la lógica real, no una paráfrasis):

```ts
case 'diamond':
  if (lightness > 0.8 && chroma < 0.3) return normalizeHue(hue + 200);
  if (hue >= 30 && hue < 90 && lightness > 0.6) return 240 + (hue - 30) * 0.3;
  if (hue >= 180 && hue < 240 && lightness < 0.5) return 40 + (hue - 180) * 0.4;
  if (chroma > 0.8 && lightness < 0.4) {
    return hue < 180 ? normalizeHue(hue + 160) : normalizeHue(hue + 200);
  }
  if (hue >= 270 && hue < 330) return 90 + (hue - 270) * 0.6;
  return normalizeHue(hue + 180 + (lightness * 20 - 10));  // catch-all
```

Esto confirma algo importante: **`diamond` no es "un estilo", es literalmente una colección de 5-6 reglas hechas a mano para combinaciones específicas de hue+lightness+chroma**, con un fallback general al final. No hay una "fórmula diamond" única — es una tabla de casos especiales curada por el autor, probablemente a partir de prueba y error visual.

### `getAnalogousHues` — offsets exactos por estilo (referencia rápida)

| Style | Offsets típicos (grados desde el hue base) |
|---|---|
| `square` | `[0, -30, -20, -10, 15, 30]` — fijo siempre |
| `triangle` | Varía por bucket de hue, ej. `[0, -15, -8, 8, 20, 35]` para hue<30 |
| `circle` | Varía por banda de hue, ej. `[0, -20, -10, 8, 18, 30]` para rojo |
| `diamond` | Casos especiales; el catch-all es `[0, -22, -10, 8, 18, 30]` |

(Los 6 valores son offsets de hue en grados; el índice 0 siempre es 0 = el hue base, sin desplazamiento.)

---

## 6. `variations.ts` — el corazón adaptativo (con umbrales reales)

Cinco funciones: `getTriadicVariations`, `getComplementaryVariations`, `getAnalogousVariations`, `getTetradicVariations`, `getSplitComplementaryVariations`. Todas devuelven objetos con forma `{ l: delta, c: multiplicador }` por rol (no valores absolutos — `l` se **suma** a la lightness base, `c` **multiplica** el chroma base).

### 6.1 El sistema de umbrales real (¡no es lo que decía la v1 del informe!)

Hay **dos sistemas de umbral distintos y con distinto ancho de banda**, y **no todos los estilos usan el mismo:**

```ts
// Sistema "default" (usado por square, y como fallback de triangle/circle/diamond
// cuando ninguna condición especial de esos estilos aplica):
l < 0.3  → caso "oscuro"
l > 0.7  → caso "claro"
0.3-0.7  → caso "medio"
// Zona de blend suave: ancho 0.1 centrado en cada umbral → [0.25,0.35] y [0.65,0.75]

// Sistema "triangle" (interno, distinto del anterior):
mod = l < 0.4 ? +X : l > 0.6 ? -X : 0   // un modificador continuo, no 3 categorías
// Zona de blend suave: ancho 0.1 centrado en 0.4 y 0.6 → [0.35,0.45] y [0.55,0.65]
```

El blending se hace con `interpolateDeep(getX(low), getX(high), t)` — una función que recorre recursivamente el objeto de variaciones (que puede tener objetos anidados varios niveles, ej. `triad.first.pure.l`) y aplica `lerp` a **cada número hoja**. Es lo que evita el "salto" al cruzar el umbral.

### 6.2 Hallazgo importante: `circle` y `diamond` NO tienen umbrales suavizados en sus ramas especiales

Mirá la estructura real de `getTriadicVariations`:

```ts
if (style === 'triangle') { /* ... con interpolación suave en 0.4/0.6 ... */ }
else if (style === 'circle') {
  if (hue está en banda roja) return { ...valores fijos... };       // SIN interpolación
  else if (hue está en banda cian/teal) return { ...valores fijos... }; // SIN interpolación
  // si el hue no cae en NINGUNA de las 2 bandas especiales, no hay `return` acá:
  // el control sigue de largo hasta el bloque final
} else if (style === 'diamond') {
  if (muy claro y poco saturado) return { ...valores fijos... };    // SIN interpolación
  else if (muy saturado y oscuro) return { ...valores fijos... };   // SIN interpolación
  // idem: si no matchea, sigue de largo
}

// Bloque final — acá SÍ hay interpolación suave (sistema "default", umbrales 0.3/0.7):
if (interpolate) { /* blend en 0.3/0.7 */ }
return getDefault(baseLightness);
```

**Consecuencia práctica real**: para estilo `circle`, solo 2 bandas de hue (rojo ~345-30° y cian ~150-210°) tienen "magic numbers" curados a mano. **Todo el resto del círculo de hue (la mayoría) usa el sistema `getDefault` genérico** (el mismo que usaría `square`, salvo por el hue en sí, que sí es distinto porque viene de `hue-strategies.ts`). Mismo patrón para `diamond`: solo 2 combinaciones especiales de lightness+chroma están curadas; todo lo demás cae al default. Y esas 2 bandas curadas de `circle`/`diamond` **no tienen suavizado de umbral** — si el hue base cruza de 29.9° a 30.1°, ahí sí puede haber un salto perceptible (a diferencia de lo que sugiere el marketing de "sin saltos" del proyecto, que aplica al eje de *lightness*, no al eje de *hue*).

### 6.3 Tabla completa de umbrales de `l < 0.3` / `l > 0.7` (sistema default, triádico, como ejemplo representativo)

| Caso | `base.dark` | `triad.first.pure` | `triad.first.muted` | `triad.second.pure` | `triad.second.muted` |
|---|---|---|---|---|---|
| `l < 0.3` (oscuro) | `l:max(-0.1, 0.15-l), c:1.0` | `l:0.2, c:0.95` | `l:0.35, c:0.7` | `l:0.15, c:0.95` | `l:0.3, c:0.7` |
| `l > 0.7` (claro) | `l:max(-0.4, 0.15-l), c:1.1` | `l:-0.2, c:0.95` | `l:-0.35, c:0.7` | `l:-0.25, c:0.95` | `l:-0.15, c:0.7` |
| medio | `l:-0.2, c:1.1` | `l:0.1, c:0.95` | `l:0.2, c:0.7` | `l:-0.1, c:0.95` | `l:-0.2, c:0.7` |

Lectura: para una base oscura, el "dark" companion casi no puede bajar más lightness (`max(-0.1, ...)` — se protege contra ir a negro puro), pero para una base clara sí puede bajar mucho (`max(-0.4, ...)`). Los "pure" del triádico suelen tener `c` cerca de 0.95-1.0 (casi sin recortar chroma) y los "muted" bajan a 0.6-0.7 — ese contraste pure/muted es el mecanismo real detrás de lo que en la v1 del informe describí como "6 colores con roles" — ahora con los números exactos.

*(Las tablas equivalentes para `complementary`, `analogous`, `tetradic` y `splitComplementary` siguen la misma filosofía — base protegido de irse a negro/blanco puro, "pure" con chroma alto, "muted"/"dark" con chroma reducido. Si necesitás las 4 tablas completas número por número te las paso aparte para no duplicar 600 líneas acá.)*

---

## 7. `tintsShades.ts` — la escala de 6 pasos (100% autónoma)

```ts
const lightnessProgression = [0.02, 0.25, 0.38, 0.62, 0.84, 0.98];
// Abismo, Sombra, Medio-oscuro, Medio-claro, Brillante, Blanco
```

El color base se **inserta en el slot más cercano** de esta progresión (no se agrega como 7mo elemento): se calcula qué slot tiene el `l` más próximo al `l` de la base, y ese slot pasa a ser exactamente el color base, **clampeado entre sus vecinos** para que la rampa siga siendo monótona (`Math.min(Math.max(lightness, lower), upper)`). Los otros 5 slots se calculan con lógica por estilo:

| Style | Qué hace, exacto |
|---|---|
| `square` | Nada. Mismo chroma y hue en todos los pasos — pura sustitución del valor de `l`. |
| `triangle` | **Doble corrección perceptual real:**<br>1. **Chroma asimétrico**: si el paso es más oscuro que la base, `chromaMult = 1 + \|Δl\|*0.4` (los oscuros aguantan más chroma); si es más claro, `chromaMult = max(0.2, 1 - \|Δl\|*0.8)` (los claros se desaturan rápido).<br>2. **Bezold-Brücke**: `cos((hue-90)·π/180) · Δl · 4`, clampeado a ±4°. El drift de hue peakea cerca del amarillo (90°) y se invierte cerca del azul (270°) — literalmente modela el efecto óptico real.<br>3. **Abney**: `sin((hue-30)·π/180) · (1-chromaMult) · 15`, clampeado a ±2°. Shift de hue proporcional a cuánto se desaturó, más fuerte en el eje rojo/cian. |
| `circle` | Curva de chroma que sube en las sombras: `boost = darkness^1.5 · 0.8 + 0.2` (donde `darkness = 1 - targetL`), `chroma_final = chroma_base · boost · 1.2`. Los oscuros son ricos, los claros se desvanecen ("etéreos"). Shift de hue mínimo: `(targetL - 0.5) * 10`. |
| `diamond` | **Simula mezclar con pintura real** en vez de solo cambiar lightness:<br>- Hacia oscuro (mezclar con negro): `shadeFactor = (baseL - targetL) / baseL`, `chroma = lerp(shadeFactor, chroma, chroma*0.5)` — pierde hasta la mitad del chroma.<br>- Hacia claro (mezclar con blanco): `tintFactor = (targetL - baseL) / (1 - baseL)`, `chroma = lerp(tintFactor, chroma, 0)` — se desatura del todo al acercarse al blanco puro. |

Esta es, con diferencia, **la función con más ciencia perceptual real** de todo el proyecto — Bezold-Brücke y Abney son efectos ópticos documentados, no metáforas de marketing.

---

## 8. Los 5 ensambladores (`src/index.ts`) — cómo se arman los 6 colores finales

Todos usan `createPaletteGenerator(tipo, fn)` de `palette.ts` (que aporta el atajo acromático + enhance/polish). La función interna de cada uno solo tiene que devolver los 6 `OKLCH`.

### `generateComplementary` — con `chromaAdjust = 0.9` global
```
[0] base tal cual (l, c, h originales)
[1] complemento "main"     → safeColor(complementHue, l+compVars.main.l,   c*compVars.main.c*0.9, enhanced)
[2] base "dark"            → safeColor(baseHue,        l+baseVars.dark.l,  c*baseVars.dark.c*0.9,  enhanced)
[3] base "light"           → safeColor(baseHue,        l+baseVars.light.l, c*baseVars.light.c*0.9, enhanced)
[4] complemento "light"    → safeColor(complementHue,  l+compVars.light.l, c*compVars.light.c*0.9, enhanced)
[5] complemento "muted"    → safeColor(complementHue,  l+compVars.muted.l, c*compVars.muted.c*0.9, enhanced)
```
El `* 0.9` es un amortiguador de chroma que **solo existe en `complementary` y `analogous`** — ninguno de los otros 3 generadores lo tiene. Es un ajuste manual del autor, probablemente porque complementarios/análogos sin ese freno se veían "demasiado gritones".

### `generateAnalogous` — con el mismo `chromaAdjust = 0.9`
```
[0] = analogousHues[0] es SIEMPRE hue base → color = base tal cual
[1..5] = safeColor(analogousHues[i], l + variations[i].l, c * variations[i].c * 0.9, enhanced)
```

### `generateTriadic` — sin amortiguador, estructura 1+1+2+2
```
[0] base tal cual
[1] "base dark" — MISMO HUE que la base (triadicHues[0] === baseHue), solo cambia l y c
[2] triad1 "pure"   → safeColor(triadicHues[1], l+first.pure.l,  c*first.pure.c,  enhanced)
[3] triad1 "muted"  → safeColor(triadicHues[1], l+first.muted.l, c*first.muted.c, enhanced)
[4] triad2 "pure"   → safeColor(triadicHues[2], l+second.pure.l, c*second.pure.c, enhanced)
[5] triad2 "muted"  → safeColor(triadicHues[2], l+second.muted.l,c*second.muted.c,enhanced)
```

### `generateTetradic` — sin amortiguador, estructura 1+2+1+2
```
[0] base tal cual
[1] hue1 "pure"
[2] hue1 "muted"
[3] hue2 "complement" (una sola variante, no pure/muted)
[4] hue3 "light"
[5] hue3 "dark"
```

### `generateSplitComplementary` — sin amortiguador, estructura 1+1+2+2
```
[0] base tal cual
[1] "base dark" — mismo hue que la base
[2] split1 "pure"
[3] split1 "muted"
[4] split2 "pure"
[5] split2 "muted"
```

**Patrón que se repite en triadic/tetradic/splitComplementary**: siempre hay un color "puro" (chroma cerca de 0.9-1.0× el original) y un color "muted" (chroma cerca de 0.6-0.7×) por cada hue secundario — ese contraste pure/muted, no la cantidad de hues, es lo que le da variedad tonal a la paleta con solo 2-3 hues de base.

---

## 9. `ColorPaletteGenerator` — la clase orquestadora

```ts
static generate(baseColor, paletteType, options): PaletteColor[] {
  const baseOptions = { interpolation: true, ...options };  // interpolation ON por default
  
  // dispatch según paletteType (switch con los 6 casos)
  let palette = /* generador correspondiente, o generateTintsAndShades directo */;
  
  const result = applyModifiers(palette, baseOptions.modifiers);
  
  if (baseOptions.clampToGamut) {
    const gamut = baseOptions.clampToGamut === true ? 'rgb' : baseOptions.clampToGamut;
    return clampPaletteToGamut(result, gamut);
  }
  return result;
}

static generateAll(baseColor, options): Record<PaletteType, PaletteColor[]> {
  // llama a generate() 6 veces, una por cada PaletteType, con las mismas options
}
```

**Detalle menor pero real**: el objeto de conveniencia `generators` (exportado para uso directo) **incluye solo 5 de las 6 funciones** — `tintsShades` queda afuera porque su firma es distinta (`(base, style)` en vez de `(base, options)`), así que no encaja en el mismo objeto.

---

## 10. `enhancer.ts` — Chroma Narratives + Color Hierarchy (tablas completas)

Se aplican **juntos, siempre**, para cualquier estilo que no sea `square` (triangle, circle, diamond por igual — no hay un estilo que use solo narrativa o solo jerarquía, contrario a lo que sugería la v1 del informe).

### `getChromaNarrative(paletteType, style)` — multiplicador de chroma por posición (índice 0-5)

Tabla completa (`pattern` = 6 multiplicadores por índice; `breathingRoom` = si aplica compresión de lightness alternada):

| paletteType | square | triangle | circle | diamond |
|---|---|---|---|---|
| **analogous** | `[.8,.9,1,1,.9,.8]` bR:✓ | `[.7,1,.85,1,.75,.6]` bR:✓ | `[.6,.9,1,1,1.1,.8]` bR:✗ | `[.8,.7,1,.9,1.1,.6]` bR:✓ |
| **complementary** | `[1,.9,.7,.6,.8,.5]` bR:✓ | `[1,.85,.6,.5,.75,.4]` bR:✓ | `[1,1.1,.8,.6,.9,.5]` bR:✗ | `[1,.9,.7,.5,.8,.4]` bR:✓ |
| **splitComplementary** | `[1,.8,.9,.7,.85,.6]` bR:✓ | `[1,.7,.95,.6,.8,.5]` bR:✓ | `[1,.9,1.1,.8,.9,.7]` bR:✗ | `[1,.8,.9,.7,.85,.65]` bR:✓ |
| **triadic** | `[1,.8,.9,.85,.9,.7]` bR:✓ | `[1,.75,.95,.7,.85,.6]` bR:✓ | `[1,.9,1.1,.8,.95,.75]` bR:✗ | `[1,.8,.9,.7,.85,.65]` bR:✓ |
| **tetradic** | `[1,.8,.7,.9,.75,.6]` bR:✓ | `[1,.7,.6,.85,.65,.5]` bR:✓ | `[1,.9,.8,1,.85,.7]` bR:✗ | `[1,.8,.6,.9,.7,.5]` bR:✓ |

**Patrón consistente**: `circle` es el único estilo con `breathingRoom: false` en todos los casos, y es el único que a veces sube el multiplicador por encima de 1.0 (más intenso que el original) — coherente con su rol de estilo "emocional/expresivo". `triangle` es sistemáticamente el más conservador (multiplicadores más bajos), coherente con ser el más "perceptualmente cauteloso".

### `getColorHierarchy(paletteType)` — roles fijos por posición (⚠️ **ignora el parámetro `style`** — el propio código lo marca `_style` sin usar)

| paletteType | Roles (índice 0→5) |
|---|---|
| **analogous** | supporting(.8,-.05) → accent(1,.02) → protagonist(1,0) → protagonist(.95,0) → deuteragonist(.9,.03) → background(.6,.08) |
| **complementary** | protagonist(1,0) → deuteragonist(.95,.05) → supporting(.8,-.1) → neutral(.5,-.05) → supporting(.7,.08) → background(.4,-.08) |
| **splitComplementary** | protagonist(1,0) → supporting(.9,-.08) → deuteragonist(.85,.03) → neutral(.6,-.05) → accent(.8,.05) → background(.5,.08) |
| **triadic** | protagonist(1,0) → supporting(.9,-.1) → deuteragonist(.85,.05) → neutral(.65,.08) → accent(.8,.02) → background(.6,-.05) |
| **tetradic** | protagonist(1,0) → deuteragonist(.85,.02) → neutral(.6,-.05) → supporting(.8,0) → accent(.75,.05) → background(.7,-.08) |

*(formato: `rol(chromaMultiplier, lightnessShift)`)*

### Cómo se combinan (código real de `enhancePalette`)

```ts
newL = color.l + role.lightnessShift;
newC = color.c * role.chromaMultiplier * narrativeFactor;   // ¡se multiplican los DOS factores!

// "Breathing room": solo si narrative.breathingRoom es true, solo en índices impares
if (narrative.breathingRoom && index % 2 !== 0) {
  newL += (newL > 0.5 ? -0.05 : 0.05);   // empuja hacia el centro (0.5), no hacia afuera
}
```

Es decir: el chroma final de cada color recibe **dos multiplicadores independientes en cascada** (rol de jerarquía × posición narrativa), y el color base (`index === baseColorIndex`, casi siempre 0) queda **siempre intacto**, sin tocar.

### `polishPalette` — anti-gris-muerto, exacto

```ts
// 1. Grises muertos en tonos medios
if (c < 0.05 && l > 0.2 && l < 0.8) c = Math.max(0.08, c * 2);

// 2. Highlights sin vida
if (l > 0.85 && c < 0.04) c = 0.04;
```

Ambas correcciones **saltean el color base** (igual que `enhancePalette`). Son pisos absolutos, no multiplicadores — garantizan un mínimo de "vida" sin importar qué tan chato haya salido el cálculo previo.

---

## 11. `modifiers.ts` — las 4 fórmulas exactas

Todos reciben `(palette, modifier)` con `modifier` en **-1 a 1**, y se aplican en `applyModifiers` en orden fijo `sine → wave → zap → block`, solo si el valor es *truthy* (o sea, `0` se saltea).

### Sine
```ts
hueIntensity = modifier * 45;
lightnessIntensity = modifier * 0.15;

wavePosition = (idx / (len-1)) * 2π;
fundamental = sin(wavePosition + modifier * 1);
harmonic = sin(wavePosition * 2 + modifier * 0.5) * 0.3;   // 2° armónico, 30% de amplitud
sineValue = fundamental + harmonic;

hueShift = sineValue * hueIntensity;
lightnessShift = sin(wavePosition * 1.5 + modifier * 0.8) * lightnessIntensity;
```
No es un seno simple: combina una **fundamental + un segundo armónico** para el hue, y una **tercera onda independiente** (frecuencia 1.5×) para lightness — y el propio `modifier` desfasa las ondas, no solo escala su amplitud.

### Wave (mapa logístico)
```ts
chaosLevel = 2.0 + modifier * 1.2;   // rango real ≈ 0.8 a 3.2
hueRange = modifier * 120;
lightnessRange = modifier * 0.35;

x = 0.2 + (idx/len) * 0.6 + sin(idx * 0.7) * 0.15;   // semilla por índice
for (8 iteraciones): x = chaosLevel * x * (1 - x);    // mapa logístico
smoothedX = x * 0.85 + 0.5 * 0.15;                    // atenúa 15% hacia el centro

hueShift = (smoothedX - 0.5) * hueRange;
lightnessShift = (smoothedX - 0.5) * lightnessRange;
chromaMultiplier = 0.4 + smoothedX * 1.2;              // rango 0.4 a 1.6
```
**Nota técnica honesta**: el mapa logístico `x = r·x·(1-x)` es matemáticamente caótico recién para `r` entre ~3.57 y 4. Acá `chaosLevel` tope es 3.2 (con `modifier = 1`), que está en zona de **period-doubling**, no caos completo — el nombre "chaotic map" es más aspiracional que estrictamente cierto, pero el efecto visual (irregular, no-periódico a simple vista, acotado) cumple igual.

### Zap (espiral)
```ts
spiralTightness = 0.2 + |modifier| * 1.0;   // siempre positivo (Math.abs)
maxHueShift = modifier * 90;                 // este sí cambia de signo

normalizedPos = idx / (len-1);
angle = normalizedPos * spiralTightness * 2π;
radius = sqrt(normalizedPos) * 2;            // el radio crece con la raíz de la posición

spiralX = cos(angle) * radius;
spiralY = sin(angle) * radius;

hueShift = spiralX * maxHueShift;
lightnessShift = spiralY * 0.12 * modifier;
chromaShift = sin(angle * 1.5) * 0.08 * modifier;
```
Es una espiral de Arquímedes aplanada sobre el índice del array (no sobre coordenadas de pantalla) — el radio crece con `sqrt(pos)`, así que los primeros colores del array están "más apretados" al centro de la espiral y los últimos más desplegados.

### Block (onda triangular)
```ts
lightnessAmplitude = modifier * 0.25;
hueAmplitude = modifier * 30;
chromaAmplitude = modifier * 0.1;

frequency = max(1, floor(len / 8));          // más "bloques" repetidos en paletas largas
wavePosition = (idx/(len-1)) * π * frequency;

rawTriangle = (2/π) * asin(sin(wavePosition));    // onda triangular EXACTA, rango -1..1
softTriangle = rawTriangle * (1 - |rawTriangle| * 0.3);  // redondea el 30% de los picos

lightnessShift = softTriangle * lightnessAmplitude;
hueShift = sin(wavePosition + π/4) * rawTriangle * hueAmplitude;   // combinado, no puro
chromaShift = cos(wavePosition + π/2) * rawTriangle * chromaAmplitude;
```
El truco `asin(sin(x))` es la forma matemáticamente exacta de generar una onda triangular sin usar `if`/módulo — vale la pena robárselo si vas a implementar algo similar.

---

## 12. `gamut.ts` — clamp real vía Culori

```ts
clampColorToGamut(color, gamut = 'rgb') {
  const clamped = clampChroma({ mode:'oklch', l, c, h }, 'oklch', gamut);
  return { l: clamped.l ?? l, c: clamped.c ?? 0, h: clamped.h ?? h };
}
```
Usa directamente `clampChroma` de Culori — no reinventa el gamut-mapping, delega en la librería. `gamut` es `'rgb'` (sRGB) o `'p3'` (Display P3). Esto confirma por qué `OKLCH_LIMITS.c.max = 0.37` es un techo arbitrario y no el límite real de gamut: el límite real depende de `l` y `h` juntos (cerca del blanco, sRGB banca ~0.03 de chroma, no 0.37), por eso existe este paso separado.

---

## 13. `interpolation.ts` — utilidades genéricas

- **`lerp(amt, from, to)`**: `from + amt*(to-from)`, la base de todo.
- **`lerpColor`**: interpola 2 colores de Culori pasando ambos a OKLAB primero.
- **`lerpOKLCH`**: interpola l/c linealmente, pero el **hue toma el camino más corto** alrededor del círculo (si la diferencia es >180° o <-180°, la corrige antes de interpolar) — evita que interpolar de 350° a 10° pase "por el medio" (por 180°) en vez de cruzar directo por 0°.
- **`interpolateDeep`**: recorre recursivamente objetos/arrays y aplica `lerp` a cada número hoja. Es el motor genérico detrás del blending de umbrales en `variations.ts`.
- **`scaleSpreadArray(values, targetSize, padding=0, fillFunction=lerp)`**: utilidad de expansión de arrays **con dos algoritmos**:
  - `padding = 0`: algoritmo de "chunks" — reparte los slots extra necesarios entre los huecos consecutivos del array original de forma round-robin (`idx % (len-1)`), interpola dentro de cada chunk.
  - `padding > 0`: algoritmo "estilo chroma.js" — encoge el dominio 0-1 efectivo hacia adentro (`domainStart = padding`, `domainEnd = 1-padding`) antes de mapear, así los extremos del array resultante no tocan los valores extremos originales. **Este parámetro `padding` no está documentado en ningún lado del README público** — es una feature "escondida" para quien lea el código.

Importante: **esta función NO es la que usa la demo para expandir a >6 colores** (esa es `extendPalette` en `demo-palette.ts`, que usa Culori/OKLAB directamente). `scaleSpreadArray` es de propósito general, sin dependencia de Culori, disponible para cualquier tipo interpolable.

---

## 14. `demo-palette.ts` — solo para la demo

```ts
extendPalette(basePalette, targetCount) {
  if (targetCount <= basePalette.length) {
    // DOWN-sampling por índice (no interpolación): 
    step = basePalette.length / targetCount;
    index = min(floor(i * step), basePalette.length - 1);
    // simplemente TOMA el color más cercano, no mezcla nada
  } else {
    // UP-sampling: interpolación multi-stop en OKLAB vía Culori
    interpolator = culori.interpolate(baseColors, 'oklab');
    // muestrea targetCount puntos equiespaciados con t = i/(targetCount-1)
  }
}
```

**Hallazgo no documentado**: el archivo también exporta `createPieChartSvg(colors)` — genera un SVG de gráfico de torta (con un "donut hole" blanco en el centro) a partir de un array de colores hex. No aparece mencionado en el README público ni en la descripción de la demo que pude relevar — probablemente una vista alternativa experimental o descartada de la demo (o usada en alguna sección puntual que no llegué a ver en la captura del sitio). Si tu objetivo es replicar "lo mismo que hace la demo", este es un extra opcional, no crítico.

---

## 15. `palette.ts` — el wrapper que ata todo

```ts
export const ACHROMATIC_CHROMA_THRESHOLD = 0.002;

isAchromatic(color) → color.c < 0.002

generateNeutralPalette(base) {
  const ramp = [0.2, 0.35, 0.5, 0.65, 0.8, 0.95];
  // encuentra el slot de la rampa más cercano al l de la base
  // devuelve: [ base_tal_cual, ...resto_de_la_rampa_sin_ese_slot ]
  // (el h y c de TODOS los colores extra = los del base, o sea casi-cero chroma)
}

createPaletteGenerator(paletteType, generatorFn) → (baseColor, options) => {
  const base = { l, c, h: h||0 };
  if (isAchromatic(base)) return generateNeutralPalette(base);   // atajo total

  const style = resolvePaletteStyle(options.style);   // default→square
  const enhanced = style !== 'square';
  const colors = generatorFn(base, {...options, style}, enhanced);

  if (enhanced) return polishPalette(enhancePalette(colors, paletteType, style));
  return colors;
}
```

Para colores grises (`c < 0.002`, ej. cualquier gris puro tipo `#808080`), **no hay armonía posible** — el hue es matemáticamente indefinido/irrelevante — así que directamente se devuelve una rampa de grises con la misma micro-chroma/hue del original, con la base insertada en su posición correspondiente. Es el único de los 6 tipos de paleta (salvo `tintsShades`, que no pasa por acá) que tiene este atajo — y es un detalle de robustez que vale la pena copiar: **nunca asumas que el usuario te va a dar un color con saturación; contemplá el caso gris desde el día 1.**

---

## 16. Errata: correcciones respecto al informe v1 (para que sepas qué cambió)

| # | v1 decía (reconstruido de docs) | Realidad (código real) |
|---|---|---|
| 1 | Modificadores en rango "0 a 1" (luego corregido a "-1 a 1" citando README) | Confirmado: **-1 a 1**, `0` = off, negativo invierte dirección. Correcto en la versión final de v1. |
| 2 | El sistema de umbral suave (0.3/0.7) parecía ser "la innovación central", sin más detalle | Confirmado y **más rico de lo que parecía**: hay 2 sistemas de umbral distintos (default en 0.3/0.7, triangle interno en 0.4/0.6), y **circle/diamond solo tienen 2 casos especiales cada uno**, sin suavizado — todo lo demás cae al sistema default. |
| 3 | "Chroma Narratives es de triangle, Color Hierarchy es de circle" | **Falso.** Ambos mecanismos se aplican **siempre juntos** para cualquier estilo no-square. `getColorHierarchy` ni siquiera mira el parámetro `style`. |
| 4 | No se mencionaba el atajo para colores acromáticos (grises) | **Existe y es central**: `c < 0.002` → paleta de grises dedicada, se salta toda la lógica de hue. |
| 5 | Se asumía que `tintsShades` pasaba por el mismo pipeline que los otros 5 tipos | **Falso.** `tintsShades` es 100% autónomo: no pasa por el atajo acromático, ni por enhance, ni por polish. Sí recibe `modifiers` y `clampToGamut` (aplicados a nivel `ColorPaletteGenerator`, no a nivel del generador). |
| 6 | `avoidMuddyZones` parecía aplicarse "sobre todo en triangle" | Exacto: se aplica en **cualquier estilo no-square** vía el flag `enhanced`, no es específico de triangle. |
| 7 | No se conocía el amortiguador `chromaAdjust = 0.9` | Existe, y **solo en `complementary` y `analogous`** — ninguno de los otros 3 generadores lo usa. |
| 8 | No se conocía el orden exacto modifiers→gamut | Confirmado: **generar → enhance → polish → modifiers → gamut clamp**, en ese orden, siempre. |
| 9 | Zonas "muddy" descritas en términos generales | Rangos exactos: `[25,65]` brown-olive, `[100,140]` sick-green, `[180,200]` corpse-cyan, con lógica de escape de 10° + boost de chroma 1.1×, o atenuación 0.5× si ya venía apagado. |
| 10 | No se sabía si `generators` incluía los 6 tipos | Incluye solo **5** — `tintsShades` queda afuera por tener firma distinta. |

---

## 17. Guía actualizada para replicar esto en tu proyecto (ahora con precisión real)

Con el código real confirmado, esta es la receta concreta, en orden de implementación:

1. **Modelo de color**: `{ l, c, h }` en OKLCH. Librería recomendada: Culori (que es la que usa este proyecto) o Color.js.
2. **Atajo de acromáticos primero**: antes de cualquier lógica de armonía, chequeá `c < 0.002` (o el umbral que definas) y andá directo a una rampa de grises. Te ahorra bugs raros con hues indefinidos.
3. **Hue-strategies como funciones puras** `(base, style) => hue | hue[]`. Empezá con `square` (rotaciones fijas: complementario `+180`, triádico `+120/+240`, tetrádico `+90/180/270`) — funciona bien y es tu baseline de testing.
4. **Variations como funciones puras** `(base, style, interpolate) => { l: delta, c: multiplicador }` por rol. Arrancá con un solo sistema de umbral (`l<0.3` / `l>0.7` / medio) aplicado universalmente — no necesitás un sistema por estilo desde el día 1, este proyecto mismo usa esa estrategia de fallback para la mayoría de los casos de `circle`/`diamond`.
5. **Blend suave en los bordes del umbral** con una función `interpolateDeep` genérica (recorre el objeto de variaciones y hace `lerp` en cada hoja numérica) — esto es barato de implementar y es lo que más se nota si lo omitís (los saltos al mover un slider son muy visibles).
6. **`safeColor` gateado por estilo**: solo aplicá corrección de "zonas feas" (definí las tuyas, no hace falta copiar las de acá) cuando el estilo no sea el "matemático puro" — así siempre tenés un modo 100% predecible para debug/testing.
7. **Enhance + Polish como pasos separados y opcionales**, aplicados después de generar los 6 colores crudos: un multiplicador de chroma por "rol" (protagonista/soporte/fondo) + un piso mínimo de chroma para evitar grises muertos en post. Guardá siempre el índice del color base para nunca tocarlo.
8. **Modificadores como funciones puras sobre `(array, intensity)`**, aplicados en un orden fijo, después de enhance/polish. El truco `(2/π)·asin(sin(x))` para onda triangular exacta y el mapa logístico con "burn-in" de 8 iteraciones son técnicas reutilizables tal cual, no son específicas de este dominio.
9. **Gamut-clamp al final de todo**, justo antes de convertir a hex, delegando en tu librería de color (`clampChroma` de Culori si la usás) — nunca lo hagas manualmente recortando canales RGB.
10. **`tintsShades` como función completamente separada**, no forzada a pasar por el mismo pipeline genérico que las armonías multi-hue — tiene su propia lógica (una rampa de lightness fija con un color insertado en su slot más cercano) y beneficia de tener su propio código dedicado en vez de reusar el genérico a la fuerza.

---

## 18. Resumen ejecutivo actualizado

1. Pipeline real: `achromatic-check → style-resolve → hue-strategy → variations(+blend suave) → safeColor(muddy-zones si enhanced) → enhance+polish(si enhanced) → modifiers(orden fijo) → gamut-clamp`.
2. `tintsShades` **no** sigue este pipeline — es autónomo, con su propia física perceptual (Bezold-Brücke, Abney, mezcla simulada con blanco/negro).
3. El sistema adaptativo por lightness (`0.3/0.7`) es **universal**; los estilos `circle`/`diamond` solo agregan 2 casos especiales cada uno encima, sin blend suave en esos casos puntuales.
4. `enhancePalette` combina **siempre** narrativa de chroma (por posición) + jerarquía de roles (por tipo de paleta, no por estilo) — nunca uno sin el otro.
5. Los colores grises puros (`c < 0.002`) tienen su propio camino dedicado, evitando matemática de hue sin sentido.
6. Los 4 modificadores son fórmulas matemáticas concretas y reutilizables (dos armónicos senoidales, mapa logístico con burn-in, espiral de Arquímedes sobre el índice, onda triangular exacta vía `asin(sin(x))`), aplicadas siempre en el mismo orden y siempre después del enhance/polish.
7. El gamut-clamp es un paso final y opcional, delegado en Culori, nunca hecho a mano.
