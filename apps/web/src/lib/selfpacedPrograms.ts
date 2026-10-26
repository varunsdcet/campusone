export type SelfpacedProgram = {
  id: string;
  slug: string;
  title: string;
  subject: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  blurb: string;
  description: string;
  hours: number;
  chapters: number;
  priceCad: number;
  internationalCad?: number;
  image: string;
  features: string[];
  status?: "draft" | "review" | "published";
  curriculum?: unknown[];
};

/** Exact catalog from https://hccbconline.com/ — do not invent extra programs. */
export const SELFPACED_PROGRAMS: SelfpacedProgram[] = [
  {
    id: "cap-101",
    slug: "cap-101-applied-business-capstone",
    title: "CAP 101 – Applied Business Capstone Project",
    subject: "Business",
    level: "Intermediate",
    blurb:
      "Turn business knowledge into a complete applied capstone: define a client problem, analyse evidence, build a practical recommendation, and present a professional solution.",
    description:
      "CAP 101 is an applied business capstone built around a realistic Canadian workplace case. Learners move from problem definition and stakeholder discovery through research, data analysis, solution design, implementation planning, professional reporting, and a final presentation. Every chapter includes guided readings, narrated video slides, practice, assessment, and instructor-quality feedback checkpoints.",
    hours: 120,
    chapters: 12,
    priceCad: 100,
    image: "/brand/campus/learn.png",
    features: ["12 applied modules", "Narrated video lectures and slides", "Capstone assessments and final presentation", "Verifiable CampusOne certificate"],
  },
  {
    id: "office-admin",
    slug: "office-administration-diploma",
    title: "Office Administration Diploma",
    subject: "Business",
    level: "Intermediate",
    blurb:
      "As professional offices become more complex, it becomes critical for offices to employ specialists in Office Administration. Graduates of this Office Administration program will be highly organized and client-ready.",
    description:
      "As professional offices become more complex, it becomes critical for offices to employ specialists in Office Administration. Graduates of this Office Administration program will be highly organized and prepared for administrative roles across Canadian workplaces — including professional communication, scheduling, records management, Microsoft Office productivity, and customer service.",
    hours: 361,
    chapters: 11,
    priceCad: 9500,
    internationalCad: 11750,
    image: "https://hccbconline.com/api/files/public/8cfa958b-9646-4810-bf05-5866eafdeebe",
    features: ["11 chapters", "1 chapter unlocks / day", "Instructor lectures", "Premium certificate on completion"],
  },
  {
    id: "pharmacy-assistant",
    slug: "pharmacy-assistant",
    title: "Pharmacy Assistant",
    subject: "Pharmacy Assistant",
    level: "Beginner",
    blurb:
      "The Pharmacy Assistant Certificate Program prepares students for a rewarding career in retail, hospital, and community pharmacies. Students gain hands-on training in prescription processing, pharmacy operations, and patient service.",
    description:
      "The Pharmacy Assistant Certificate Program prepares students for a rewarding career in retail, hospital, and community pharmacies. Students gain hands-on training in prescription processing, pharmacy operations, inventory support, customer service, and professional ethics.",
    hours: 135.5,
    chapters: 9,
    priceCad: 0,
    image: "https://hccbconline.com/api/files/public/136289e2-3c80-490a-a41c-53978b062a20",
    features: ["9 chapters", "Free test enrolment", "Instructor video lectures and slides", "Premium certificate on completion"],
  },
  {
    id: "red-seal-electrician",
    slug: "red-seal-exam-preparation-electrician",
    title: "Red Seal Exam Preparation Electrician (Construction)",
    subject: "Red Seal Exam Preparation",
    level: "Advanced",
    blurb:
      "This course is designed to help construction electricians and apprentices prepare for the Red Seal certification exam. It provides a structured approach to mastering the knowledge, skills, and strategies required for success.",
    description:
      "This course is designed to help construction electricians and apprentices prepare for the Red Seal certification exam. It provides a structured approach to mastering the knowledge, skills, and exam strategies required for the construction electrician pathway.",
    hours: 350,
    chapters: 5,
    priceCad: 3990,
    image: "https://hccbconline.com/api/files/public/6d0bcc8e-a785-4ed7-9e4d-9b2858ed6abc",
    features: ["5 chapters", "1 chapter unlocks / day", "Instructor lectures", "Premium certificate on completion"],
  },
  {
    id: "red-seal-carpentry",
    slug: "red-seal-exam-preparation-carpentry",
    title: "Red Seal Exam Preparation Carpentry",
    subject: "Red Seal Exam Preparation",
    level: "Advanced",
    blurb:
      "This course is tailored to help carpenters and apprentices successfully prepare for the Red Seal certification exam. Through targeted training, practice exams, and expert guidance, participants strengthen exam readiness.",
    description:
      "This course is tailored to help carpenters and apprentices successfully prepare for the Red Seal certification exam. Through targeted training, practice exams, and expert guidance, participants strengthen exam readiness across core carpentry competencies.",
    hours: 350,
    chapters: 5,
    priceCad: 3990,
    image: "https://hccbconline.com/api/files/public/4f177812-0398-4b9c-8104-96165dd95f14",
    features: ["5 chapters", "1 chapter unlocks / day", "Instructor lectures", "Premium certificate on completion"],
  },
  {
    id: "red-seal-plumber",
    slug: "red-seal-exam-preparation-plumber",
    title: "Red Seal Exam Preparation Plumber",
    subject: "Red Seal Trades Exam Preparation",
    level: "Advanced",
    blurb:
      "This course is designed to help journeyperson plumbers and apprentices prepare for the Red Seal certification exam. The program provides comprehensive support through focused study materials and practice.",
    description:
      "This course is designed to help journeyperson plumbers and apprentices prepare for the Red Seal certification exam. The program provides comprehensive support through focused study materials, practice exams, and exam strategy coaching.",
    hours: 350,
    chapters: 5,
    priceCad: 3999,
    image: "https://hccbconline.com/api/files/public/cfd178a3-3b54-464e-80c6-c2483f883a41",
    features: ["5 chapters", "1 chapter unlocks / day", "Instructor lectures", "Premium certificate on completion"],
  },
  {
    id: "red-seal-chef",
    slug: "red-seal-exam-preparation-chef",
    title: "Red Seal Exam Preparation Chef",
    subject: "Red Seal Exam Trades Preparation",
    level: "Advanced",
    blurb:
      "This course is tailored for chefs and culinary professionals preparing to achieve their Red Seal certification. The program provides comprehensive guidance on culinary theory, practical skills, and exam readiness.",
    description:
      "This course is tailored for chefs and culinary professionals preparing to achieve their Red Seal certification. The program provides comprehensive guidance on culinary theory, practical skills, and exam-focused strategies.",
    hours: 350,
    chapters: 15,
    priceCad: 3990,
    image: "https://hccbconline.com/api/files/public/881ca2e7-8e41-4c38-89d1-406c0a90f5b8",
    features: ["15 chapters", "1 chapter unlocks / day", "Instructor lectures", "Premium certificate on completion"],
  },
  {
    id: "red-seal-hvac",
    slug: "red-seal-exam-preparation-hvac",
    title: "Red Seal Exam HVAC Technician",
    subject: "Red Seal Exam Preparation",
    level: "Advanced",
    blurb:
      "This comprehensive Red Seal Exam Preparation course is designed to assist experienced HVAC technicians, apprentices, and trade qualifiers in preparing for the Red Seal HVAC and Refrigeration Mechanic exam.",
    description:
      "This comprehensive Red Seal Exam Preparation course is designed to assist experienced HVAC technicians, apprentices, and trade qualifiers in preparing for the Red Seal HVAC and Refrigeration Mechanic certification exam.",
    hours: 350,
    chapters: 5,
    priceCad: 3990,
    image: "https://hccbconline.com/api/files/public/e124a768-3986-4e6f-99d5-046b312cdb61",
    features: ["5 chapters", "1 chapter unlocks / day", "Instructor lectures", "Premium certificate on completion"],
  },
  {
    id: "red-seal-machinist",
    slug: "red-seal-exam-preparation-machinist",
    title: "Red Seal Exam Preparation Machinist",
    subject: "Red Seal Trades Exam Preparation",
    level: "Advanced",
    blurb:
      "This course is specifically designed to assist machinists and apprentices in preparing for the Red Seal certification exam. It combines theoretical knowledge, practical skills, and exam-focused strategies.",
    description:
      "This course is specifically designed to assist machinists and apprentices in preparing for the Red Seal certification exam. It combines theoretical knowledge, practical skills, and exam-focused strategies for trade success.",
    hours: 200,
    chapters: 1,
    priceCad: 3999,
    image: "https://hccbconline.com/api/files/public/5b0e5401-43a0-4658-8576-2d942a00d0e4",
    features: ["1 chapter", "Instructor lectures", "Practice assessment", "Premium certificate on completion"],
  },
];

/** Merge the server catalogue in-place so existing learner helpers see admin-created programs too. */
export function installSelfpacedPrograms(items: SelfpacedProgram[]) {
  const merged = new Map(SELFPACED_PROGRAMS.map((item) => [item.slug, item]));
  for (const item of items) merged.set(item.slug, { ...merged.get(item.slug), ...item });
  SELFPACED_PROGRAMS.splice(0, SELFPACED_PROGRAMS.length, ...merged.values());
}

export function getSelfpacedProgram(slug: string): SelfpacedProgram | undefined {
  return SELFPACED_PROGRAMS.find((p) => p.slug === slug || p.id === slug);
}

export function isKnownSelfpacedSlug(slug: string): boolean {
  return Boolean(getSelfpacedProgram(slug));
}

export function formatCad(amount: number): string {
  return `$${amount.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAD`;
}
