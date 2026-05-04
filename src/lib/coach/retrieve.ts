import { prisma } from "@/lib/prisma";
import { COACH_RAG_TOP_K } from "@/lib/coach/constants";
import { cosineSimilarity } from "@/lib/coach/cosine";

export interface RetrievedChunk {
  content: string;
  sourcePath: string;
}

export async function retrieveCoachChunks(queryEmbedding: number[]): Promise<RetrievedChunk[]> {
  const rows = await prisma.coachKnowledgeChunk.findMany({
    select: { content: true, sourcePath: true, embedding: true },
  });

  const scored = rows
    .filter((r) => r.embedding.length > 0)
    .map((r) => ({
      content: r.content,
      sourcePath: r.sourcePath,
      score: cosineSimilarity(queryEmbedding, r.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, COACH_RAG_TOP_K);

  return scored.map(({ content, sourcePath }) => ({ content, sourcePath }));
}
