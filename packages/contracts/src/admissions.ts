export const ADMISSIONS_LEAD_STATUSES = ["new_inquiry", "prospective", "follow_up", "draft"] as const;

export const ADMISSIONS_STAGE_PROGRESS: Readonly<Record<string, number>> = {
  draft: 0,
  submitted: 60,
  under_review: 70,
  interview: 80,
  waitlisted: 80,
  approved_application: 90,
  offered: 90,
  cloa: 90,
  accepted: 100,
  enrolled: 100,
  declined: 100,
  refused_visa: 100,
  withdrawn: 100,
};

export const ADMISSIONS_STAGE_TEXT: Readonly<Record<string, string>> = {
  submitted: "Your application was submitted to Admissions.",
  under_review: "Your application is now being reviewed by Admissions.",
  interview: "You have been invited to an admissions interview.",
  waitlisted: "Your application has been placed on the waitlist.",
  approved_application: "Congratulations — you have been admitted. Your letter will follow.",
  offered: "An offer letter is waiting for you in the applicant portal.",
  cloa: "A letter of acceptance is waiting for you in the applicant portal.",
  accepted: "Your acceptance has been recorded.",
  enrolled: "Welcome to Heritage! Your student record has been created; sign in to the student portal.",
  declined: "A decision has been made on your application. Please check the applicant portal.",
  refused_visa: "Your application was updated following the visa decision.",
  withdrawn: "Your application has been withdrawn.",
};
