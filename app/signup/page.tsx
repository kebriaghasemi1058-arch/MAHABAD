"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import SunBadge from "@/components/SunBadge";
import FloatingShapes from "@/components/FloatingShapes";

export default function SignupPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, phone, full_name: fullName, birthdate } },
    });
    setBusy(false);
    if (error) {
      if (error.message.toLowerCase().includes("duplicate") || error.message.includes("unique")) {
        setError(t.usernameTaken);
      } else {
        setError(error.message);
      }
    } else setDone(true);
  }

  if (done) {
    return (
      <div className="relative max-w-sm mx-auto py-6">
        <FloatingShapes />
        <div className="relative bg-surface/80 backdrop-blur-sm rounded-3xl border border-ink/10 card-shadow p-6 text-center animate-card-slow">
          <SunBadge />
          <p className="text-ink">ایمیلتان را برای تایید حساب بررسی کنید.</p>
          <button onClick={() => router.push("/login")} className="mt-4 text-juniper underline link-underline">
            {t.alreadyHaveAccount}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative max-w-sm mx-auto py-6">
      <FloatingShapes />
      <div className="relative bg-surface/80 backdrop-blur-sm rounded-3xl border border-ink/10 card-shadow p-6 animate-card-slow">
        <SunBadge />
        <h1 className="text-xl font-bold mb-4 text-center">{t.createAccount}</h1>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="text"
            required
            placeholder={t.fullName}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border border-ink/20 rounded-full px-4 py-2 bg-surface focus-ring"
          />
          <input
            type="text"
            required
            placeholder={t.username}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border border-ink/20 rounded-full px-4 py-2 bg-surface focus-ring"
          />
          <label className="block">
            <span className="text-xs text-ink/50 px-2">{t.birthdate}</span>
            <input
              type="date"
              required
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              className="w-full border border-ink/20 rounded-full px-4 py-2 bg-surface focus-ring"
            />
          </label>
          <input
            type="tel"
            required
            placeholder={t.phone}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-ink/20 rounded-full px-4 py-2 bg-surface focus-ring"
          />
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
            minLength={6}
            placeholder={t.password}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-ink/20 rounded-full px-4 py-2 bg-surface focus-ring"
          />
          {error && <p className="text-brick text-sm">{error}</p>}
          <button
            disabled={busy}
            className="w-full bg-brick text-oncolor rounded-full px-4 py-2 font-medium focus-ring"
          >
            {t.signup}
          </button>
        </form>
        <Link href="/login" className="block text-sm text-center mt-4 text-juniper underline link-underline">
          {t.alreadyHaveAccount}
        </Link>
      </div>
    </div>
  );
}
