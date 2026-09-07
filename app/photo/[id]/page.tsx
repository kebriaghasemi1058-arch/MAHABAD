"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import PhotoCard, { PhotoWithData } from "@/components/PhotoCard";

export default function SinglePhotoPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const { lang } = useI18n();
  const [photo, setPhoto] = useState<PhotoWithData | null | undefined>(undefined);

  useEffect(() => {
    supabase
      .from("photos")
      .select(
        `id, image_path, caption, media_type, post_type, pinned, user_id,
         neighborhoods ( name_fa, name_ckb ),
         likes ( user_id ),
         bookmarks ( user_id ),
         comments ( id, text, created_at, user_id, profiles ( username, avatar_path ) )`
      )
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (!data) return setPhoto(null);
        const p: any = data;
        setPhoto({
          id: p.id,
          image_url: supabase.storage.from("photos").getPublicUrl(p.image_path).data.publicUrl,
          media_type: p.media_type,
          post_type: p.post_type,
          pinned: p.pinned,
          owner_id: p.user_id,
          caption: p.caption,
          neighborhood_name: p.neighborhoods
            ? lang === "fa"
              ? p.neighborhoods.name_fa
              : p.neighborhoods.name_ckb
            : null,
          like_count: p.likes?.length ?? 0,
          liked_by_user: !!p.likes?.some((l: any) => l.user_id === user?.id),
          bookmarked_by_user: !!p.bookmarks?.some((b: any) => b.user_id === user?.id),
          comments: p.comments ?? [],
        });
      });
  }, [id, lang, user?.id]);

  if (photo === undefined) return null;
  if (photo === null) return <p className="text-center text-ink/50">404</p>;

  return (
    <div className="max-w-md mx-auto">
      <PhotoCard photo={photo} />
    </div>
  );
}
