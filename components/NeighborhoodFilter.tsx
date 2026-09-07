"use client";

import { useI18n } from "@/lib/i18n";

export type Neighborhood = { id: number; name_fa: string; name_ckb: string };

export default function NeighborhoodFilter({
  neighborhoods,
  value,
  onChange,
}: {
  neighborhoods: Neighborhood[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const { t, lang } = useI18n();

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="border border-ink/20 rounded-full px-4 py-2 bg-surface text-sm focus-ring"
    >
      <option value="">{t.allNeighborhoods}</option>
      {neighborhoods.map((n) => (
        <option key={n.id} value={n.id}>
          {lang === "fa" ? n.name_fa : n.name_ckb}
        </option>
      ))}
    </select>
  );
}
