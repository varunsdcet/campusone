import { z } from 'zod';
import type { ApplyInput, EnglishTestRegistrationInput } from '../../services/contracts/publicFlows';

/* Option lists mirror the web pages (apps/web/src/app/apply and /english-test). */
export const GENDERS = ['Female', 'Male', 'Non-binary', 'Prefer not to say', 'Other'];
export const RESIDENCY = ['Canadian citizen', 'Permanent resident', 'Study permit', 'Work permit', 'Visitor', 'Other'];
export const PROGRAM_CATEGORIES = ['Business', 'Health', 'Trades', 'Technology', 'Other'];
export const PROGRAMS = [
  'Office Administration Diploma',
  'Pharmacy Assistant',
  'Red Seal Exam Preparation Electrician (Construction)',
  'Red Seal Exam Preparation Carpentry',
  'Red Seal Exam Preparation Plumber',
  'Red Seal Exam Preparation Chef',
  'Red Seal Exam HVAC Technician',
  'Red Seal Exam Preparation Machinist',
];
export const INTAKE_TERMS = ['Winter 2027', 'Spring 2027', 'Fall 2027', 'Continuous / self-paced'];
export const CAMPUSES = ['Surrey', 'Victoria', 'Online'];
export const PROVINCES = ['British Columbia', 'Alberta', 'Ontario', 'Quebec', 'Other'];
export const YES_NO = ['Yes', 'No'];
export const INSTITUTION = 'Campus One';

export const asOptions = (list: string[]) => list.map(v => ({ value: v, label: v }));

const required = (message: string, max: number) => z.string().trim().min(1, message).max(max, `Use ${max} characters or fewer`);
const optional = (max: number) => z.string().trim().max(max, `Use ${max} characters or fewer`);

/* ------------------------------- Apply ------------------------------- */

export const applySchema = z
  .object({
    givenName: required('Enter your first name', 80),
    middleName: optional(80),
    familyName: required('Enter your last name', 80),
    dateOfBirth: required('Choose your date of birth', 10),
    gender: required('Select your gender', 40),
    residency: required('Select your visa / residency status', 80),
    email: z.string().trim().email('Enter a valid email address').max(200),
    phone: required('Enter your phone number', 30),
    country: required('Enter your country', 80),
    addressLine1: required('Enter your street address', 160),
    addressLine2: optional(80),
    city: required('Enter your city', 80),
    region: optional(80),
    postalCode: optional(20),
    programCategory: required('Select a program category', 120),
    programName: required('Select a program', 180),
    intakeTerm: required('Select an admission term', 120),
    campus: required('Select a campus', 120),
    password: z.string().min(8, 'Password must be at least 8 characters').max(200),
    confirm: z.string(),
    consent: z.boolean().refine(v => v, 'Confirm the declaration to continue'),
  })
  .refine(v => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });
export type ApplyFormValues = z.infer<typeof applySchema>;

export const applyDefaults: ApplyFormValues = {
  givenName: '', middleName: '', familyName: '', dateOfBirth: '', gender: '', residency: '',
  email: '', phone: '', country: 'Canada', addressLine1: '', addressLine2: '', city: '', region: 'British Columbia', postalCode: '',
  programCategory: '', programName: '', intakeTerm: '', campus: 'Online',
  password: '', confirm: '', consent: false,
};

export function toApplyPayload(v: ApplyFormValues): ApplyInput {
  const t = (s: string) => s.trim();
  return {
    givenName: t(v.givenName), middleName: t(v.middleName), familyName: t(v.familyName),
    email: t(v.email).toLowerCase(), password: v.password, phone: t(v.phone), dateOfBirth: v.dateOfBirth,
    gender: v.gender, residency: v.residency, country: t(v.country),
    addressLine1: t(v.addressLine1), addressLine2: t(v.addressLine2), city: t(v.city), region: t(v.region), postalCode: t(v.postalCode),
    programCategory: v.programCategory, programName: v.programName, intakeTerm: v.intakeTerm, campus: v.campus,
  };
}

/* ---------------------------- English Test ---------------------------- */

const splitInstitutions = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);

