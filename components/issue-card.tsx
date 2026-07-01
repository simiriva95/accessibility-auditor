"use client";

import { useState } from "react";
import type { Issue, Severity } from "@/lib/types";
import { wcagUrl, criterionCode } from "@/lib/wcag-refs";

const SEV_COLOR: Record<Severity, string> = {
  critico: "var(--sev-critico)",
  serio: "var(--sev-serio)",
  moderato: "var(--sev-moderato)",
  minore: "var(--sev-minore)",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="press border-2 border-ink bg-paper px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider"
    >
      {copied ? "Copiato ✓" : "Copia"}
    </button>
  );
}

function CodeBlock({
  label,
  code,
  tone,
}: {
  label: string;
  code: string;
  tone: "bad" | "good";
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
          {label}
        </span>
        {tone === "good" && <CopyButton text={code} />}
      </div>
      <pre
        className="overflow-x-auto border-2 border-ink bg-paper-2 p-3 text-xs leading-relaxed"
        style={{
          borderLeftWidth: 6,
          borderLeftColor: tone === "bad" ? "var(--sev-critico)" : "var(--sev-minore)",
        }}
      >
        <code className="font-mono whitespace-pre-wrap break-words">{code}</code>
      </pre>
    </div>
  );
}

export function IssueCard({ issue }: { issue: Issue }) {
  const [open, setOpen] = useState(false);
  const color = SEV_COLOR[issue.gravita];

  return (
    <div className="block flex">
      {/* severity spine */}
      <span
        className="w-3 shrink-0 border-r-2 border-ink"
        style={{ background: color }}
        aria-hidden="true"
      />
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
                {issue.gravita}
              </span>
              <span className="border-2 border-ink px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase">
                WCAG {issue.livello}
              </span>
              {issue.source === "ai" && (
                <span className="bg-accent px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-paper">
                  AI
                </span>
              )}
              <span className="font-display text-lg font-semibold">
                {issue.criterio}
              </span>
            </span>
            <span className="mt-1 block text-sm text-ink-soft text-pretty line-clamp-2">
              {issue.spiegazione}
            </span>
            {issue.misura && (
              <span className="mt-1 inline-block bg-ink px-1.5 py-0.5 font-mono text-xs text-paper">
                {issue.misura}
              </span>
            )}
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
          <div className="space-y-4 border-t-2 border-ink p-4">
            <div>
              <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
                Perché è un problema
              </span>
              <p className="mt-1 text-sm leading-relaxed text-pretty">
                {issue.spiegazione}
              </p>
            </div>

            {issue.rimedio && (
              <div className="border-l-4 border-accent bg-paper-2 p-3">
                <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
                  Come risolvere
                </span>
                <p className="mt-1 text-sm leading-relaxed text-pretty">
                  {issue.rimedio}
                </p>
              </div>
            )}

            <div>
              <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
                Elemento
              </span>
              <pre className="mt-1 overflow-x-auto border-2 border-ink bg-paper-2 p-3 text-xs">
                <code className="font-mono whitespace-pre-wrap break-words text-ink-soft">
                  {issue.elemento}
                </code>
              </pre>
            </div>

            {issue.fixCodiceAttuale || issue.fixCodiceCorretto ? (
              <div className="grid gap-3 md:grid-cols-2">
                {issue.fixCodiceAttuale && (
                  <CodeBlock label="Codice attuale" code={issue.fixCodiceAttuale} tone="bad" />
                )}
                {issue.fixCodiceCorretto && (
                  <CodeBlock label="Codice corretto" code={issue.fixCodiceCorretto} tone="good" />
                )}
              </div>
            ) : (
              <p className="border-2 border-dashed border-ink-soft p-3 text-xs text-ink-soft">
                Configura un provider AI per ottenere anche il{" "}
                <strong>codice corretto pronto da copiare</strong> per questo
                elemento specifico.
              </p>
            )}

            {wcagUrl(issue.criterio) && (
              <a
                href={wcagUrl(issue.criterio)}
                target="_blank"
                rel="noreferrer"
                className="inline-block font-mono text-xs font-bold uppercase tracking-wider underline-offset-4 hover:underline"
              >
                Riferimento W3C: {criterionCode(issue.criterio)} ↗
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
