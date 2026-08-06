/**
 * Color Token Extractor — core de extracción.
 *
 * Portado conceptualmente del mecanismo de dembrandt (https://github.com/dembrandt/dembrandt, MIT):
 * - Filtros de ruido de CSS custom properties (dumps de frameworks, utilidades Tailwind
 *   no-color, paletas default de frameworks).
 * - Parser de colores CSS Color Level 4 (hex, rgb/hsl/hwb, lab/lch D50, oklab/oklch,
 *   color() con espacios predefinidos y nombres de color comunes).
 *
 * Diferencia deliberada con dembrandt: aquí los tokens SEMÁNTICOS (--error-*, --success-*)
 * SÍ se conservan (clasificados como tipo 'semantic'). Dembrandt los descarta porque arma un
 * "brand book"; esta tool es un extractor de tokens, donde los tokens de estado son justo
 * los más valiosos.
 *
 * Otra decisión consciente (heredada del bias "brand book" de dembrandt): se filtran los
 * namespaces de frameworks/design systems completos (--ant-, --el-, --chakra-, --mantine-,
 * --p-, --bs-, --wp--preset...) porque son internals del framework, no tokens de marca.
 * Si a futuro querés extraerlos (ej. para un tema de Ant Design), hay que quitar los
 * prefijos de NOISE_PREFIXES.
 *
 * El código corre server-side (Nitro) — sin dependencias, sin DOM.
 */

export type TokenType = 'brand' | 'semantic' | 'custom';
export type TokenScope = 'root' | 'scoped';

export interface ColorToken {
  /** Nombre del token, ej. --color-primary */
  name: string;
  /** Valor declarado original, ej. #1a2b3c o var(--other) */
  value: string;
  /** Hex #rrggbb resuelto, o null si no se pudo resolver */
  hex: string | null;
  type: TokenType;
  scope: TokenScope;
}

export interface TokenExtractorResult {
  /** URL analizada */
  url: string;
  /** <title> del sitio */
  title: string | null;
  /** meta theme-color (valor crudo) */
  themeColor: string | null;
  /** meta theme-color resuelto a hex */
  themeColorHex: string | null;
  /** URL absoluta del favicon */
  favicon: string | null;
  /** Tokens extraídos y filtrados */
  tokens: ColorToken[];
  /** Paleta derivada: colores únicos con su frecuencia entre tokens */
  palette: { hex: string; count: number; names: string[] }[];
  /** Cantidad de fuentes CSS analizadas (inline + externas) */
  cssSources: number;
}

// ---------------------------------------------------------------------------
// Parser CSS de custom properties
// ---------------------------------------------------------------------------

interface CssRule {
  selector: string;
  declarations: { name: string; value: string }[];
  rules: CssRule[];
}

/**
 * Parseo de CSS a un árbol de reglas. Antes de contar llaves se descartan
 * strings y url() para no romper el balance por SVG data-URI u otros valores
 * con llaves adentro.
 */
function parseCssRules(css: string): CssRule[] {
  let cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/url\(\s*(['"]?)[^)]*\1\s*\)/gi, 'url()');
  cleaned = cleaned.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  cleaned = cleaned.replace(/'(?:[^'\\]|\\.)*'/g, "''");

  const roots: CssRule[] = [];
  const stack: { rule: CssRule; isKeyframes: boolean }[] = [];
  let buffer = '';

  const pushDeclaration = (frame: { rule: CssRule } | undefined, decl: string) => {
    if (!decl || !frame) return;
    const sep = decl.indexOf(':');
    if (sep === -1) return;
    const name = decl.slice(0, sep).trim();
    const value = decl.slice(sep + 1).trim();
    if (name) {
      // Se guardan todas; el filtro de custom properties ocurre en
      // collectDeclarations (para poder leer initial-value de @property).
      frame.rule.declarations.push({ name, value });
    }
  };

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '{') {
      const selector = buffer.trim();
      buffer = '';
      const rule: CssRule = { selector, declarations: [], rules: [] };
      const parent = stack[stack.length - 1];
      if (parent) {
        parent.rule.rules.push(rule);
      } else {
        roots.push(rule);
      }
      const isKeyframes = /^@keyframes/.test(selector);
      stack.push({
        rule,
        isKeyframes: parent ? parent.isKeyframes || isKeyframes : isKeyframes
      });
    } else if (ch === '}') {
      const frame = stack.pop();
      pushDeclaration(frame, buffer.trim());
      buffer = '';
    } else if (ch === ';') {
      const frame = stack[stack.length - 1];
      pushDeclaration(frame, buffer.trim());
      buffer = '';
    } else {
      buffer += ch;
    }
  }
  return roots;
}

