"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import StyledSelect, { type StyledSelectOption } from "./StyledSelect";

/** Filtros de Vigilancia: los selects aplican al elegir; el # de publicación, al enviar. */
export default function HistorialFilters({ org, country, pub, size, sizes, orgs, countries }: {
  org: string; country: string; pub: string; size: number; sizes: readonly number[];
  orgs: StyledSelectOption[] | null; countries: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pubText, setPubText] = useState(pub);
  const current = { org, country, pub, size: String(size) };

  function apply(patch: Partial<typeof current>) {
    const next = { ...current, ...patch };
    const u = new URLSearchParams();
    if (next.org) u.set("org", next.org);
    if (next.country) u.set("country", next.country);
    if (next.pub.trim()) u.set("pub", next.pub.trim());
    if (next.size !== String(sizes[0])) u.set("size", next.size);
    const s = u.toString();
    startTransition(() => router.push(`/historial${s ? `?${s}` : ""}`));
  }

  const hasFilters = Boolean(org || country || pub);
  const label = "flex min-w-0 flex-col gap-1 text-xs text-[var(--mut)]";

  return (
    <form onSubmit={(e) => { e.preventDefault(); apply({ pub: pubText }); }}
      className={`mb-4 flex flex-wrap items-end gap-2 transition-opacity ${pending ? "opacity-60" : ""}`}>
      {orgs && (
        <div className={`${label} w-48`}>
          Organización
          <StyledSelect value={org} onChange={(v) => apply({ org: v })} ariaLabel="Organización"
            options={[{ value: "", label: "Todas" }, ...orgs]} />
        </div>
      )}
      <div className={`${label} w-32`}>
        País
        <StyledSelect value={country} onChange={(v) => apply({ country: v })} ariaLabel="País"
          options={[{ value: "", label: "Todos" }, ...countries.map((c) => ({ value: c, label: c }))]} />
      </div>
      <label className={label}>
        # de publicación
        <input value={pubText} onChange={(e) => setPubText(e.target.value)} placeholder="Ej. 1024"
          className="w-36 rounded-lg border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2 text-sm text-[var(--tx)] outline-none transition hover:border-[var(--acc)] focus:border-[var(--acc)] focus:ring-2 focus:ring-[var(--acc)]/20" />
      </label>
      <button className="rounded-lg bg-[var(--acc)] px-4 py-2 text-sm font-medium text-white">Filtrar</button>
      {hasFilters && (
        <button type="button" onClick={() => { setPubText(""); apply({ org: "", country: "", pub: "" }); }}
          className="rounded-lg border border-[var(--bd)] px-3 py-2 text-sm text-[var(--mut)] hover:text-[var(--tx)]">Limpiar</button>
      )}
      <div className={`${label} ml-auto w-24`}>
        Por página
        <StyledSelect value={String(size)} onChange={(v) => apply({ size: v })} ariaLabel="Resultados por página"
          options={sizes.map((n) => ({ value: String(n), label: String(n) }))} />
      </div>
    </form>
  );
}
