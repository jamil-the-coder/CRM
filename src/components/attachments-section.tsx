"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Attachment = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsSection({
  entityType,
  entityId,
  attachments,
}: {
  entityType: "contact" | "account" | "lead" | "opportunity";
  entityId: string;
  attachments: Attachment[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("entityType", entityType);
    formData.append("entityId", entityId);

    const response = await fetch("/api/attachments", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Couldn't upload that file.");
      setUploading(false);
      return;
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/attachments/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <p className="text-sm font-medium text-foreground">
          Attachments
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            disabled={uploading}
            className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
          />
          {uploading && <span className="text-xs text-muted-foreground">Uploading…</span>}
        </div>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files attached yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {attachments.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between py-2"
              >
                <a
                  href={`/api/attachments/${file.id}/download`}
                  className="text-sm text-foreground hover:text-primary transition-colors"
                >
                  {file.fileName}
                </a>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatSize(file.sizeBytes)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(file.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
