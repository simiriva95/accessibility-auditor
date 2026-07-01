"use client";

import { useState } from "react";
import type { SeoFinding, SeoReport, Severity } from "@/lib/types";

const SEV_COLOR: Record<Severity, string> = {
  critico: "var(--sev-critico)",
  serio: "var(--sev-serio)",
  moderato: "var(--sev-moderato)",
  minore: "var(--sev-minore)",
};
const SEV_ORDER: Record<Severity, number> = { critico: 0, serio: 1, moderato: 2, minore: 3 };

function scoreColor(score: number): string {
  if (score >= 90) return "var(--sev-minore)";
  if (score >= 70) return "var(--sev-serio)";
  return "var(--sev-critico)";
}

function Row({ finding }: { finding: SeoFinding }) {
  const [open, setOpen] = useState(false);
  const color = SEV_COLOR[finding.gravita];
  return (
    <div className="block flex">
      <span className="w-3 shrink-0 border-r-2 border-ink" style={{ background: color }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-start gap-3 p-4 text-left"
          aria-expanded={open}
        >
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span
                className="px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-paper"
                style={{ background: color }}
              >
                {finding.gravita}
              </span>
              <span className="border-2 border-ink px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase">
                {finding.area}
              </span>
              {finding.misura && (
                <span className="bg-ink px-1.5 py-0.5 font-mono text-[10px] text-paper">
                  {finding.misura}
                </span>
              )}
            </span>
            <span className="mt-1 block text-sm text-ink-soft text-pretty line-clamp-2">
              {finding.spiegazione}
            </span>
          </span>
          <span
            className="mt-1 shrink-0 font-mono text-lg transition-transform"
            style={{ transform: open ? "rotate(45deg)" : "none" }}
            aria-hidden="true"
          >
            +
          </span>
        </button>
        {open && (
          <div className="space-y-3 border-t-2 border-ink p-4">
            <div>
              <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">Perché conta per Google</span>
              <p className="mt-1 text-sm leading-relaxed text-pretty">{finding.spiegazione}</p>
            </div>
            <div className="border-l-4 border-accent bg-paper-2 p-3">
              <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">Come risolvere</span>
              <p className="mt-1 text-sm leading-relaxed text-pretty">{finding.rimedio}</p>
            </div>
            <pre className="overflow-x-auto border-2 border-ink bg-paper-2 p-3 text-xs">
              <code className="font-mono whitespace-pre-wrap break-words text-ink-soft">{finding.elemento}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export function SeoPanel({ seo }: { seo: SeoReport }) {
  const sorted = [...seo.issues].sort((a, b) => SEV_ORDER[a.gravita] - SEV_ORDER[b.gravita]);
  const color = scoreColor(seo.score);
  return (
    <section className="space-y-4">
      <div className="block block-shadow flex items-stretch bg-paper">
        <div className="ink flex flex-col justify-center px-6 py-4">
          <span className="kicker text-paper/70">SEO / Indicizzazione</span>
          <span className="font-display text-5xl font-black tabular-nums" style={{ color }}>
            {seo.score}
          </span>
        </div>
        <div className="flex flex-1 items-center p-4">
          <p className="text-sm text-pretty">
            {seo.issues.length === 0
              ? "Nessun problema SEO on-page rilevato dall'HTML."
              : `${seo.issues.length} segnali SEO da sistemare per posizionarti meglio su Google.`}
          </p>
        </div>
      </div>
      {sorted.length > 0 && (
        <div className="space-y-4">
          {sorted.map((f) => (
            <Row key={f.id} finding={f} />
          ))}
        </div>
      )}
    </section>
  );
}
