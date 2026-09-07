"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { compressImage } from "@/lib/compressImage";
import { Neighborhood } from "@/components/NeighborhoodFilter";

const MAX_VIDEO_BYTES_USER = 30 * 1024 * 1024;
const MAX_VIDEO_BYTES_ADMIN = 500 * 1024 * 1024;

export default function UploadPage() {
  const { user, isAdmin, loading } = useAuth();
  const { t, lang } = useI18n();
  const router = useRouter();

  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [neighborhoodId, setNeighborhoodId] = useState<number | "">("");
  const [postType, setPostType] = useState<"beauty" | "issue">("beauty");
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const maxVideoBytes = isAdmin ? MAX_VIDEO_BYTES_ADMIN : MAX_VIDEO_BYTES_USER;

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    supabase
      .from("neighborhoods")
      .select("id, name_fa, name_ckb")
      .order("id")
      .then(({ data }) => setNeighborhoods(data ?? []));
  }, []);

  function handleFiles(list: FileList | null) {
    setError(null);
    if (!list) return setFiles([]);
    const picked = Array.from(list);
    const tooBig = picked.find((f) => f.type.startsWith("video/") && f.size > maxVideoBytes);
    if (tooBig) {
      setError(t.videoTooBig);
      setFiles([]);
      return;
    }
    setFiles(picked);
  }

  async function uploadOne(file: File) {
    const isVideo = file.type.startsWith("video/");
    let path: string;

    if (isVideo) {
      // Videos aren't compressed client-side — the bucket's file size
      // limit (see supabase/schema.sql) plus the check in handleFiles()
      // are what keep this from filling up storage.
      const ext = file.name.split(".").pop() || "mp4";
      path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(path, file, { contentType: file.type || "video/mp4" });
      if (uploadError) throw uploadError;
    } else {
      // Resize/re-encode in the browser first — a raw phone photo can be
      // 10-20MB; this keeps uploads fast and storage costs sane.
      const compressed = await compressImage(file);
      path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(path, compressed, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
    }

    // Direct browser -> Storage upload, authenticated as the current user.
    // Storage RLS policies (see supabase/schema.sql) only allow writes
    // under this user's own folder, so no server relay is needed.
    const { error: insertError } = await supabase.from("photos").insert({
      user_id: user!.id,
      neighborhood_id: neighborhoodId || null,
      image_path: path,
      caption: caption || null,
      language: lang,
      media_type: isVideo ? "video" : "image",
      post_type: postType,
    });
    if (insertError) throw insertError;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || files.length === 0) return;
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: files.length });

    try {
      // Uploaded one at a time (not Promise.all) so progress is meaningful
      // and we don't fire off dozens of parallel uploads on a slow connection.
      for (const file of files) {
        await uploadOne(file);
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
      router.push("/");
    } catch (err: any) {
      const msg = err.message ?? String(err);
      setError(msg.includes("post_limit_reached") ? t.postLimitReached : msg);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">{t.upload}</h1>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-ink/70">{t.chooseMedia}</span>
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            required
            onChange={(e) => handleFiles(e.target.files)}
            className="block w-full mt-1 text-sm"
          />
          <span className="text-xs text-ink/50">{t.chooseMultiple}</span>
        </label>

        {files.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {files.map((f, i) => {
              const url = URL.createObjectURL(f);
              return f.type.startsWith("video/") ? (
                <video key={i} src={url} className="w-full aspect-square object-cover rounded-lg" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-lg" />
              );
            })}
          </div>
        )}

        <div className="flex gap-2">
          {(["beauty", "issue"] as const).map((pt) => (
            <button
              key={pt}
              type="button"
              onClick={() => setPostType(pt)}
              className={`flex-1 text-sm px-4 py-2 rounded-full border focus-ring ${
                postType === pt
                  ? pt === "issue"
                    ? "bg-brick text-oncolor border-brick"
                    : "bg-juniper text-oncolor border-juniper"
                  : "border-ink/20 text-ink"
              }`}
            >
              {pt === "issue" ? t.issues : t.beauties}
            </button>
          ))}
        </div>

        <select
          value={neighborhoodId}
          onChange={(e) => setNeighborhoodId(e.target.value ? Number(e.target.value) : "")}
          className="w-full border border-ink/20 rounded-full px-4 py-2 bg-surface focus-ring"
        >
          <option value="">{t.selectNeighborhood}</option>
          {neighborhoods.map((n) => (
            <option key={n.id} value={n.id}>
              {lang === "fa" ? n.name_fa : n.name_ckb}
            </option>
          ))}
        </select>

        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={t.caption}
          className="w-full border border-ink/20 rounded-full px-4 py-2 bg-surface focus-ring"
        />

        {error && <p className="text-brick text-sm">{error}</p>}

        <button
          disabled={busy}
          className="w-full bg-brick text-oncolor rounded-full px-4 py-2 font-medium focus-ring"
        >
          {busy ? t.uploadingCount.replace("{n}", String(progress.done + 1)).replace("{total}", String(progress.total)) : t.submit}
        </button>
      </form>
    </div>
  );
}
