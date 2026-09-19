import { getSession } from "@/lib/auth";
import { listCountries } from "@/lib/countries";
import PaisesClient from "@/app/_components/PaisesClient";

export const dynamic = "force-dynamic";

export default async function PaisesPage() {
  const s = await getSession();
  if (!s) return null;
  const countries = await listCountries(s.organizationId);
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Países de monitoreo</h1>
      <p className="mb-4 text-sm text-[var(--mut)]">Activa las oficinas/países cuyas gacetas quieres vigilar.</p>
      <PaisesClient countries={countries} />
    </div>
  );
}
