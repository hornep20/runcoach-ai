-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN     "defaultBaseWeeks" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "defaultDistanceUnit" TEXT NOT NULL DEFAULT 'mi';
