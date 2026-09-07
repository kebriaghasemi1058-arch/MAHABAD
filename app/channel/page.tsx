"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

type Message = {
  id: string;
  text: string;
  created_at: string;
  user_id: string;
  profiles: { username: string; avatar_path: string | null } | null;
  like_count: number;
  liked_by_user: boolean;
};

export default function ChannelPage() {
  const { user, isAdmin } = useAuth();
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [locked, setLocked] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("channel_locked")
      .single()
      .then(({ data }) => setLocked(!!data?.channel_locked));

    Promise.all([
      // IMPORTANT: fetch the NEWEST 100 messages (descending + limit),
      // then reverse for chronological display. Fetching ascending +
      // limit(100) instead would silently return only the OLDEST 100 —
      // which looks exactly like "new messages disappearing" once a
      // channel has more than 100 messages in it.
      supabase
        .from("channel_messages")
        .select("id, text, created_at, user_id, profiles ( username, avatar_path )")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("message_likes").select("message_id, user_id"),
    ]).then(([msgRes, likeRes]) => {
      const likes = likeRes.data ?? [];
      const mapped = ((msgRes.data as any[]) ?? [])
        .reverse()
        .map((m) => ({
          ...m,
          like_count: likes.filter((l) => l.message_id === m.id).length,
          liked_by_user: likes.some((l) => l.message_id === m.id && l.user_id === user?.id),
        }));
      setMessages(mapped);
    });

    // Live updates for new messages/likes/deletes from anyone, no refresh needed.
    const channel = supabase
      .channel("channel_messages_live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "channel_messages" },
        async (payload) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, avatar_path")
            .eq("id", payload.new.user_id)
            .single();
          setMessages((prev) => [
            ...prev,
            { ...(payload.new as any), profiles: profile ?? null, like_count: 0, liked_by_user: false },
          ]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "channel_messages" },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as any).id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      alert(t.loginRequired);
      return;
    }
    if (!text.trim()) return;
    setSending(true);
    const { error } = await supabase.from("channel_messages").insert({ user_id: user.id, text: text.trim() });
    setSending(false);
    if (error) {
      alert(error.message);
      return;
    }
    setText("");
  }

  async function toggleLike(m: Message) {
    if (!user) {
      alert(t.loginRequired);
      return;
    }
    setMessages((prev) =>
      prev.map((x) =>
        x.id === m.id
          ? { ...x, liked_by_user: !x.liked_by_user, like_count: x.like_count + (x.liked_by_user ? -1 : 1) }
          : x
      )
    );
    if (m.liked_by_user) {
      await supabase.from("message_likes").delete().eq("message_id", m.id).eq("user_id", user.id);
    } else {
      await supabase.from("message_likes").insert({ message_id: m.id, user_id: user.id });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t.confirmDelete)) return;
    await supabase.from("channel_messages").delete().eq("id", id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  async function toggleLock() {
    const next = !locked;
    setLocked(next);
    await supabase.from("app_settings").update({ channel_locked: next }).eq("id", true);
  }

  const canPost = user && (!locked || isAdmin);

  return (
    <div className="max-w-lg mx-auto flex flex-col h-[70vh]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-ink">{t.channel}</h1>
          <p className="text-sm text-ink/60">{t.channelIntro}</p>
        </div>
        {isAdmin && (
          <button
            onClick={toggleLock}
            className={`text-xs px-3 py-1.5 rounded-full border focus-ring flex-shrink-0 ${
              locked ? "bg-brick text-oncolor border-brick" : "border-ink/20 text-ink"
            }`}
          >
            {locked ? t.unlockChannel : t.lockChannel}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 bg-surface rounded-2xl border border-ink/10 p-3">
        {messages.map((m) => (
          <div key={m.id} className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-full bg-stone-dark flex-shrink-0 overflow-hidden">
              {m.profiles?.avatar_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={supabase.storage.from("avatars").getPublicUrl(m.profiles.avatar_path).data.publicUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1">
              {m.profiles?.username ? (
                <Link href={`/u/${m.profiles.username}`} className="text-xs font-semibold text-saffron hover:underline">
                  {m.profiles.username}
                </Link>
              ) : (
                <span className="text-xs font-semibold text-saffron">...</span>
              )}
              <p className="text-sm text-ink">{m.text}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <button
                  onClick={() => toggleLike(m)}
                  className={`text-xs focus-ring ${m.liked_by_user ? "text-brick" : "text-ink/40"}`}
                >
                  {m.liked_by_user ? "♥" : "♡"} {m.like_count > 0 && m.like_count}
                </button>
                {isAdmin && (
                  <button onClick={() => handleDelete(m.id)} className="text-xs text-ink/30 underline focus-ring">
                    {t.delete}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {locked && !isAdmin && <p className="text-xs text-brick mt-2">{t.channelLocked}</p>}

      <form onSubmit={submit} className="flex gap-2 mt-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.typeMessage}
          disabled={!canPost}
          className="flex-1 border border-ink/20 rounded-full px-4 py-2 bg-surface focus-ring disabled:opacity-50"
        />
        <button
          disabled={sending || !canPost}
          className="px-4 py-2 rounded-full bg-brick text-oncolor font-medium focus-ring disabled:opacity-50"
        >
          {t.send}
        </button>
      </form>
    </div>
  );
}
