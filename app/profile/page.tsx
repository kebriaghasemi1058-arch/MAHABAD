"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { compressImage } from "@/lib/compressImage";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [showActivity, setShowActivity] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("username, avatar_path, show_activity_status")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setUsername(data.username);
          setAvatarPath(data.avatar_path);
          setShowActivity(data.show_activity_status);
        }
      });
  }, [user]);

  function handleFile(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      let newPath = avatarPath;
      if (file) {
        const compressed = await compressImage(file, 400, 0.85);
        newPath = `${user.id}/avatar.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(newPath, compressed, { contentType: "image/jpeg", upsert: true });
        if (uploadError) throw uploadError;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ username, avatar_path: newPath, show_activity_status: showActivity })
        .eq("id", user.id);
      if (updateError) throw updateError;

      setAvatarPath(newPath);
      setSaved(true);
    } catch (err: any) {
      if (err.message?.toLowerCase().includes("duplicate") || err.message?.includes("unique")) {
        setError(t.usernameTaken);
      } else {
        setError(err.message ?? String(err));
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return null;

  const avatarUrl = preview
    ? preview
    : avatarPath
    ? supabase.storage.from("avatars").getPublicUrl(avatarPath).data.publicUrl
    : null;

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">{t.editProfile}</h1>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-full bg-stone-dark overflow-hidden border border-ink/10">
            {avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <label className="text-sm text-juniper underline cursor-pointer">
            {t.changeAvatar}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t.username}
          required
          className="w-full border border-ink/20 rounded-full px-4 py-2 bg-surface focus-ring"
        />

        <label className="flex items-center gap-2 text-sm text-ink/70 px-2">
          <input
            type="checkbox"
            checked={showActivity}
            onChange={(e) => setShowActivity(e.target.checked)}
            className="focus-ring"
          />
          {t.showActivityStatus}
        </label>

        {error && <p className="text-brick text-sm">{error}</p>}
        {saved && <p className="text-juniper text-sm">✓</p>}

        <button
          disabled={busy}
          className="w-full bg-juniper text-oncolor rounded-full px-4 py-2 font-medium focus-ring"
        >
          {t.saveChanges}
        </button>
      </form>
    </div>
  );
}
