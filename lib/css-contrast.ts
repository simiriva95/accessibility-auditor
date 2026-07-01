import type { CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";

// Best-effort CSS resolver for contrast checking. Parses <style> blocks and
// inline styles, then resolves an element's effective color/background by
// matching SIMPLE selectors (tag, .class, #id, and compounds of those).
//
// ponytail: this is NOT a real CSS engine. No specificity weighting (source
// order wins), no combinators/descendant selectors, no pseudo-classes, no
// @media/@supports rules, no external stylesheets, no em/rem/% font sizes.
// Those are deliberately skipped — rules we can't understand are simply
// ignored, never guessed. Upgrade path: swap in a real CSS parser (csstree)
// + a headless render if pixel-accurate contrast becomes a requirement.

export interface ResolvedStyle {
  color?: string;
  bg?: string;
  fontSize?: number; // px
  bold?: boolean;
}

interface Rule {
  selector: string;
  style: ResolvedStyle;
}

/** Remove comments and at-rule blocks (@media/@supports/@keyframes/@font-face). */
function stripNoise(css: string): string {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let out = "";
  for (let i = 0; i < noComments.length; ) {
    if (noComments[i] === "@") {
      const open = noComments.indexOf("{", i);
      const semi = noComments.indexOf(";", i);
      if (open === -1 || (semi !== -1 && semi < open)) {
        // at-rule without block (e.g. @import ...;) — drop to ';'
        i = semi === -1 ? noComments.length : semi + 1;
        continue;
      }
      // skip the whole balanced block
      let depth = 0;
      let j = open;
      for (; j < noComments.length; j++) {
        if (noComments[j] === "{") depth++;
        else if (noComments[j] === "}") {
          depth--;
          if (depth === 0) {
            j++;
            break;
          }
        }
      }
      i = j;
    } else {
      out += noComments[i++];
    }
  }
  return out;
}

export function parseDeclarations(decls: string): ResolvedStyle {
  const out: ResolvedStyle = {};
  for (const decl of decls.split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const k = decl.slice(0, idx).trim().toLowerCase();
    const v = decl.slice(idx + 1).trim();
    if (!v) continue;
    if (k === "color") out.color = v;
    else if (k === "background-color") out.bg = v;
    else if (k === "background") {
      // grab a color token if the shorthand contains one
      const m = v.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-z]+/);
      if (m) out.bg = m[0];
    } else if (k === "font-size") {
      const m = v.match(/([\d.]+)\s*px/);
      if (m) out.fontSize = Number(m[1]);
    } else if (k === "font-weight") {
      out.bold = v === "bold" || Number(v) >= 700;
    }
  }
  return out;
}

function parseStyleBlocks(css: string): Rule[] {
  const rules: Rule[] = [];
  const clean = stripNoise(css);
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    const style = parseDeclarations(m[2]);
    if (!style.color && !style.bg && style.fontSize === undefined && style.bold === undefined)
      continue;
    for (const sel of m[1].split(",").map((s) => s.trim()).filter(Boolean)) {
      rules.push({ selector: sel, style });
    }
  }
  return rules;
}

/** Match a simple selector (tag / .class / #id / compound) against an element. */
export function selectorMatches(selector: string, el: Element): boolean {
  if (/[\s>+~]/.test(selector)) return false; // combinators -> too complex
  let rest = selector;
  const tagM = rest.match(/^[a-zA-Z][\w-]*/);
  if (tagM) {
    if (el.tagName?.toLowerCase() !== tagM[0].toLowerCase()) return false;
    rest = rest.slice(tagM[0].length);
  }
  const ids = [...rest.matchAll(/#([\w-]+)/g)].map((x) => x[1]);
  const classes = [...rest.matchAll(/\.([\w-]+)/g)].map((x) => x[1]);
  const elId = el.attribs?.id;
  const elClasses = (el.attribs?.class || "").split(/\s+/).filter(Boolean);
  if (ids.some((id) => id !== elId)) return false;
  if (classes.some((c) => !elClasses.includes(c))) return false;
  // leftover means pseudo-class / attribute selector we don't support
  const leftover = rest.replace(/#[\w-]+/g, "").replace(/\.[\w-]+/g, "").trim();
  return leftover === "";
}

export type StyleResolver = (el: Element) => Required<Pick<ResolvedStyle, "fontSize" | "bold">> &
  Pick<ResolvedStyle, "color" | "bg">;

/** Build a resolver that returns an element's effective (inherited) style. */
export function buildStyleResolver($: CheerioAPI): StyleResolver {
  const cssText = $("style")
    .toArray()
    .map((s) => $(s).text())
    .join("\n");
  const rules = parseStyleBlocks(cssText);

  const own = (el: Element): ResolvedStyle => {
    const merged: ResolvedStyle = {};
    for (const r of rules) {
      if (selectorMatches(r.selector, el)) Object.assign(merged, r.style);
    }
    // inline style wins
    if (el.attribs?.style) Object.assign(merged, parseDeclarations(el.attribs.style));
    return merged;
  };

  return (el: Element) => {
    let color: string | undefined;
    let bg: string | undefined;
    let fontSize: number | undefined;
    let bold: boolean | undefined;
    let node: AnyNode | null = el;
    for (let i = 0; i < 12 && node && node.type === "tag"; i++) {
      const s = own(node as Element);
      color ??= s.color;
      bg ??= s.bg;
      fontSize ??= s.fontSize;
      bold ??= s.bold;
      if (color && bg) break;
      node = node.parent;
    }
    return { color, bg, fontSize: fontSize ?? 16, bold: bold ?? false };
  };
}

// ponytail: inline self-check. Run with `npx tsx lib/css-contrast.ts`.
async function demo() {
  const cheerio = await import("cheerio");
  const assert = (c: boolean, m: string) => {
    if (!c) throw new Error("FAIL: " + m);
  };
  const $ = cheerio.load(`<html><head><style>
    body { background: #ffffff; }
    .muted { color: #aaaaaa; }
    @media (max-width:600px){ .muted{ color:#000 } }
    p { font-size: 14px; }
  </style></head><body><p class="muted">ciao</p><span>x</span></body></html>`);
  const resolve = buildStyleResolver($);
  const p = $("p.muted")[0] as Element;
  const r = resolve(p);
  assert(r.color === "#aaaaaa", `p color resolved (got ${r.color})`);
  assert(r.bg === "#ffffff", `bg inherited from body (got ${r.bg})`);
  assert(r.fontSize === 14, `font-size resolved (got ${r.fontSize})`);
  assert(selectorMatches(".muted", p), "matches .muted");
  assert(!selectorMatches("div .muted", p), "rejects descendant selector");
  assert(!selectorMatches(".muted:hover", p), "rejects pseudo-class");
  console.log("css-contrast self-check OK");
}

if (require.main === module) demo();
