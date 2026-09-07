"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { useAuth } from "./auth-context";

const PresenceContext = createContext<{ onlineUsernames: string[] }>({ onlineUsernames: [] });

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [onlineUsernames, setOnlineUsernames] = useState<string[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Create the shared channel exactly once for the whole app. The
  // presence listener must be attached before subscribe() is called —
  // attaching it later (e.g. from a second `.channel("online-users")`
  // call elsewhere) throws, since Supabase reuses channels by topic name.
  useEffect(() => {
    const channel = supabase.channel("online-users", {
      config: { presence: { key: user?.id ?? `anon-${Math.random()}` } },
    });
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ username: string }>();
      const names = Object.values(state)
        .flat()
        .map((p) => p.username);
      setOnlineUsernames(Array.from(new Set(names)));
    });
    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // Recreated only if the logged-in user identity changes, so the
    // presence key stays correct without ever double-subscribing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Track/untrack this user's own presence on the already-open channel,
  // and keep last_seen_at fresh for the profile page's offline fallback.
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !user || !profile) return;
    channel.track({ username: profile.username });
    supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);
    const interval = setInterval(() => {
      supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, profile]);

  return <PresenceContext.Provider value={{ onlineUsernames }}>{children}</PresenceContext.Provider>;
}

export function usePresence() {
  return useContext(PresenceContext);
}
