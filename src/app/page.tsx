import NewComparison from "./_components/NewComparison";
import { getCarteraInfo } from "@/lib/cartera";
import { listOrganizations } from "@/lib/organizations";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [carteraInfo, s] = await Promise.all([getCarteraInfo(), getSession()]);
  const isSuper = s?.role === "superadmin";
  const orgs = isSuper ? await listOrganizations() : [];
  return <NewComparison carteraInfo={carteraInfo} orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} isSuper={isSuper} />;
}
