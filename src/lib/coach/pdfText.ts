import { PDFParse } from "pdf-parse";

const MAX_EXTRACT_CHARS = 400_000;

/** Extract plain text from a PDF buffer (server-only). */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    const raw = textResult.text.replace(/\r\n/g, "\n").trim();
    if (raw.length <= MAX_EXTRACT_CHARS) {
      return raw;
    }
    return `${raw.slice(0, MAX_EXTRACT_CHARS)}\n\n[…truncated for indexing]`;
  } finally {
    await parser.destroy();
  }
}
