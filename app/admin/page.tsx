"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { usePresence } from "@/lib/presence-context";
import { useI18n } from "@/lib/i18n";

type Inbox = { id: string; text: string; created_at: string; profiles: { username: string } | null };
type Report = { id: string; photo_id: string; reason: string | null; created_at: string };
type UserRow = {
  id: string;
  username: string;
  full_name: string | null;
  phone: string | null;
  birthdate: string | null;
  is_admin: boolean;
  banned_until: string | null;
  created_at: string;
  photos: { count: number }[];
};
type LogRow = { id: string; action: string; target_username: string | null; created_at: string };

export default function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [announcement, setAnnouncement] = useState("");
  const [posting, setPosting] = useState(false);
  const [announcementsList, setAnnouncementsList] = useState<{ id: string; text: string; created_at: string }[]>([]);
  const [inbox, setInbox] = useState<Inbox[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const { onlineUsernames } = usePresence();
  const [stats, setStats] = useState({ totalUsers: 0, postsToday: 0 });
  const [log, setLog] = useState<LogRow[]>([]);
  const [userSearch, setUserSearch] = useState("");

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push("/");
  }, [loading, user, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    loadInbox();
    loadReports();
    loadUsers();
    loadStats();
    loadLog();
    loadAnnouncements();
  }, [isAdmin]);

  function loadAnnouncements() {
    supabase
      .from("announcements")
      .select("id, text, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => setAnnouncementsList(data ?? []));
  }

  function loadInbox() {
    supabase
      .from("admin_messages")
      .select("id, text, created_at, profiles ( username )")
      .order("created_at", { ascending: false })
      .then(({ data }) => setInbox((data as any) ?? []));
  }

  function loadReports() {
    supabase
      .from("reports")
      .select("id, photo_id, reason, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => setReports(data ?? []));
  }

  function loadUsers() {
    supabase
      .from("profiles")
      .select("id, username, full_name, phone, birthdate, is_admin, banned_until, created_at, photos ( count )")
      .order("username")
      .then(({ data }) => setUsers((data as any) ?? []));
  }

  function loadStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("photos").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()),
    ]).then(([usersRes, postsRes]) => {
      setStats({ totalUsers: usersRes.count ?? 0, postsToday: postsRes.count ?? 0 });
    });
  }

  function loadLog() {
    supabase
      .from("admin_actions")
      .select("id, action, target_username, created_at")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => setLog(data ?? []));
  }

  async function logAction(action: string, targetUsername?: string) {
    if (!user) return;
    await supabase.from("admin_actions").insert({ admin_id: user.id, action, target_username: targetUsername ?? null });
    loadLog();
  }

  async function postAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !announcement.trim()) return;
    setPosting(true);
    await supabase.from("announcements").insert({ text: announcement.trim(), created_by: user.id });
    setAnnouncement("");
    setPosting(false);
    logAction("posted an announcement");
    loadAnnouncements();
  }

  async function deleteAnnouncement(id: string) {
    await supabase.from("announcements").delete().eq("id", id);
    setAnnouncementsList((a) => a.filter((x) => x.id !== id));
    logAction("deleted an announcement");
  }

  async function dismissReport(id: string) {
    await supabase.from("reports").delete().eq("id", id);
    setReports((r) => r.filter((x) => x.id !== id));
  }

  async function deleteReportedPhoto(reportId: string, photoId: string) {
    if (!confirm(t.confirmDelete)) return;
    await supabase.from("photos").delete().eq("id", photoId);
    setReports((r) => r.filter((x) => x.id !== reportId));
    logAction("deleted a reported photo");
  }

  async function banUser(username: string, id: string, hours: number) {
    const until = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    await supabase.rpc("set_user_ban", { target_user: id, ban_until: until });
    setUsers((us) => us.map((u) => (u.id === id ? { ...u, banned_until: until } : u)));
    logAction(`banned for ${hours}h`, username);
  }

  async function unbanUser(username: string, id: string) {
    await supabase.rpc("set_user_ban", { target_user: id, ban_until: null });
    setUsers((us) => us.map((u) => (u.id === id ? { ...u, banned_until: null } : u)));
    logAction("unbanned", username);
  }

  async function deleteUserPermanently(username: string, id: string) {
    if (!confirm(t.confirmDeleteUser)) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const res = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: id, accessToken }),
    });
    if (res.ok) {
      setUsers((us) => us.filter((u) => u.id !== id));
      logAction("deleted user permanently", username);
      alert(t.userDeleted);
    } else {
      const body = await res.json();
      alert(body.error ?? "error");
    }
  }

  async function deleteAdminMessage(id: string) {
    await supabase.from("admin_messages").delete().eq("id", id);
    setInbox((i) => i.filter((m) => m.id !== id));
  }

  async function clearChannel() {
    if (!confirm(t.confirmClearChannel)) return;
    await supabase.from("channel_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    logAction("cleared the city channel");
  }

  async function clearSite() {
    if (!confirm(t.confirmClearSite)) return;
    await supabase.from("photos").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    logAction("cleared all site posts");
  }

  if (loading || !isAdmin) return null;

  const filteredUsers = users.filter(
    (u) =>
      !userSearch.trim() ||
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.phone?.includes(userSearch)
  );

  return (
    <div className="max-w-lg mx-auto space-y-10">
      <h1 className="text-xl font-bold text-ink">{t.admin}</h1>

      <section>
        <h2 className="text-sm font-semibold text-ink/70 mb-2">{t.siteStats}</h2>
        <div className="flex gap-3 flex-wrap">
          <div className="bg-surface rounded-xl border border-ink/10 p-3 flex-1 min-w-[120px] text-center">
            <p className="text-2xl font-bold text-juniper">{stats.totalUsers}</p>
            <p className="text-xs text-ink/50">{t.totalUsers}</p>
          </div>
          <div className="bg-surface rounded-xl border border-ink/10 p-3 flex-1 min-w-[120px] text-center">
            <p className="text-2xl font-bold text-brick">{stats.postsToday}</p>
            <p className="text-xs text-ink/50">{t.postsToday}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink/70 mb-2">{t.activeNow}</h2>
        {onlineUsernames.length === 0 ? (
          <p className="text-xs text-ink/40">{t.noOneActive}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {onlineUsernames.map((n) => (
              <span key={n} className="text-xs bg-juniper/10 text-juniper px-2 py-1 rounded-full">
                {n}
              </span>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink/70 mb-2">{t.postAnnouncement}</h2>
        <form onSubmit={postAnnouncement} className="flex gap-2">
          <input
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            placeholder={t.announcement}
            className="flex-1 border border-ink/20 rounded-full px-4 py-2 bg-surface focus-ring"
          />
          <button disabled={posting} className="px-4 py-2 rounded-full bg-saffron text-oncolor font-medium focus-ring">
            {t.saveAnnouncement}
          </button>
        </form>
        <div className="space-y-1 mt-2">
          {announcementsList.map((a) => (
            <div key={a.id} className="bg-surface rounded-xl border border-ink/10 p-2 text-sm flex items-center justify-between gap-2">
              <span>{a.text}</span>
              <button onClick={() => deleteAnnouncement(a.id)} className="text-xs text-brick underline focus-ring flex-shrink-0">
                {t.delete}
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink/40 mt-1">
          کانال شهر رو از صفحه‌ی <a href="/channel" className="underline">کانال شهر</a> می‌تونید قفل/باز کنید.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-brick mb-2">منطقه‌ی خطر</h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={clearChannel} className="text-xs px-3 py-1.5 rounded-full bg-brick/10 text-brick focus-ring">
            {t.clearChannel}
          </button>
          <button onClick={clearSite} className="text-xs px-3 py-1.5 rounded-full bg-brick/10 text-brick focus-ring">
            {t.clearSite}
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink/70 mb-2">گزارش‌های ثبت‌شده</h2>
        <div className="space-y-2">
          {reports.length === 0 && <p className="text-xs text-ink/40">{t.noMessagesYet}</p>}
          {reports.map((r) => (
            <div key={r.id} className="bg-surface rounded-xl border border-ink/10 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink/60">شناسه عکس: {r.photo_id.slice(0, 8)}...</span>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => deleteReportedPhoto(r.id, r.photo_id)} className="text-xs text-brick underline focus-ring">
                    {t.delete}
                  </button>
                  <button onClick={() => dismissReport(r.id)} className="text-xs text-ink/40 underline focus-ring">
                    رد کردن
                  </button>
                </div>
              </div>
              {r.reason && <p className="text-xs text-ink/50 mt-1">{t.reportReason}: {r.reason}</p>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink/70 mb-2">{t.adminMessages}</h2>
        <div className="space-y-2">
          {inbox.length === 0 && <p className="text-xs text-ink/40">{t.noMessagesYet}</p>}
          {inbox.map((m) => (
            <div key={m.id} className="bg-surface rounded-xl border border-ink/10 p-3 text-sm flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-semibold text-saffron block">{m.profiles?.username ?? "..."}</span>
                {m.text}
              </div>
              <button onClick={() => deleteAdminMessage(m.id)} className="text-xs text-brick underline focus-ring flex-shrink-0">
                {t.delete}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink/70 mb-2">{t.newUsers}</h2>
        <div className="space-y-2">
          {[...users]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 10)
            .map((u) => (
              <div key={u.id} className="bg-surface rounded-xl border border-ink/10 p-3 text-sm">
                <span className="font-semibold">{u.username}</span>
                <span className="text-xs text-ink/50"> · {new Date(u.created_at).toLocaleString("fa-IR")}</span>
                <div className="text-xs text-ink/50 mt-0.5">
                  {u.full_name} · {u.phone} · {u.birthdate}
                </div>
              </div>
            ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink/70 mb-2">{t.allUsers}</h2>
        <input
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          placeholder={t.username}
          className="w-full border border-ink/20 rounded-full px-4 py-2 bg-surface focus-ring mb-2"
        />
        <div className="space-y-2">
          {filteredUsers.map((u) => {
            const banned = u.banned_until && new Date(u.banned_until) > new Date();
            return (
              <div key={u.id} className="bg-surface rounded-xl border border-ink/10 p-3 text-sm">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="font-semibold">
                    {u.username} {u.is_admin && "👑"}
                  </span>
                  <span className="text-xs text-ink/50">{u.photos?.[0]?.count ?? 0} {t.posts}</span>
                </div>
                <div className="text-xs text-ink/50 mt-0.5">
                  {u.full_name} · {u.phone} · {u.birthdate}
                </div>
                {banned && <p className="text-xs text-brick mt-1">{t.banUser}: {new Date(u.banned_until!).toLocaleString("fa-IR")}</p>}
                {!u.is_admin && (
                  <div className="flex gap-2 flex-wrap mt-2">
                    {banned ? (
                      <button onClick={() => unbanUser(u.username, u.id)} className="text-xs text-juniper underline focus-ring">
                        {t.unban}
                      </button>
                    ) : (
                      <>
                        <button onClick={() => banUser(u.username, u.id, 24)} className="text-xs text-saffron underline focus-ring">
                          {t.ban24h}
                        </button>
                        <button onClick={() => banUser(u.username, u.id, 24 * 7)} className="text-xs text-saffron underline focus-ring">
                          {t.ban7d}
                        </button>
                      </>
                    )}
                    <button onClick={() => deleteUserPermanently(u.username, u.id)} className="text-xs text-brick underline focus-ring">
                      {t.deleteUserPermanently}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink/70 mb-2">{t.activityLog}</h2>
        <div className="space-y-1">
          {log.map((l) => (
            <p key={l.id} className="text-xs text-ink/50">
              {new Date(l.created_at).toLocaleString("fa-IR")} — {l.action} {l.target_username && `(${l.target_username})`}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
