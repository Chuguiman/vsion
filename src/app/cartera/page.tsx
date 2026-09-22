import CarteraManager from "@/app/_components/CarteraManager";
import { getCarteraInfo } from "@/lib/cartera";
import { listOrganizations } from "@/lib/organizations";

export const dynamic = "force-dynamic";

export default async function CarteraPage() {
  const probe = await getCarteraInfo(null); // null => sin base de datos
  if (!probe) {
    return (
      <div>
        <h1 className="mb-4 text-xl font-semibold">Cartera del cliente</h1>
        <p className="rounded-lg border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 text-sm text-[var(--mut)]">
          Sin base de datos configurada. Define <code className="text-[var(--tx)]">DATABASE_URL</code> para guardar la cartera.
        </p>
      </div>
    );
  }
  const orgs = await listOrganizations();
  return <CarteraManager orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} />;
}
