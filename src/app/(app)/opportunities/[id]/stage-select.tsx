"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { stageBadgeVariant } from "@/lib/status-badge";

const selectClassName =
  "h-8 rounded-md border border-border bg-transparent px-2 text-sm shadow-xs dark:bg-input/30";

export function StageSelect({
  opportunityId,
  stage,
  stages,
}: {
  opportunityId: string;
  stage: string;
  stages: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleChange(newStage: string) {
    setSaving(true);
    await fetch(`/api/opportunities/${opportunityId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant={stageBadgeVariant(stage)}>{stage}</Badge>
      <select
        aria-label="Change stage"
        className={selectClassName}
        value={stage}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
      >
        {stages.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
