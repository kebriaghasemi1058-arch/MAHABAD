"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import SunBadge from "@/components/SunBadge";
import FloatingShapes from "@/components/FloatingShapes";

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
    else router.push("/");
  }

  return (
    <div className="relative max-w-sm mx-auto py-6">
      <FloatingShapes />
      <div className="relative bg-surface/80 backdrop-blur-sm rounded-3xl border border-ink/10 card-shadow p-6 animate-card-slow">
        <SunBadge />
        <h1 className="text-xl font-bold mb-4 text-center">{t.login}</h1>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            placeholder={t.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-ink/20 rounded-full px-4 py-2 bg-surface focus-ring"
          />
          <input
            type="password"
            required
            placeholder={t.password}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-ink/20 rounded-full px-4 py-2 bg-surface focus-ring"
          />
          {error && <p className="text-brick text-sm">{error}</p>}
          <button
            disabled={busy}
            className="w-full bg-juniper text-oncolor rounded-full px-4 py-2 font-medium focus-ring"
          >
            {t.login}
          </button>
        </form>
        <Link href="/signup" className="block text-sm text-center mt-4 text-juniper underline link-underline">
          {t.needAccount}
        </Link>
      </div>
    </div>
  );
}
