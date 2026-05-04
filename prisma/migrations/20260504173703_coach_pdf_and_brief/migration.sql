-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN     "coachingBrief" TEXT;

-- AlterTable
ALTER TABLE "CoachKnowledgeChunk" ADD COLUMN     "uploadId" TEXT;

-- CreateTable
CREATE TABLE "CoachUploadedDocument" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachUploadedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachUploadedDocument_athleteId_idx" ON "CoachUploadedDocument"("athleteId");

-- CreateIndex
CREATE INDEX "CoachKnowledgeChunk_uploadId_idx" ON "CoachKnowledgeChunk"("uploadId");

-- AddForeignKey
ALTER TABLE "CoachUploadedDocument" ADD CONSTRAINT "CoachUploadedDocument_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachKnowledgeChunk" ADD CONSTRAINT "CoachKnowledgeChunk_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "CoachUploadedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
