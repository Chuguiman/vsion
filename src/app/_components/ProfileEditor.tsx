"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserCircle, Camera, Trash2, Loader2 } from "lucide-react";
import { updateNameAction, changePasswordAction, updateAvatarAction } from "../auth-actions";

const ROLE_LABEL: Record<string, string> = { superadmin: "Superadmin", admin: "Administrador", user: "Usuario" };

async function resizeToDataUrl(file: File, size = 128): Promise<string> {
  const img = document.createElement("img");
  const url = URL.createObjectURL(file);
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("img")); img.src = url; });
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.max(size / img.width, size / img.height);
  const w = img.width * scale, h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function Msg({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null;
  return <p className={`mt-2 text-sm ${m.ok ? "text-emerald-400" : "text-red-400"}`}>{m.text}</p>;
}

export default function ProfileEditor({ profile }: {
  profile: { id: number; email: string; name: string; role: string; avatar: string | null };
}) {
  const router = useRouter();
  const [avatar, setAvatar] = useState(profile.avatar);
  const [name, setName] = useState(profile.name);
  const [cur, setCur] = useState(""); const [nw, setNw] = useState(""); const [conf, setConf] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [avMsg, setAvMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onAvatar(file: File | null) {
    if (!file) return;
    setBusy("avatar"); setAvMsg(null);
    try {
      const dataUrl = await resizeToDataUrl(file);
      const r = await updateAvatarAction(dataUrl);
      if (r.ok) { setAvatar(dataUrl); setAvMsg({ ok: true, text: "Avatar actualizado." }); router.refresh(); }
      else setAvMsg({ ok: false, text: r.error ?? "Error" });
    } catch { setAvMsg({ ok: false, text: "No se pudo procesar la imagen." }); }
    finally { setBusy(null); }
  }
  async function removeAvatar() {
    setBusy("avatar"); setAvMsg(null);
    const r = await updateAvatarAction(null);
    if (r.ok) { setAvatar(null); router.refresh(); } else setAvMsg({ ok: false, text: r.error ?? "Error" });
    setBusy(null);
  }
  async function saveName(e: React.FormEvent) {
    e.preventDefault(); setBusy("name"); setNameMsg(null);
    const r = await updateNameAction(name);
    setNameMsg(r.ok ? { ok: true, text: "Nombre actualizado." } : { ok: false, text: r.error ?? "Error" });
    if (r.ok) router.refresh();
    setBusy(null);
  }
  async function savePassword(e: React.FormEvent) {
    e.preventDefault(); setPwMsg(null);
    if (nw !== conf) { setPwMsg({ ok: false, text: "La nueva contraseña y su confirmación no coinciden." }); return; }
    setBusy("pw");
    const r = await changePasswordAction(cur, nw);
    if (r.ok) { setPwMsg({ ok: true, text: "Contraseña actualizada." }); setCur(""); setNw(""); setConf(""); }
    else setPwMsg({ ok: false, text: r.error ?? "Error" });
    setBusy(null);
  }

  const card = "rounded-xl border border-[var(--bd)] bg-[var(--bg2)] p-6";
  const input = "w-full rounded-lg border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--acc)]";
  const label = "mb-1 block text-xs text-[var(--mut)]";
  const btn = "inline-flex items-center gap-2 rounded-lg bg-[var(--acc)] px-4 py-2 text-sm font-medium text-black disabled:opacity-40";

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Mi perfil</h1>

      {/* Avatar + identidad */}
      <div className={card}>
        <div className="flex items-center gap-4">
          {avatar
            ? <img src={avatar} alt="avatar" className="h-16 w-16 rounded-full object-cover" />
            : <UserCircle size={64} className="text-[var(--mut)]" />}
          <div className="min-w-0">
            <div className="font-semibold">{profile.name}</div>
            <div className="truncate text-sm text-[var(--mut)]">{profile.email}</div>
            <div className="text-xs text-[var(--acc)]">{ROLE_LABEL[profile.role] ?? profile.role}</div>
          </div>
          <div className="ml-auto flex gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onAvatar(e.target.files?.[0] ?? null)} />
            <button onClick={() => fileRef.current?.click()} disabled={busy === "avatar"} className="inline-flex items-center gap-1 rounded-lg border border-[var(--bd)] px-3 py-1.5 text-sm hover:bg-white/5">
              {busy === "avatar" ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} Cambiar
            </button>
            {avatar && <button onClick={removeAvatar} disabled={busy === "avatar"} className="rounded-lg border border-[var(--bd)] px-2 py-1.5 text-[var(--mut)] hover:text-red-300"><Trash2 size={15} /></button>}
          </div>
        </div>
        <Msg m={avMsg} />
      </div>

      {/* Nombre */}
      <form onSubmit={saveName} className={card}>
        <h2 className="mb-3 text-sm font-semibold">Nombre</h2>
        <label className={label}>Nombre visible</label>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} required />
        <button className={`${btn} mt-3`} disabled={busy === "name"}>{busy === "name" && <Loader2 size={15} className="animate-spin" />} Guardar</button>
        <Msg m={nameMsg} />
      </form>

      {/* Contraseña */}
      <form onSubmit={savePassword} className={card}>
        <h2 className="mb-3 text-sm font-semibold">Cambiar contraseña</h2>
        <label className={label}>Contraseña actual</label>
        <input type="password" className={`${input} mb-3`} value={cur} onChange={(e) => setCur(e.target.value)} required />
        <label className={label}>Nueva contraseña (mín. 8)</label>
        <input type="password" className={`${input} mb-3`} value={nw} onChange={(e) => setNw(e.target.value)} required minLength={8} />
        <label className={label}>Confirmar nueva contraseña</label>
        <input type="password" className={input} value={conf} onChange={(e) => setConf(e.target.value)} required minLength={8} />
        <button className={`${btn} mt-3`} disabled={busy === "pw"}>{busy === "pw" && <Loader2 size={15} className="animate-spin" />} Actualizar contraseña</button>
        <Msg m={pwMsg} />
      </form>
    </div>
  );
}
