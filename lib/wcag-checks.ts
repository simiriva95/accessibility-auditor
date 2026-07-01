import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";
import type { Issue } from "./types";
import {
  parseColor,
  contrastRatio,
  isLargeText,
  meetsAA,
  meetsAAA,
  round2,
} from "./contrast";
import { buildStyleResolver } from "./css-contrast";

// Deterministic WCAG 2.2 checks over a static HTML DOM (cheerio).
// These run ALWAYS and never depend on the AI. Measurable signals only.
// Every finding carries: why (rule + impact + who is affected) and a
// deterministic remediation (rimedio), so the tool is useful without AI.

const VAGUE_LINKS = [
  "clicca qui",
  "click here",
  "qui",
  "here",
  "leggi",
  "leggi di più",
  "read more",
  "scopri",
  "scopri di più",
  "link",
  "vai",
  "more",
  "details",
  "dettagli",
  "info",
];

// WAI-ARIA 1.2 role names (subset wide enough for real pages).
const VALID_ROLES = new Set([
  "alert", "alertdialog", "application", "article", "banner", "blockquote",
  "button", "caption", "cell", "checkbox", "code", "columnheader", "combobox",
  "complementary", "contentinfo", "definition", "deletion", "dialog",
  "document", "emphasis", "feed", "figure", "form", "generic", "grid",
  "gridcell", "group", "heading", "img", "insertion", "link", "list",
  "listbox", "listitem", "log", "main", "mark", "marquee", "math", "menu",
  "menubar", "menuitem", "menuitemcheckbox", "menuitemradio", "meter",
  "navigation", "none", "note", "option", "paragraph", "presentation",
  "progressbar", "radio", "radiogroup", "region", "row", "rowgroup",
  "rowheader", "scrollbar", "search", "searchbox", "separator", "slider",
  "spinbutton", "status", "strong", "subscript", "superscript", "switch",
  "tab", "table", "tablist", "tabpanel", "term", "textbox", "time", "timer",
  "toolbar", "tooltip", "tree", "treegrid", "treeitem",
]);

