import type { Metadata } from "next";
import { Fraunces, Archivo, Space_Mono } from "next/font/google";
import "./globals.css";

// Editorial serif display + grotesque body + mono for data. No Inter, no slop.
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "600", "900"],
  style: ["normal", "italic"],
});
const body = Archivo({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});
const mono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Accessibility Auditor — WCAG 2.2",
  description:
    "Analizza una pagina, individua problemi WCAG 2.2 (A/AA/AAA) e proponi fix concreti. Contrasti calcolati in modo deterministico, AI solo per spiegazioni.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        {children}
      </body>
    </html>
  );
}
