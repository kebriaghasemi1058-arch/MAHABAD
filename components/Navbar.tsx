"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme-context";
import KilimDivider from "./KilimDivider";
import SunBadge from "./SunBadge";

export default function Navbar() {
  const { t, lang, setLang } = useI18n();
  const { user, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadNotifs(0);
      setUnreadMessages(0);
      return;
    }

    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false)
      .neq("type", "dm")
      .then(({ count }) => setUnreadNotifs(count ?? 0));

    supabase
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false)
      .then(({ count }) => setUnreadMessages(count ?? 0));

    const notifChannel = supabase
      .channel(`notif_badge_${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if ((payload.new as any).type !== "dm") setUnreadNotifs((n) => n + 1);
        }
      )
      .subscribe();

    const dmChannel = supabase
      .channel(`dm_badge_${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${user.id}` },
        () => setUnreadMessages((n) => n + 1)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(dmChannel);
    };
  }, [user]);

  return (
    <header>
      <div className="flex items-center justify-between px-5 py-4 max-w-3xl mx-auto flex-wrap gap-y-2">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 flex-shrink-0">
            <SunBadge small />
          </div>
          <span className="text-lg font-bold text-ink leading-tight">
            MAHABAD CITY
            <span className="block text-[10px] font-normal text-ink/50">{t.siteName}</span>
          </span>
        </Link>

        <nav className="flex items-center gap-4 text-sm flex-wrap">
          <div className="flex rounded-full border border-ink/20 overflow-hidden text-xs">
            <button
              onClick={() => setLang("fa")}
              className={`px-2 py-1 focus-ring ${lang === "fa" ? "bg-brick text-oncolor" : ""}`}
            >
              فارسی
            </button>
            <button
              onClick={() => setLang("ckb")}
              className={`px-2 py-1 focus-ring ${lang === "ckb" ? "bg-brick text-oncolor" : ""}`}
            >
              کوردی
            </button>
          </div>

          <button
            onClick={toggleTheme}
            aria-label="toggle theme"
            className="w-8 h-8 rounded-full border border-ink/20 flex items-center justify-center focus-ring flex-shrink-0"
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>

          <Link href="/popular" className="focus-ring">
            {t.popular}
          </Link>
          <Link href="/search" className="focus-ring">
            {t.searchLabel}
          </Link>

          {user ? (
            <>
              <Link href="/channel" className="focus-ring">
                {t.channel}
              </Link>
              <Link href="/upload" className="text-juniper font-medium focus-ring">
                {t.upload}
              </Link>
              <Link href="/notifications" onClick={() => setUnreadNotifs(0)} className="relative focus-ring">
                {t.notifications}
                {unreadNotifs > 0 && (
                  <span className="absolute -top-2 -right-3 bg-brick text-oncolor text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadNotifs}
                  </span>
                )}
              </Link>
              <Link href="/messages" onClick={() => setUnreadMessages(0)} className="relative focus-ring">
                {t.messages}
                {unreadMessages > 0 && (
                  <span className="absolute -top-2 -right-3 bg-brick text-oncolor text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadMessages}
                  </span>
                )}
              </Link>
              <Link href="/profile" className="focus-ring">
                {t.profile}
              </Link>
              <Link href="/contact" className="focus-ring">
                {t.contactAdmin}
              </Link>
              {isAdmin && (
                <Link href="/admin" className="text-brick font-medium focus-ring">
                  {t.admin}
                </Link>
              )}
              <button onClick={() => supabase.auth.signOut()} className="text-ink/60 focus-ring">
                {t.logout}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="focus-ring">
                {t.login}
              </Link>
              <Link href="/signup" className="text-juniper font-medium focus-ring">
                {t.signup}
              </Link>
            </>
          )}
        </nav>
      </div>
      <KilimDivider />
    </header>
  );
}
