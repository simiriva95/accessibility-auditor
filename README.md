<div align="center">

# ♿ Accessibility Auditor

### Analizza qualsiasi pagina, trova i problemi **WCAG 2.2** e ottieni i fix — in un colpo solo.

I segnali misurabili (contrasti, ARIA, struttura) sono calcolati in **codice deterministico**.
L'AI serve solo a spiegare e correggere — **mai** a inventare i numeri.

<br/>

![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![WCAG 2.2](https://img.shields.io/badge/WCAG-2.2_AAA-ff4a1c?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-16130d?style=for-the-badge)

[**Demo live**](https://accessibility-auditor-simiriva95s-projects.vercel.app) · [Segnala un bug](https://github.com/simiriva95/accessibility-auditor/issues) · [Contribuisci](https://github.com/simiriva95/accessibility-auditor/pulls)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/simiriva95/accessibility-auditor)

</div>

---

## ⚡ In breve

Incolli un **URL** (o dell'**HTML grezzo**) e ottieni:

- 🎯 **Score 0-100** con verdetto di conformità (A · AA · AAA) e breakdown per principio **POUR**
- 🔍 **26 controlli WCAG 2.2** con criterio, livello, gravità, **perché** è un problema e **come** si risolve
- 🤖 **Fix di codice** pronti da copiare, generati dall'AI (opzionale, porti la tua chiave)
- 📤 **Report esportabile** in Markdown / JSON / PDF, da consegnare a un cliente
- 🎨 Interfaccia **editoriale brutalista** — e l'app stessa è accessibile (focus, ARIA, skip-link)

> **Il principio:** le misure si calcolano, non si chiedono all'AI. Un LLM non "vede" i pixel;
> chiedergli un rapporto di contrasto significa farglielo indovinare. Qui il contrasto è
> matematica WCAG deterministica e riproducibile.

---

## 🧩 Cosa rileva

| Principio | Controlli |
|---|---|
| **Percepibile** | alt mancante · `input[type=image]` senza alt · **contrasto AA/AAA** (inline, `<style>` e CSS esterni) · zoom bloccato dal viewport · gerarchia/heading vuoti · video senza sottotitoli |
| **Utilizzabile** | link generici ("clicca qui") · link-icona senza nome · href vuoto · target < 24px · titolo pagina · tabindex positivo · skip-link · nuova scheda senza avviso |
| **Comprensibile** | `lang` mancante o non valido · campi email/tel senza `autocomplete` |
| **Robusto** | label mancante/orfana · `aria-labelledby/describedby` rotti · ruoli ARIA invalidi · id duplicati · controlli senza nome · `<main>` mancante · `<li>` fuori lista · `<iframe>` senza title |

Ogni problema ripetuto viene **raggruppato** (un componente ripetuto = un problema da correggere).

---

## 🤔 Perché il contrasto è deterministico e non affidato all'AI

| | Codice deterministico | LLM |
|---|:---:|:---:|
| **Riproducibilità** | identico ad ogni run | varia |
| **Correttezza numerica** | formula WCAG esatta | stima inaffidabile |
| **Costo / latenza** | trascurabile | una chiamata API |
| **Verificabilità** | self-check con valori noti | nessuna garanzia |

La formula (luminanza relativa → `(L1 + 0.05) / (L2 + 0.05)`) si testa con coppie note
(bianco/nero = 21:1). Quindi: **l'AI spiega e corregge, il codice misura.**

---

## 🚀 Avvio rapido

```bash
git clone https://github.com/simiriva95/accessibility-auditor
cd accessibility-auditor
npm install
npm run dev          # http://localhost:3000
```

Verifica della logica deterministica (self-check senza framework di test):

```bash
npx tsx lib/contrast.ts
npx tsx lib/wcag-checks.ts
npx tsx lib/ssrf.ts
npx tsx lib/css-contrast.ts
npx tsx lib/fetch-css.ts
```

---

## 🤖 AI: porta la tua chiave (BYOK)

Nessuna chiave inclusa. Scegli il provider dall'interfaccia e incolla la tua —
resta **solo in memoria del browser** (niente `localStorage`), inviata al backend
solo per quella richiesta.

| Provider | Note |
|---|---|
| **Groq** | Consigliato · free tier senza carta · default `openai/gpt-oss-20b`. Non confonderlo con **Grok** di xAI (prodotto diverso, a pagamento). |
| **Anthropic** | `claude-sonnet-4-6` |
| **OpenAI** | `gpt-4o-mini` |
| **Locale** | Ollama / LM Studio via Base URL OpenAI-compatible |

Per una **demo pubblica senza chiave lato utente**, imposta una env var lato server:

```bash
GROQ_API_KEY=gsk_...           # nascosta, mai esposta al client
GROQ_MODEL=openai/gpt-oss-20b  # opzionale
```

---

## 🏗️ Architettura

```
app/
  page.tsx              UI: input, provider AI, report
  api/audit/route.ts    orchestratore: fetch → CSS esterni → check → AI (opz.)
lib/
  contrast.ts           luminanza + rapporto WCAG (deterministico, testato)
  wcag-checks.ts        26 controlli su DOM cheerio → Issue[]
  css-contrast.ts       resolver colori da <style>/inline (selettori semplici)
  fetch-css.ts          scarica e inlinea i CSS esterni collegati
  ssrf.ts               guardia SSRF sul fetch degli URL
  ai.ts                 provider-agnostico (AI SDK + generateObject/zod)
  scoring.ts            score 0-100 + breakdown POUR
  report.ts             verdetto conformità + export Markdown
components/             dashboard, report, lista e card dei problemi
```

**Flusso:** URL → `fetch` server-side (timeout, limite 2 MB, **guardia SSRF** su ogni
redirect) → i fogli di stile esterni vengono scaricati e inlineati → i 26 check
deterministici producono i problemi → scoring → (opzionale) l'AI arricchisce con
spiegazioni e codice. **Se l'AI fallisce, i check deterministici ci sono comunque.**

---

## ☁️ Deploy su Vercel

Zero config — Next.js è rilevato automaticamente. **Gira sul piano gratuito (Hobby)**:
nessun browser headless da impacchettare (i CSS esterni sono scaricati via `fetch`,
non renderizzati), quindi niente limiti di dimensione delle function.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/simiriva95/accessibility-auditor)

---

## 🔒 Privacy & sicurezza

- Nessun dato persistito: analisi **stateless** per richiesta.
- Chiavi AI mai salvate (solo in memoria del browser).
- Fetch degli URL protetto contro **SSRF** (IP privati/interni e metadata cloud bloccati).

---

## 📋 Limiti noti (onestà prima di tutto)

- Analizza l'**HTML statico** + i CSS collegati, non esegue JavaScript: i siti
  full-SPA sono valutati sull'HTML iniziale.
- Copre i criteri **verificabili automaticamente**; alcuni (uso reale da tastiera,
  screen reader, contenuti dinamici) richiedono comunque una verifica manuale.
- Una pagina minimale e pulita può legittimamente ottenere 100.

---

<div align="center">

Fatto con cura per il web accessibile · Licenza [MIT](LICENSE)

</div>
