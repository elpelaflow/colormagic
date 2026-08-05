export interface Rgb {
  r: number
  g: number
  b: number
}

export interface Hsl {
  h: number
  s: number
  l: number
}

export interface Hsv {
  h: number
  s: number
  v: number
}

export interface Cmyk {
  c: number
  m: number
  y: number
  k: number
}

export interface Xyz {
  x: number
  y: number
  z: number
}

export interface Lab {
  l: number
  a: number
  b: number
}

export interface Yxy {
  y: number
  x: number
  yChromaticity: number
}

export function hexToRgb(hex: string): Rgb {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result !== null
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : { r: 0, g: 0, b: 0 };
};

export function normalizeHex(value: string): string | null {
  const result = /^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(value.trim());
  if (result === null) {
    return null;
  }
  let hex = result[1];
  if (hex.length === 3) {
    hex = hex.split('').map(channel => `${channel}${channel}`).join('');
  }
  return `#${hex.toLowerCase()}`;
};

export function getContrastTextColor(hex: string): string {
  const rgb = hexToRgb(hex);
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? '#000000' : '#ffffff';
};

export function rgbToHex(rgb: Rgb): string {
  const r = rgb.r.toString(16);
  const g = rgb.g.toString(16);
  const b = rgb.b.toString(16);
  return `#${r.length === 1 ? `0${r}` : r}${g.length === 1 ? `0${g}` : g}${
    b.length === 1 ? `0${b}` : b
  }`;
};

export function rgbToHsl(rgb: Rgb): Hsl {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case r:
        h = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      case b:
        h = (r - g) / delta + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100
  };
};

