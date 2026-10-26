import { z } from 'zod';
import {
  applyDefaults, applySchema, toApplyPayload,
  englishTestDefaults, englishTestSchema, toEnglishTestPayload,
  selfpacedSignupSchema,
} from '../../src/features/public/forms';

/* Server request schemas (apps/api/src/modules/public and selfpaced), kept in sync by hand. */
const ApplyBody = z.object({
  givenName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80).optional().default(''),
  familyName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
  phone: z.string().trim().max(30).optional().default(''),
  dateOfBirth: z.string().trim().max(10).optional().default(''),
  gender: z.string().trim().max(40).optional().default(''),
  residency: z.string().trim().max(80).optional().default(''),
  country: z.string().trim().max(80).optional().default(''),
  addressLine1: z.string().trim().max(160).optional().default(''),
  addressLine2: z.string().trim().max(80).optional().default(''),
  city: z.string().trim().max(80).optional().default(''),
  region: z.string().trim().max(80).optional().default(''),
  postalCode: z.string().trim().max(20).optional().default(''),
  programCategory: z.string().trim().max(120).optional().default(''),
  programName: z.string().trim().max(180).optional().default(''),
  intakeTerm: z.string().trim().max(120).optional().default(''),
  campus: z.string().trim().max(120).optional().default(''),
  applicationAcknowledgement: z.string().trim().max(40).optional().default(''),
}).strict();

const EnglishTestRegistration = z.object({
  institutionName: z.string().trim().min(1).max(160),
  branchProfile: z.string().trim().max(160).default(''),
  siteName: z.string().trim().max(160).default(''),
  voucherCode: z.string().trim().max(80).default(''),
  firstName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80).default(''),
  lastName: z.string().trim().min(1).max(80),
  dateOfBirth: z.string().date(),
  gender: z.string().trim().min(1).max(40),
  highSchoolEnrolled: z.enum(['Yes', 'No']),
  address1: z.string().trim().min(1).max(160),
  address2: z.string().trim().max(160).default(''),
  country: z.string().trim().min(1).max(80),
  province: z.string().trim().min(1).max(80),
  otherProvince: z.string().trim().max(80).default(''),
  city: z.string().trim().min(1).max(80),
  postalCode: z.string().trim().min(1).max(20),
  email: z.string().trim().toLowerCase().email().max(200),
  homePhone: z.string().trim().max(30).default(''),
  mobilePhone: z.string().trim().min(6).max(30),
  studentId: z.string().trim().min(1).max(80),
  confirmStudentId: z.string().trim().min(1).max(80),
  supplementalStudentId: z.string().trim().max(80).default(''),
  resultInstitutions: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
  optOutCollegePlanningEmail: z.boolean().default(false),
  privacyAccepted: z.literal(true),
}).strict().superRefine((v, ctx) => {
  if (v.studentId !== v.confirmStudentId) ctx.addIssue({ code: 'custom', path: ['confirmStudentId'], message: 'Student IDs do not match.' });
  if (v.province === 'Other' && !v.otherProvince) ctx.addIssue({ code: 'custom', path: ['otherProvince'], message: 'Specify the province/state.' });
});

const LearnerRegistrationBody = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
}).strict();

describe('public apply form', () => {
  const filled = {
    ...applyDefaults,
    givenName: ' Asha ', familyName: 'Verma', dateOfBirth: '2001-04-12', gender: 'Female', residency: 'Study permit',
    email: ' Asha.Verma@Example.com ', phone: '+1 604 555 0101', addressLine1: '12 Main St', city: 'Surrey',
    programCategory: 'Health', programName: 'Pharmacy Assistant', intakeTerm: 'Fall 2027', campus: 'Surrey',
    password: 'longenough1', confirm: 'longenough1', consent: true,
  };

  it('produces a body the API accepts', () => {
    const form = applySchema.parse(filled);
    const body = { ...toApplyPayload(form), applicationAcknowledgement: 'Confirmed' };
    expect(ApplyBody.safeParse(body).success).toBe(true);
    expect(body.email).toBe('asha.verma@example.com');
    expect(body.givenName).toBe('Asha');
    expect(body).not.toHaveProperty('confirm');
    expect(body).not.toHaveProperty('consent');
  });

  it('rejects mismatched passwords, short passwords and missing consent', () => {
    expect(applySchema.safeParse({ ...filled, confirm: 'different1' }).success).toBe(false);
    expect(applySchema.safeParse({ ...filled, password: 'short', confirm: 'short' }).success).toBe(false);
    expect(applySchema.safeParse({ ...filled, consent: false }).success).toBe(false);
  });

  it('requires the fields the web form requires', () => {
    const r = applySchema.safeParse(applyDefaults);
    const paths = new Set(r.error?.issues.map(i => i.path[0]));
    for (const k of ['givenName', 'familyName', 'email', 'phone', 'dateOfBirth', 'gender', 'residency', 'addressLine1', 'city', 'programCategory', 'programName', 'intakeTerm', 'password']) expect(paths.has(k)).toBe(true);
  });
});

describe('public English Test form', () => {
  const filled = {
    ...englishTestDefaults,
    firstName: 'Asha', lastName: 'Verma', dateOfBirth: '2001-04-12', gender: 'Female', highSchoolEnrolled: 'No',
    address1: '12 Main St', city: 'Surrey', postalCode: 'V3T 1A1', email: 'ASHA@example.com', mobilePhone: '6045550101',
    studentId: 'ST-1', confirmStudentId: 'ST-1', resultInstitutions: 'Campus One, Example College', privacyAccepted: true,
  };

  it('produces a body the API accepts', () => {
    const body = toEnglishTestPayload(englishTestSchema.parse(filled));
    expect(EnglishTestRegistration.safeParse(body).success).toBe(true);
    expect(body.resultInstitutions).toEqual(['Campus One', 'Example College']);
    expect(body.email).toBe('asha@example.com');
  });

  it('requires matching student IDs, privacy consent and a specified other province', () => {
    expect(englishTestSchema.safeParse({ ...filled, confirmStudentId: 'ST-2' }).success).toBe(false);
    expect(englishTestSchema.safeParse({ ...filled, privacyAccepted: false }).success).toBe(false);
    expect(englishTestSchema.safeParse({ ...filled, province: 'Other' }).success).toBe(false);
    const other = toEnglishTestPayload(englishTestSchema.parse({ ...filled, province: 'Other', otherProvince: 'Yukon' }));
    expect(EnglishTestRegistration.safeParse(other).success).toBe(true);
  });

  it('requires a high-school answer', () => {
    expect(englishTestSchema.safeParse({ ...filled, highSchoolEnrolled: '' }).success).toBe(false);
  });
});

describe('self-paced sign-up form', () => {
  it('produces a body the API accepts', () => {
    const v = selfpacedSignupSchema.parse({ name: 'Asha Verma', email: 'asha@example.com', password: 'longenough1', confirm: 'longenough1' });
    expect(LearnerRegistrationBody.safeParse({ name: v.name, email: v.email, password: v.password }).success).toBe(true);
    expect(selfpacedSignupSchema.safeParse({ ...v, confirm: 'nope' }).success).toBe(false);
  });
});
