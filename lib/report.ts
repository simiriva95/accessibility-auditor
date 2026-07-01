import type { AuditResult, Issue, Severity, WcagLevel } from "./types";
import { categoryLabel } from "./scoring";
import { wcagUrl } from "./wcag-refs";

// Derived report data: severity/level counts + a conformance verdict.
// The verdict is honest about scope — it reflects only the criteria this tool
// can check from static HTML, never a full legal conformance claim.

export type Verdict = "conforme-aaa" | "conforme-aa" | "conforme-a" | "non-conforme";

export interface ReportSummary {
  bySeverity: Record<Severity, number>;
  byLevel: Record<WcagLevel, number>;
  verdict: Verdict;
  verdictLabel: string;
}

const SEVERITIES: Severity[] = ["critico", "serio", "moderato", "minore"];
const LEVELS: WcagLevel[] = ["A", "AA", "AAA"];

export function summarize(issues: Issue[]): ReportSummary {
  const bySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<Severity, number>;
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, 0])) as Record<WcagLevel, number>;
  for (const i of issues) {
    bySeverity[i.gravita]++;
    byLevel[i.livello]++;
  }

  let verdict: Verdict;
  if (byLevel.A > 0) verdict = "non-conforme";
  else if (byLevel.AA > 0) verdict = "conforme-a";
  else if (byLevel.AAA > 0) verdict = "conforme-aa";
  else verdict = "conforme-aaa";

  const verdictLabel = {
    "non-conforme": "Non conforme (violazioni di livello A)",
    "conforme-a": "Conforme A · non conforme AA",
    "conforme-aa": "Conforme AA · non conforme AAA",
    "conforme-aaa": "Nessuna violazione rilevata (A/AA/AAA)",
  }[verdict];

  return { bySeverity, byLevel, verdict, verdictLabel };
}

/** Portable Markdown report — copy/paste into a ticket or hand to a client. */
export function toMarkdown(result: AuditResult): string {
  const s = summarize(result.issues);
  const lines: string[] = [];
  lines.push(`# Audit di accessibilità WCAG 2.2`);
  if (result.url) lines.push(`\n**Pagina:** ${result.url}`);
  lines.push(`**Data:** ${result.checkedAt}`);
  lines.push(`**Score:** ${result.score}/100`);
  lines.push(`**Verdetto:** ${s.verdictLabel}`);
  lines.push(
    `**Problemi:** ${result.issues.length} — ` +
      `critici ${s.bySeverity.critico}, seri ${s.bySeverity.serio}, ` +
      `moderati ${s.bySeverity.moderato}, minori ${s.bySeverity.minore}`,
  );

  lines.push(`\n## Breakdown per principio (POUR)`);
  for (const b of result.breakdown) {
    lines.push(`- **${categoryLabel(b.categoria)}**: ${b.score}/100 (${b.issues} problemi)`);
  }

  lines.push(`\n## Problemi`);
  const order: Severity[] = ["critico", "serio", "moderato", "minore"];
  const sorted = [...result.issues].sort(
    (a, b) => order.indexOf(a.gravita) - order.indexOf(b.gravita),
  );
  for (const i of sorted) {
    lines.push(`\n### [${i.gravita.toUpperCase()} · WCAG ${i.livello}] ${i.criterio}`);
    lines.push(`**Elemento:** \`${i.elemento.replace(/`/g, "'")}\``);
    if (i.misura) lines.push(`**Misura:** ${i.misura}`);
    lines.push(`**Perché:** ${i.spiegazione}`);
    if (i.rimedio) lines.push(`**Come risolvere:** ${i.rimedio}`);
    if (i.fixCodiceCorretto) {
      lines.push(`**Codice corretto:**\n\`\`\`html\n${i.fixCodiceCorretto}\n\`\`\``);
    }
    const url = wcagUrl(i.criterio);
    if (url) lines.push(`**Riferimento:** ${url}`);
  }

  lines.push(`\n---\n_Generato da Accessibility Auditor. I contrasti e i segnali misurabili sono calcolati in modo deterministico; l'analisi copre i criteri verificabili dall'HTML statico._`);
  return lines.join("\n");
}
