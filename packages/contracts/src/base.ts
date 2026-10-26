import { z } from "zod";

/** RFC UUID or demo seed ids (e.g. a1a1a1a1-s0s0-…). */
export const Uuid = z
  .string()
  .min(8)
  .refine((value) => {
    if (z.string().uuid().safeParse(value).success) return true;
    return /^[0-9a-zA-Z][0-9a-zA-Z-]{7,62}$/.test(value);
  }, "Invalid uuid");
export const InstitutionId = Uuid;
export const IsoDateTime = z.string().datetime({ offset: true }).or(z.string().datetime());
/** External HTTPS meeting link, or the in-app live classroom launcher (`/live/<sectionId>?provider=...`). */
export const JoinUrl = z
  .string()
  .refine(
    (value) =>
      /^\/live\/[0-9a-zA-Z][0-9a-zA-Z-]{7,62}(?:\?provider=(?:jitsi|bigbluebutton))?$/.test(value) ||
      (value.startsWith("https://") && z.string().url().safeParse(value).success),
    "Join links must be HTTPS or an in-app live class link",
  );
export const MoneyCad = z.object({
  amountCents: z.number().int(),
  currency: z.literal("CAD"),
});

export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const PaginatedMeta = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const ErrorEnvelope = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    correlationId: z.string(),
  }),
});

export const AuditEnvelope = z.object({
  actorId: Uuid,
  purpose: z.string(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  source: z.string(),
  correlationId: z.string(),
  eventName: z.string(),
  version: z.number().int().positive(),
});

export const BaseEntity = z.object({
  id: Uuid,
  institutionId: InstitutionId,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  rowVersion: z.number().int().positive(),
});

export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;
export type AuditEnvelope = z.infer<typeof AuditEnvelope>;
export type MoneyCad = z.infer<typeof MoneyCad>;
