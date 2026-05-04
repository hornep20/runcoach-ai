import { NextResponse } from "next/server";

import { chunkMarkdown } from "@/lib/coach/chunkMarkdown";
import { embedTexts } from "@/lib/coach/openai";
import { extractTextFromPdf } from "@/lib/coach/pdfText";
import { resolveAthleteIdForRead } from "@/lib/athleteRead";
import { getOpenAIApiKey } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_BYTES = 6 * 1024 * 1024;
const BATCH = 12;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    getOpenAIApiKey();
  } catch {
    return NextResponse.json(
      { error: "Server missing OPENAI_API_KEY" },
      { status: 500 },
    );
  }

  const athleteId = await resolveAthleteIdForRead();
  if (!athleteId) {
    return NextResponse.json(
      { error: "No athlete configured. Set RUNCOACH_DEFAULT_ATHLETE_ID or create an Athlete." },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file field "file"' }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "PDF too large (max 6 MB)" }, { status: 400 });
  }

  const name = file.name || "upload.pdf";
  if (!name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only .pdf files are supported" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  let text: string;
  try {
    text = await extractTextFromPdf(buf);
  } catch {
    return NextResponse.json(
      { error: "Could not read PDF text. Try a text-based PDF or export from your plan app." },
      { status: 400 },
    );
  }

  if (text.trim().length < 40) {
    return NextResponse.json(
      { error: "Very little text extracted from this PDF. Try a different export or copy key weeks into docs/ as markdown." },
      { status: 400 },
    );
  }

  const sourcePath = `upload/${name}`;
  const pieces = chunkMarkdown(text, sourcePath);
  if (pieces.length === 0) {
    return NextResponse.json({ error: "No indexable chunks produced" }, { status: 400 });
  }

  const doc = await prisma.coachUploadedDocument.create({
    data: {
      athleteId,
      originalFilename: name.slice(0, 240),
    },
  });

  try {
    for (let i = 0; i < pieces.length; i += BATCH) {
      const slice = pieces.slice(i, i + BATCH);
      const vectors = await embedTexts(slice.map((p) => p.content));
      await prisma.coachKnowledgeChunk.createMany({
        data: slice.map((p, j) => ({
          content: p.content,
          sourcePath: p.sourcePath,
          embedding: vectors[j] ?? [],
          uploadId: doc.id,
        })),
      });
    }
  } catch (err) {
    await prisma.coachUploadedDocument.delete({ where: { id: doc.id } }).catch(() => {});
    const message = err instanceof Error ? err.message : "Embedding failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    documentId: doc.id,
    chunks: pieces.length,
    filename: doc.originalFilename,
  });
}
