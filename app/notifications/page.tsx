"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

type Notif = {
  id: string;
  type: "comment" | "dm" | "announcement" | "neighborhood_photo" | "follow" | "like";
  content: string | null;
  related_id: string | null;
  created_at: string;
  is_read: boolean;
  actor: { username: string; avatar_path: string | null } | null;
};

export default function NotificationsPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notifications")
      .select("id, type, content, related_id, created_at, is_read, actor:actor_id ( username, avatar_path )")
      .neq("type", "dm")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setNotifs((data as any) ?? []);
        supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
      });
  }, [user]);

  if (loading || !user) return null;

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">{t.notifications}</h1>
      {notifs.length === 0 && <p className="text-ink/50 text-sm">{t.noNotifications}</p>}
      <div className="space-y-2">
        {notifs.map((n) => (
          <div key={n.id} className="bg-surface rounded-xl border border-ink/10 p-3 text-sm flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-stone-dark overflow-hidden flex-shrink-0">
              {n.actor?.avatar_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={supabase.storage.from("avatars").getPublicUrl(n.actor.avatar_path).data.publicUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1">
              <p>
                {n.actor?.username && (
                  <Link href={`/u/${n.actor.username}`} className="font-semibold text-saffron hover:underline">
                    {n.actor.username}
                  </Link>
                )}{" "}
                {n.type === "comment" && t.newCommentNotif}
                {n.type === "announcement" && "📢 " + t.postAnnouncement + ":"}
                {n.type === "neighborhood_photo" && "📍 عکس جدید در محله‌ای که دنبال می‌کنید:"}
                {n.type === "follow" && t.newFollowerNotif}
                {n.type === "like" && t.newLikeNotif}
              </p>
              {n.content && <p className="text-ink/70 mt-0.5">{n.content}</p>}
              {(n.type === "comment" || n.type === "like" || n.type === "neighborhood_photo") && n.related_id && (
                <Link href={`/photo/${n.related_id}`} className="block text-xs text-juniper underline mt-1">
                  مشاهده پست
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
