"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import PhotoCard, { PhotoWithData } from "@/components/PhotoCard";
import NeighborhoodFilter, { Neighborhood } from "@/components/NeighborhoodFilter";

export default function HomePage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [filter, setFilter] = useState<number | null>(null);
  const [section, setSection] = useState<"all" | "beauty" | "issue">("all");
  const [search, setSearch] = useState("");
  const [photos, setPhotos] = useState<PhotoWithData[] | null>(null);
  const [announcements, setAnnouncements] = useState<{ id: string; text: string }[]>([]);
  const [followingNeighborhood, setFollowingNeighborhood] = useState(false);

  useEffect(() => {
    supabase
      .from("announcements")
      .select("id, text")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setAnnouncements(data ?? []));
  }, []);

  useEffect(() => {
    supabase
      .from("neighborhoods")
      .select("id, name_fa, name_ckb")
      .order("id")
      .then(({ data }) => setNeighborhoods(data ?? []));
  }, []);

  useEffect(() => {
    if (!user || !filter) return setFollowingNeighborhood(false);
    supabase
      .from("neighborhood_follows")
      .select("neighborhood_id")
      .eq("user_id", user.id)
      .eq("neighborhood_id", filter)
      .maybeSingle()
      .then(({ data }) => setFollowingNeighborhood(!!data));
  }, [user, filter]);

  useEffect(() => {
    let query = supabase
      .from("photos")
      .select(
        `id, image_path, caption, media_type, post_type, pinned, user_id,
         neighborhoods ( name_fa, name_ckb ),
         likes ( user_id ),
         bookmarks ( user_id ),
         comments ( id, text, created_at, user_id, profiles ( username, avatar_path ) )`
      )
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (filter) query = query.eq("neighborhood_id", filter);
    if (section !== "all") query = query.eq("post_type", section);

    query.then(({ data }) => {
      if (!data) return setPhotos([]);
      const mapped: PhotoWithData[] = data.map((p: any) => ({
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
      }));
      setPhotos(mapped);
    });
  }, [filter, section, lang, user?.id]);

  async function toggleFollowNeighborhood() {
    if (!user || !filter) {
      alert(t.loginRequired);
      return;
    }
    if (followingNeighborhood) {
      setFollowingNeighborhood(false);
      await supabase.from("neighborhood_follows").delete().eq("user_id", user.id).eq("neighborhood_id", filter);
    } else {
      setFollowingNeighborhood(true);
      await supabase.from("neighborhood_follows").insert({ user_id: user.id, neighborhood_id: filter });
    }
  }

  return (
    <div>
      <section className="mb-6">
        <h1 className="text-2xl font-bold text-ink">{t.welcome}</h1>
        <p className="text-ink/70 mt-1">{t.intro}</p>
      </section>

      {announcements.length > 0 && (
        <div className="mb-6 space-y-2">
          {announcements.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-3 bg-gradient-to-l from-brick to-saffron text-oncolor rounded-2xl px-5 py-4 text-sm font-medium card-shadow animate-card"
            >
              <span className="text-xl flex-shrink-0">📢</span>
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex gap-2">
        {(["all", "beauty", "issue"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`text-sm px-4 py-1.5 rounded-full border focus-ring ${
              section === s
                ? s === "issue"
                  ? "bg-brick text-oncolor border-brick"
                  : "bg-juniper text-oncolor border-juniper"
                : "border-ink/20 text-ink"
            }`}
          >
            {s === "all" ? t.all : s === "beauty" ? t.beauties : t.issues}
          </button>
        ))}
      </div>

      <div className="mb-5 flex items-center gap-2 flex-wrap">
        <NeighborhoodFilter neighborhoods={neighborhoods} value={filter} onChange={setFilter} />
        {filter && (
          <button
            onClick={toggleFollowNeighborhood}
            className={`text-xs px-3 py-1.5 rounded-full border focus-ring ${
              followingNeighborhood ? "bg-saffron text-oncolor border-saffron" : "border-ink/20 text-ink"
            }`}
          >
            {followingNeighborhood ? t.unfollowNeighborhood : t.followNeighborhood}
          </button>
        )}
      </div>

      <div className="mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.search}
          className="w-full border border-ink/20 rounded-full px-4 py-2 bg-surface focus-ring"
        />
      </div>

      {photos === null && <p className="text-ink/50">…</p>}

      {photos?.length === 0 && <p className="text-ink/50">{t.noPhotos}</p>}

      <div className="grid gap-5">
        {photos
          ?.filter((p) => !search.trim() || p.caption?.toLowerCase().includes(search.trim().toLowerCase()))
          .map((p) => (
            <PhotoCard key={p.id} photo={p} />
          ))}
      </div>
    </div>
  );
}
