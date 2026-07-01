import * as cheerio from "cheerio";
import { assertPublicHost } from "./ssrf";

// Fetch external <link rel="stylesheet"> files and return their concatenated
// CSS, so the contrast checker sees colors defined in external stylesheets —
// not just inline/<style>. No headless browser: stays light and free on Vercel.
//
// ponytail: no JS execution, no @import resolution, no media-query evaluation.
// Covers the common case (external CSS with simple selectors); full computed
// styles would need a real browser — deliberately out of scope here.

const MAX_LINKS = 12;
const PER_FILE_TIMEOUT_MS = 5_000;
const MAX_CSS_BYTES = 1_500_000; // total budget across all stylesheets

/** Extract absolute stylesheet URLs from HTML, resolved against the page URL. */
export function extractStylesheetLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const urls: string[] = [];
  $('link[rel~="stylesheet"][href]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const u = new URL(href, baseUrl);
      if (/^https?:$/.test(u.protocol)) urls.push(u.toString());
    } catch {
      /* ignore malformed href */
    }
  });
  return [...new Set(urls)].slice(0, MAX_LINKS);
}

async function fetchOne(url: string): Promise<string> {
  const parsed = new URL(url);
  await assertPublicHost(parsed.hostname); // SSRF guard per file
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_FILE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "AccessibilityAuditor/1.0", Accept: "text/css,*/*" },
    });
    if (!res.ok) return "";
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("css") && !ct.includes("text/plain")) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

/** Best-effort: never throws. Returns concatenated CSS (capped) or "". */
export async function gatherExternalCss(html: string, baseUrl: string): Promise<string> {
  const links = extractStylesheetLinks(html, baseUrl);
  if (!links.length) return "";
  const parts = await Promise.allSettled(links.map(fetchOne));
  let css = "";
  for (const p of parts) {
    if (p.status === "fulfilled" && p.value) {
      css += "\n" + p.value;
      if (css.length > MAX_CSS_BYTES) {
        css = css.slice(0, MAX_CSS_BYTES);
        break;
      }
    }
  }
  return css;
}

/** Inject CSS into the HTML as a <style> block so the checker picks it up. */
export function injectCss(html: string, css: string): string {
  if (!css.trim()) return html;
  const safe = css.replace(/<\/style/gi, "<\\/style");
  const block = `<style data-external-css>${safe}</style>`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${block}</head>`);
  return block + html;
}

// ponytail: inline self-check (pure parts only). Run `npx tsx lib/fetch-css.ts`.
function demo() {
  const assert = (c: boolean, m: string) => {
    if (!c) throw new Error("FAIL: " + m);
  };
  const html = `<html><head>
    <link rel="stylesheet" href="/a.css">
    <link rel="stylesheet" href="https://cdn.example.com/b.css">
    <link rel="preload" href="/c.css">
    <link rel="stylesheet" href="/a.css">
  </head><body></body></html>`;
  const links = extractStylesheetLinks(html, "https://site.test/page");
  assert(links.includes("https://site.test/a.css"), "resolves relative href");
  assert(links.includes("https://cdn.example.com/b.css"), "keeps absolute href");
  assert(!links.some((l) => l.endsWith("c.css")), "ignores non-stylesheet rel");
  assert(links.length === 2, "dedupes duplicate hrefs");

  const injected = injectCss("<html><head></head><body></body></html>", "body{color:red}");
  assert(/data-external-css/.test(injected), "injects style block");
  assert(injectCss("<p>x</p>", "").includes("<p>x</p>"), "empty css -> unchanged");
  console.log("fetch-css self-check OK");
}

if (require.main === module) demo();
