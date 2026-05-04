-- AlterTable
ALTER TABLE "ExternalActivity" ADD COLUMN     "detailFetchedAt" TIMESTAMP(3),
ADD COLUMN     "detailPayload" JSONB;

-- CreateIndex
CREATE INDEX "ExternalActivity_athleteId_detailFetchedAt_idx" ON "ExternalActivity"("athleteId", "detailFetchedAt");
