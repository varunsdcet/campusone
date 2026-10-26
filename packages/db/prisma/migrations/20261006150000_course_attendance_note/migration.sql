-- My Courses → Course Attendance: per-student note on each attendance row
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "note" TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS "AttendanceRecord_sectionId_meetingLabel_idx" ON "AttendanceRecord"("sectionId", "meetingLabel");
