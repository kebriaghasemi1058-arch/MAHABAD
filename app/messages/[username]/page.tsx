"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { usePresence } from "@/lib/presence-context";
import { useI18n } from "@/lib/i18n";

type Profile = {
  id: string;
  username: string;
  avatar_path: string | null;
  last_seen_at: string | null;
  show_activity_status: boolean;
};
type DM = { id: string; text: string; created_at: string; sender_id: string };

export default function ChatPage() {
  const params = useParams();
  const username = params.username as string;
  const { user, isAdmin, loading } = useAuth();
  const { onlineUsernames } = usePresence();
  const { t } = useI18n();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [messages, setMessages] = useState<DM[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [typingChannel, setTypingChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTypingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, username, avatar_path, last_seen_at, show_activity_status")
      .eq("username", username)
      .single()
      .then(({ data }) => setProfile(data ?? null));
  }, [username]);

  // Typing indicator: a lightweight broadcast channel (not persisted to
  // the database), one per conversation pair.
  useEffect(() => {
    if (!user || !profile) return;
    const pairKey = [user.id, profile.id].sort().join("_");
    const channel = supabase.channel(`typing_${pairKey}`);
    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload.from !== user.id) {
          setOtherTyping(true);
          if (stopTypingTimeout.current) clearTimeout(stopTypingTimeout.current);
          stopTypingTimeout.current = setTimeout(() => setOtherTyping(false), 3000);
        }
      })
      .subscribe();
    setTypingChannel(channel);
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile]);

  function handleTextChange(value: string) {
    setText(value);
    if (!typingChannel) return;
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingChannel.send({ type: "broadcast", event: "typing", payload: { from: user!.id } });
    typingTimeout.current = setTimeout(() => {}, 1000);
  }

  useEffect(() => {
    if (!user || !profile) return;

    supabase
      .from("direct_messages")
      .select("id, text, created_at, sender_id")
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${profile.id}),and(sender_id.eq.${profile.id},recipient_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setMessages(data ?? []);
        // Clear the unread badge for this conversation.
        supabase
          .from("direct_messages")
          .update({ is_read: true })
          .eq("sender_id", profile.id)
          .eq("recipient_id", user.id)
          .eq("is_read", false)
          .then(() => {});
      });

    const channel = supabase
      .channel(`dm_${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          const row = payload.new as DM & { recipient_id: string };
          if (row.sender_id === user.id) return; // already added locally by submit()
          const isThisConversation =
            row.sender_id === profile.id && row.recipient_id === user.id;
          if (isThisConversation) {
            setMessages((prev) => [...prev, row]);
            supabase.from("direct_messages").update({ is_read: true }).eq("id", row.id);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "direct_messages" },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as any).id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile || !text.trim()) return;
    setSending(true);
    const { data, error } = await supabase
      .from("direct_messages")
      .insert({ sender_id: user.id, recipient_id: profile.id, text: text.trim() })
      .select("id, text, created_at, sender_id")
      .single();
    setSending(false);
    if (!error && data) {
      setMessages((prev) => [...prev, data]);
      setText("");
    }
  }

  async function deleteMessage(id: string) {
    await supabase.from("direct_messages").delete().eq("id", id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  if (loading || !user) return null;
  if (profile === undefined) return null;
  if (profile === null) return <p className="text-center text-ink/50">404</p>;

  const avatarUrl = profile.avatar_path
    ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_path).data.publicUrl
    : null;
  const isOnline = onlineUsernames.includes(profile.username);
  const canSeeStatus = profile.show_activity_status || isAdmin;

  return (
    <div className="max-w-md mx-auto flex flex-col h-[75vh]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-full bg-stone-dark overflow-hidden flex-shrink-0">
          {avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-ink">{profile.username}</p>
          {otherTyping ? (
            <p className="text-xs text-juniper">{t.typing}</p>
          ) : canSeeStatus ? (
            <p className="text-xs text-ink/40">
              {isOnline
                ? t.online
                : profile.last_seen_at
                ? `${t.lastSeen}: ${new Date(profile.last_seen_at).toLocaleString("fa-IR")}`
                : ""}
            </p>
          ) : null}
        </div>
        <Link href={`/u/${profile.username}`} className="text-xs text-juniper underline focus-ring flex-shrink-0">
          {t.viewProfile}
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 bg-surface rounded-2xl border border-ink/10 p-3">
        {messages.map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <div key={m.id} className={`flex items-center gap-1 ${mine ? "flex-row-reverse" : ""}`}>
              <div
                className={`max-w-[75%] rounded-xl px-3 py-1.5 text-sm ${
                  mine ? "bg-juniper text-oncolor" : "bg-stone-dark"
                }`}
              >
                {m.text}
              </div>
              {mine && (
                <button onClick={() => deleteMessage(m.id)} className="text-xs text-ink/30 focus-ring">
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} className="flex gap-2 mt-3">
        <input
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={t.typeMessage}
          className="flex-1 border border-ink/20 rounded-full px-4 py-2 bg-surface focus-ring"
        />
        <button disabled={sending} className="px-4 py-2 rounded-full bg-brick text-oncolor font-medium focus-ring">
          {t.send}
        </button>
      </form>
    </div>
  );
}
