-- CreateTable
CREATE TABLE "CoachConversation" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachConversation_athleteId_updatedAt_idx" ON "CoachConversation"("athleteId", "updatedAt");

-- CreateIndex
CREATE INDEX "CoachMessage_conversationId_createdAt_idx" ON "CoachMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "CoachConversation" ADD CONSTRAINT "CoachConversation_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachMessage" ADD CONSTRAINT "CoachMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CoachConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
