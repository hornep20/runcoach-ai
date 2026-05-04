/**
 * Chunk markdown under `docs/`, embed with OpenAI, and store rows in `CoachKnowledgeChunk`.
 * Requires `OPENAI_API_KEY` and `DATABASE_URL`. Run after `npx prisma migrate dev`.
 *
 *   npx tsx scripts/seed-coach-knowledge.ts
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chunkMarkdown } from "../src/lib/coach/chunkMarkdown";
import { embedTexts } from "../src/lib/coach/openai";
import { prisma } from "../src/lib/prisma";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const BATCH = 16;

async function main(): Promise<void> {
  const docsDir = join(root, "docs");
  const names = readdirSync(docsDir).filter((n) => n.endsWith(".md"));
  if (names.length === 0) {
    console.error("No .md files in docs/");
    process.exit(1);
  }

  const pieces: { content: string; sourcePath: string }[] = [];
  for (const name of names) {
    const sourcePath = `docs/${name}`;
    const raw = readFileSync(join(docsDir, name), "utf8");
    pieces.push(...chunkMarkdown(raw, sourcePath));
  }

  if (pieces.length === 0) {
    console.error("No chunks produced");
    process.exit(1);
  }

  console.log(`Embedding ${pieces.length} chunks from ${names.length} file(s)…`);

  await prisma.coachKnowledgeChunk.deleteMany();

  for (let i = 0; i < pieces.length; i += BATCH) {
    const slice = pieces.slice(i, i + BATCH);
    const vectors = await embedTexts(slice.map((p) => p.content));
    await prisma.coachKnowledgeChunk.createMany({
      data: slice.map((p, j) => ({
        content: p.content,
        sourcePath: p.sourcePath,
        embedding: vectors[j] ?? [],
      })),
    });
    console.log(`  inserted ${Math.min(i + BATCH, pieces.length)} / ${pieces.length}`);
  }

  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
