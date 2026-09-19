"use server";

import { getSession } from "@/lib/auth";
import { setMonitored } from "@/lib/countries";
import {
  getScope, setScope, addWatchMark, removeWatchMark, listWatchMarks, searchMarks,
  type ScopeMode, type WatchScope, type MarkLite,
} from "@/lib/scopes";

type Res = { ok: boolean; error?: string };

async function requireManager() {
  const s = await getSession();
  if (!s || (s.role !== "superadmin" && s.role !== "admin")) return null;
  return s;
}

export async function setMonitoredAction(countryId: number, active: boolean): Promise<Res> {
  const s = await requireManager();
  if (!s) return { ok: false, error: "No autorizado." };
  try {
    await setMonitored(s.organizationId, countryId, active);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error." };
  }
}

export async function getScopeAction(country: string): Promise<{ ok: boolean; scope?: WatchScope; marks?: MarkLite[]; error?: string }> {
  const s = await requireManager();
  if (!s) return { ok: false, error: "No autorizado." };
  try {
    const [scope, marks] = await Promise.all([
      getScope(s.organizationId, country),
      listWatchMarks(s.organizationId, country),
    ]);
    return { ok: true, scope, marks };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error." };
  }
}

export async function setScopeAction(country: string, mode: ScopeMode, holders: string[], caseIds: string[]): Promise<Res> {
  const s = await requireManager();
  if (!s) return { ok: false, error: "No autorizado." };
  try {
    await setScope(s.organizationId, country, mode, holders, caseIds);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error." };
  }
}

export async function addWatchMarkAction(country: string, markId: number): Promise<Res> {
  const s = await requireManager();
  if (!s) return { ok: false, error: "No autorizado." };
  try { await addWatchMark(s.organizationId, country, markId); return { ok: true }; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Error." }; }
}

export async function removeWatchMarkAction(country: string, markId: number): Promise<Res> {
  const s = await requireManager();
  if (!s) return { ok: false, error: "No autorizado." };
  try { await removeWatchMark(s.organizationId, country, markId); return { ok: true }; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Error." }; }
}

export async function searchMarksAction(q: string): Promise<{ ok: boolean; marks?: MarkLite[] }> {
  const s = await requireManager();
  if (!s) return { ok: false };
  return { ok: true, marks: await searchMarks(q) };
}

export async function listHoldersAction(): Promise<{ ok: boolean; holders?: { holder: string; n: number }[] }> {
  const s = await requireManager();
  if (!s) return { ok: false };
  const { listHolders } = await import("@/lib/scopes");
  return { ok: true, holders: await listHolders() };
}
