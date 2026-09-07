"use client";

import { useState } from "react";
import Image from "next/image";
import LikeButton from "./LikeButton";
import CommentSection from "./CommentSection";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

export type PhotoWithData = {
  id: string;
  image_url: string;
  media_type: "image" | "video";
  post_type: "beauty" | "issue";
  caption: string | null;
  neighborhood_name: string | null;
  like_count: number;
  liked_by_user: boolean;
  pinned?: boolean;
  owner_id?: string;
  bookmarked_by_user?: boolean;
  comments: {
    id: string;
    text: string;
    created_at: string;
    user_id?: string;
    profiles?: { username: string; avatar_path: string | null } | null;
  }[];
};

export default function PhotoCard({ photo }: { photo: PhotoWithData }) {
  const { t } = useI18n();
  const { user, isAdmin } = useAuth();
  const isIssue = photo.post_type === "issue";
  const isOwner = user && photo.owner_id && user.id === photo.owner_id;

  const [hidden, setHidden] = useState(false);
  const [reported, setReported] = useState(false);
  const [bookmarked, setBookmarked] = useState(!!photo.bookmarked_by_user);
  const [pinned, setPinned] = useState(!!photo.pinned);
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [copied, setCopied] = useState(false);

  async function handleDelete() {
    if (!confirm(t.confirmDelete)) return;
    await supabase.from("photos").delete().eq("id", photo.id);
    setHidden(true);
  }

  async function handleReport() {
    if (!user) {
      alert(t.loginRequired);
      return;
    }
    const reason = prompt(t.reportReason) ?? "";
    await supabase.from("reports").insert({ photo_id: photo.id, user_id: user.id, reason: reason || null });
    setReported(true);
  }

  async function toggleBookmark() {
    if (!user) {
      alert(t.loginRequired);
      return;
    }
    if (bookmarked) {
      setBookmarked(false);
      await supabase.from("bookmarks").delete().eq("photo_id", photo.id).eq("user_id", user.id);
    } else {
      setBookmarked(true);
      await supabase.from("bookmarks").insert({ photo_id: photo.id, user_id: user.id });
    }
  }

  async function togglePin() {
    const next = !pinned;
    setPinned(next);
    await supabase.from("photos").update({ pinned: next }).eq("id", photo.id);
  }

  async function saveCaption() {
    await supabase.from("photos").update({ caption: caption || null }).eq("id", photo.id);
    setEditing(false);
  }

  async function handleShare() {
    const url = `${window.location.origin}/photo/${photo.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt(t.shareLink, url);
    }
  }

  if (hidden) return null;

  return (
    <article className="bg-surface rounded-2xl overflow-hidden card-shadow border border-ink/10 animate-card">
      {pinned && (
        <div className="bg-saffron/20 text-saffron text-xs font-semibold px-4 py-1">📌 {t.pinned}</div>
      )}
      <div className="relative w-full aspect-[4/3] bg-stone-dark">
        {photo.media_type === "video" ? (
          <video
            src={photo.image_url}
            controls
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <Image
            src={photo.image_url}
            alt={photo.caption ?? ""}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 700px"
          />
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 flex-wrap justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                isIssue ? "bg-brick/10 text-brick" : "bg-juniper/10 text-juniper"
              }`}
            >
              {isIssue ? t.issues : t.beauties}
            </span>
            {photo.neighborhood_name && (
              <span className="text-xs text-saffron font-semibold">{photo.neighborhood_name}</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isAdmin && (
              <button onClick={togglePin} className="text-xs text-saffron underline focus-ring">
                {pinned ? t.unpin : t.pin}
              </button>
            )}
            {(isOwner || isAdmin) && !editing && (
              <button onClick={() => setEditing(true)} className="text-xs text-juniper underline focus-ring">
                {t.edit}
              </button>
            )}
            {(isOwner || isAdmin) && (
              <button onClick={handleDelete} className="text-xs text-brick underline focus-ring">
                {t.delete}
              </button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="mt-2 flex gap-2">
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="flex-1 border border-ink/20 rounded-full px-3 py-1 text-sm bg-surface focus-ring"
            />
            <button onClick={saveCaption} className="text-xs text-juniper underline focus-ring">
              {t.save}
            </button>
            <button onClick={() => setEditing(false)} className="text-xs text-ink/40 underline focus-ring">
              {t.cancel}
            </button>
          </div>
        ) : (
          photo.caption && <p className="text-ink mt-1">{photo.caption}</p>
        )}

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <LikeButton
            photoId={photo.id}
            initialCount={photo.like_count}
            initiallyLiked={photo.liked_by_user}
          />
          <button
            onClick={toggleBookmark}
            className={`text-xs focus-ring ${bookmarked ? "text-saffron" : "text-ink/40"}`}
          >
            {bookmarked ? "★ " + t.bookmarked : "☆ " + t.bookmark}
          </button>
          <button onClick={handleShare} className="text-xs text-ink/40 underline focus-ring">
            {copied ? t.linkCopied : t.shareLink}
          </button>
          {!isAdmin && (
            <button
              onClick={handleReport}
              disabled={reported}
              className="text-xs text-ink/40 underline focus-ring"
            >
              {reported ? t.reported : t.report}
            </button>
          )}
        </div>

        <CommentSection photoId={photo.id} initialComments={photo.comments} />
      </div>
    </article>
  );
}
