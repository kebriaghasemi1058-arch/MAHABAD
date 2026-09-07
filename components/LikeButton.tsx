"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

export default function LikeButton({
  photoId,
  initialCount,
  initiallyLiked,
}: {
  photoId: string;
  initialCount: number;
  initiallyLiked: boolean;
}) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initiallyLiked);
  const [busy, setBusy] = useState(false);
  const [popKey, setPopKey] = useState(0);

  async function toggle() {
    if (!user) {
      alert(t.loginRequired);
      return;
    }
    setBusy(true);
    if (liked) {
      setLiked(false);
      setCount((c) => c - 1);
      await supabase.from("likes").delete().eq("photo_id", photoId).eq("user_id", user.id);
    } else {
      setLiked(true);
      setCount((c) => c + 1);
      setPopKey((k) => k + 1);
      await supabase.from("likes").insert({ photo_id: photoId, user_id: user.id });
    }
    setBusy(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`text-sm px-3 py-1 rounded-full border focus-ring transition-colors ${
        liked ? "bg-brick text-oncolor border-brick" : "border-ink/20 text-ink"
      }`}
    >
      <span key={popKey} className={liked ? "inline-block animate-pop" : "inline-block"}>
        {liked ? "♥" : "♡"}
      </span>{" "}
      {liked ? t.liked : t.like} ({count})
    </button>
  );
}
