"use client";

import { useEffect, useRef } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRealtimeTokenAction } from "../actions";
import type { ReviewStatus } from "@/lib/reviews";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

interface RemoteChange {
  candKey: string;
  status: ReviewStatus | null; // null = borrada (vuelve a pendiente)
  reviewer: string | null;
}

/**
 * Suscribe la vista a los cambios de `reviews` de una corrida (Supabase Realtime).
 * Cada usuario ve en vivo las decisiones de los demás. Las claves que el usuario
 * tiene a medio guardar (`savingKeys`) se ignoran para no pisar su clic optimista.
 *
 * Seguridad: usa un token firmado por el servidor (rol authenticated); sin él
 * (SUPABASE_JWT_SECRET ausente o sin sesión) simplemente no se activa.
 */
export function useRealtimeReviews(opts: {
  runId: number | undefined;
  savingKeys: React.MutableRefObject<Set<string>>;
  onRemoteChange: (c: RemoteChange) => void;
  onResync: () => void;
}) {
  const { runId, savingKeys, onRemoteChange, onResync } = opts;
  // Callbacks vivos sin re-suscribir en cada render.
  const cbRef = useRef({ onRemoteChange, onResync });
  cbRef.current = { onRemoteChange, onResync };

  useEffect(() => {
    if (!runId || !URL || !KEY) return;
    let cancelled = false;
    let client: SupabaseClient | null = null;
    let refresh: ReturnType<typeof setInterval> | undefined;

    (async () => {
      const auth = await getRealtimeTokenAction();
      if (cancelled || !auth) return;

      client = createClient(URL!, KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { params: { eventsPerSecond: 5 } },
      });
      await client.realtime.setAuth(auth.token);

      // Renueva el token antes de que venza (~10% de margen) para no perder el socket.
      const everyMs = Math.max(60, auth.ttl * 0.9) * 1000;
      refresh = setInterval(async () => {
        const next = await getRealtimeTokenAction();
        if (next && client) client.realtime.setAuth(next.token);
      }, everyMs);

      client
        .channel(`reviews:${runId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "reviews", filter: `run_id=eq.${runId}` },
          (payload) => {
            const row = (payload.new ?? payload.old) as
              | { cand_key?: string; status?: ReviewStatus; reviewer_name?: string | null }
              | undefined;
            const candKey = row?.cand_key;
            if (!candKey || savingKeys.current.has(candKey)) return; // no pisar mi propio guardado
            if (payload.eventType === "DELETE") {
              cbRef.current.onRemoteChange({ candKey, status: null, reviewer: null });
            } else {
              cbRef.current.onRemoteChange({
                candKey,
                status: (row?.status as ReviewStatus) ?? null,
                reviewer: row?.reviewer_name ?? null,
              });
            }
          },
        )
        .subscribe((status) => {
          // Al (re)conectar, re-lee todo por si se perdió algún evento.
          if (status === "SUBSCRIBED") cbRef.current.onResync();
        });
    })();

    return () => {
      cancelled = true;
      if (refresh) clearInterval(refresh);
      if (client) client.removeAllChannels();
    };
  }, [runId, savingKeys]);
}
