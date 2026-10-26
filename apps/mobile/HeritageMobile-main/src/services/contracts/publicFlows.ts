/** Signed-out flows: online application, English Test registration and the public self-paced catalogue. */

export interface ApplyInput {
  givenName: string;
  middleName: string;
  familyName: string;
  email: string;
  password: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  residency: string;
  country: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  programCategory: string;
  programName: string;
  intakeTerm: string;
  campus: string;
}

export interface ApplyResult {
  accountId: string;
  applicationId: string;
  email: string;
}

export interface EnglishTestRegistrationInput {
  institutionName: string;
  branchProfile: string;
  siteName: string;
  voucherCode: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  highSchoolEnrolled: 'Yes' | 'No';
  address1: string;
  address2: string;
  country: string;
  province: string;
  otherProvince: string;
  city: string;
  postalCode: string;
  email: string;
  homePhone: string;
  mobilePhone: string;
  studentId: string;
  confirmStudentId: string;
  supplementalStudentId: string;
  resultInstitutions: string[];
  optOutCollegePlanningEmail: boolean;
  privacyAccepted: true;
}

export interface EnglishTestReceipt {
  registrationId: string;
  reference: string;
  status: string;
  submittedAt: string;
}

export interface PublicChapter {
  id: string;
  title: string;
  summary: string;
  hours: number;
  activityCount: number;
}

export interface PublicProgram {
  /** Same id the signed-in student catalogue uses (`programmeId`). */
  slug: string;
  title: string;
  subject: string;
  level: string;
  description: string;
  hours: number;
  chapterCount: number;
  priceCad: number;
  internationalCad?: number;
  imageUrl?: string;
  features: string[];
  chapters: PublicChapter[];
}

export interface SelfpacedRegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface SelfpacedRegisterResult {
  email: string;
  studentNumber: string;
}

export interface PublicFlowsService {
  apply(input: ApplyInput): Promise<ApplyResult>;
  registerEnglishTest(input: EnglishTestRegistrationInput): Promise<EnglishTestReceipt>;
  listSelfpacedPrograms(): Promise<PublicProgram[]>;
  getSelfpacedProgram(slug: string): Promise<PublicProgram>;
  /** Creates a student-role account; sign in afterwards with the same email and password. */
  registerSelfpacedLearner(input: SelfpacedRegisterInput): Promise<SelfpacedRegisterResult>;
}
