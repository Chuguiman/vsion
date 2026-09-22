"use server";

import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { setMonitored, listCountries, type CountryRow } from "@/lib/countries";
import {
  getScope, setScope, addWatchMark, removeWatchMark, listWatchMarks, searchMarks,
  type ScopeMode, type WatchScope, type MarkLite,
} from "@/lib/scopes";

type Res = { ok: boolean; error?: string };

/**
 * Resuelve la organización a gestionar. El superadmin puede elegir cualquiera
 * (pasada por parámetro y validada); un admin queda atado a la suya. Devuelve
 * null cuando el rol no está autorizado.
 */
async function resolveOrg(requestedOrgId: number | null): Promise<{ ok: true; orgId: number } | { ok: false; error: string } | null> {
  const s = await getSession();
  if (!s || (s.role !== "superadmin" && s.role !== "admin")) return null;
  if (s.role === "admin") {
    if (s.organizationId == null) return { ok: false, error: "Tu cuenta no tiene organización." };
    return { ok: true, orgId: s.organizationId };
  }
  // superadmin: debe elegir una organización válida
  if (requestedOrgId == null) return { ok: false, error: "Elige una organización." };
  const db = getDb();
  if (db) {
    const [o] = await db<{ id: number }[]>`SELECT id FROM organizations WHERE id = ${requestedOrgId}`;
    if (!o) return { ok: false, error: "Organización no válida." };
  }
  return { ok: true, orgId: requestedOrgId };
}

/** Países maestros + estado de monitoreo para la organización indicada. */
export async function listCountriesAction(orgId: number | null): Promise<{ ok: boolean; countries?: CountryRow[]; error?: string }> {
  const r = await resolveOrg(orgId);
  if (!r) return { ok: false, error: "No autorizado." };
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, countries: await listCountries(r.orgId) };
}

export async function setMonitoredAction(countryId: number, active: boolean, orgId: number | null = null): Promise<Res> {
  const r = await resolveOrg(orgId);
  if (!r) return { ok: false, error: "No autorizado." };
  if (!r.ok) return r;
  try {
    await setMonitored(r.orgId, countryId, active);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error." };
  }
}

export async function getScopeAction(country: string, orgId: number | null = null): Promise<{ ok: boolean; scope?: WatchScope; marks?: MarkLite[]; error?: string }> {
  const r = await resolveOrg(orgId);
  if (!r) return { ok: false, error: "No autorizado." };
  if (!r.ok) return { ok: false, error: r.error };
  try {
    const [scope, marks] = await Promise.all([
      getScope(r.orgId, country),
      listWatchMarks(r.orgId, country),
    ]);
    return { ok: true, scope, marks };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error." };
  }
}

export async function setScopeAction(country: string, mode: ScopeMode, holders: string[], caseIds: string[], orgId: number | null = null): Promise<Res> {
  const r = await resolveOrg(orgId);
  if (!r) return { ok: false, error: "No autorizado." };
  if (!r.ok) return r;
  try {
    await setScope(r.orgId, country, mode, holders, caseIds);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error." };
  }
}

export async function addWatchMarkAction(country: string, markId: number, orgId: number | null = null): Promise<Res> {
  const r = await resolveOrg(orgId);
  if (!r) return { ok: false, error: "No autorizado." };
  if (!r.ok) return r;
  try { await addWatchMark(r.orgId, country, markId); return { ok: true }; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Error." }; }
}

export async function removeWatchMarkAction(country: string, markId: number, orgId: number | null = null): Promise<Res> {
  const r = await resolveOrg(orgId);
  if (!r) return { ok: false, error: "No autorizado." };
  if (!r.ok) return r;
  try { await removeWatchMark(r.orgId, country, markId); return { ok: true }; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Error." }; }
}

export async function searchMarksAction(q: string, orgId: number | null = null): Promise<{ ok: boolean; marks?: MarkLite[] }> {
  const r = await resolveOrg(orgId);
  if (!r || !r.ok) return { ok: false };
  return { ok: true, marks: await searchMarks(r.orgId, q) };
}

export async function listHoldersAction(orgId: number | null = null): Promise<{ ok: boolean; holders?: { holder: string; n: number }[] }> {
  const r = await resolveOrg(orgId);
  if (!r || !r.ok) return { ok: false };
  const { listHolders } = await import("@/lib/scopes");
  return { ok: true, holders: await listHolders(r.orgId) };
}
