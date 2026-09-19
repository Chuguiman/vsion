"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { deleteRunAction } from "../actions";

export default function DeleteRunButton({ runId, label }: { runId: number; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`¿Borrar la comparación ${label}? Esta acción no se puede deshacer.`)) return;
    setBusy(true);
    const r = await deleteRunAction(runId);
    setBusy(false);
    if (r.ok) router.refresh();
    else alert(r.error ?? "No se pudo borrar.");
  }

  return (
    <button onClick={remove} disabled={busy} title="Borrar comparación"
      className="text-[var(--mut)] hover:text-red-400 disabled:opacity-40">
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
    </button>
  );
}
