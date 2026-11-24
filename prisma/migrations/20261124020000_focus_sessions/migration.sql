ALTER TABLE "Subject" ADD COLUMN "archivedAt" TIMESTAMPTZ(3);
ALTER TABLE "StudySession" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'FOCUS', ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'CUSTOM';
CREATE UNIQUE INDEX "StudySession_one_active_per_user" ON "StudySession" ("userId") WHERE "status" IN ('ACTIVE', 'PAUSED');
