import { getSession } from "@/lib/auth";
import { listUsers } from "@/lib/users";
import UsersManager from "@/app/_components/UsersManager";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const s = await getSession();
  if (!s) return null;
  const users = await listUsers();
  return <UsersManager users={users} canManage={s.role === "superadmin"} currentUserId={s.userId} />;
}
