"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

type Conversation = {
  otherUsername: string;
  otherAvatarPath: string | null;
  lastText: string;
  lastAt: string;
};

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ username: string; avatar_path: string | null }[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("direct_messages")
      .select("text, created_at, sender_id, recipient_id, sender:sender_id ( username, avatar_path ), recipient:recipient_id ( username, avatar_path )")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return setConversations([]);
        const byUser = new Map<string, Conversation>();
        for (const row of data as any[]) {
          const isSender = row.sender_id === user.id;
          const other = isSender ? row.recipient : row.sender;
          if (!other || byUser.has(other.username)) continue;
          byUser.set(other.username, {
            otherUsername: other.username,
            otherAvatarPath: other.avatar_path,
            lastText: row.text,
            lastAt: row.created_at,
          });
        }
        setConversations(Array.from(byUser.values()));
      });
  }, [user]);

  useEffect(() => {
    if (!query.trim()) return setResults([]);
    const handle = setTimeout(() => {
      supabase
        .from("profiles")
        .select("username, avatar_path")
        .ilike("username", `%${query.trim()}%`)
        .neq("id", user?.id ?? "")
        .limit(8)
        .then(({ data }) => setResults(data ?? []));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, user?.id]);

  if (loading || !user) return null;

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">{t.messages}</h1>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.findUser}
        className="w-full border border-ink/20 rounded-full px-4 py-2 bg-surface focus-ring mb-2"
      />

      {results.length > 0 && (
        <div className="bg-surface rounded-2xl border border-ink/10 mb-4 overflow-hidden">
          {results.map((r) => (
            <Link
              key={r.username}
              href={`/messages/${r.username}`}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-stone-dark focus-ring"
            >
              <div className="w-7 h-7 rounded-full bg-stone-dark overflow-hidden flex-shrink-0">
                {r.avatar_path && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={supabase.storage.from("avatars").getPublicUrl(r.avatar_path).data.publicUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              {r.username}
            </Link>
          ))}
        </div>
      )}

      <h2 className="text-sm font-semibold text-ink/60 mb-2">{t.yourConversations}</h2>
      {conversations === null && <p className="text-ink/50 text-sm">…</p>}
      {conversations?.length === 0 && <p className="text-ink/50 text-sm">{t.noConversations}</p>}
      <div className="space-y-1">
        {conversations?.map((c) => (
          <Link
            key={c.otherUsername}
            href={`/messages/${c.otherUsername}`}
            className="flex items-center gap-3 bg-surface rounded-xl border border-ink/10 p-3 hover:bg-stone-dark focus-ring"
          >
            <div className="w-9 h-9 rounded-full bg-stone-dark overflow-hidden flex-shrink-0">
              {c.otherAvatarPath && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={supabase.storage.from("avatars").getPublicUrl(c.otherAvatarPath).data.publicUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{c.otherUsername}</p>
              <p className="text-xs text-ink/50 truncate">{c.lastText}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
