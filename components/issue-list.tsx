"use client";

import { useMemo, useState } from "react";
import type { Issue, Severity, WcagLevel } from "@/lib/types";
import { IssueCard } from "./issue-card";

const SEVERITIES: Severity[] = ["critico", "serio", "moderato", "minore"];
const LEVELS: WcagLevel[] = ["A", "AA", "AAA"];
const SEV_ORDER: Record<Severity, number> = {
  critico: 0,
  serio: 1,
  moderato: 2,
  minore: 3,
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`border-2 border-ink px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider transition ${
        active ? "bg-ink text-paper" : "bg-paper hover:bg-paper-2"
      }`}
    >
      {children}
    </button>
  );
}

export function IssueList({ issues }: { issues: Issue[] }) {
  const [sev, setSev] = useState<Severity | "all">("all");
  const [lvl, setLvl] = useState<WcagLevel | "all">("all");

  const filtered = useMemo(() => {
    return issues
      .filter((i) => (sev === "all" ? true : i.gravita === sev))
      .filter((i) => (lvl === "all" ? true : i.livello === lvl))
      .sort((a, b) => SEV_ORDER[a.gravita] - SEV_ORDER[b.gravita]);
  }, [issues, sev, lvl]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 font-mono text-xs uppercase tracking-[0.18em]">
          Gravità
        </span>
        <Chip active={sev === "all"} onClick={() => setSev("all")}>
          Tutte
        </Chip>
        {SEVERITIES.map((s) => (
          <Chip key={s} active={sev === s} onClick={() => setSev(s)}>
            {s}
          </Chip>
        ))}
        <span className="ml-3 mr-1 font-mono text-xs uppercase tracking-[0.18em]">
          Livello
        </span>
        <Chip active={lvl === "all"} onClick={() => setLvl("all")}>
          Tutti
        </Chip>
        {LEVELS.map((l) => (
          <Chip key={l} active={lvl === l} onClick={() => setLvl(l)}>
            {l}
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="block p-6 text-center font-mono text-sm uppercase tracking-wider">
          Nessun problema con questi filtri.
        </p>
      ) : (
        <div className="space-y-4">
          {filtered.map((i) => (
            <IssueCard key={i.id} issue={i} />
          ))}
        </div>
      )}
    </section>
  );
}
