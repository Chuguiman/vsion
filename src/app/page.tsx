import NewComparison from "./_components/NewComparison";
import { getCarteraInfo } from "@/lib/cartera";
import { listOrganizations } from "@/lib/organizations";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const s = await getSession();
  const isSuper = s?.role === "superadmin";
  // superadmin elige la org en el formulario (la cartera se resuelve al elegir);
  // los demás ven la cartera de su propia organización.
  const carteraInfo = isSuper ? null : await getCarteraInfo(s?.organizationId ?? null);
  const orgs = isSuper ? await listOrganizations() : [];
  return <NewComparison carteraInfo={carteraInfo} orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} isSuper={isSuper} />;
}