export const englishTestSchema = z
  .object({
    institutionName: required('Enter the institution name', 160),
    branchProfile: optional(160),
    siteName: optional(160),
    voucherCode: optional(80),
    firstName: required('Enter your first name', 80),
    middleName: optional(80),
    lastName: required('Enter your last name', 80),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose your date of birth'),
    gender: required('Select your gender', 40),
    highSchoolEnrolled: z.string().refine(v => YES_NO.includes(v), 'Select Yes or No'),
    address1: required('Enter your street address', 160),
    address2: optional(160),
    country: required('Enter your country', 80),
    province: required('Select a province / state', 80),
    otherProvince: optional(80),
    city: required('Enter your city', 80),
    postalCode: required('Enter your ZIP / postal code', 20),
    email: z.string().trim().email('Enter a valid email address').max(200),
    homePhone: optional(30),
    mobilePhone: z.string().trim().min(6, 'Enter a mobile phone number').max(30, 'Use 30 characters or fewer'),
    studentId: required('Enter your Student ID', 80),
    confirmStudentId: required('Confirm your Student ID', 80),
    supplementalStudentId: optional(80),
    resultInstitutions: z.string().refine(s => {
      const list = splitInstitutions(s);
      return list.length <= 10 && list.every(x => x.length <= 160);
    }, 'List up to 10 institutions, separated by commas'),
    optOutCollegePlanningEmail: z.boolean(),
    privacyAccepted: z.boolean().refine(v => v, 'Accept the privacy policy to continue'),
  })
  .superRefine((v, ctx) => {
    if (v.studentId.trim() !== v.confirmStudentId.trim()) ctx.addIssue({ code: 'custom', path: ['confirmStudentId'], message: 'Student IDs do not match' });
    if (v.province === 'Other' && !v.otherProvince.trim()) ctx.addIssue({ code: 'custom', path: ['otherProvince'], message: 'Specify the province / state' });
  });
export type EnglishTestFormValues = z.infer<typeof englishTestSchema>;

export const englishTestDefaults: EnglishTestFormValues = {
  institutionName: INSTITUTION, branchProfile: '', siteName: '', voucherCode: '',
  firstName: '', middleName: '', lastName: '', dateOfBirth: '', gender: '', highSchoolEnrolled: '',
  address1: '', address2: '', country: 'Canada', province: 'British Columbia', otherProvince: '', city: '', postalCode: '',
  email: '', homePhone: '', mobilePhone: '',
  studentId: '', confirmStudentId: '', supplementalStudentId: '',
  resultInstitutions: INSTITUTION, optOutCollegePlanningEmail: false, privacyAccepted: false,
};

export function toEnglishTestPayload(v: EnglishTestFormValues): EnglishTestRegistrationInput {
  const t = (s: string) => s.trim();
  return {
    institutionName: t(v.institutionName), branchProfile: t(v.branchProfile), siteName: t(v.siteName), voucherCode: t(v.voucherCode),
    firstName: t(v.firstName), middleName: t(v.middleName), lastName: t(v.lastName), dateOfBirth: v.dateOfBirth, gender: v.gender,
    highSchoolEnrolled: v.highSchoolEnrolled === 'Yes' ? 'Yes' : 'No',
    address1: t(v.address1), address2: t(v.address2), country: t(v.country), province: v.province,
    otherProvince: v.province === 'Other' ? t(v.otherProvince) : '', city: t(v.city), postalCode: t(v.postalCode),
    email: t(v.email).toLowerCase(), homePhone: t(v.homePhone), mobilePhone: t(v.mobilePhone),
    studentId: t(v.studentId), confirmStudentId: t(v.confirmStudentId), supplementalStudentId: t(v.supplementalStudentId),
    resultInstitutions: splitInstitutions(v.resultInstitutions),
    optOutCollegePlanningEmail: v.optOutCollegePlanningEmail,
    privacyAccepted: true,
  };
}

/* ------------------------- Self-paced sign-up ------------------------- */

export const selfpacedSignupSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name').max(120, 'Use 120 characters or fewer'),
    email: z.string().trim().email('Enter a valid email address').max(254),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Use 128 characters or fewer'),
    confirm: z.string(),
  })
  .refine(v => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });
export type SelfpacedSignupValues = z.infer<typeof selfpacedSignupSchema>;
