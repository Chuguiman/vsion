import { getSession } from "@/lib/auth";
import { listUsers } from "@/lib/users";
import { listOrganizations } from "@/lib/organizations";
import UsersManager from "@/app/_components/UsersManager";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const s = await getSession();
  if (!s) return null;
  const isSuper = s.role === "superadmin";
  const [users, orgs] = await Promise.all([
    listUsers(isSuper ? null : s.organizationId),
    isSuper ? listOrganizations() : Promise.resolve([]),
  ]);
  return <UsersManager users={users} orgs={orgs} role={s.role} currentUserId={s.userId} currentOrgId={s.organizationId} />;
}