const ROOT_SELECTOR = /(^|,)\s*(?::root|html|\*|body)\s*(?:,|$)/;

function isRootSelector(selector: string): boolean {
  return ROOT_SELECTOR.test(selector.toLowerCase());
}

function collectDeclarations(
  rules: CssRule[],
  isKeyframes: boolean,
  out: { name: string; value: string; scope: TokenScope }[]
): void {
  for (const rule of rules) {
    const kf = isKeyframes || /^@keyframes/.test(rule.selector);

    // @property --foo { syntax: ...; initial-value: #fff } declara un token.
    const propMatch = rule.selector.match(/^@property\s+(--[\w-]+)/);
    if (propMatch && !kf) {
      const initial = rule.declarations.find(d => d.name === 'initial-value');
      if (initial && isColorValue(initial.value)) {
        out.push({ name: propMatch[1], value: initial.value, scope: 'root' });
      }
    }

    if (!kf) {
      const scope: TokenScope = isRootSelector(rule.selector) ? 'root' : 'scoped';
      for (const d of rule.declarations) {
        if (!d.name.startsWith('--')) continue;
        if (d.name === 'initial-value') continue;
        out.push({ name: d.name, value: d.value, scope });
      }
    }

    collectDeclarations(rule.rules, kf, out);
  }
}

// ---------------------------------------------------------------------------
// Filtros de ruido (portados de dembrandt lib/extractors/colors.ts)
// ---------------------------------------------------------------------------

/** Prefijos de dumps de frameworks que no son tokens de marca. */
const NOISE_PREFIXES = [
  '--wp--preset', '--el-', '--p-', '--chakra-', '--mantine-', '--ant-',
  '--bs-', '--swiper-', '--rsbs-', '--toastify-'
];

/** Utilidades Tailwind/Bootstrap no-color (sombras, transforms, blur...). */
const NOISE_UTILITIES = [
  '--tw-ring-offset-width', '--tw-ring-offset', '--tw-shadow', '--tw-blur',
  '--tw-brightness', '--tw-contrast', '--tw-grayscale', '--tw-hue-rotate',
  '--tw-invert', '--tw-saturate', '--tw-sepia', '--tw-drop-shadow',
  '--tw-translate-x', '--tw-translate-y', '--tw-translate-z',
  '--tw-rotate', '--tw-skew-x', '--tw-skew-y',
  '--tw-scale-x', '--tw-scale-y', '--tw-scale-z',
  '--tw-gradient-from-position', '--tw-gradient-via-position', '--tw-gradient-to-position',
  '--tw-gradient-from', '--tw-gradient-via', '--tw-gradient-to',
  '--tw-scrollbar-', '--tw-divide-', '--tw-space-',
  '--bs-gutter', '--bs-border-spacing'
];

/** Paletas default de frameworks: --colors-red-500, --tw-colors-blue-800, etc. */
const FRAMEWORK_PALETTE =
  /^--(?:tw-)?colors?-(?:slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|\d00|950)$/;

const FRAMEWORK_NAMED = /^--(?:tw-)?colors?-(?:transparent|current|black|white|inherit)$/;

function isNoiseName(name: string): boolean {
  if (NOISE_PREFIXES.some(p => name.startsWith(p))) return false;
  if (NOISE_UTILITIES.some(p => name.includes(p))) return false;
  if (FRAMEWORK_PALETTE.test(name)) return false;
  if (FRAMEWORK_NAMED.test(name)) return false;
  if (/--(?:system|default)-/.test(name)) return false;
  return true;
}