function snippet(html: string, max = 240): string {
  const s = html.replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function outer($: CheerioAPI, el: AnyNode): string {
  return snippet($.html(el as never));
}

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

function issue(
  partial: Omit<Issue, "id" | "source"> & { idPrefix: string },
): Issue {
  const { idPrefix, ...rest } = partial;
  return { id: nextId(idPrefix), source: "deterministic", ...rest };
}

export function wcagChecks(html: string): Issue[] {
  counter = 0;
  const $ = cheerio.load(html);
  const issues: Issue[] = [];
  const isFullDoc = /<head|<!doctype|<title|<body/i.test(html);

  // 1. html[lang] mancante o non valido — 3.1.1 (A), Comprensibile
  const lang = ($("html").attr("lang") || "").trim();
  if (!lang) {
    issues.push(
      issue({
        idPrefix: "lang",
        criterio: "3.1.1 Lingua della pagina",
        livello: "A",
        gravita: "serio",
        categoria: "comprensibile",
        elemento: "<html> senza attributo lang",
        spiegazione:
          "L'elemento <html> non dichiara la lingua. Gli screen reader scelgono la voce/pronuncia in base a lang: senza, leggono il contenuto con la fonetica sbagliata. Colpisce gli utenti non vedenti.",
        rimedio: 'Aggiungi lang alla radice, es. <html lang="it">.',
      }),
    );
  } else if (!/^[a-zA-Z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(lang)) {
    issues.push(
      issue({
        idPrefix: "lang-bad",
        criterio: "3.1.1 Lingua della pagina",
        livello: "A",
        gravita: "moderato",
        categoria: "comprensibile",
        elemento: `<html lang="${lang}">`,
        spiegazione: `Il valore di lang ("${lang}") non è un codice lingua BCP 47 valido, quindi gli screen reader lo ignorano.`,
        rimedio: 'Usa un codice valido, es. lang="it" o lang="it-IT".',
      }),
    );
  }

  // 2. img senza alt — 1.1.1 (A), Percepibile
  $("img").each((_, el) => {
    const $el = $(el);
    const alt = $el.attr("alt");
    const role = $el.attr("role");
    const ariaHidden = $el.attr("aria-hidden") === "true";
    const decorative = alt === "" || role === "presentation" || role === "none" || ariaHidden;
    if (alt === undefined && !decorative) {
      issues.push(
        issue({
          idPrefix: "img-alt",
          criterio: "1.1.1 Contenuto non testuale",
          livello: "A",
          gravita: "serio",
          categoria: "percepibile",
          elemento: outer($, el),
          spiegazione:
            "Immagine senza attributo alt. Chi usa screen reader non riceve alcuna descrizione; spesso viene letto il nome del file. Colpisce gli utenti non vedenti.",
          rimedio:
            'Aggiungi alt descrittivo (es. alt="Grafico vendite Q3"). Se decorativa, usa alt="" per farla ignorare.',
        }),
      );
    }
  });

  // 3. input type=image senza alt — 1.1.1 (A), Percepibile
  $('input[type="image"]').each((_, el) => {
    const $el = $(el);
    if (!($el.attr("alt") || "").trim() && !$el.attr("aria-label")) {
      issues.push(
        issue({
          idPrefix: "input-image-alt",
          criterio: "1.1.1 Contenuto non testuale",
          livello: "A",
          gravita: "serio",
          categoria: "percepibile",
          elemento: outer($, el),
          spiegazione:
            "Pulsante immagine (<input type=image>) senza alt: lo screen reader annuncia un controllo senza nome.",
          rimedio: 'Aggiungi alt che descriva l\'azione, es. alt="Cerca".',
        }),
      );
    }
  });

  // 4. form controls senza label — 1.3.1 / 4.1.2 (A), Robusto
  $("input,select,textarea").each((_, el) => {
    const $el = $(el);
    const type = ($el.attr("type") || "").toLowerCase();
    if (["hidden", "submit", "button", "reset", "image"].includes(type)) return;
    const id = $el.attr("id");
    const hasLabelFor = id && $(`label[for="${id}"]`).length > 0;
    const wrapped = $el.closest("label").length > 0;
    const aria = $el.attr("aria-label") || $el.attr("aria-labelledby") || $el.attr("title");
    if (!hasLabelFor && !wrapped && !aria) {
      const onlyPlaceholder = !!$el.attr("placeholder");
      issues.push(
        issue({
          idPrefix: "label",
          criterio: "1.3.1 Informazioni e correlazioni / 4.1.2 Nome, ruolo, valore",
          livello: "A",
          gravita: "serio",
          categoria: "robusto",
          elemento: outer($, el),
          spiegazione: onlyPlaceholder
            ? "Campo con solo placeholder e nessuna label. Il placeholder sparisce alla digitazione e molti screen reader non lo annunciano come nome del campo (3.3.2)."
            : "Campo di form senza label associata né aria-label: non è chiaro quale dato inserire per chi non vede il contesto visivo.",
          rimedio:
            'Associa una <label for="id"> al campo, oppure avvolgi il campo nella <label>, oppure aggiungi aria-label. Il placeholder non sostituisce la label.',
        }),
      );
    }
  });

  // 5. label[for] verso id inesistente — 1.3.1 (A), Robusto
  $("label[for]").each((_, el) => {
    const target = $(el).attr("for");
    if (target && $(`#${cssEscape(target)}`).length === 0) {
      issues.push(
        issue({
          idPrefix: "label-orphan",
          criterio: "1.3.1 Informazioni e correlazioni",
          livello: "A",
          gravita: "moderato",
          categoria: "robusto",
          elemento: outer($, el),
          spiegazione: `La label punta a for="${target}" ma nessun elemento ha quell'id: l'associazione label↔campo non esiste.`,
          rimedio: `Allinea l'attributo for all'id reale del campo, oppure correggi l'id mancante.`,
        }),
      );
    }
  });

  // 6. aria-labelledby / aria-describedby verso id inesistenti — 1.3.1/4.1.2 (A)
  $("[aria-labelledby],[aria-describedby]").each((_, el) => {
    const $el = $(el);
    for (const attr of ["aria-labelledby", "aria-describedby"]) {
      const val = $el.attr(attr);
      if (!val) continue;
      const missing = val
        .split(/\s+/)
        .filter(Boolean)
        .filter((idref) => $(`#${cssEscape(idref)}`).length === 0);
      if (missing.length) {
        issues.push(
          issue({
            idPrefix: "aria-ref",
            criterio: "4.1.2 Nome, ruolo, valore",
            livello: "A",
            gravita: "serio",
            categoria: "robusto",
            elemento: outer($, el),
            spiegazione: `${attr} riferisce id inesistenti (${missing.join(", ")}): il nome/descrizione accessibile non viene calcolato e lo screen reader resta senza testo.`,
            rimedio: `Fai puntare ${attr} a id realmente presenti nella pagina.`,
          }),
        );
      }
    }
  });

  // 7. ruolo ARIA non valido — 4.1.2 (A), Robusto
  $("[role]").each((_, el) => {
    const roles = ($(el).attr("role") || "").split(/\s+/).filter(Boolean);
    const bad = roles.filter((r) => !VALID_ROLES.has(r.toLowerCase()));
    if (bad.length) {
      issues.push(
        issue({
          idPrefix: "role",
          criterio: "4.1.2 Nome, ruolo, valore",
          livello: "A",
          gravita: "moderato",
          categoria: "robusto",
          elemento: outer($, el),
          misura: `role="${bad.join(" ")}"`,
          spiegazione: `Ruolo ARIA non riconosciuto ("${bad.join(" ")}"): le tecnologie assistive lo ignorano, quindi il ruolo dell'elemento non viene comunicato.`,
          rimedio: "Usa un ruolo WAI-ARIA valido o rimuovi l'attributo affidandoti all'HTML semantico.",
        }),
      );
    }
  });

  // 8. gerarchia heading — 1.3.1 (A) / 2.4.6 (AA), Percepibile
  const headings = $("h1,h2,h3,h4,h5,h6")
    .toArray()
    .map((el) => ({ level: Number(el.tagName[1]), el }));
  const h1count = headings.filter((h) => h.level === 1).length;
  if (headings.length > 0 && h1count === 0) {
    issues.push(
      issue({
        idPrefix: "h1-missing",
        criterio: "1.3.1 Informazioni e correlazioni",
        livello: "A",
        gravita: "moderato",
        categoria: "percepibile",
        elemento: "Nessun <h1> nella pagina",
        spiegazione:
          "La pagina ha intestazioni ma nessun <h1>: manca il titolo principale che ancora la struttura. Chi naviga per intestazioni perde il punto di partenza.",
        rimedio: "Introduci un unico <h1> che descriva il contenuto principale della pagina.",
      }),
    );
  }
  if (h1count > 1) {
    issues.push(
      issue({
        idPrefix: "h1-multi",
        criterio: "1.3.1 Informazioni e correlazioni",
        livello: "A",
        gravita: "minore",
        categoria: "percepibile",
        elemento: `${h1count} elementi <h1>`,
        spiegazione:
          "Più di un <h1>: la gerarchia del documento diventa ambigua per la navigazione tramite intestazioni.",
        rimedio: "Mantieni un solo <h1>; usa <h2>–<h6> per le sezioni successive.",
      }),
    );
  }
  let prev = 0;
  for (const h of headings) {
    const text = $(h.el).text().replace(/\s+/g, " ").trim();
    if (!text && !$(h.el).attr("aria-label")) {
      issues.push(
        issue({
          idPrefix: "h-empty",
          criterio: "1.3.1 Informazioni e correlazioni",
          livello: "A",
          gravita: "moderato",
          categoria: "percepibile",
          elemento: outer($, h.el),
          spiegazione: `Intestazione <h${h.level}> vuota: appare nella mappa delle intestazioni come voce senza testo, confondendo la navigazione.`,
          rimedio: "Rimuovi l'intestazione vuota o inserisci un testo significativo.",
        }),
      );
    }
    if (prev && h.level > prev + 1) {
      issues.push(
        issue({
          idPrefix: "h-skip",
          criterio: "1.3.1 Informazioni e correlazioni",
          livello: "A",
          gravita: "moderato",
          categoria: "percepibile",
          elemento: outer($, h.el),
          spiegazione: `Salto di livello nelle intestazioni: da h${prev} a h${h.level}. La gerarchia deve crescere di un livello alla volta, altrimenti la struttura risulta incoerente per gli screen reader.`,
          rimedio: `Usa h${prev + 1} invece di h${h.level}, oppure inserisci i livelli intermedi.`,
        }),
      );
    }
    prev = h.level;
  }

  // 9. contrasto testo — 1.4.3 (AA) / 1.4.6 (AAA), Percepibile.
  // Risolve i colori da <style> + inline (best-effort). Dedupe per combinazione.
  const resolveStyle = buildStyleResolver($);
  const TEXT_SEL =
    "p,a,li,span,h1,h2,h3,h4,h5,h6,td,th,button,label,strong,em,small,blockquote,figcaption,dt,dd,summary,caption,b,i,mark";
  const seenCombo = new Set<string>();
  const CONTRAST_CAP = 50;
  $(TEXT_SEL).each((_, el) => {
    if (seenCombo.size >= CONTRAST_CAP) return;
    const $el = $(el);
    const ownText = $el
      .contents()
      .filter((_, n) => n.type === "text")
      .text()
      .replace(/\s+/g, " ")
      .trim();
    if (!ownText) return;
    const st = resolveStyle(el as Element);
    const fg = parseColor(st.color);
    const bg = parseColor(st.bg);
    if (!fg || !bg) return; // colore o sfondo non determinabili -> no guess
    const large = isLargeText(st.fontSize, st.bold);
    const combo = `${st.color}|${st.bg}|${large}`;
    if (seenCombo.has(combo)) return;
    seenCombo.add(combo);
    const ratio = round2(contrastRatio(fg, bg));
    if (!meetsAA(ratio, large)) {
      issues.push(
        issue({
          idPrefix: "contrast-aa",
          criterio: "1.4.3 Contrasto (Minimo)",
          livello: "AA",
          gravita: "serio",
          categoria: "percepibile",
          elemento: outer($, el),
          misura: `rapporto ${ratio}:1 (richiesto ${large ? "3" : "4.5"}:1)`,
          spiegazione: `Contrasto testo/sfondo ${ratio}:1, sotto la soglia AA di ${large ? "3" : "4.5"}:1. Il testo è poco leggibile per ipovedenti e in condizioni di luce forte.`,
          rimedio: `Scurisci il testo o schiarisci lo sfondo fino ad almeno ${large ? "3" : "4.5"}:1 (testo normale 4.5:1, testo grande 3:1).`,
        }),
      );
    } else if (!meetsAAA(ratio, large)) {
      issues.push(
        issue({
          idPrefix: "contrast-aaa",
          criterio: "1.4.6 Contrasto (Avanzato)",
          livello: "AAA",
          gravita: "minore",
          categoria: "percepibile",
          elemento: outer($, el),
          misura: `rapporto ${ratio}:1 (richiesto ${large ? "4.5" : "7"}:1)`,
          spiegazione: `Contrasto ${ratio}:1: rispetta AA ma non la soglia AAA di ${large ? "4.5" : "7"}:1.`,
          rimedio: `Per la conformità AAA porta il rapporto ad almeno ${large ? "4.5" : "7"}:1.`,
        }),
      );
    }
  });

  // 10. link non descrittivi — 2.4.4 (A), Utilizzabile
  $("a").each((_, el) => {
    const $el = $(el);
    const text = ($el.text() || "").replace(/\s+/g, " ").trim().toLowerCase();
    const aria = $el.attr("aria-label");
    const href = $el.attr("href");
    if (text && !aria && VAGUE_LINKS.includes(text)) {
      issues.push(
        issue({
          idPrefix: "vague-link",
          criterio: "2.4.4 Scopo del collegamento (nel contesto)",
          livello: "A",
          gravita: "moderato",
          categoria: "utilizzabile",
          elemento: outer($, el),
          spiegazione: `Testo del link generico ("${text}"). Chi naviga saltando di link in link (screen reader) sente solo "${text}" e non capisce la destinazione.`,
          rimedio: 'Usa un testo che descriva la meta (es. "Scarica il listino PDF") o aggiungi un aria-label esplicito.',
        }),
      );
    }
    if (href !== undefined && (href === "#" || href.trim() === "") && !aria) {
      issues.push(
        issue({
          idPrefix: "empty-href",
          criterio: "2.4.4 Scopo del collegamento (nel contesto)",
          livello: "A",
          gravita: "minore",
          categoria: "utilizzabile",
          elemento: outer($, el),
          spiegazione:
            'Link con href vuoto o "#": non porta da nessuna parte e confonde la navigazione da tastiera.',
          rimedio: "Dai un href reale, oppure usa un <button> se l'elemento esegue un'azione invece di navigare.",
        }),
      );
    }
  });

  // 11. link-icona senza nome accessibile — 2.4.4 / 4.1.2 (A), Utilizzabile
  $("a[href]").each((_, el) => {
    const $el = $(el);
    const text = ($el.text() || "").replace(/\s+/g, " ").trim();
    if (text) return;
    if ($el.attr("aria-label") || $el.attr("aria-labelledby") || $el.attr("title")) return;
    if ($el.find("img[alt]").filter((_, im) => ($(im).attr("alt") || "").trim() !== "").length)
      return;
    if ($el.children().length > 0 || $el.find("svg,img,i").length > 0) {
      issues.push(
        issue({
          idPrefix: "icon-link",
          criterio: "2.4.4 Scopo del collegamento / 4.1.2 Nome, ruolo, valore",
          livello: "A",
          gravita: "serio",
          categoria: "utilizzabile",
          elemento: outer($, el),
          spiegazione:
            "Link con sola icona e nessun nome accessibile (testo, aria-label o alt): per chi usa screen reader è un collegamento muto.",
          rimedio: 'Aggiungi aria-label al link (es. aria-label="Apri il profilo") o un alt all\'icona <img>.',
        }),
      );
    }
  });

  // 12. controlli senza nome accessibile — 4.1.2 (A), Robusto
  $("button,a[role='button'],[role='link']").each((_, el) => {
    const $el = $(el);
    const text = ($el.text() || "").trim();
    const aria = $el.attr("aria-label") || $el.attr("aria-labelledby");
    const title = $el.attr("title");
    const imgAlt = $el.find("img[alt]").filter((_, im) => ($(im).attr("alt") || "").trim() !== "").length > 0;
    if (!text && !aria && !title && !imgAlt) {
      issues.push(
        issue({
          idPrefix: "no-name",
          criterio: "4.1.2 Nome, ruolo, valore",
          livello: "A",
          gravita: "critico",
          categoria: "robusto",
          elemento: outer($, el),
          spiegazione:
            "Controllo interattivo senza nome accessibile (nessun testo, aria-label o title): per uno screen reader è un pulsante muto e l'utente non sa cosa fa.",
          rimedio: "Inserisci testo visibile nel controllo o un aria-label che ne descriva l'azione.",
        }),
      );
    }
  });

  // 13. touch target < 24px — 2.5.8 (AA), Utilizzabile
  $("a,button,input,select,[role='button']").each((_, el) => {
    const $el = $(el);
    const st = $el.attr("style") || "";
    const w = st.match(/(?:^|;)\s*width:\s*([\d.]+)px/);
    const h = st.match(/(?:^|;)\s*height:\s*([\d.]+)px/);
    const small = (m: RegExpMatchArray | null) =>
      m && Number(m[1]) > 0 && Number(m[1]) < 24;
    if (small(w) || small(h)) {
      issues.push(
        issue({
          idPrefix: "touch",
          criterio: "2.5.8 Dimensione del target (Minimo)",
          livello: "AA",
          gravita: "moderato",
          categoria: "utilizzabile",
          elemento: outer($, el),
          misura: "dimensione dichiarata < 24px",
          spiegazione:
            "Target interattivo sotto 24×24px: difficile da centrare con dito o mouse impreciso. Colpisce utenti con disabilità motorie e su touch screen.",
          rimedio: "Porta l'area cliccabile ad almeno 24×24px (meglio 44×44px), anche con padding.",
        }),
      );
    }
  });

  // 14. titolo pagina mancante — 2.4.2 (A), Utilizzabile (solo documenti completi)
  if (isFullDoc && !($("title").first().text() || "").trim()) {
    issues.push(
      issue({
        idPrefix: "title",
        criterio: "2.4.2 Titolo della pagina",
        livello: "A",
        gravita: "moderato",
        categoria: "utilizzabile",
        elemento: "<head> senza <title>",
        spiegazione:
          "La pagina non ha un <title>: nelle schede del browser, nei preferiti e nei risultati di ricerca non è identificabile, e gli screen reader non annunciano di che pagina si tratta all'apertura.",
        rimedio: "Aggiungi un <title> univoco e descrittivo nell'<head>.",
      }),
    );
  }

  // 15. viewport che blocca lo zoom — 1.4.4 (AA), Percepibile
  const viewport = $('meta[name="viewport"]').attr("content") || "";
  const maxScale = viewport.match(/maximum-scale\s*=\s*([\d.]+)/);
  if (/user-scalable\s*=\s*(no|0)/.test(viewport) || (maxScale && Number(maxScale[1]) < 2)) {
    issues.push(
      issue({
        idPrefix: "viewport-zoom",
        criterio: "1.4.4 Ridimensionamento del testo",
        livello: "AA",
        gravita: "serio",
        categoria: "percepibile",
        elemento: `<meta name="viewport" content="${snippet(viewport, 80)}">`,
        spiegazione:
          "Il meta viewport disabilita lo zoom (user-scalable=no o maximum-scale<2). Gli ipovedenti non possono ingrandire il testo sul mobile.",
        rimedio: 'Rimuovi user-scalable=no e maximum-scale; lascia width=device-width, initial-scale=1.',
      }),
    );
  }

  // 16. video senza sottotitoli — 1.2.2 (A), Percepibile
  $("video").each((_, el) => {
    const $el = $(el);
    const hasCaptions = $el.find('track[kind="captions"],track[kind="subtitles"]').length > 0;
    if (!hasCaptions) {
      issues.push(
        issue({
          idPrefix: "video-captions",
          criterio: "1.2.2 Sottotitoli (preregistrati)",
          livello: "A",
          gravita: "serio",
          categoria: "percepibile",
          elemento: outer($, el),
          spiegazione:
            "Video senza traccia di sottotitoli: chi è sordo o in ambiente silenzioso non accede al parlato.",
          rimedio: 'Aggiungi <track kind="captions" srclang="it" src="...vtt" /> con i sottotitoli sincronizzati.',
        }),
      );
    }
  });

  // 17. iframe senza title — 4.1.2 (A), Robusto
  $("iframe").each((_, el) => {
    const $el = $(el);
    if (!($el.attr("title") || "").trim() && !$el.attr("aria-label")) {
      issues.push(
        issue({
          idPrefix: "iframe-title",
          criterio: "4.1.2 Nome, ruolo, valore",
          livello: "A",
          gravita: "moderato",
          categoria: "robusto",
          elemento: outer($, el),
          spiegazione:
            "<iframe> senza attributo title: lo screen reader annuncia un frame senza sapere cosa contiene.",
          rimedio: 'Aggiungi title che descriva il contenuto, es. title="Mappa della sede".',
        }),
      );
    }
  });

  // 18. tabindex positivo — 2.4.3 (A), Utilizzabile
  $("[tabindex]").each((_, el) => {
    const v = Number($(el).attr("tabindex"));
    if (Number.isFinite(v) && v > 0) {
      issues.push(
        issue({
          idPrefix: "tabindex",
          criterio: "2.4.3 Ordine del focus",
          livello: "A",
          gravita: "moderato",
          categoria: "utilizzabile",
          elemento: outer($, el),
          misura: `tabindex="${v}"`,
          spiegazione:
            "tabindex positivo: forza un ordine di tabulazione artificiale che diverge dall'ordine visivo e disorienta chi naviga da tastiera.",
          rimedio: "Usa tabindex=0 (focus nell'ordine naturale) o -1; riordina nel DOM invece di forzare indici.",
        }),
      );
    }
  });

  // 19. id duplicati — 4.1.2 (A), Robusto (rompono label[for] e riferimenti ARIA)
  const idMap = new Map<string, number>();
  $("[id]").each((_, el) => {
    const id = $(el).attr("id");
    if (id) idMap.set(id, (idMap.get(id) || 0) + 1);
  });
  for (const [id, n] of idMap) {
    if (n > 1) {
      issues.push(
        issue({
          idPrefix: "dup-id",
          criterio: "4.1.2 Nome, ruolo, valore",
          livello: "A",
          gravita: "moderato",
          categoria: "robusto",
          elemento: `id="${id}" usato ${n} volte`,
          spiegazione: `L'id "${id}" è duplicato (${n} volte). label[for] e aria-labelledby/describedby risolvono solo il primo, rompendo le associazioni accessibili.`,
          rimedio: "Rendi ogni id univoco nella pagina.",
        }),
      );
    }
  }

  // 20. landmark <main> mancante / multiplo — 1.3.1 (A), Robusto (solo doc completi)
  if (isFullDoc) {
    const mains = $("main,[role='main']").length;
    if (mains === 0) {
      issues.push(
        issue({
          idPrefix: "main-missing",
          criterio: "1.3.1 Informazioni e correlazioni",
          livello: "A",
          gravita: "moderato",
          categoria: "robusto",
          elemento: "Nessun <main> o role=main",
          spiegazione:
            "Manca il landmark <main>: gli utenti di screen reader non possono saltare direttamente al contenuto principale tramite le scorciatoie per le regioni.",
          rimedio: "Avvolgi il contenuto principale in un <main> (uno solo per pagina).",
        }),
      );
    } else if (mains > 1) {
      issues.push(
        issue({
          idPrefix: "main-multi",
          criterio: "1.3.1 Informazioni e correlazioni",
          livello: "A",
          gravita: "minore",
          categoria: "robusto",
          elemento: `${mains} landmark main`,
          spiegazione: "Più di un landmark <main>: l'orientamento per regioni diventa ambiguo.",
          rimedio: "Tieni un solo <main> visibile per pagina.",
        }),
      );
    }

    // 21. skip link assente — 2.4.1 (A), Utilizzabile
    const hasNav = $("nav,[role='navigation'],header").length > 0;
    const hasAnchor = $("a[href^='#']").length > 0;
    if (hasNav && !hasAnchor) {
      issues.push(
        issue({
          idPrefix: "skip-link",
          criterio: "2.4.1 Salto di blocchi",
          livello: "A",
          gravita: "minore",
          categoria: "utilizzabile",
          elemento: "Nessun link di salto interno (href=\"#…\")",
          spiegazione:
            "Sembra mancare un link \"salta al contenuto\". Chi naviga da tastiera o screen reader deve attraversare l'intera navigazione su ogni pagina.",
          rimedio: 'Aggiungi come primo elemento un <a href="#main">Salta al contenuto</a> verso il <main>.',
        }),
      );
    }
  }

  // 22. <li> fuori da una lista — 1.3.1 (A), Robusto
  $("li").each((_, el) => {
    const parent = el.parent;
    const ptag = parent && parent.type === "tag" ? parent.tagName.toLowerCase() : "";
    if (!["ul", "ol", "menu"].includes(ptag)) {
      issues.push(
        issue({
          idPrefix: "li-orphan",
          criterio: "1.3.1 Informazioni e correlazioni",
          livello: "A",
          gravita: "minore",
          categoria: "robusto",
          elemento: outer($, el),
          spiegazione:
            "<li> non contenuto direttamente in <ul>/<ol>/<menu>: la relazione di lista non viene comunicata e gli screen reader non annunciano numero e posizione degli elementi.",
          rimedio: "Avvolgi gli <li> in un <ul> o <ol>.",
        }),
      );
    }
  });

  // 23. gruppo radio/checkbox senza fieldset+legend — 1.3.1 (A), Robusto
  const groups = new Map<string, Element[]>();
  $("input[type='radio'],input[type='checkbox']").each((_, el) => {
    const name = $(el).attr("name");
    if (!name) return;
    const arr = groups.get(name) || [];
    arr.push(el as Element);
    groups.set(name, arr);
  });
  for (const [name, els] of groups) {
    if (els.length < 2) continue; // solo gruppi di scelte correlate
    const grouped = els.every((el) => {
      const fs = $(el).closest("fieldset");
      return fs.length > 0 && fs.children("legend").length > 0;
    });
    if (!grouped) {
      issues.push(
        issue({
          idPrefix: "fieldset",
          criterio: "1.3.1 Informazioni e correlazioni",
          livello: "A",
          gravita: "moderato",
          categoria: "robusto",
          elemento: `Gruppo di ${els.length} controlli name="${name}"`,
          spiegazione:
            "Gruppo di radio/checkbox correlati non racchiuso in un <fieldset> con <legend>: gli screen reader non annunciano la domanda comune a cui le opzioni rispondono.",
          rimedio:
            "Avvolgi il gruppo in <fieldset> e inserisci la domanda/etichetta in <legend>.",
        }),
      );
    }
  }

  // 24. tabella dati senza intestazioni — 1.3.1 (A), Robusto
  $("table").each((_, el) => {
    const $t = $(el);
    const role = ($t.attr("role") || "").toLowerCase();
    if (role === "presentation" || role === "none") return;
    const rows = $t.find("tr").length;
    const cols = $t.find("tr").first().children("td,th").length;
    if (rows > 1 && cols > 1 && $t.find("th").length === 0) {
      issues.push(
        issue({
          idPrefix: "table-headers",
          criterio: "1.3.1 Informazioni e correlazioni",
          livello: "A",
          gravita: "serio",
          categoria: "robusto",
          elemento: outer($, el),
          spiegazione:
            "Tabella di dati senza celle <th>: gli screen reader non possono associare ogni valore alla sua intestazione di riga/colonna, rendendo i dati incomprensibili.",
          rimedio:
            'Usa <th scope="col"> e <th scope="row"> per le intestazioni. Se la tabella è solo di layout, aggiungi role="presentation".',
        }),
      );
    }
  });

  // 25. campo dati personali senza autocomplete — 1.3.5 (AA), Comprensibile
  $("input").each((_, el) => {
    const type = ($(el).attr("type") || "text").toLowerCase();
    if (!["email", "tel"].includes(type)) return;
    if (!$(el).attr("autocomplete")) {
      issues.push(
        issue({
          idPrefix: "autocomplete",
          criterio: "1.3.5 Identificare lo scopo dell'input",
          livello: "AA",
          gravita: "minore",
          categoria: "comprensibile",
          elemento: outer($, el),
          spiegazione:
            "Campo che raccoglie dati personali (email/telefono) senza attributo autocomplete: chi usa la compilazione automatica o gli aiuti cognitivi non riceve il tipo di dato atteso.",
          rimedio: `Aggiungi autocomplete appropriato, es. autocomplete="${type === "email" ? "email" : "tel"}".`,
        }),
      );
    }
  });

  // 26. link che apre una nuova scheda senza avviso — 3.2.5 (AAA), Utilizzabile
  $("a[target='_blank']").each((_, el) => {
    const $el = $(el);
    const text = (($el.text() || "") + " " + ($el.attr("aria-label") || "")).toLowerCase();
    const warns = /nuova scheda|nuova finestra|new tab|new window|↗|⧉|external/.test(text);
    if (!warns) {
      issues.push(
        issue({
          idPrefix: "new-tab",
          criterio: "3.2.5 Cambiamento su richiesta",
          livello: "AAA",
          gravita: "minore",
          categoria: "utilizzabile",
          elemento: outer($, el),
          spiegazione:
            "Link con target=_blank che apre una nuova scheda senza preavviso: il cambio di contesto disorienta, in particolare gli utenti con disabilità cognitive.",
          rimedio:
            'Indica l\'apertura in nuova scheda (testo o aria-label) e aggiungi rel="noopener noreferrer".',
        }),
      );
    }
  });

  return groupRepeated(issues);
}

/** Minimal CSS.escape for id selectors (cheerio lacks it). */
function cssEscape(id: string): string {
  return id.replace(/["\\\]\[#.:>+~*\s]/g, "\\$&");
}

/** Collapse identical repeated findings (same criterion + same element shape).
 *  A component repeated N times is ONE problem to fix, not N — otherwise a
 *  page with 30 identical buttons would tank the score unfairly. */
function groupRepeated(issues: Issue[]): Issue[] {
  const bySig = new Map<string, { issue: Issue; n: number }>();
  for (const it of issues) {
    const shape = it.elemento
      .replace(/=("[^"]*"|'[^']*')/g, "")
      .replace(/\d+/g, "#")
      .replace(/\s+/g, " ")
      .trim();
    const sig = `${it.criterio}|${shape}`;
    const e = bySig.get(sig);
    if (e) e.n++;
    else bySig.set(sig, { issue: it, n: 1 });
  }
  const out: Issue[] = [];
  for (const { issue: it, n } of bySig.values()) {
    if (n > 1) it.spiegazione += ` — ${n} occorrenze simili raggruppate.`;
    out.push(it);
  }
  return out;
}

// ponytail: inline self-check. Run with `npx tsx lib/wcag-checks.ts`.
function demo() {
  const assert = (c: boolean, m: string) => {
    if (!c) throw new Error("FAIL: " + m);
  };
  const bad = `<!doctype html><html><head></head><body>
    <img src="x.png">
    <h1>T</h1><h3>skip</h3><h2></h2>
    <input type="text">
    <label for="nope">X</label>
    <span aria-labelledby="ghost">y</span>
    <div role="bogus">z</div>
    <a href="/p">clicca qui</a>
    <p style="color:#aaa;background:#fff">testo</p>
    <button></button>
    <a href="/x"><svg width="16" height="16"></svg></a>
    <iframe src="/e"></iframe>
    <div tabindex="5">x</div>
    <span id="d"></span><span id="d"></span>
    <video src="v.mp4"></video>
    <meta name="viewport" content="width=device-width, user-scalable=no">
    <li>orfano</li>
    <input type="radio" name="g"><input type="radio" name="g">
    <table><tr><td>a</td><td>b</td></tr><tr><td>1</td><td>2</td></tr></table>
    <input type="email">
    <a href="/o" target="_blank">apri</a>
  </body></html>`;
  const r = wcagChecks(bad);
  const has = (p: string) => r.some((i) => i.id.startsWith(p));
  for (const p of [
    "img-alt", "label", "label-orphan", "aria-ref", "role", "h-skip",
    "h-empty", "contrast-aa", "vague-link", "no-name", "icon-link",
    "iframe-title", "tabindex", "dup-id", "main-missing", "video-captions",
    "viewport-zoom", "li-orphan", "title", "fieldset", "table-headers",
    "autocomplete", "new-tab",
  ]) {
    assert(has(p), `expected finding: ${p}`);
  }
  // ogni problema deve avere un rimedio
  assert(r.every((i) => i.rimedio && i.rimedio.length > 0), "every issue has rimedio");

  // contrasto da <style> (non inline)
  const cssDoc = `<!doctype html><html lang="it"><head><title>T</title>
    <style>body{background:#ffffff} .faint{color:#bbbbbb}</style></head>
    <body><main><h1>Ok</h1><p class="faint">grigio</p></main></body></html>`;
  assert(
    wcagChecks(cssDoc).some((i) => i.id.startsWith("contrast-aa")),
    "low contrast from <style> CSS",
  );

  // pagina pulita -> nessun problema
  const good = `<!doctype html><html lang="it"><head><title>Ok</title></head>
    <body><a href="#main">Salta</a><nav>menu</nav><main><h1>Ok</h1>
    <img src="x.png" alt="descrizione">
    <label for="n">Nome</label><input id="n" type="text">
    <a href="/p">Vai alla pagina prodotti</a></main></body></html>`;
  const g = wcagChecks(good);
  assert(g.length === 0, `clean page has no issues (got ${g.map((i) => i.id).join(",")})`);
  console.log("wcag-checks self-check OK");
}

if (require.main === module) demo();
