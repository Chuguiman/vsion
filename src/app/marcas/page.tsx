import { getSession } from "@/lib/auth";
import { listOrganizations } from "@/lib/organizations";
import CarteraViewer from "@/app/_components/CarteraViewer";

export const dynamic = "force-dynamic";

export default async function MarcasPage() {
  const s = await getSession();
  if (!s) return null;
  const isSuper = s.role === "superadmin";
  const orgs = isSuper ? (await listOrganizations()).map((o) => ({ id: o.id, name: o.name })) : [];
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Cartera de marcas</h1>
      <p className="mb-4 text-sm text-[var(--mut)]">Explora el portafolio del cliente con sus imágenes.</p>
      <CarteraViewer orgs={orgs} isSuper={isSuper} />
    </div>
  );
}
