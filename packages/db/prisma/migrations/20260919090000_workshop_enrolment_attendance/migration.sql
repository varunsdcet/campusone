ALTER TABLE "WorkshopRegistration" ALTER COLUMN "status" SET DEFAULT 'pending';
ALTER TABLE "WorkshopRegistration" ADD COLUMN IF NOT EXISTS "note" TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS "WorkshopAttendance" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attendedOn" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'present',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "WorkshopAttendance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkshopAttendance_workshopId_studentId_attendedOn_key" ON "WorkshopAttendance"("workshopId", "studentId", "attendedOn");
CREATE INDEX IF NOT EXISTS "WorkshopAttendance_institutionId_attendedOn_idx" ON "WorkshopAttendance"("institutionId", "attendedOn");
DO $$ BEGIN ALTER TABLE "WorkshopAttendance" ADD CONSTRAINT "WorkshopAttendance_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "WorkshopAttendance" ADD CONSTRAINT "WorkshopAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
