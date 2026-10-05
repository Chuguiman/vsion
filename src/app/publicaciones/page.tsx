import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listAllGazettes } from "@/lib/gazettes";
import GazettesManager from "@/app/_components/GazettesManager";

export const dynamic = "force-dynamic";

export default async function PublicacionesPage() {
  const s = await getSession();
  if (s?.role !== "superadmin") return notFound();
  const gazettes = await listAllGazettes();
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Publicaciones</h1>
      <p className="mb-4 text-sm text-[var(--mut)]">
        Gacetas oficiales cargadas en el sistema. Una vez cargadas, se eligen en Nueva comparación sin volver a subir el archivo.
      </p>
      <GazettesManager gazettes={gazettes} />
    </div>
  );
}
