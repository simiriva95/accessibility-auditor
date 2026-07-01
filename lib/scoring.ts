import type { Issue, CategoryScore, WcagCategory, Severity } from "./types";

// Deterministic scoring. Each issue subtracts weighted points from a 100 base,
// per POUR category and overall. Pure function of the issue list -> reproducible.

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critico: 15,
  serio: 9,
  moderato: 5,
  minore: 2,
};

const CATEGORIES: WcagCategory[] = [
  "percepibile",
  "utilizzabile",
  "comprensibile",
  "robusto",
];

const LABEL: Record<WcagCategory, string> = {
  percepibile: "Percepibile",
  utilizzabile: "Utilizzabile",
  comprensibile: "Comprensibile",
  robusto: "Robusto",
};

export function categoryLabel(c: WcagCategory): string {
  return LABEL[c];
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function scoreFromIssues(issues: Issue[]): {
  score: number;
  breakdown: CategoryScore[];
} {
  const breakdown: CategoryScore[] = CATEGORIES.map((categoria) => {
    const inCat = issues.filter((i) => i.categoria === categoria);
    const penalty = inCat.reduce((s, i) => s + SEVERITY_WEIGHT[i.gravita], 0);
    return { categoria, score: clamp(100 - penalty), issues: inCat.length };
  });

  const totalPenalty = issues.reduce(
    (s, i) => s + SEVERITY_WEIGHT[i.gravita],
    0,
  );
  return { score: clamp(100 - totalPenalty), breakdown };
}
