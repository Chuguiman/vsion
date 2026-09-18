import CarteraManager from "@/app/_components/CarteraManager";
import { getCarteraInfo } from "@/lib/cartera";

export const dynamic = "force-dynamic";

export default async function CarteraPage() {
  const info = await getCarteraInfo();
  if (!info) {
    return (
      <div>
        <h1 className="mb-4 text-xl font-semibold">Cartera del cliente</h1>
        <p className="rounded-lg border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 text-sm text-[var(--mut)]">
          Sin base de datos configurada. Define <code className="text-[var(--tx)]">DATABASE_URL</code> para guardar la cartera.
        </p>
      </div>
    );
  }
  return <CarteraManager info={info} />;
}
