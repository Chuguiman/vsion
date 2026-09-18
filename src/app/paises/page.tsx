import { Globe } from "lucide-react";

export default function PaisesPage() {
  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-xl font-semibold">Países de monitoreo</h1>
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-6 text-sm text-[var(--mut)]">
        <Globe size={24} className="text-[var(--acc)]" />
        <div>
          Próximamente: administración de los países/oficinas a vigilar (SIC Colombia, IMPI México, etc.)
          y sus formatos de gaceta.
        </div>
      </div>
    </div>
  );
}
