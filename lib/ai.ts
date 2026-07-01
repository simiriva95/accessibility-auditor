import { generateObject, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import type { Issue } from "./types";

// Provider-agnostic AI layer (BYOK). The AI only writes prose and code fixes —
// it never produces the numeric measures (those come from the deterministic checks).

export type AiProvider = "groq" | "anthropic" | "openai" | "compatible";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  /** Override model id; sensible default per provider otherwise. */
  model?: string;
  /** For "compatible" (Ollama, LM Studio, ...). OpenAI-compatible base URL. */
  baseURL?: string;
}

const DEFAULT_MODEL: Record<AiProvider, string> = {
  // gpt-oss-20b supports json_schema structured outputs on Groq's free tier.
  // llama-3.3-70b does NOT (rejects response_format json_schema).
  groq: "openai/gpt-oss-20b",
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o-mini",
  compatible: "llama3.1",
};

function buildModel(cfg: AiConfig): LanguageModel {
  const model = cfg.model || DEFAULT_MODEL[cfg.provider];
  switch (cfg.provider) {
    case "groq":
      return createOpenAI({ apiKey: cfg.apiKey, baseURL: GROQ_BASE_URL })(model);
    case "anthropic":
      return createAnthropic({ apiKey: cfg.apiKey })(model);
    case "openai":
      return createOpenAI({ apiKey: cfg.apiKey })(model);
    case "compatible":
      return createOpenAI({
        apiKey: cfg.apiKey || "local",
        baseURL: cfg.baseURL || "http://localhost:11434/v1",
      })(model);
  }
}

const EnrichmentSchema = z.object({
  enrichments: z
    .array(
      z.object({
        id: z.string().describe("id del problema deterministico da arricchire"),
        spiegazione: z
          .string()
          .describe("perché è un problema, in italiano, chiaro e conciso"),
        fix_codice_attuale: z
          .string()
          .describe("frammento del codice attuale problematico"),
        fix_codice_corretto: z
          .string()
          .describe("frammento corretto, copiabile"),
      }),
    )
    .describe("una voce per ciascun problema ricevuto, stesso id"),
  ulteriori_problemi: z
    .array(
      z.object({
        criterio_wcag: z.string(),
        livello: z.enum(["A", "AA", "AAA"]),
        gravita: z.enum(["critico", "serio", "moderato", "minore"]),
        categoria: z.enum([
          "percepibile",
          "utilizzabile",
          "comprensibile",
          "robusto",
        ]),
        elemento: z.string(),
        spiegazione: z.string(),
        fix_codice_attuale: z.string(),
        fix_codice_corretto: z.string(),
      }),
    )
    .describe(
      "SOLO problemi non misurabili a codice (es. testo alt non descrittivo, ordine di lettura, lingua di una parte). Niente contrasti o conteggi: già calcolati.",
    ),
});

const SYSTEM = `Sei un esperto di accessibilità web e WCAG 2.2.
Ricevi una lista di problemi GIÀ INDIVIDUATI in modo deterministico (con misure esatte) e l'HTML.
Compito:
1. Per OGNI problema ricevuto, scrivi una spiegazione chiara e un fix concreto e copiabile (codice attuale -> codice corretto), mantenendo lo stesso "id".
2. NON ricalcolare misure numeriche (contrasti, dimensioni, conteggi): sono già corrette, usale.
3. Puoi aggiungere SOLO problemi qualitativi non rilevabili automaticamente (es. alt presente ma non descrittivo, testo dei link ambiguo nel contesto, struttura semantica).
Rispondi esclusivamente con i dati strutturati richiesti. Niente markdown, niente preamboli.`;

/** Strip ```fences``` in case a provider wraps JSON despite instructions. */
export function stripFences(s: string): string {
  return s
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

/** Enrich deterministic issues with AI explanations/fixes and extra qualitative issues.
 *  Returns the merged issue list. Throws on AI failure (caller keeps deterministic-only). */
export async function enrichWithAI(
  cfg: AiConfig,
  deterministic: Issue[],
  html: string,
): Promise<Issue[]> {
  const compact = deterministic.map((i) => ({
    id: i.id,
    criterio: i.criterio,
    livello: i.livello,
    gravita: i.gravita,
    elemento: i.elemento,
    misura: i.misura,
  }));

  const { object } = await generateObject({
    model: buildModel(cfg),
    schema: EnrichmentSchema,
    system: SYSTEM,
    prompt: `Problemi deterministici (JSON):\n${JSON.stringify(compact)}\n\nHTML (troncato):\n${html.slice(0, 18000)}`,
  });

  const byId = new Map(object.enrichments.map((e) => [e.id, e]));
  const merged: Issue[] = deterministic.map((i) => {
    const e = byId.get(i.id);
    if (!e) return i;
    return {
      ...i,
      spiegazione: e.spiegazione || i.spiegazione,
      fixCodiceAttuale: e.fix_codice_attuale,
      fixCodiceCorretto: e.fix_codice_corretto,
    };
  });

  object.ulteriori_problemi.forEach((p, idx) => {
    merged.push({
      id: `ai-${idx + 1}`,
      criterio: p.criterio_wcag,
      livello: p.livello,
      gravita: p.gravita,
      categoria: p.categoria,
      elemento: p.elemento,
      spiegazione: p.spiegazione,
      fixCodiceAttuale: p.fix_codice_attuale,
      fixCodiceCorretto: p.fix_codice_corretto,
      source: "ai",
    });
  });

  return merged;
}
