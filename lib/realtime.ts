"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";

// Live sync over Supabase Realtime broadcast channels (ADR-007). Carries only
// "something changed" signals and field patches — never privileged data; all
// real reads go through the authenticated server. Silently disabled until
// NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY are set.

let client: SupabaseClient | null | undefined;

export function getRealtimeClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key) : null;
  return client;
}

/** Subscribe to a broadcast channel; returns a send function (no-op if off). */
export function useRealtimeChannel(
  channelName: string,
  opts: {
    onMessage?: (event: string, payload: unknown) => void;
    presence?: { key: string; name: string };
    onPresence?: (names: string[]) => void;
  },
): (event: string, payload: unknown) => void {
  const sendRef = useRef<(event: string, payload: unknown) => void>(() => {});
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const supabase = getRealtimeClient();
    if (!supabase) return;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        ...(optsRef.current.presence
          ? { presence: { key: optsRef.current.presence.key } }
          : {}),
      },
    });
    channel.on("broadcast", { event: "*" }, (msg) => {
      optsRef.current.onMessage?.(msg.event, msg.payload);
    });
    if (optsRef.current.presence) {
      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ name: string }>();
        const names = Object.values(state)
          .flat()
          .map((p) => p.name);
        optsRef.current.onPresence?.(names);
      });
    }
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" && optsRef.current.presence) {
        void channel.track({ name: optsRef.current.presence.name });
      }
    });
    sendRef.current = (event, payload) => {
      void channel.send({ type: "broadcast", event, payload });
    };
    return () => {
      sendRef.current = () => {};
      void supabase.removeChannel(channel);
    };
  }, [channelName]);

  return (event, payload) => sendRef.current(event, payload);
}
