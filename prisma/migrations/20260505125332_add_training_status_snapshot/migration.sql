-- CreateTable
CREATE TABLE "TrainingStatusSnapshot" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "fatigueScore" DOUBLE PRECISION NOT NULL,
    "fatigueLevel" TEXT NOT NULL,
    "readinessScore" DOUBLE PRECISION NOT NULL,
    "readinessLevel" TEXT NOT NULL,
    "summary" TEXT,
    "factors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingStatusSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingStatusSnapshot_athleteId_date_idx" ON "TrainingStatusSnapshot"("athleteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingStatusSnapshot_athleteId_date_key" ON "TrainingStatusSnapshot"("athleteId", "date");

-- AddForeignKey
ALTER TABLE "TrainingStatusSnapshot" ADD CONSTRAINT "TrainingStatusSnapshot_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
