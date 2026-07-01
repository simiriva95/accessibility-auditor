import type { AuditResult } from "@/lib/types";
import { categoryLabel } from "@/lib/scoring";
import { ScoreGauge } from "./score-gauge";

export function AuditDashboard({ result }: { result: AuditResult }) {
  const total = result.issues.length;
  return (
    <section className="block block-shadow reveal bg-paper">
      <div className="grid md:grid-cols-[minmax(260px,38%)_1fr]">
        {/* Score — ink block, giant numeral */}
        <div className="border-b-2 border-ink md:border-b-0 md:border-r-2">
          <ScoreGauge score={result.score} />
          <p className="px-5 py-3 font-mono text-xs uppercase tracking-wider">
            {total === 0
              ? "Nessun problema"
              : `${total} ${total === 1 ? "problema" : "problemi"}`}
            {result.url && (
              <span className="mt-1 block truncate normal-case tracking-normal text-ink-soft">
                {result.url}
              </span>
            )}
          </p>
        </div>

        {/* POUR breakdown — stark rows */}
        <div className="divide-y-2 divide-ink">
          <h2 className="px-5 pt-4 pb-2 font-mono text-xs uppercase tracking-[0.2em]">
            Principi WCAG · POUR
          </h2>
          {result.breakdown.map((b) => (
            <div key={b.categoria} className="px-5 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-2xl font-semibold lowercase">
                  {categoryLabel(b.categoria)}
                </span>
                <span className="font-mono text-sm tabular-nums">
                  <span className="text-2xl font-bold">{b.score}</span>
                  <span className="text-ink-soft">
                    {" "}
                    · {b.issues} {b.issues === 1 ? "issue" : "issues"}
                  </span>
                </span>
              </div>
              <div className="mt-2 h-3 w-full border-2 border-ink bg-paper-2">
                <div
                  className="h-full bg-ink transition-[width] duration-700 ease-out"
                  style={{ width: `${b.score}%` }}
                  aria-hidden="true"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
