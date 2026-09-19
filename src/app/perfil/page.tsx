import { getSession } from "@/lib/auth";
import { getProfile } from "@/lib/users";
import ProfileEditor from "@/app/_components/ProfileEditor";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const s = await getSession();
  if (!s) return null;
  const profile = await getProfile(s.userId);
  if (!profile) return null;
  return <ProfileEditor profile={profile} />;
}