/** El valor parece un color (o una referencia var() a un color). */
function isColorValue(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  if (v === 'transparent' || v === 'rgba(0, 0, 0, 0)' || v === 'rgba(0,0,0,0)') return false;
  // Hex totalmente transparente (#0000, #00000000) no es un token útil.
  if (/^#[0-9a-f]{3}0$/i.test(v) || /^#[0-9a-f]{6}00$/i.test(v)) return false;
  if (v.includes('lighten(') || v.includes('darken(') || v.includes('saturate(') || v.includes('color.adjust(')) return false;
  if (v.includes('calc(') || v.includes('clamp(')) {
    return /#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i.test(v);
  }
  // Colores por nombre (--color-primary: crimson).
  if (NAMED_COLORS[v]) return true;
  return /^(#|rgb|hsl|hwb|lab|lch|oklab|oklch|color\(|var\(--)/i.test(v);
}

// ---------------------------------------------------------------------------
// Clasificación
// ---------------------------------------------------------------------------

function classifyToken(name: string): TokenType {
  // Los status words son la señal más específica: --error-color es semántico,
  // no brand, aunque contenga "color".
  if (/(error|danger|destructive|invalid|warning|success|info|alert|notice|disabled|placeholder)/i.test(name)) {
    return 'semantic';
  }
  if (/(color|bg|background|text|brand|primary|secondary|accent|ink|surface|foreground|link|border|ring|stroke|fill|gradient)/i.test(name)) {
    return 'brand';
  }
  return 'custom';
}

// ---------------------------------------------------------------------------
// Helpers de presentación (agrupar y ordenar la tabla de tokens)
// ---------------------------------------------------------------------------

/**
 * Prefijo de agrupación de un token: --cds-ai-aura-hover → --cds-,
 * --color-primary → --color-. Los tokens de un solo segmento (--primary)
 * no tienen prefijo → '' (grupo "otros").
 */
export function tokenPrefix(name: string): string {
  const segments = name.slice(2).split('-');
  if (segments.length <= 1) return '';
  return `--${segments[0]}-`;
}

/** Hue (0-360) de un hex #rrggbb, para ordenar la paleta por matiz. */
export function hexToHue(hex: string): number {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round((h * 60 + 360) % 360);
}

// ---------------------------------------------------------------------------
// Parser de colores (CSS Color Level 4, port compacto de dembrandt lib/color-parse.ts)
// ---------------------------------------------------------------------------

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const XYZ_D65_TO_LINEAR_SRGB = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.9692660, 1.8760108, 0.0415560],
  [0.0556434, -0.2040259, 1.0572252]
];

