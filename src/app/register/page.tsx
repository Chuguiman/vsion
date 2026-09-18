import Link from "next/link";
import { Search } from "lucide-react";
import { registrationOpen } from "../auth-actions";
import RegisterForm from "../_components/RegisterForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const open = await registrationOpen();
  if (open) return <RegisterForm />;
  return (
    <div className="mx-auto mt-16 max-w-sm text-center">
      <div className="mb-6 flex items-center justify-center gap-2 text-lg font-semibold tracking-wide">
        <Search size={20} className="text-[var(--acc)]" /> vsion
      </div>
      <div className="rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-6">
        <h1 className="mb-2 text-lg font-semibold">Registro cerrado</h1>
        <p className="text-sm text-[var(--mut)]">Las cuentas las crea un administrador. Si ya tienes una, inicia sesión.</p>
        <Link href="/login" className="mt-4 inline-block rounded-lg bg-[var(--acc)] px-4 py-2 text-sm font-medium text-black">Iniciar sesión</Link>
      </div>
    </div>
  );
}
