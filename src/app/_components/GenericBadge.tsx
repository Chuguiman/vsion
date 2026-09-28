/** Aviso: el parecido se debe solo a un término genérico/descriptivo compartido (p.ej. SHOES). */
export default function GenericBadge({ terms }: { terms: string[] }) {
  return (
    <div className="mt-1 inline-flex items-center gap-1 rounded bg-zinc-500/15 px-1.5 py-0.5 text-[10px] text-[var(--mut)]"
      title="Solo comparten un término genérico/descriptivo; lo distintivo de cada marca es diferente">
      Solo genérico: <span className="font-semibold uppercase text-[var(--tx)]">{terms.join(", ")}</span>
    </div>
  );
}
