const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

function isValidHex(hex: string): boolean {
  return HEX_COLOR_RE.test(hex);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  // eslint-disable-next-line no-bitwise
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r: r8, g: g8, b: b8 } = hexToRgb(hex);
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  } else if (max === g) {
    h = ((b - r) / d + 2) / 6;
  } else {
    h = ((r - g) / d + 4) / 6;
  }

  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  if (s === 0) {
    const v = Math.round(l * 255);
    return (
      "#" +
      v.toString(16).padStart(2, "0") +
      v.toString(16).padStart(2, "0") +
      v.toString(16).padStart(2, "0")
    );
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

  return (
    "#" +
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0")
  );
}

function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function adjustEventColor(
  hexColor: string,
  isDarkMode: boolean,
): string {
  if (!isValidHex(hexColor)) {
    return hexColor;
  }

  if (!isDarkMode) {
    return hexColor;
  }

  const { h, s, l } = hexToHsl(hexColor);

  const adjustedS = Math.min(s, 0.6);
  const adjustedL = Math.max(0.5, Math.min(l, 0.8));

  return hslToHex(h, adjustedS, adjustedL);
}

export function getContrastRatio(
  foreground: string,
  background: string,
): number {
  if (!isValidHex(foreground) || !isValidHex(background)) {
    return 1;
  }

  const fgRgb = hexToRgb(foreground);
  const bgRgb = hexToRgb(background);

  const l1 = relativeLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
  const l2 = relativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsContrastAA(
  foreground: string,
  background: string,
): boolean {
  return getContrastRatio(foreground, background) >= 4.5;
}
