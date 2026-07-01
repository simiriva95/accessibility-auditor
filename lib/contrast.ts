// Deterministic WCAG contrast math. No AI — pixels and numbers are computed,
// never guessed. Formulas: https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const NAMED: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  yellow: "#ffff00",
  orange: "#ffa500",
  purple: "#800080",
  navy: "#000080",
  teal: "#008080",
  transparent: "transparent",
};

/** Parse a CSS color (#hex, #rgb, rgb(), rgba(), basic names) to RGB.
 *  Returns null when unparseable or fully transparent (caller treats as unknown). */
export function parseColor(input: string | undefined | null): Rgb | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  if (s in NAMED) s = NAMED[s];
  if (s === "transparent") return null;

  if (s.startsWith("#")) {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].some(Number.isNaN)) return null;
      // alpha == 0 -> treat as unknown background
      if (hex.length === 8 && parseInt(hex.slice(6, 8), 16) === 0) return null;
      return { r, g, b };
    }
    return null;
  }

  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(/[,/\s]+/).filter(Boolean);
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    const a = parts[3] !== undefined ? Number(parts[3]) : 1;
    if ([r, g, b].some(Number.isNaN)) return null;
    if (a === 0) return null;
    return { r, g, b };
  }
  return null;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(fg: Rgb, bg: Rgb): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Large text per WCAG: >= 18.66px (14pt) bold, or >= 24px (18pt). */
export function isLargeText(fontSizePx: number, bold: boolean): boolean {
  return fontSizePx >= 24 || (bold && fontSizePx >= 18.66);
}

export function meetsAA(ratio: number, largeText: boolean): boolean {
  return ratio >= (largeText ? 3 : 4.5);
}

export function meetsAAA(ratio: number, largeText: boolean): boolean {
  return ratio >= (largeText ? 4.5 : 7);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ponytail: inline self-check instead of a test framework. Run with `npx tsx lib/contrast.ts`.
function demo() {
  const assert = (c: boolean, m: string) => {
    if (!c) throw new Error("FAIL: " + m);
  };
  const black = parseColor("#000")!;
  const white = parseColor("white")!;
  assert(round2(contrastRatio(black, white)) === 21, "black/white = 21:1");
  assert(round2(contrastRatio(white, white)) === 1, "white/white = 1:1");
  assert(parseColor("transparent") === null, "transparent -> null");
  assert(parseColor("rgba(0,0,0,0)") === null, "alpha 0 -> null");
  const gray = parseColor("rgb(119,119,119)")!;
  // #777 on white ~ 4.48 -> fails AA normal, passes AA large
  const r = contrastRatio(gray, white);
  assert(!meetsAA(r, false), "#777/white fails AA normal");
  assert(meetsAA(r, true), "#777/white passes AA large");
  assert(meetsAAA(contrastRatio(black, white), false), "black/white passes AAA");
  console.log("contrast self-check OK");
}

if (require.main === module) demo();
