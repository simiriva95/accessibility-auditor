import * as cheerio from "cheerio";
import type { SeoFinding, SeoReport, Severity } from "./types";

// Deterministic on-page SEO / indexability checks over static HTML.
// Goal: rank #1 — surface the signals Google actually reads from the markup.
// Like the WCAG side: measurable facts only, each with why + how to fix.

const WEIGHT: Record<Severity, number> = { critico: 28, serio: 13, moderato: 6, minore: 3 };

let n = 0;
function f(
  area: string,
  gravita: Severity,
  elemento: string,
  spiegazione: string,
  rimedio: string,
  misura?: string,
): SeoFinding {
  n += 1;
  return { id: `seo-${n}`, area, gravita, elemento, spiegazione, rimedio, misura };
}

function textLen(s: string): number {
  return s.replace(/\s+/g, " ").trim().length;
}

export function seoChecks(html: string, pageUrl?: string): SeoReport {
  n = 0;
  const $ = cheerio.load(html);
  const issues: SeoFinding[] = [];

  // --- Title ---
  const title = ($("head title").first().text() || "").trim();
  if (!title) {
    issues.push(
      f("Title", "critico", "<title> assente",
        "Manca il tag <title>: è il fattore on-page più importante e il testo blu cliccabile nei risultati Google.",
        "Aggiungi un <title> unico di 30-60 caratteri con la keyword principale."),
    );
  } else if (title.length < 15 || title.length > 60) {
    issues.push(
      f("Title", "moderato", `<title>${title}</title>`,
        `Il title è ${title.length} caratteri: fuori dall'intervallo ottimale (30-60). Troppo corto spreca spazio, troppo lungo viene troncato nella SERP.`,
        "Porta il title a 30-60 caratteri, keyword principale all'inizio.",
        `${title.length} caratteri`),
    );
  }

  // --- Meta description ---
  const desc = ($('meta[name="description"]').attr("content") || "").trim();
  if (!desc) {
    issues.push(
      f("Meta description", "serio", "<meta name=description> assente",
        "Manca la meta description: Google genera uno snippet automatico, spesso poco invitante. Incide sul CTR (click-through) dalla SERP.",
        "Aggiungi una meta description di 50-160 caratteri persuasiva con la keyword."),
    );
  } else if (textLen(desc) < 50 || textLen(desc) > 160) {
    issues.push(
      f("Meta description", "moderato", `"${desc.slice(0, 80)}…"`,
        `Meta description di ${textLen(desc)} caratteri: fuori dall'intervallo consigliato (50-160), rischia il troncamento o l'inefficacia.`,
        "Riscrivi la description tra 50 e 160 caratteri.",
        `${textLen(desc)} caratteri`),
    );
  }

  // --- Indicizzazione: meta robots noindex ---
  const robots = ($('meta[name="robots"]').attr("content") || "").toLowerCase();
  if (/noindex/.test(robots)) {
    issues.push(
      f("Indicizzazione", "critico", `<meta name="robots" content="${robots}">`,
        "La pagina ha noindex: dice esplicitamente a Google di NON indicizzarla. Se non è voluto, la pagina non comparirà mai nei risultati.",
        'Rimuovi noindex (o usa "index, follow") se la pagina deve essere trovata.'),
    );
  }

  // --- Canonical ---
  if ($('link[rel="canonical"]').length === 0) {
    issues.push(
      f("Canonical", "moderato", "<link rel=canonical> assente",
        "Manca l'URL canonico: in presenza di contenuti duplicati o parametri, Google potrebbe indicizzare la versione sbagliata e diluire il ranking.",
        'Aggiungi <link rel="canonical" href="URL-preferito"> nell\'<head>.'),
    );
  }

  // --- H1 ---
  const h1 = $("h1").length;
  if (h1 === 0) {
    issues.push(
      f("Struttura", "serio", "Nessun <h1>",
        "Manca l'<h1>: è il titolo principale che Google usa per capire l'argomento della pagina.",
        "Aggiungi un unico <h1> con la keyword principale."),
    );
  } else if (h1 > 1) {
    issues.push(
      f("Struttura", "minore", `${h1} elementi <h1>`,
        "Più <h1>: diluisce il segnale sull'argomento principale della pagina.",
        "Usa un solo <h1>; gli altri titoli come <h2>/<h3>.", `${h1} h1`),
    );
  }

  // --- Viewport (mobile-first indexing) ---
  if ($('meta[name="viewport"]').length === 0) {
    issues.push(
      f("Mobile", "serio", "<meta name=viewport> assente",
        "Manca il meta viewport: Google usa il mobile-first indexing. Senza, la pagina non è mobile-friendly e perde posizioni.",
        'Aggiungi <meta name="viewport" content="width=device-width, initial-scale=1">.'),
    );
  }

  // --- lang ---
  if (!($("html").attr("lang") || "").trim()) {
    issues.push(
      f("Lingua", "moderato", "<html> senza lang",
        "Manca l'attributo lang: aiuta Google a servire la pagina agli utenti della lingua giusta.",
        'Aggiungi lang alla radice, es. <html lang="it">.'),
    );
  }

  // --- Open Graph (anteprima social) ---
  const ogMissing = ["og:title", "og:description", "og:image"].filter(
    (p) => $(`meta[property="${p}"]`).length === 0,
  );
  if (ogMissing.length) {
    issues.push(
      f("Social / Open Graph", "moderato", `Mancano: ${ogMissing.join(", ")}`,
        "Open Graph incompleto: quando il link è condiviso su social/chat, l'anteprima (titolo, testo, immagine) è assente o brutta, riducendo i click.",
        "Aggiungi og:title, og:description e og:image (1200×630) nell'<head>."),
    );
  }

  // --- Immagini senza alt (SEO immagini) ---
  const imgsNoAlt = $("img").filter((_, el) => $(el).attr("alt") === undefined).length;
  if (imgsNoAlt > 0) {
    issues.push(
      f("Immagini", "moderato", `${imgsNoAlt} <img> senza alt`,
        "Immagini senza alt: perdi posizionamento su Google Immagini e contesto semantico per il ranking.",
        "Aggiungi alt descrittivi con parole chiave pertinenti (senza keyword stuffing).",
        `${imgsNoAlt} immagini`),
    );
  }

  // --- Structured data (JSON-LD) ---
  if ($('script[type="application/ld+json"]').length === 0) {
    issues.push(
      f("Dati strutturati", "minore", "Nessun JSON-LD (schema.org)",
        "Nessun dato strutturato: perdi i rich result (stelle, FAQ, breadcrumb, sitelinks) che aumentano visibilità e CTR.",
        "Aggiungi JSON-LD schema.org pertinente (Organization, Article, Product, FAQ…)."),
    );
  }

  // --- HTTPS ---
  if (pageUrl && pageUrl.startsWith("http://")) {
    issues.push(
      f("Sicurezza", "serio", pageUrl,
        "La pagina è servita su HTTP: Google usa HTTPS come fattore di ranking e i browser la marcano come «non sicura».",
        "Servi il sito su HTTPS con un certificato valido e reindirizza HTTP→HTTPS."),
    );
  }

  // --- Thin content ---
  const words = ($("body").text().match(/\S+/g) || []).length;
  if (words < 200) {
    issues.push(
      f("Contenuto", "moderato", `~${words} parole nell'HTML`,
        "Contenuto molto scarno nell'HTML statico (thin content): poche parole indicizzabili. Se il testo arriva via JavaScript, i crawler potrebbero non vederlo.",
        "Assicura contenuto testuale sostanziale nell'HTML iniziale (SSR/SSG se usi un framework JS).",
        `${words} parole`),
    );
  }

  const penalty = issues.reduce((s, i) => s + WEIGHT[i.gravita], 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  return { score, issues };
}

// ponytail: inline self-check. Run with `npx tsx lib/seo-checks.ts`.
function demo() {
  const assert = (c: boolean, m: string) => {
    if (!c) throw new Error("FAIL: " + m);
  };
  const bad = `<!doctype html><html><head>
    <meta name="robots" content="noindex">
  </head><body><div>ciao</div></body></html>`;
  const r = seoChecks(bad, "http://x.test");
  const areas = r.issues.map((i) => i.area);
  for (const a of ["Title", "Meta description", "Indicizzazione", "Canonical", "Struttura", "Mobile", "Social / Open Graph", "Dati strutturati", "Sicurezza", "Contenuto"]) {
    assert(areas.includes(a), `expected SEO area: ${a}`);
  }
  assert(r.score < 50, "bad page low SEO score");

  const good = `<!doctype html><html lang="it"><head>
    <title>Simone Riva — Sviluppatore Full Stack a Milano</title>
    <meta name="description" content="Portfolio di Simone Riva, sviluppatore full stack: progetti, competenze e contatti. Realizzo applicazioni web moderne, veloci e accessibili.">
    <link rel="canonical" href="https://x.test/">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta property="og:title" content="Simone Riva"><meta property="og:description" content="Portfolio"><meta property="og:image" content="/og.png">
    <script type="application/ld+json">{}</script>
  </head><body><h1>Simone Riva</h1>${"<p>Testo sostanzioso e utile per gli utenti. </p>".repeat(60)}</body></html>`;
  const g = seoChecks(good, "https://x.test/");
  assert(g.score >= 90, `good page high SEO score (got ${g.score}: ${g.issues.map((i) => i.area)})`);
  console.log("seo-checks self-check OK");
}

if (require.main === module) demo();
