"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type Profile = {
  username: string;
  avatar_path: string | null;
  is_admin: boolean;
  banned_until: string | null;
};

const AuthContext = createContext<{
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
}>({ user: null, profile: null, isAdmin: false, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(u: User | null) {
    if (!u) return setProfile(null);
    const { data } = await supabase
      .from("profiles")
      .select("username, avatar_path, is_admin, banned_until")
      .eq("id", u.id)
      .single();
    if (data?.banned_until && new Date(data.banned_until) > new Date()) {
      const until = new Date(data.banned_until);
      const isFarFuture = until.getFullYear() >= 9000;
      const msg = isFarFuture
        ? "حساب شما مسدود شده است\nبه‌صورت دائمی مسدود شده‌اید"
        : `حساب شما مسدود شده است\nتا ${until.toLocaleString("fa-IR")}`;
      alert(msg);
      await supabase.auth.signOut();
      setProfile(null);
      return;
    }
    setProfile(data ?? null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      loadProfile(u).finally(() => setLoading(false));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      loadProfile(u);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin: !!profile?.is_admin, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