const LINEAR_P3_TO_XYZ_D65 = [
  [0.4865709486482162, 0.26566769316909306, 0.19821728523436247],
  [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
  [0, 0.04511338185890264, 1.043944368900976]
];

// Bradford: lab()/lch() están definidos en D50; sRGB vive en D65.
const XYZ_D50_TO_D65 = [
  [0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
  [-0.028369706963208136, 1.0099954580058226, 0.021041398966943008],
  [0.012314001688319899, -0.020507696433477912, 1.3303659366080753]
];

const D50_WHITE = { x: 0.96422, y: 1, z: 0.82521 };

function applyMatrix(m: number[][], v: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  return {
    x: m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z,
    y: m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z,
    z: m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z
  };
}

function srgbToLinear(c: number): number {
  const abs = Math.abs(c);
  const sign = c < 0 ? -1 : 1;
  return abs <= 0.04045 ? c / 12.92 : sign * Math.pow((abs + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const abs = Math.abs(c);
  const sign = c < 0 ? -1 : 1;
  return abs <= 0.0031308 ? c * 12.92 : sign * (1.055 * Math.pow(abs, 1 / 2.4) - 0.055);
}

function linearToRgbChannel(linear: { x: number; y: number; z: number }, clamp = true): { r: number; g: number; b: number } {
  const v = {
    r: linearToSrgb(linear.x) * 255,
    g: linearToSrgb(linear.y) * 255,
    b: linearToSrgb(linear.z) * 255
  };
  if (clamp) {
    v.r = Math.min(255, Math.max(0, v.r));
    v.g = Math.min(255, Math.max(0, v.g));
    v.b = Math.min(255, Math.max(0, v.b));
  }
  return v;
}

function oklabToLinearSrgb(L: number, a: number, b: number): { x: number; y: number; z: number } {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
  return {
    x: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    y: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    z: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  };
}

/** Nombres de color comunes (subconjunto de CSS named colors). */
const NAMED_COLORS: Record<string, string> = {
  aliceblue: '#f0f8ff', antiquewhite: '#faebd7', aqua: '#00ffff', aquamarine: '#7fffd4',
  azure: '#f0ffff', beige: '#f5f5dc', bisque: '#ffe4c4', black: '#000000',
  blue: '#0000ff', blueviolet: '#8a2be2', brown: '#a52a2a', burlywood: '#deb887',
  cadetblue: '#5f9ea0', chartreuse: '#7fff00', chocolate: '#d2691e', coral: '#ff7f50',
  cornflowerblue: '#6495ed', cornsilk: '#fff8dc', crimson: '#dc143c', cyan: '#00ffff',
  darkblue: '#00008b', darkcyan: '#008b8b', darkgoldenrod: '#b8860b', darkgray: '#a9a9a9',
  darkgrey: '#a9a9a9', darkgreen: '#006400', darkkhaki: '#bdb76b', darkmagenta: '#8b008b',
  darkolivegreen: '#556b2f', darkorange: '#ff8c00', darkorchid: '#9932cc', darkred: '#8b0000',
  darksalmon: '#e9967a', darkseagreen: '#8fbc8f', darkslateblue: '#483d8b', darkslategray: '#2f4f4f',
  darkslategrey: '#2f4f4f', darkturquoise: '#00ced1', darkviolet: '#9400d3', deeppink: '#ff1493',
  deepskyblue: '#00bfff', dimgray: '#696969', dimgrey: '#696969', dodgerblue: '#1e90ff',
  firebrick: '#b22222', floralwhite: '#fffaf0', forestgreen: '#228b22', fuchsia: '#ff00ff',
  gainsboro: '#dcdcdc', ghostwhite: '#f8f8ff', gold: '#ffd700', goldenrod: '#daa520',
  gray: '#808080', grey: '#808080', green: '#008000', greenyellow: '#adff2f',
  honeydew: '#f0fff0', hotpink: '#ff69b4', indianred: '#cd5c5c', indigo: '#4b0082',
  ivory: '#fffff0', khaki: '#f0e68c', lavender: '#e6e6fa', lavenderblush: '#fff0f5',
  lawngreen: '#7cfc00', lemonchiffon: '#fffacd', lightblue: '#add8e6', lightcoral: '#f08080',
  lightcyan: '#e0ffff', lightgoldenrodyellow: '#fafad2', lightgray: '#d3d3d3', lightgrey: '#d3d3d3',
  lightgreen: '#90ee90', lightpink: '#ffb6c1', lightsalmon: '#ffa07a', lightseagreen: '#20b2aa',
  lightskyblue: '#87cefa', lightslategray: '#778899', lightslategrey: '#778899', lightsteelblue: '#b0c4de',
  lightyellow: '#ffffe0', lime: '#00ff00', limegreen: '#32cd32', linen: '#faf0e6',
  magenta: '#ff00ff', maroon: '#800000', mediumaquamarine: '#66cdaa', mediumblue: '#0000cd',
  mediumorchid: '#ba55d3', mediumpurple: '#9370db', mediumseagreen: '#3cb371', mediumslateblue: '#7b68ee',
  mediumspringgreen: '#00fa9a', mediumturquoise: '#48d1cc', mediumvioletred: '#c71585', midnightblue: '#191970',
  mintcream: '#f5fffa', mistyrose: '#ffe4e1', moccasin: '#ffe4b5', navajowhite: '#ffdead',
  navy: '#000080', oldlace: '#fdf5e6', olive: '#808000', olivedrab: '#6b8e23',
  orange: '#ffa500', orangered: '#ff4500', orchid: '#da70d6', palegoldenrod: '#eee8aa',
  palegreen: '#98fb98', paleturquoise: '#afeeee', palevioletred: '#db7093', papayawhip: '#ffefd5',
  peachpuff: '#ffdab9', peru: '#cd853f', pink: '#ffc0cb', plum: '#dda0dd',
  powderblue: '#b0e0e6', purple: '#800080', rebeccapurple: '#663399', red: '#ff0000',
  rosybrown: '#bc8f8f', royalblue: '#4169e1', saddlebrown: '#8b4513', salmon: '#fa8072',
  sandybrown: '#f4a460', seagreen: '#2e8b57', seashell: '#fff5ee', sienna: '#a0522d',
  silver: '#c0c0c0', skyblue: '#87ceeb', slateblue: '#6a5acd', slategray: '#708090',
  slategrey: '#708090', snow: '#fffafa', springgreen: '#00ff7f', steelblue: '#4682b4',
  tan: '#d2b48c', teal: '#008080', thistle: '#d8bfd8', tomato: '#ff6347',
  turquoise: '#40e0d0', violet: '#ee82ee', wheat: '#f5deb3', white: '#ffffff',
  whitesmoke: '#f5f5f5', yellow: '#ffff00', yellowgreen: '#9acd32'
};

const NUMBER_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

function parseNumeric(token: string, percentRef: number): number | null {
  if (token === 'none') return 0;
  if (token.endsWith('%')) {
    const v = token.slice(0, -1);
    if (!NUMBER_RE.test(v)) return null;
    return (parseFloat(v) / 100) * percentRef;
  }
  if (!NUMBER_RE.test(token)) return null;
  return parseFloat(token);
}

function parseHue(token: string): number | null {
  if (token === 'none') return 0;
  const m = token.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(deg|rad|grad|turn)?$/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  switch ((m[2] || 'deg').toLowerCase()) {
    case 'rad': return (v * 180) / Math.PI;
    case 'grad': return v * 0.9;
    case 'turn': return v * 360;
    default: return v;
  }
}

function parseAlpha(token: string | undefined): number | null {
  if (token === undefined) return 1;
  const v = parseNumeric(token, 1);
  if (v === null) return null;
  return Math.min(1, Math.max(0, v));
}

function splitArgs(body: string): { channels: string[]; alpha: string | undefined } | null {
  const trimmed = body.trim();
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map(p => p.trim());
    if (parts.some(p => p === '')) return null;
    if (parts.length === 4) return { channels: parts.slice(0, 3), alpha: parts[3] };
    if (parts.length === 3) return { channels: parts, alpha: undefined };
    return null;
  }
  const slash = trimmed.split('/');
  if (slash.length > 2) return null;
  const channels = slash[0].trim().split(/\s+/);
  const alpha = slash.length === 2 ? slash[1].trim() : undefined;
  if (alpha === '') return null;
  return { channels, alpha };
}

function clamp255(v: number): number {
  return Math.min(255, Math.max(0, Math.round(v)));
}

function fromHex(input: string): Rgba | null {
  const m = input.match(/^#([0-9a-f]{3,8})$/i);
  if (!m) return null;
  const h = m[1];
  const dup = (c: string) => parseInt(c + c, 16);
  const pair = (i: number) => parseInt(h.slice(i, i + 2), 16);
  switch (h.length) {
    case 3: return { r: dup(h[0]), g: dup(h[1]), b: dup(h[2]), a: 1 };
    case 4: return { r: dup(h[0]), g: dup(h[1]), b: dup(h[2]), a: dup(h[3]) / 255 };
    case 6: return { r: pair(0), g: pair(2), b: pair(4), a: 1 };
    case 8: return { r: pair(0), g: pair(2), b: pair(4), a: pair(6) / 255 };
    default: return null;
  }
}

function fromRgb(args: string): Rgba | null {
  const parsed = splitArgs(args);
  if (!parsed || parsed.channels.length !== 3) return null;
  const r = parseNumeric(parsed.channels[0], 255);
  const g = parseNumeric(parsed.channels[1], 255);
  const b = parseNumeric(parsed.channels[2], 255);
  const a = parseAlpha(parsed.alpha);
  if (r === null || g === null || b === null || a === null) return null;
  return { r: clamp255(r), g: clamp255(g), b: clamp255(b), a };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return { r: clamp255((r + m) * 255), g: clamp255((g + m) * 255), b: clamp255((b + m) * 255) };
}

function fromHsl(args: string): Rgba | null {
  const parsed = splitArgs(args);
  if (!parsed || parsed.channels.length !== 3) return null;
  const h = parseHue(parsed.channels[0]);
  const s = parseNumeric(parsed.channels[1], 1);
  const l = parseNumeric(parsed.channels[2], 1);
  const a = parseAlpha(parsed.alpha);
  if (h === null || s === null || l === null || a === null) return null;
  const rgb = hslToRgb(h, Math.min(1, Math.max(0, s)), Math.min(1, Math.max(0, l)));
  return { ...rgb, a };
}

function fromHwb(args: string): Rgba | null {
  const parsed = splitArgs(args);
  if (!parsed || parsed.channels.length !== 3) return null;
  const h = parseHue(parsed.channels[0]);
  const w = parseNumeric(parsed.channels[1], 1);
  const b = parseNumeric(parsed.channels[2], 1);
  const a = parseAlpha(parsed.alpha);
  if (h === null || w === null || b === null || a === null) return null;
  const ww = Math.min(1, Math.max(0, w));
  const bb = Math.min(1, Math.max(0, b));
  if (ww + bb >= 1) {
    const v = clamp255((ww / (ww + bb)) * 255);
    return { r: v, g: v, b: v, a };
  }
  const l = ww + (1 - ww - bb) / 2;
  const s = l <= 0.5 ? (1 - ww - bb) / (2 * l) : (1 - ww - bb) / (2 * (1 - l));
  const rgb = hslToRgb(h, Math.min(1, Math.max(0, s)), Math.min(1, Math.max(0, l)));
  return { ...rgb, a };
}

function labToXyzD50(L: number, a: number, b: number): { x: number; y: number; z: number } {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const f = (t: number) => {
    const t3 = t * t * t;
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
  };
  return {
    x: D50_WHITE.x * f(fx),
    y: D50_WHITE.y * f(fy),
    z: D50_WHITE.z * f(fz)
  };
}

function fromLabLike(args: string, isLch: boolean): Rgba | null {
  const parsed = splitArgs(args);
  if (!parsed || parsed.channels.length !== 3) return null;
  const L = parseNumeric(parsed.channels[0], 100);
  const a = parseNumeric(parsed.channels[1], 125);
  const cOrB = parseNumeric(parsed.channels[2], isLch ? 150 : 125);
  const alpha = parseAlpha(parsed.alpha);
  if (L === null || a === null || cOrB === null || alpha === null) return null;
  let b: number;
  let aChroma: number;
  if (isLch) {
    const hue = ((cOrB % 360) + 360) % 360;
    const rad = (hue * Math.PI) / 180;
    aChroma = a * Math.cos(rad);
    b = a * Math.sin(rad);
  } else {
    aChroma = a;
    b = cOrB;
  }
  const xyz = labToXyzD50(L, aChroma, b);
  const d65 = applyMatrix(XYZ_D50_TO_D65, xyz);
  const linear = applyMatrix(XYZ_D65_TO_LINEAR_SRGB, d65);
  const rgb = linearToRgbChannel(linear);
  return { r: clamp255(rgb.r), g: clamp255(rgb.g), b: clamp255(rgb.b), a: alpha };
}

function fromOklabLike(args: string, isOklch: boolean): Rgba | null {
  const parsed = splitArgs(args);
  if (!parsed || parsed.channels.length !== 3) return null;
  const L = parseNumeric(parsed.channels[0], 1);
  const a = parseNumeric(parsed.channels[1], 0.4);
  const cOrB = parseNumeric(parsed.channels[2], isOklch ? 0.4 : 0.4);
  const alpha = parseAlpha(parsed.alpha);
  if (L === null || a === null || cOrB === null || alpha === null) return null;
  let aChroma: number;
  let b: number;
  if (isOklch) {
    const hue = ((cOrB % 360) + 360) % 360;
    const rad = (hue * Math.PI) / 180;
    aChroma = a * Math.cos(rad);
    b = a * Math.sin(rad);
  } else {
    aChroma = a;
    b = cOrB;
  }
  const linear = oklabToLinearSrgb(L, aChroma, b);
  const rgb = linearToRgbChannel(linear);
  return { r: clamp255(rgb.r), g: clamp255(rgb.g), b: clamp255(rgb.b), a: alpha };
}

function fromColorFunction(args: string): Rgba | null {
  const spaceMatch = args.trim().match(/^([a-z0-9-]+)\s*([\s\S]*)$/i);
  if (!spaceMatch) return null;
  const space = spaceMatch[1].toLowerCase();
  const parsed = splitArgs(spaceMatch[2]);
  if (!parsed || parsed.channels.length !== 3) return null;
  const r = parseNumeric(parsed.channels[0], 1);
  const g = parseNumeric(parsed.channels[1], 1);
  const b = parseNumeric(parsed.channels[2], 1);
  const a = parseAlpha(parsed.alpha);
  if (r === null || g === null || b === null || a === null) return null;

  switch (space) {
    case 'srgb': {
      const rgb = linearToRgbChannel({ x: srgbToLinear(r), y: srgbToLinear(g), z: srgbToLinear(b) });
      return { r: clamp255(rgb.r), g: clamp255(rgb.g), b: clamp255(rgb.b), a };
    }
    case 'srgb-linear': {
      const rgb = linearToRgbChannel({ x: r, y: g, z: b });
      return { r: clamp255(rgb.r), g: clamp255(rgb.g), b: clamp255(rgb.b), a };
    }
    case 'display-p3': {
      const xyz = applyMatrix(LINEAR_P3_TO_XYZ_D65, { x: r, y: g, z: b });
      const linear = applyMatrix(XYZ_D65_TO_LINEAR_SRGB, xyz);
      const rgb = linearToRgbChannel(linear);
      return { r: clamp255(rgb.r), g: clamp255(rgb.g), b: clamp255(rgb.b), a };
    }
    case 'xyz-d65': {
      const linear = applyMatrix(XYZ_D65_TO_LINEAR_SRGB, { x: r, y: g, z: b });
      const rgb = linearToRgbChannel(linear);
      return { r: clamp255(rgb.r), g: clamp255(rgb.g), b: clamp255(rgb.b), a };
    }
    case 'xyz-d50': {
      const d65 = applyMatrix(XYZ_D50_TO_D65, { x: r, y: g, z: b });
      const linear = applyMatrix(XYZ_D65_TO_LINEAR_SRGB, d65);
      const rgb = linearToRgbChannel(linear);
      return { r: clamp255(rgb.r), g: clamp255(rgb.g), b: clamp255(rgb.b), a };
    }
    default:
      return null;
  }
}

/** Parser CSS Color Level 4 → sRGB 8-bit + alpha. Devuelve null si no puede resolver. */
export function parseCssColor(input: string): Rgba | null {
  if (!input) return null;
  const v = input.trim();
  const lower = v.toLowerCase();
  if (lower === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (lower === 'currentcolor') return null;
  if (v.startsWith('#')) return fromHex(v);
  if (NAMED_COLORS[lower]) return fromHex(NAMED_COLORS[lower]);
  const fn = v.match(/^([a-z]+)\(([\s\S]*)\)$/i);
  if (!fn) return null;
  const name = fn[1].toLowerCase();
  const args = fn[2];
  switch (name) {
    case 'rgb':
    case 'rgba':
      return fromRgb(args);
    case 'hsl':
    case 'hsla':
      return fromHsl(args);
    case 'hwb':
      return fromHwb(args);
    case 'lab':
      return fromLabLike(args, false);
    case 'lch':
      return fromLabLike(args, true);
    case 'oklab':
      return fromOklabLike(args, false);
    case 'oklch':
      return fromOklabLike(args, true);
    case 'color':
      return fromColorFunction(args);
    default:
      return null;
  }
}

export function colorToHex(c: Rgba): string {
  return `#${clamp255(c.r).toString(16).padStart(2, '0')}${clamp255(c.g).toString(16).padStart(2, '0')}${clamp255(c.b).toString(16).padStart(2, '0')}`;
}

function colorToHexOrNull(value: string): string | null {
  const c = parseCssColor(value);
  if (!c) return null;
  if (c.a < 0.05) return null;
  return colorToHex(c);
}

// ---------------------------------------------------------------------------
// Resolución de var() encadenadas
// ---------------------------------------------------------------------------

function resolveVarChain(
  value: string,
  lookup: Map<string, { value: string; scope: TokenScope }>,
  depth: number
): string | null {
  if (depth > 6) return null;
  const trimmed = value.trim();
  const m = trimmed.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/);
  if (!m) return trimmed;
  const target = lookup.get(m[1]);
  if (target) return resolveVarChain(target.value, lookup, depth + 1);
  return m[2] ? m[2].trim() : null;
}

// ---------------------------------------------------------------------------
// Extracción principal
// ---------------------------------------------------------------------------

export function extractColorTokens(cssSources: { text: string; source: string }[]): {
  tokens: ColorToken[];
  palette: { hex: string; count: number; names: string[] }[];
} {
  const declarations: { name: string; value: string; scope: TokenScope }[] = [];
  for (const src of cssSources) {
    const rules = parseCssRules(src.text);
    collectDeclarations(rules, false, declarations);
  }

  // Dedupe por nombre (gana root scope) con filtros de ruido, sobre TODAS las
  // declaraciones: la resolución de var() necesita ver también los no-colores
  // (ej. --font: var(--font-stack) resuelve a una font, no a un color).
  const allByName = new Map<string, { value: string; scope: TokenScope }>();
  for (const d of declarations) {
    if (!isNoiseName(d.name)) continue;
    const existing = allByName.get(d.name);
    if (!existing || (d.scope === 'root' && existing.scope !== 'root')) {
      allByName.set(d.name, { value: d.value, scope: d.scope });
    }
  }

  // Solo los que parecen color forman parte del resultado.
  const byName = new Map<string, { value: string; scope: TokenScope }>();
  for (const [name, entry] of allByName) {
    if (isColorValue(entry.value)) byName.set(name, entry);
  }

  const tokens: ColorToken[] = [];
  for (const [name, { value, scope }] of byName) {
    const resolved = resolveVarChain(value, allByName, 0);
    if (resolved !== null && !isColorValue(resolved)) {
      // var() encadenada resolvió a un valor no-color (font stack, spacing,
      // etc.): no es un token de color aunque su nombre parezca serlo.
      continue;
    }
    tokens.push({
      name,
      value,
      hex: resolved ? colorToHexOrNull(resolved) : null,
      type: classifyToken(name),
      scope
    });
  }

  const byHex = new Map<string, { count: number; names: string[] }>();
  for (const t of tokens) {
    if (!t.hex) continue;
    const entry = byHex.get(t.hex) ?? { count: 0, names: [] };
    entry.count++;
    if (!entry.names.includes(t.name)) entry.names.push(t.name);
    byHex.set(t.hex, entry);
  }
  const palette = Array.from(byHex.entries())
    .map(([hex, v]) => ({ hex, count: v.count, names: v.names.slice(0, 3) }))
    .sort((a, b) => b.count - a.count);

  return { tokens, palette };
}

// ---------------------------------------------------------------------------
// Export builders (client-side)
// ---------------------------------------------------------------------------

function tokenExportValue(t: ColorToken): string {
  return t.hex ?? t.value;
}

/** Bloque :root { ... } con las variables para pegar en un proyecto. */
export function buildCssExport(tokens: ColorToken[]): string {
  const lines = tokens.map(t => `  ${t.name}: ${tokenExportValue(t)};`);
  return `:root {
${lines.join('\n')}
}`;
}

/** Objeto colors: {} de tailwind.config con claves sanitizadas (sin --). */
export function buildTailwindExport(tokens: ColorToken[]): string {
  const lines = tokens.map(t => {
    const key = t.name.replace(/^--/, '').replace(/\./g, '-').replace(/\s+/g, '-');
    return `    '${key}': '${tokenExportValue(t)}',`;
  });
  return `module.exports = {
  theme: {
    extend: {
      colors: {
${lines.join('\n')}
      }
    }
  }
};`;
}
