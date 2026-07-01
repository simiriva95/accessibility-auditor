// Shared types for the Accessibility Auditor.

export type Severity = "critico" | "serio" | "moderato" | "minore";
export type WcagLevel = "A" | "AA" | "AAA";

// POUR — the four WCAG principles.
export type WcagCategory =
  | "percepibile"
  | "utilizzabile"
  | "comprensibile"
  | "robusto";

export type IssueSource = "deterministic" | "ai";

export interface Issue {
  /** Stable id so the AI can map enrichment back to a deterministic finding. */
  id: string;
  criterio: string; // e.g. "1.4.3 Contrasto (Minimo)"
  livello: WcagLevel;
  gravita: Severity;
  categoria: WcagCategory;
  /** The offending HTML snippet (already truncated). */
  elemento: string;
  /** Why it's a problem: rule + impact + who is affected. */
  spiegazione: string;
  /** Deterministic remediation guidance (how to fix), available without AI. */
  rimedio?: string;
  /** Optional measured detail (e.g. contrast ratio) — deterministic only. */
  misura?: string;
  /** Suggested fix, filled by AI. */
  fixCodiceAttuale?: string;
  fixCodiceCorretto?: string;
  source: IssueSource;
}

export interface CategoryScore {
  categoria: WcagCategory;
  score: number; // 0-100
  issues: number;
}

export interface AuditResult {
  url?: string;
  score: number; // 0-100 overall
  breakdown: CategoryScore[];
  issues: Issue[];
  htmlBytes: number;
  checkedAt: string; // ISO timestamp, stamped by the route
}

export interface AuditResponse {
  result: AuditResult;
  aiError?: string;
}
