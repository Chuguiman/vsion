import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "@/app/_components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const s = await getSession();
  if (s) redirect(s.role === "superadmin" ? "/" : "/historial"); // ya autenticado → fuera de /login
  return <LoginForm />;
}
