"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

export default function ContactPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !text.trim()) return;
    setSending(true);
    await supabase.from("admin_messages").insert({ user_id: user.id, text: text.trim() });
    setSending(false);
    setSent(true);
    setText("");
  }

  if (loading || !user) return null;

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-1">{t.contactAdmin}</h1>
      <p className="text-sm text-ink/60 mb-4">{t.contactAdminIntro}</p>
      <form onSubmit={submit} className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.yourMessage}
          required
          rows={5}
          className="w-full border border-ink/20 rounded-2xl px-4 py-2 bg-surface focus-ring"
        />
        {sent && <p className="text-juniper text-sm">✓ {t.sent}</p>}
        <button
          disabled={sending}
          className="w-full bg-brick text-oncolor rounded-full px-4 py-2 font-medium focus-ring"
        >
          {t.sendMessage}
        </button>
      </form>
    </div>
  );
}
