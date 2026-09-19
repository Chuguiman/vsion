"use server";

import { getSession } from "@/lib/auth";
import { setMonitored } from "@/lib/countries";

export async function setMonitoredAction(countryId: number, active: boolean): Promise<{ ok: boolean; error?: string }> {
  const s = await getSession();
  if (!s || (s.role !== "superadmin" && s.role !== "admin")) return { ok: false, error: "No autorizado." };
  try {
    await setMonitored(s.organizationId, countryId, active);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error." };
  }
}
