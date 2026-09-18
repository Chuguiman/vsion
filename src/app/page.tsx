import NewComparison from "./_components/NewComparison";
import { getCarteraInfo } from "@/lib/cartera";

export const dynamic = "force-dynamic";

export default async function Home() {
  const carteraInfo = await getCarteraInfo();
  return <NewComparison carteraInfo={carteraInfo} />;
}
