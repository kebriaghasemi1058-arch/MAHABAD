"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

type Comment = {
  id: string;
  text: string;
  created_at: string;
  user_id?: string;
  profiles?: { username: string; avatar_path: string | null } | null;
};

export default function CommentSection({
  photoId,
  initialComments,
}: {
  photoId: string;
  initialComments: Comment[];
}) {
  const { user, isAdmin } = useAuth();
  const { t } = useI18n();
  const [comments, setComments] = useState(initialComments);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      alert(t.loginRequired);
      return;
    }
    if (!text.trim()) return;
    setSending(true);
    const { data, error } = await supabase
      .from("comments")
      .insert({ photo_id: photoId, user_id: user.id, text: text.trim() })
      .select("id, text, created_at, user_id, profiles ( username, avatar_path )")
      .single();
    setSending(false);
    if (!error && data) {
      setComments((c) => [...c, data as any]);
      setText("");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t.confirmDelete)) return;
    await supabase.from("comments").delete().eq("id", id);
    setComments((c) => c.filter((x) => x.id !== id));
  }

  function startEdit(c: Comment) {
    setEditingId(c.id);
    setEditText(c.text);
  }

  async function saveEdit(id: string) {
    await supabase.from("comments").update({ text: editText.trim() }).eq("id", id);
    setComments((cs) => cs.map((c) => (c.id === id ? { ...c, text: editText.trim() } : c)));
    setEditingId(null);
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-ink/60 underline focus-ring"
      >
        {t.comments} ({comments.length})
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {comments.map((c) => {
            const avatarUrl = c.profiles?.avatar_path
              ? supabase.storage.from("avatars").getPublicUrl(c.profiles.avatar_path).data.publicUrl
              : null;
            const isOwner = user && c.user_id === user.id;
            return (
              <div key={c.id} className="flex items-start gap-2 text-sm bg-stone-dark rounded-lg px-3 py-2">
                <div className="w-6 h-6 rounded-full bg-surface flex-shrink-0 overflow-hidden">
                  {avatarUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1">
                  {c.profiles?.username ? (
                    <Link
                      href={`/u/${c.profiles.username}`}
                      className="text-xs font-semibold text-saffron block hover:underline"
                    >
                      {c.profiles.username}
                    </Link>
                  ) : (
                    <span className="text-xs font-semibold text-saffron block">...</span>
                  )}
                  {editingId === c.id ? (
                    <div className="flex gap-2 mt-1">
                      <input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="flex-1 border border-ink/20 rounded-full px-2 py-0.5 text-sm bg-surface focus-ring"
                      />
                      <button onClick={() => saveEdit(c.id)} className="text-xs text-juniper underline focus-ring">
                        {t.save}
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-ink/40 underline focus-ring">
                        {t.cancel}
                      </button>
                    </div>
                  ) : (
                    c.text
                  )}
                </div>
                {(isOwner || isAdmin) && editingId !== c.id && (
                  <div className="flex gap-2 flex-shrink-0">
                    {isOwner && (
                      <button onClick={() => startEdit(c)} className="text-xs text-juniper underline focus-ring">
                        {t.edit}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-xs text-brick underline focus-ring"
                    >
                      {t.delete}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <form onSubmit={submit} className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t.addComment}
              className="flex-1 border border-ink/20 rounded-full px-3 py-1 text-sm bg-surface focus-ring"
            />
            <button
              type="submit"
              disabled={sending}
              className="text-sm px-3 py-1 rounded-full bg-juniper text-oncolor focus-ring"
            >
              {t.send}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
