"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { usePresence } from "@/lib/presence-context";
import { useI18n } from "@/lib/i18n";
import PhotoCard, { PhotoWithData } from "@/components/PhotoCard";

type Profile = {
  id: string;
  username: string;
  avatar_path: string | null;
  is_admin: boolean;
  last_seen_at: string | null;
  show_activity_status: boolean;
  banned_until: string | null;
};
type SimpleUser = { username: string; avatar_path: string | null };

export default function UserProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const { user, isAdmin: viewerIsAdmin } = useAuth();
  const { onlineUsernames } = usePresence();
  const { t, lang } = useI18n();

  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [tab, setTab] = useState<"posts" | "followers" | "following">("posts");
  const [posts, setPosts] = useState<PhotoWithData[]>([]);
  const [followers, setFollowers] = useState<SimpleUser[]>([]);
  const [following, setFollowing] = useState<SimpleUser[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showBanMenu, setShowBanMenu] = useState(false);
  const [customBanUntil, setCustomBanUntil] = useState("");

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, username, avatar_path, is_admin, last_seen_at, show_activity_status, banned_until")
      .eq("username", username)
      .single()
      .then(({ data }) => setProfile(data ?? null));
  }, [username]);

  useEffect(() => {
    if (!profile) return;

    supabase
      .from("photos")
      .select(
        `id, image_path, caption, media_type, post_type, pinned, user_id,
         neighborhoods ( name_fa, name_ckb ),
         likes ( user_id ),
         bookmarks ( user_id ),
         comments ( id, text, created_at, user_id, profiles ( username, avatar_path ) )`
      )
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const mapped = (data ?? []).map((p: any) => ({
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
        setPosts(mapped);
      });

    supabase
      .from("follows")
      .select("follower:follower_id ( username, avatar_path )")
      .eq("following_id", profile.id)
      .then(({ data }) => setFollowers(((data as any) ?? []).map((r: any) => r.follower)));

    supabase
      .from("follows")
      .select("followee:following_id ( username, avatar_path )")
      .eq("follower_id", profile.id)
      .then(({ data }) => setFollowing(((data as any) ?? []).map((r: any) => r.followee)));

    if (user) {
      supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("following_id", profile.id)
        .maybeSingle()
        .then(({ data }) => setIsFollowing(!!data));
      supabase
        .from("blocks")
        .select("blocker_id")
        .eq("blocker_id", user.id)
        .eq("blocked_id", profile.id)
        .maybeSingle()
        .then(({ data }) => setIsBlocked(!!data));
      supabase
        .from("mutes")
        .select("muter_id")
        .eq("muter_id", user.id)
        .eq("muted_id", profile.id)
        .maybeSingle()
        .then(({ data }) => setIsMuted(!!data));
    }
  }, [profile, user, lang]);

  async function toggleFollow() {
    if (!user || !profile) {
      alert(t.loginRequired);
      return;
    }
    if (isFollowing) {
      setIsFollowing(false);
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", profile.id);
    } else {
      setIsFollowing(true);
      await supabase.from("follows").insert({ follower_id: user.id, following_id: profile.id });
    }
  }

  async function toggleBlock() {
    if (!user || !profile) return;
    if (isBlocked) {
      setIsBlocked(false);
      await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", profile.id);
    } else {
      setIsBlocked(true);
      await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: profile.id });
    }
  }

  async function toggleMute() {
    if (!user || !profile) return;
    if (isMuted) {
      setIsMuted(false);
      await supabase.from("mutes").delete().eq("muter_id", user.id).eq("muted_id", profile.id);
    } else {
      setIsMuted(true);
      await supabase.from("mutes").insert({ muter_id: user.id, muted_id: profile.id });
    }
  }

  async function applyBan(hours: number | "permanent") {
    if (!profile) return;
    const until = hours === "permanent" ? new Date("9999-12-31").toISOString() : new Date(Date.now() + hours * 3600 * 1000).toISOString();
    await supabase.rpc("set_user_ban", { target_user: profile.id, ban_until: until });
    setProfile({ ...profile, banned_until: until });
    setShowBanMenu(false);
  }

  async function applyCustomBan() {
    if (!profile || !customBanUntil) return;
    const until = new Date(customBanUntil).toISOString();
    await supabase.rpc("set_user_ban", { target_user: profile.id, ban_until: until });
    setProfile({ ...profile, banned_until: until });
    setShowBanMenu(false);
  }

  async function unban() {
    if (!profile) return;
    await supabase.rpc("set_user_ban", { target_user: profile.id, ban_until: null });
    setProfile({ ...profile, banned_until: null });
  }

  if (profile === undefined) return null;
  if (profile === null) return <p className="text-center text-ink/50">404</p>;

  const avatarUrl = profile.avatar_path
    ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_path).data.publicUrl
    : null;
  const isOwnProfile = user?.id === profile.id;
  const isOnline = onlineUsernames.includes(profile.username);

  return (
    <div className="max-w-md mx-auto">
      <div className="flex flex-col items-center gap-2 mb-4">
        <div className="w-24 h-24 rounded-full bg-stone-dark overflow-hidden border border-ink/10">
          {avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <h1 className="text-lg font-bold text-ink">{profile.username}</h1>

        {(profile.show_activity_status || viewerIsAdmin) && (
          <p className="text-xs">
            {isOnline ? (
              <span className="text-juniper font-semibold">● {t.online}</span>
            ) : profile.last_seen_at ? (
              <span className="text-ink/40">
                {t.lastSeen}: {new Date(profile.last_seen_at).toLocaleString("fa-IR")}
              </span>
            ) : null}
          </p>
        )}

        <div className="flex gap-4 text-sm text-ink/60">
          <span>{posts.length} {t.posts}</span>
          <span>{followers.length} {t.followers}</span>
          <span>{following.length} {t.following}</span>
        </div>

        {!isOwnProfile && user && (
          <div className="flex gap-2 mt-2 flex-wrap justify-center">
            <Link
              href={`/messages/${profile.username}`}
              className="text-xs px-3 py-1.5 rounded-full bg-brick text-oncolor focus-ring"
            >
              {t.message}
            </Link>
            <button
              onClick={toggleFollow}
              className={`text-xs px-3 py-1.5 rounded-full border focus-ring ${
                isFollowing ? "bg-juniper text-oncolor border-juniper" : "border-ink/20 text-ink"
              }`}
            >
              {isFollowing ? t.unfollow : t.follow}
            </button>
            {!profile.is_admin && (
              <button
                onClick={toggleBlock}
                className={`text-xs px-3 py-1.5 rounded-full border focus-ring ${
                  isBlocked ? "bg-brick text-oncolor border-brick" : "border-ink/20 text-ink"
                }`}
              >
                {isBlocked ? t.unblock : t.block}
              </button>
            )}
            <button
              onClick={toggleMute}
              className={`text-xs px-3 py-1.5 rounded-full border focus-ring ${
                isMuted ? "bg-ink/70 text-oncolor border-ink/70" : "border-ink/20 text-ink"
              }`}
            >
              {isMuted ? t.unmute : t.mute}
            </button>

            {viewerIsAdmin && !profile.is_admin && (
              <>
                {profile.banned_until && new Date(profile.banned_until) > new Date() ? (
                  <button onClick={unban} className="text-xs px-3 py-1.5 rounded-full bg-juniper text-oncolor focus-ring">
                    {t.unban}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowBanMenu((s) => !s)}
                    className="text-xs px-3 py-1.5 rounded-full bg-brick/80 text-oncolor focus-ring"
                  >
                    {t.banUser}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {viewerIsAdmin && showBanMenu && (
          <div className="bg-surface border border-ink/10 rounded-xl p-3 mt-2 w-full max-w-xs">
            <p className="text-xs text-ink/60 mb-2">{t.banDuration}</p>
            <div className="flex gap-2 flex-wrap mb-2">
              <button onClick={() => applyBan(1)} className="text-xs px-2 py-1 rounded-full border border-ink/20 focus-ring">
                {t.ban1h}
              </button>
              <button onClick={() => applyBan(24)} className="text-xs px-2 py-1 rounded-full border border-ink/20 focus-ring">
                {t.ban24h}
              </button>
              <button onClick={() => applyBan(72)} className="text-xs px-2 py-1 rounded-full border border-ink/20 focus-ring">
                {t.ban3d}
              </button>
              <button onClick={() => applyBan(24 * 7)} className="text-xs px-2 py-1 rounded-full border border-ink/20 focus-ring">
                {t.ban7d}
              </button>
              <button onClick={() => applyBan(24 * 30)} className="text-xs px-2 py-1 rounded-full border border-ink/20 focus-ring">
                {t.ban30d}
              </button>
              <button onClick={() => applyBan("permanent")} className="text-xs px-2 py-1 rounded-full bg-brick text-oncolor focus-ring">
                {t.banPermanent}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={customBanUntil}
                onChange={(e) => setCustomBanUntil(e.target.value)}
                className="flex-1 border border-ink/20 rounded-full px-3 py-1 text-xs bg-surface focus-ring"
              />
              <button onClick={applyCustomBan} className="text-xs px-3 py-1 rounded-full bg-juniper text-oncolor focus-ring">
                {t.applyBan}
              </button>
            </div>
          </div>
        )}

        {isOwnProfile && (
          <Link href="/profile" className="text-xs px-3 py-1.5 rounded-full border border-ink/20 text-ink focus-ring mt-2">
            {t.editProfile}
          </Link>
        )}
      </div>

      <div className="flex gap-2 mb-4 justify-center">
        {(["posts", "followers", "following"] as const).map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`text-xs px-3 py-1.5 rounded-full border focus-ring ${
              tab === tb ? "bg-saffron text-oncolor border-saffron" : "border-ink/20 text-ink"
            }`}
          >
            {tb === "posts" ? t.posts : tb === "followers" ? t.followers : t.following}
          </button>
        ))}
      </div>

      {tab === "posts" && (
        <div className="grid gap-5">
          {posts.map((p) => (
            <PhotoCard key={p.id} photo={p} />
          ))}
        </div>
      )}
      {tab === "followers" && <UserList list={followers} />}
      {tab === "following" && <UserList list={following} />}
    </div>
  );
}

function UserList({ list }: { list: SimpleUser[] }) {
  return (
    <div className="space-y-1">
      {list.map((u) => (
        <Link
          key={u.username}
          href={`/u/${u.username}`}
          className="flex items-center gap-2 bg-surface rounded-xl border border-ink/10 p-2 hover:bg-stone-dark focus-ring"
        >
          <div className="w-7 h-7 rounded-full bg-stone-dark overflow-hidden flex-shrink-0">
            {u.avatar_path && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={supabase.storage.from("avatars").getPublicUrl(u.avatar_path).data.publicUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <span className="text-sm">{u.username}</span>
        </Link>
      ))}
    </div>
  );
}
