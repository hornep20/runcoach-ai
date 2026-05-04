-- CreateTable
CREATE TABLE "ExternalActivity" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "sportType" TEXT,
    "durationSeconds" INTEGER,
    "distanceM" DOUBLE PRECISION,
    "elevationGainM" DOUBLE PRECISION,
    "avgHr" INTEGER,
    "maxHr" INTEGER,
    "avgSpeed" DOUBLE PRECISION,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalActivity_athleteId_startTime_idx" ON "ExternalActivity"("athleteId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalActivity_athleteId_provider_externalId_key" ON "ExternalActivity"("athleteId", "provider", "externalId");

-- AddForeignKey
ALTER TABLE "ExternalActivity" ADD CONSTRAINT "ExternalActivity_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
