import { z } from "zod";
import { BaseEntity, Uuid } from "./base.js";

export const RoleName = z.enum([
  "applicant",
  "student",
  "instructor",
  "admin",
  "employer",
  "registrar",
]);

export const Institution = BaseEntity.extend({
  name: z.string().min(1),
  legalName: z.string().min(1),
  timezone: z.string().default("America/Vancouver"),
  currency: z.literal("CAD"),
  addressLine1: z.string(),
  city: z.string(),
  region: z.string(),
  postalCode: z.string(),
  country: z.string(),
});

export const Person = BaseEntity.extend({
  givenName: z.string(),
  familyName: z.string(),
  email: z.string().email(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const Account = BaseEntity.extend({
  personId: Uuid,
  email: z.string().email(),
  status: z.enum(["active", "locked", "disabled"]),
  mfaEnabled: z.boolean(),
});

export const Session = BaseEntity.extend({
  accountId: Uuid,
  deviceFingerprint: z.string(),
  ipAddress: z.string(),
  userAgent: z.string(),
  geoLocation: z.string().nullable(),
  expiresAt: z.string(),
});

export const Role = BaseEntity.extend({
  name: RoleName,
  description: z.string(),
});

export const Permission = BaseEntity.extend({
  key: z.string(),
  description: z.string(),
});

export const Student = BaseEntity.extend({
  personId: Uuid,
  studentNumber: z.string(),
  programName: z.string(),
  standing: z.enum(["good", "warning", "probation", "alert"]),
});

export const Term = BaseEntity.extend({
  code: z.string(),
  name: z.string(),
  startsOn: z.string(),
  endsOn: z.string(),
});

export const Course = BaseEntity.extend({
  code: z.string(),
  title: z.string(),
  credits: z.number(),
});

export const Section = BaseEntity.extend({
  courseId: Uuid,
  termId: Uuid,
  code: z.string(),
  instructorPersonId: Uuid,
});

export const Enrolment = BaseEntity.extend({
  sectionId: Uuid,
  studentId: Uuid,
  status: z.enum(["enrolled", "withdrawn", "completed"]),
});

export const Assignment = BaseEntity.extend({
  sectionId: Uuid,
  title: z.string(),
  maxScore: z.number(),
  weightPercent: z.number(),
  dueAt: z.string().nullable(),
});

export const Submission = BaseEntity.extend({
  assignmentId: Uuid,
  studentId: Uuid,
  submittedAt: z.string().nullable(),
  status: z.enum(["draft", "submitted", "returned"]),
});

export const GradeStatus = z.enum(["draft", "pending_publish", "published", "under_review"]);

export const GradeItem = BaseEntity.extend({
  assignmentId: Uuid,
  studentId: Uuid,
  enrolmentId: Uuid,
  score: z.number().nullable(),
  maxScore: z.number(),
  letter: z.string().nullable(),
  status: GradeStatus,
  publishedAt: z.string().nullable(),
});

export const ApprovalStatus = z.enum([
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "applied",
]);

export const ApprovalRequest = BaseEntity.extend({
  type: z.string(),
  subjectRef: z.string(),
  proposedDiff: z.unknown(),
  requestedBy: Uuid,
  requiredApproverRoles: z.array(RoleName),
  requiredCount: z.number().int().positive(),
  status: ApprovalStatus,
  decisions: z.array(
    z.object({
      actorId: Uuid,
      decision: z.enum(["approve", "reject"]),
      comment: z.string().optional(),
      decidedAt: z.string(),
    }),
  ),
});

export const AuditEvent = BaseEntity.extend({
  actorId: Uuid,
  eventName: z.string(),
  purpose: z.string(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  source: z.string(),
  correlationId: z.string(),
  version: z.number().int(),
});

export const Notification = BaseEntity.extend({
  recipientAccountId: Uuid,
  channel: z.enum(["in_app", "email", "push"]),
  title: z.string(),
  body: z.string(),
  readAt: z.string().nullable(),
  templateKey: z.string().nullable(),
});

export const FileObject = BaseEntity.extend({
  path: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  classification: z.enum(["public", "internal", "confidential", "restricted"]),
  version: z.number().int(),
});

export const Message = BaseEntity.extend({
  threadId: Uuid,
  senderAccountId: Uuid,
  body: z.string().min(1),
  relatedGradeItemId: Uuid.optional(),
});

export const MessageThread = BaseEntity.extend({
  subject: z.string(),
  participantAccountIds: z.array(Uuid),
});

export type RoleName = z.infer<typeof RoleName>;
export type Institution = z.infer<typeof Institution>;
export type Person = z.infer<typeof Person>;
export type Account = z.infer<typeof Account>;
export type Student = z.infer<typeof Student>;
export type GradeItem = z.infer<typeof GradeItem>;
export type ApprovalRequest = z.infer<typeof ApprovalRequest>;
export type AuditEvent = z.infer<typeof AuditEvent>;
export type Notification = z.infer<typeof Notification>;
export type Message = z.infer<typeof Message>;
