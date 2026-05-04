const MAX_CHARS = 2800;

/**
 * Split markdown into overlapping-ish paragraphs, merged up to MAX_CHARS per chunk.
 */
export function chunkMarkdown(text: string, sourcePath: string): { content: string; sourcePath: string }[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: { content: string; sourcePath: string }[] = [];
  let buf = "";

  function flush() {
    const t = buf.trim();
    if (t.length > 0) {
      chunks.push({ content: t, sourcePath });
    }
    buf = "";
  }

  for (const p of paragraphs) {
    const next = buf.length === 0 ? p : `${buf}\n\n${p}`;
    if (next.length > MAX_CHARS && buf.length > 0) {
      flush();
      buf = p.length > MAX_CHARS ? p.slice(0, MAX_CHARS) : p;
      continue;
    }
    if (next.length > MAX_CHARS) {
      for (let i = 0; i < p.length; i += MAX_CHARS) {
        chunks.push({ content: p.slice(i, i + MAX_CHARS), sourcePath });
      }
      buf = "";
      continue;
    }
    buf = next;
  }
  flush();
  return chunks;
}
