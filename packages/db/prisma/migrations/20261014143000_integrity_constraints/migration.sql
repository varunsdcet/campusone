-- Remove duplicate attendance rows deterministically before enforcing one mark per student/meeting.
DELETE FROM "AttendanceRecord" newer
USING "AttendanceRecord" older
WHERE newer."institutionId" = older."institutionId"
  AND newer."studentId" = older."studentId"
  AND newer."sectionId" = older."sectionId"
  AND newer."meetingLabel" = older."meetingLabel"
  AND (newer."updatedAt", newer.id) < (older."updatedAt", older.id);

CREATE UNIQUE INDEX "AttendanceRecord_institutionId_studentId_sectionId_meetingLabel_key"
  ON "AttendanceRecord"("institutionId", "studentId", "sectionId", "meetingLabel");

-- Preserve every existing section while making legacy duplicate codes safe for the
-- institution/term uniqueness rule. Section relationships use the immutable id, so
-- only the later duplicate's display code needs a deterministic suffix.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY "institutionId", "termId", code
           ORDER BY "createdAt", id
         ) AS duplicate_rank
  FROM "Section"
)
UPDATE "Section" section
SET code = section.code || '-' || right(replace(section.id, '-', ''), 8)
FROM ranked
WHERE ranked.id = section.id
  AND ranked.duplicate_rank > 1;

-- Section codes are unique inside a term and institution. Code generation uses
-- the same scope so future courses cannot recreate a collision.
CREATE UNIQUE INDEX "Section_institutionId_termId_code_key"
  ON "Section"("institutionId", "termId", "code");

-- PostgreSQL partial uniqueness prevents two active plans while retaining plan history.
CREATE UNIQUE INDEX "ProgramPlan_one_active_per_student_key"
  ON "ProgramPlan"("institutionId", "studentId") WHERE "status" = 'active';
CREATE INDEX "ProgramPlan_institutionId_studentId_status_idx"
  ON "ProgramPlan"("institutionId", "studentId", "status");

-- Employer deletion must never cascade through placements into hours/evaluations.
ALTER TABLE "Placement" DROP CONSTRAINT IF EXISTS "Placement_employerOrgId_fkey";
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_employerOrgId_fkey"
  FOREIGN KEY ("employerOrgId") REFERENCES "EmployerOrg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