export function hslToRgb(hsl: Hsl): Rgb {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = function hue2rgb(p: number, q: number, t: number): number {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

export function rgbToHsv(rgb: Rgb): Hsv {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  const v = max;
  const s = max === 0 ? 0 : delta / max;

  if (delta !== 0) {
    switch (max) {
      case r:
        h = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      case b:
        h = (r - g) / delta + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: h * 360,
    s: s * 100,
    v: v * 100
  };
};

export function hsvToHsl(hsv: Hsv): Hsl {
  const v = hsv.v / 100;
  const s = hsv.s / 100;
  const l = v - (v * s) / 2;
  const min = Math.min(l, 1 - l);
  const sl = min === 0 ? 0 : (v - l) / min;
  return {
    h: hsv.h,
    s: sl * 100,
    l: l * 100
  };
};

export function hsvToRgb(hsv: Hsv): Rgb {
  const h = hsv.h / 360;
  const s = hsv.s / 100;
  const v = hsv.v / 100;
  let r = 0;
  let g = 0;
  let b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

export function rgbToCmyk(rgb: Rgb): Cmyk {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const k = 1 - Math.max(r, g, b);

  if (k === 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }

  return {
    c: ((1 - r - k) / (1 - k)) * 100,
    m: ((1 - g - k) / (1 - k)) * 100,
    y: ((1 - b - k) / (1 - k)) * 100,
    k: k * 100
  };
};

function srgbLinearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function rgbToXyz(rgb: Rgb): Xyz {
  const r = srgbLinearize(rgb.r);
  const g = srgbLinearize(rgb.g);
  const b = srgbLinearize(rgb.b);

  return {
    x: (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) * 100,
    y: (0.2126729 * r + 0.7151522 * g + 0.072175 * b) * 100,
    z: (0.0193339 * r + 0.119192 * g + 0.9503041 * b) * 100
  };
};

const D65: Xyz = { x: 95.047, y: 100, z: 108.883 };

function labPivot(value: number): number {
  const epsilon = 0.008856;
  const kappa = 903.3;
  return value > epsilon ? Math.cbrt(value) : (kappa * value + 16) / 116;
}

export function xyzToLab(xyz: Xyz): Lab {
  const fx = labPivot(xyz.x / D65.x);
  const fy = labPivot(xyz.y / D65.y);
  const fz = labPivot(xyz.z / D65.z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  };
};

export function rgbToLab(rgb: Rgb): Lab {
  return xyzToLab(rgbToXyz(rgb));
};

export function rgbToHunterLab(rgb: Rgb): Lab {
  const xyz = rgbToXyz(rgb);
  const xn = D65.x;
  const yn = D65.y;
  const zn = D65.z;

  const ka = (175 / 198.04) * (xn + yn);
  const kb = (70 / 218.11) * (yn + zn);
  const sqrtY = Math.sqrt(xyz.y / yn);

  if (sqrtY === 0) {
    return { l: 0, a: 0, b: 0 };
  }

  return {
    l: 100 * sqrtY,
    a: (ka * (xyz.x / xn - xyz.y / yn)) / sqrtY,
    b: (kb * (xyz.y / yn - xyz.z / zn)) / sqrtY
  };
};

export function rgbToYxy(rgb: Rgb): Yxy {
  const xyz = rgbToXyz(rgb);
  const sum = xyz.x + xyz.y + xyz.z;

  if (sum === 0) {
    return { y: 0, x: 0, yChromaticity: 0 };
  }

  return {
    y: xyz.y,
    x: xyz.x / sum,
    yChromaticity: xyz.y / sum
  };
};

export function rgbToYuv(rgb: Rgb): Rgb {
  const y = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  return {
    r: y,
    g: 0.492 * (rgb.b - y),
    b: 0.877 * (rgb.r - y)
  };
};

export function mixHex(hexA: string, hexB: string, ratio: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex({
    r: Math.round(a.r + (b.r - a.r) * ratio),
    g: Math.round(a.g + (b.g - a.g) * ratio),
    b: Math.round(a.b + (b.b - a.b) * ratio)
  });
};

export interface ShadeVariant {
  hex: string
  kind: 'tint' | 'base' | 'shade'
}

export function generateTints(hex: string, count = 10): string[] {
  return Array.from({ length: count }, (_, index) => {
    const ratio = (index + 1) / (count + 1);
    return mixHex(hex, '#ffffff', ratio);
  });
};

export function generateShades(hex: string, count = 10): string[] {
  return Array.from({ length: count }, (_, index) => {
    const ratio = (index + 1) / (count + 1);
    return mixHex(hex, '#000000', ratio);
  });
};

export function generateShadeVariants(hex: string, count = 10): ShadeVariant[] {
  const shades = generateShades(hex, count).reverse().map<ShadeVariant>(shade => ({ hex: shade, kind: 'shade' }));
  const base: ShadeVariant = { hex, kind: 'base' };
  const tints = generateTints(hex, count).map<ShadeVariant>(tint => ({ hex: tint, kind: 'tint' }));
  return [...shades, base, ...tints];
};

const deg2rad = (deg: number): number => (deg * Math.PI) / 180;
const rad2deg = (rad: number): number => (rad * 180) / Math.PI;

export function deltaE2000(labA: Lab, labB: Lab): number {
  const { l: L1, a: a1, b: b1 } = labA;
  const { l: L2, a: a2, b: b2 } = labB;

  const avgL = (L1 + L2) / 2;
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);
  const avgCp = (C1p + C2p) / 2;

  let h1p = Math.atan2(b1, a1p);
  let h2p = Math.atan2(b2, a2p);
  if (h1p < 0) h1p += 2 * Math.PI;
  if (h2p < 0) h2p += 2 * Math.PI;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp = h2p - h1p;
  if (Math.abs(dhp) <= Math.PI) {
    // keep
  } else if (dhp > Math.PI) {
    dhp -= 2 * Math.PI;
  } else {
    dhp += 2 * Math.PI;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp / 2);

  const avgLp = (L1 + L2) / 2;
  const avgHp = (() => {
    if (C1p * C2p === 0) return h1p + h2p;
    const diff = Math.abs(h1p - h2p);
    if (diff <= Math.PI) return (h1p + h2p) / 2;
    if (h1p + h2p < 2 * Math.PI) return (h1p + h2p + 2 * Math.PI) / 2;
    return (h1p + h2p - 2 * Math.PI) / 2;
  })();

  const T = 1
    - 0.17 * Math.cos(avgHp - deg2rad(30))
    + 0.24 * Math.cos(2 * avgHp)
    + 0.32 * Math.cos(3 * avgHp + deg2rad(6));

  const dTheta = deg2rad(30) * Math.exp(-Math.pow((rad2deg(avgHp) - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
  const SL = 1 + (0.015 * Math.pow(avgLp - 50, 2)) / Math.sqrt(20 + Math.pow(avgLp - 50, 2));
  const SC = 1 + 0.045 * avgCp;
  const SH = 1 + 0.015 * avgCp * T;
  const RT = -Math.sin(2 * dTheta) * RC;

  const kL = 1;
  const kC = 1;
  const kH = 1;

  const termL = dLp / (kL * SL);
  const termC = dCp / (kC * SC);
  const termH = dHp / (kH * SH);

  return Math.sqrt(termL * termL + termC * termC + termH * termH + RT * (termC * termH));
};
