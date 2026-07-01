"use client";

import { useState } from "react";
import type { AuditResponse, AuditResult } from "@/lib/types";
import type { AiProvider } from "@/lib/ai";
import { AuditDashboard } from "@/components/audit-dashboard";
import { IssueList } from "@/components/issue-list";
import { ReportSummary } from "@/components/report-summary";
import { SeoPanel } from "@/components/seo-panel";

const EXAMPLES = [
  "https://www.w3.org",
  "https://news.ycombinator.com",
  "https://getbootstrap.com",
];

const PROVIDERS: { id: AiProvider | "none"; label: string }[] = [
  { id: "none", label: "Nessuna (solo check deterministici)" },
  { id: "groq", label: "Groq — gratis, no carta (consigliato)" },
  { id: "anthropic", label: "Anthropic Claude" },
  { id: "openai", label: "OpenAI" },
  { id: "compatible", label: "Locale / OpenAI-compatible (Ollama…)" },
];

const INPUT =
  "w-full border-2 border-ink bg-paper px-4 py-3 font-mono text-sm placeholder:text-ink-soft/60";

export default function Home() {
  const [mode, setMode] = useState<"url" | "html">("url");
  const [value, setValue] = useState("");

  const [provider, setProvider] = useState<AiProvider | "none">("groq");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [showAi, setShowAi] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);

  async function runAudit(overrideValue?: string) {
    const val = overrideValue ?? value;
    if (!val.trim()) {
      setError(mode === "url" ? "Inserisci un URL." : "Incolla dell'HTML.");
      return;
    }
    setLoading(true);
    setError(null);
    setAiError(null);
    setResult(null);

    const ai =
      provider !== "none"
        ? { provider, apiKey, model: model || undefined, baseURL: baseURL || undefined }
        : undefined;

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, value: val, ai }),
      });
      const data = (await res.json()) as AuditResponse & { error?: string };
      if (!res.ok) {
        setError(data.error || "Errore durante l'analisi.");
        return;
      }
      setResult(data.result);
      if (data.aiError) setAiError(data.aiError);
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-5 py-8 md:px-8 md:py-12">
      <a
        href="#auditor"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border-2 focus:border-ink focus:bg-accent focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:font-bold focus:uppercase focus:text-paper"
      >
        Salta al contenuto
      </a>
      {/* ---------- Masthead ---------- */}
      <header className="reveal border-y-2 border-ink py-2">
        <div className="flex items-center justify-between">
          <span className="kicker">WCAG 2.2 — Auditor</span>
          <span className="kicker">A · AA · AAA</span>
        </div>
      </header>

      <div className="reveal mt-6 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <h1 className="font-display font-black text-ink" style={{ fontSize: "clamp(3rem, 11vw, 8rem)" }}>
          Accessibility
          <br />
          <span className="italic" style={{ color: "var(--accent)" }}>
            Auditor
          </span>
          <span className="text-ink">.</span>
        </h1>
        <p className="max-w-[36ch] text-pretty border-l-2 border-ink pl-4 text-sm leading-relaxed md:text-base">
          Contrasti, alt, label, gerarchia e target misurati in{" "}
          <strong>codice deterministico</strong>. L&apos;AI scrive solo
          spiegazioni e fix — <em>mai</em> i numeri.
        </p>
      </div>

      {/* Value strip */}
      <div className="no-print reveal mt-6 grid grid-cols-1 border-2 border-ink sm:grid-cols-3">
        {[
          { n: "01", t: "Misura", d: "26 controlli WCAG 2.2 sull'HTML: contrasti, ARIA, struttura, form, media." },
          { n: "02", t: "Spiega", d: "Ogni problema con criterio, livello, gravità, perché e come si corregge." },
          { n: "03", t: "Correggi", d: "Fix di codice pronti (AI) + report esportabile in Markdown/JSON/PDF." },
        ].map((s, i) => (
          <div key={s.n} className={`p-4 ${i < 2 ? "border-b-2 border-ink sm:border-b-0 sm:border-r-2" : ""}`}>
            <span className="font-mono text-xs text-ink-soft">{s.n}</span>
            <h2 className="font-display text-xl font-semibold">{s.t}</h2>
            <p className="mt-1 text-sm text-ink-soft text-pretty">{s.d}</p>
          </div>
        ))}
      </div>

      {/* ---------- Input ---------- */}
      <section id="auditor" className="no-print block block-shadow reveal mt-10 scroll-mt-6 bg-paper p-5 md:p-6">
        <div className="mb-4 inline-flex border-2 border-ink">
          {(["url", "html"] as const).map((m, idx) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`px-5 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition ${
                idx === 0 ? "border-r-2 border-ink" : ""
              } ${mode === m ? "bg-ink text-paper" : "bg-paper hover:bg-paper-2"}`}
            >
              {m === "url" ? "URL" : "HTML"}
            </button>
          ))}
        </div>

        {mode === "url" ? (
          <input
            type="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runAudit()}
            placeholder="https://esempio.com"
            aria-label="URL della pagina da analizzare"
            autoComplete="url"
            spellCheck={false}
            className={INPUT}
          />
        ) : null}

        {mode === "url" && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
              Prova:
            </span>
            {EXAMPLES.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => {
                  setValue(u);
                  runAudit(u);
                }}
                className="border-b-2 border-ink font-mono text-xs hover:bg-paper-2"
              >
                {u.replace(/^https?:\/\//, "")}
              </button>
            ))}
          </div>
        )}

        {mode === "html" && (
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="<html lang='it'>…</html>"
            rows={6}
            aria-label="HTML grezzo da analizzare"
            spellCheck={false}
            className={`${INPUT} resize-y text-xs`}
          />
        )}

        {/* AI settings */}
        <button
          type="button"
          onClick={() => setShowAi((s) => !s)}
          aria-expanded={showAi}
          className="mt-4 font-mono text-xs font-bold uppercase tracking-wider underline-offset-4 hover:underline"
        >
          [{showAi ? "−" : "+"}] Provider AI ·{" "}
          {PROVIDERS.find((p) => p.id === provider)?.label}
        </button>

        {showAi && (
          <div className="mt-3 grid gap-3 border-2 border-ink bg-paper-2 p-4 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-mono text-xs uppercase tracking-wider text-ink-soft">
                Provider
              </span>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as AiProvider | "none")}
                className="w-full border-2 border-ink bg-paper px-3 py-2 font-mono text-sm"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            {provider !== "none" && (
              <label className="text-sm">
                <span className="mb-1 block font-mono text-xs uppercase tracking-wider text-ink-soft">
                  API key {provider === "compatible" && "(opzionale)"}
                </span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="mai salvata, solo in memoria"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full border-2 border-ink bg-paper px-3 py-2 font-mono text-sm"
                />
              </label>
            )}

            {provider !== "none" && (
              <label className="text-sm">
                <span className="mb-1 block font-mono text-xs uppercase tracking-wider text-ink-soft">
                  Modello (opzionale)
                </span>
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="default per provider"
                  spellCheck={false}
                  className="w-full border-2 border-ink bg-paper px-3 py-2 font-mono text-sm"
                />
              </label>
            )}

            {provider === "compatible" && (
              <label className="text-sm">
                <span className="mb-1 block font-mono text-xs uppercase tracking-wider text-ink-soft">
                  Base URL
                </span>
                <input
                  value={baseURL}
                  onChange={(e) => setBaseURL(e.target.value)}
                  placeholder="http://localhost:11434/v1"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full border-2 border-ink bg-paper px-3 py-2 font-mono text-sm"
                />
              </label>
            )}

            <p className="font-mono text-xs leading-relaxed text-ink-soft md:col-span-2">
              La chiave resta solo nella memoria del browser (niente
              localStorage) e viaggia solo verso il tuo backend per questa
              richiesta.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => runAudit()}
          disabled={loading}
          className="press mt-5 w-full border-2 border-ink bg-accent px-5 py-4 font-mono text-base font-bold uppercase tracking-[0.15em] text-paper block-shadow-sm disabled:opacity-60"
        >
          {loading ? "Analisi in corso…" : "Analizza →"}
        </button>

        {error && (
          <p
            className="mt-4 border-2 border-ink px-4 py-2 font-mono text-sm font-bold text-paper"
            style={{ background: "var(--sev-critico)" }}
            role="alert"
          >
            {error}
          </p>
        )}
      </section>

      {/* ---------- Loading skeleton ---------- */}
      {loading && (
        <div className="block reveal mt-10 animate-pulse p-8">
          <div className="h-28 w-1/2 bg-paper-2" />
          <div className="mt-6 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-4 w-full bg-paper-2" />
            ))}
          </div>
        </div>
      )}

      {/* ---------- Results ---------- */}
      {result && !loading && (
        <div className="mt-10 space-y-8">
          {aiError && (
            <p
              className="border-2 border-ink px-4 py-2 font-mono text-sm font-bold"
              style={{ background: "var(--sev-serio)", color: "var(--paper)" }}
              role="status"
            >
              Check deterministici completati. AI non disponibile: {aiError}
            </p>
          )}
          {result.issues.some((i) => i.id.startsWith("js-shell")) && (
            <p
              className="border-2 border-ink px-4 py-3 font-mono text-sm font-bold text-paper"
              style={{ background: "var(--sev-serio)" }}
              role="status"
            >
              ⚠ Pagina renderizzata via JavaScript: l&apos;HTML iniziale è quasi
              vuoto, quindi questo score NON è rappresentativo del contenuto
              reale. Serve SSR/prerendering per un audit affidabile (e per una
              buona indicizzazione).
            </p>
          )}
          <ReportSummary result={result} />
          <AuditDashboard result={result} />
          {result.seo && <SeoPanel seo={result.seo} />}
          {result.issues.length > 0 ? (
            <IssueList issues={result.issues} />
          ) : (
            <p className="block p-6 text-center text-sm">
              Nessuna violazione rilevata sui criteri verificabili dall&apos;HTML
              statico. Ottimo punto di partenza — ricorda che alcuni criteri
              (uso reale da tastiera, screen reader, contenuti dinamici)
              richiedono anche una verifica manuale.
            </p>
          )}
        </div>
      )}

      {/* ---------- Footer ---------- */}
      <footer className="no-print mt-16 flex flex-wrap items-center justify-between gap-2 border-t-2 border-ink pt-3 font-mono text-xs uppercase tracking-wider">
        <span>Contrasti misurati in codice · AI solo testo</span>
        <a
          href="https://www.w3.org/TR/WCAG22/"
          target="_blank"
          rel="noreferrer"
          className="underline-offset-4 hover:underline"
        >
          WCAG 2.2 ↗
        </a>
      </footer>
    </main>
  );
}
