export function EmbedSnippet({
  embedKey,
  origin,
}: {
  embedKey: string;
  origin: string;
}) {
  const embedUrl = `${origin}/embed/${embedKey}`;
  const snippet = `<iframe src="${embedUrl}" width="100%" height="480" style="border:0"></iframe>`;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">Embed snippet</p>
      <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs text-foreground">
        {snippet}
      </pre>
    </div>
  );
}
