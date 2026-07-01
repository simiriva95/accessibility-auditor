function colorFor(score: number): string {
  if (score >= 90) return "var(--sev-minore)";
  if (score >= 70) return "var(--sev-serio)";
  if (score >= 40) return "var(--sev-serio)";
  return "var(--sev-critico)";
}

function gradeFor(score: number): string {
  if (score >= 90) return "Ottimo";
  if (score >= 70) return "Buono";
  if (score >= 40) return "Da migliorare";
  return "Critico";
}

// Brutalist score: a massive numeral in an ink block, accent status rule below.
export function ScoreGauge({ score }: { score: number }) {
  const color = colorFor(score);
  return (
    <div
      className="ink relative w-full"
      role="img"
      aria-label={`Punteggio di accessibilità ${score} su 100 — ${gradeFor(score)}`}
    >
      <div className="flex items-start justify-between px-5 pt-4">
        <span className="kicker text-paper/70">Score</span>
        <span className="kicker text-paper/70">/ 100</span>
      </div>
      <div
        className="px-4 pb-2 font-display font-black tabular-nums leading-[0.8]"
        style={{ fontSize: "clamp(6rem, 16vw, 11rem)" }}
        aria-hidden="true"
      >
        {score}
      </div>
      <div className="flex items-center justify-between gap-3 px-5 pb-4">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-paper">
          {gradeFor(score)}
        </span>
        <span
          className="h-3 flex-1 max-w-[55%]"
          style={{ background: color }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
