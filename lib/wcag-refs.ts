// Map each emitted WCAG criterion to its W3C "Understanding" doc, so every
// finding links to the authoritative explanation. Slugs are stable per WCAG 2.2.

const SLUG: Record<string, string> = {
  "1.1.1": "non-text-content",
  "1.2.2": "captions-prerecorded",
  "1.3.1": "info-and-relationships",
  "1.4.3": "contrast-minimum",
  "1.4.4": "resize-text",
  "1.4.6": "contrast-enhanced",
  "2.4.1": "bypass-blocks",
  "2.4.2": "page-titled",
  "2.4.3": "focus-order",
  "2.4.4": "link-purpose-in-context",
  "2.4.6": "headings-and-labels",
  "2.5.8": "target-size-minimum",
  "3.1.1": "language-of-page",
  "3.3.2": "labels-or-instructions",
  "4.1.2": "name-role-value",
};

/** Extract the first "x.y.z" code from a criterion label. */
export function criterionCode(criterio: string): string | undefined {
  return criterio.match(/\d+\.\d+\.\d+/)?.[0];
}

/** W3C Understanding URL for a criterion label, or undefined if unknown. */
export function wcagUrl(criterio: string): string | undefined {
  const code = criterionCode(criterio);
  const slug = code && SLUG[code];
  return slug ? `https://www.w3.org/WAI/WCAG22/Understanding/${slug}.html` : undefined;
}
