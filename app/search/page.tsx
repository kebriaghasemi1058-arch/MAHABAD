"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

type Result = { username: string; avatar_path: string | null };

export default function SearchPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    const handle = setTimeout(() => {
      supabase
        .from("profiles")
        .select("username, avatar_path")
        .ilike("username", `%${query.trim()}%`)
        .limit(20)
        .then(({ data }) => {
          setResults(data ?? []);
          setSearched(true);
        });
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">{t.searchLabel}</h1>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.searchUsers}
        className="w-full border border-ink/20 rounded-full px-4 py-2 bg-surface focus-ring mb-4"
      />

      {searched && results.length === 0 && <p className="text-ink/50 text-sm">{t.noResults}</p>}

      <div className="space-y-1">
        {results.map((r) => (
          <Link
            key={r.username}
            href={`/u/${r.username}`}
            className="flex items-center gap-3 bg-surface rounded-xl border border-ink/10 p-3 hover:bg-stone-dark focus-ring"
          >
            <div className="w-9 h-9 rounded-full bg-stone-dark overflow-hidden flex-shrink-0">
              {r.avatar_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={supabase.storage.from("avatars").getPublicUrl(r.avatar_path).data.publicUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <span className="text-sm">{r.username}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
