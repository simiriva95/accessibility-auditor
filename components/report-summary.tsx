"use client";

import { useState } from "react";
import type { AuditResult, Severity } from "@/lib/types";
import { summarize, toMarkdown, type Verdict } from "@/lib/report";

const VERDICT_COLOR: Record<Verdict, string> = {
  "non-conforme": "var(--sev-critico)",
  "conforme-a": "var(--sev-serio)",
  "conforme-aa": "var(--sev-minore)",
  "conforme-aaa": "var(--sev-minore)",
};

const SEV_COLOR: Record<Severity, string> = {
  critico: "var(--sev-critico)",
  serio: "var(--sev-serio)",
  moderato: "var(--sev-moderato)",
  minore: "var(--sev-minore)",
};

const SEVERITIES: Severity[] = ["critico", "serio", "moderato", "minore"];

function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function ActionButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press border-2 border-ink bg-paper px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider"
    >
      {children}
    </button>
  );
}

export function ReportSummary({ result }: { result: AuditResult }) {
  const [copied, setCopied] = useState(false);
  const s = summarize(result.issues);
  const stamp = result.checkedAt.slice(0, 10);

  return (
    <section className="block block-shadow reveal bg-paper">
      {/* Verdict banner */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink p-4 text-paper"
        style={{ background: VERDICT_COLOR[s.verdict] }}
      >
        <div>
          <span className="kicker opacity-80">Verdetto conformità</span>
          <p className="font-display text-xl font-bold leading-tight md:text-2xl">
            {s.verdictLabel}
          </p>
        </div>
        <span className="font-mono text-xs uppercase tracking-wider opacity-90">
          {result.issues.length} problemi · score {result.score}/100
        </span>
      </div>

      {/* Severity counts + WCAG level counts */}
      <div className="grid grid-cols-2 divide-x-2 divide-y-2 divide-ink sm:grid-cols-4 sm:divide-y-0">
        {SEVERITIES.map((sev) => (
          <div key={sev} className="p-4">
            <span
              className="block font-display text-3xl font-black tabular-nums"
              style={{ color: SEV_COLOR[sev] }}
            >
              {s.bySeverity[sev]}
            </span>
            <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
              {sev}
            </span>
          </div>
        ))}
      </div>

      {/* Export actions */}
      <div className="no-print flex flex-wrap items-center gap-2 border-t-2 border-ink p-4">
        <span className="mr-1 font-mono text-xs uppercase tracking-wider text-ink-soft">
          Esporta
        </span>
        <ActionButton
          onClick={() => {
            navigator.clipboard.writeText(toMarkdown(result));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copiato ✓" : "Copia Markdown"}
        </ActionButton>
        <ActionButton
          onClick={() =>
            download(`audit-${stamp}.json`, JSON.stringify(result, null, 2), "application/json")
          }
        >
          Scarica JSON
        </ActionButton>
        <ActionButton
          onClick={() =>
            download(`audit-${stamp}.md`, toMarkdown(result), "text/markdown")
          }
        >
          Scarica .md
        </ActionButton>
        <ActionButton onClick={() => window.print()}>Stampa / PDF</ActionButton>
      </div>
    </section>
  );
}
