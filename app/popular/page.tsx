"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import PhotoCard, { PhotoWithData } from "@/components/PhotoCard";

export default function PopularPage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [photos, setPhotos] = useState<PhotoWithData[] | null>(null);

  useEffect(() => {
    supabase
      .from("photos")
      .select(
        `id, image_path, caption, media_type, post_type,
         neighborhoods ( name_fa, name_ckb ),
         likes ( user_id ),
         comments ( id, text, created_at, profiles ( username, avatar_path ) )`
      )
      .then(({ data }) => {
        if (!data) return setPhotos([]);
        const mapped: PhotoWithData[] = data.map((p: any) => ({
          id: p.id,
          image_url: supabase.storage.from("photos").getPublicUrl(p.image_path).data.publicUrl,
          media_type: p.media_type,
          post_type: p.post_type,
          caption: p.caption,
          neighborhood_name: p.neighborhoods
            ? lang === "fa"
              ? p.neighborhoods.name_fa
              : p.neighborhoods.name_ckb
            : null,
          like_count: p.likes?.length ?? 0,
          liked_by_user: !!p.likes?.some((l: any) => l.user_id === user?.id),
          comments: p.comments ?? [],
        }));
        mapped.sort((a, b) => b.like_count - a.like_count);
        setPhotos(mapped.slice(0, 20));
      });
  }, [lang, user?.id]);

  return (
    <div>
      <section className="mb-6">
        <h1 className="text-2xl font-bold text-ink">{t.popular}</h1>
        <p className="text-ink/70 mt-1">{t.popularIntro}</p>
      </section>

      {photos === null && <p className="text-ink/50">…</p>}
      {photos?.length === 0 && <p className="text-ink/50">{t.noPhotos}</p>}

      <div className="grid gap-5">
        {photos?.map((p) => (
          <PhotoCard key={p.id} photo={p} />
        ))}
      </div>
    </div>
  );
}
