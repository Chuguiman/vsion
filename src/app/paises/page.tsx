import { getSession } from "@/lib/auth";
import { listCountries } from "@/lib/countries";
import { listOrganizations } from "@/lib/organizations";
import PaisesClient from "@/app/_components/PaisesClient";

export const dynamic = "force-dynamic";

export default async function PaisesPage() {
  const s = await getSession();
  if (!s) return null;
  const isSuper = s.role === "superadmin";
  // superadmin elige la organización en el cliente (la lista de países se carga
  // al elegirla); los demás ven la de su propia organización directamente.
  const [countries, orgs] = await Promise.all([
    isSuper ? Promise.resolve([]) : listCountries(s.organizationId),
    isSuper ? listOrganizations() : Promise.resolve([]),
  ]);
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Países de monitoreo</h1>
      <p className="mb-4 text-sm text-[var(--mut)]">Activa las oficinas/países cuyas gacetas quieres vigilar.</p>
      <PaisesClient countries={countries} orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} isSuper={isSuper} />
    </div>
  );
}
