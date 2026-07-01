import { NextResponse } from "next/server";
import { wcagChecks } from "@/lib/wcag-checks";
import { scoreFromIssues } from "@/lib/scoring";
import { enrichWithAI, type AiConfig } from "@/lib/ai";
import { assertPublicHost } from "@/lib/ssrf";
import { gatherExternalCss, injectCss } from "@/lib/fetch-css";
import type { AuditResponse, AuditResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 2_000_000; // 2 MB cap
const MAX_REDIRECTS = 5;

interface Body {
  mode: "url" | "html";
  value: string;
  ai?: AiConfig;
}

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    let current = url;
    // Follow redirects manually so every hop is SSRF-validated before we connect.
    for (let hop = 0; ; hop++) {
      let parsed: URL;
      try {
        parsed = new URL(current);
      } catch {
        throw new Error("URL non valido.");
      }
      if (!/^https?:$/.test(parsed.protocol)) {
        throw new Error("Sono ammessi solo URL http(s).");
      }
      await assertPublicHost(parsed.hostname);

      const res = await fetch(parsed.toString(), {
        signal: ctrl.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "AccessibilityAuditor/1.0 (+https://github.com)",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) throw new Error("Redirect senza destinazione.");
        if (hop >= MAX_REDIRECTS) throw new Error("Troppi redirect.");
        current = new URL(loc, parsed).toString();
        continue;
      }
      if (!res.ok) {
        throw new Error(`La pagina ha risposto ${res.status} ${res.statusText}.`);
      }
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("html")) {
        throw new Error(`Il contenuto non è HTML (content-type: ${ct || "sconosciuto"}).`);
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_HTML_BYTES) {
        throw new Error("Pagina troppo grande (oltre 2 MB).");
      }
      return { html: new TextDecoder().decode(buf), finalUrl: parsed.toString() };
    }
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === "AbortError") throw new Error("Timeout: la pagina non ha risposto in tempo.");
      // Re-surface our own validation messages unchanged; wrap low-level fetch errors.
      if (/non consentito|privato|interno|risolvibile|redirect|HTML|http\(s\)|non valido|troppo grande|risposto/i.test(err.message))
        throw err;
      throw new Error(`Impossibile raggiungere l'URL: ${err.message}`);
    }
    throw new Error("Impossibile raggiungere l'URL.");
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Body JSON non valido." }, { status: 400 });
  }

  if (!body?.value || (body.mode !== "url" && body.mode !== "html")) {
    return NextResponse.json({ error: "Fornisci 'mode' (url|html) e 'value'." }, { status: 400 });
  }
  if (body.mode === "html" && Buffer.byteLength(body.value) > MAX_HTML_BYTES) {
    return NextResponse.json({ error: "HTML troppo grande (oltre 2 MB)." }, { status: 413 });
  }

  // 1. Get HTML
  let html: string;
  let url: string | undefined;
  try {
    if (body.mode === "url") {
      const r = await fetchHtml(body.value.trim());
      html = r.html;
      url = r.finalUrl;
      // Inline external stylesheets so contrast checks see CSS colors, not
      // just inline/<style>. Best-effort: never blocks the audit.
      const css = await gatherExternalCss(html, url);
      if (css) html = injectCss(html, css);
    } else {
      html = body.value;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Errore nel recupero della pagina." },
      { status: 422 },
    );
  }

  // 2. Deterministic checks — always run, never depend on AI
  let issues;
  try {
    issues = wcagChecks(html);
  } catch {
    return NextResponse.json({ error: "HTML malformato: impossibile analizzarlo." }, { status: 422 });
  }

  // 3. Optional AI enrichment — failure must not lose deterministic results.
  //    Priority: client-provided config > server GROQ_API_KEY fallback (demo).
  const aiCfg: AiConfig | undefined =
    body.ai?.apiKey || body.ai?.provider === "compatible"
      ? body.ai
      : process.env.GROQ_API_KEY
        ? {
            provider: "groq",
            apiKey: process.env.GROQ_API_KEY,
            model: process.env.GROQ_MODEL || undefined,
          }
        : undefined;

  let aiError: string | undefined;
  if (aiCfg) {
    try {
      issues = await enrichWithAI(aiCfg, issues, html);
    } catch (err) {
      aiError = err instanceof Error ? err.message : "Arricchimento AI fallito.";
    }
  }

  const { score, breakdown } = scoreFromIssues(issues);
  const result: AuditResult = {
    url,
    score,
    breakdown,
    issues,
    htmlBytes: Buffer.byteLength(html),
    checkedAt: new Date().toISOString(),
  };

  return NextResponse.json({ result, aiError } satisfies AuditResponse);
}
