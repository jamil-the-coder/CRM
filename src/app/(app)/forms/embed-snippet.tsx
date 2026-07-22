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
      <p className="text-xs font-medium text-zinc-500">Embed snippet</p>
      <pre className="overflow-x-auto rounded-md bg-zinc-100 p-2 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        {snippet}
      </pre>
    </div>
  );
}
