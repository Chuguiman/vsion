import { CreditCard } from "lucide-react";

export default function BillingPage() {
  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-xl font-semibold">Billing</h1>
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-6 text-sm text-[var(--mut)]">
        <CreditCard size={24} className="text-[var(--acc)]" />
        <div>Próximamente: planes, consumo de IA (tokens/coste por gaceta) y facturación.</div>
      </div>
    </div>
  );
}
