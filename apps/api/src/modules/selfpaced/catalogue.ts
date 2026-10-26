/**
 * Server copy of the self-paced course catalogue (titles and curriculum shape). The web curriculum
 * test asserts that `expectedActivityIds` matches the activities the learner UI actually presents.
 */
export type SelfpacedCourse = { slug: string; title: string; prefix: string; chapters: number };

export const SELFPACED_COURSES: SelfpacedCourse[] = [
  { slug: "cap-101-applied-business-capstone", title: "CAP 101 – Applied Business Capstone Project", prefix: "cap", chapters: 12 },
  { slug: "office-administration-diploma", title: "Office Administration Diploma", prefix: "oa", chapters: 11 },
  { slug: "pharmacy-assistant", title: "Pharmacy Assistant", prefix: "ph", chapters: 9 },
  { slug: "red-seal-exam-preparation-electrician", title: "Red Seal Exam Preparation Electrician (Construction)", prefix: "re", chapters: 5 },
  { slug: "red-seal-exam-preparation-carpentry", title: "Red Seal Exam Preparation Carpentry", prefix: "rc", chapters: 5 },
  { slug: "red-seal-exam-preparation-plumber", title: "Red Seal Exam Preparation Plumber", prefix: "pl", chapters: 5 },
  { slug: "red-seal-exam-preparation-chef", title: "Red Seal Exam Preparation Chef", prefix: "ch", chapters: 15 },
  { slug: "red-seal-exam-preparation-hvac", title: "Red Seal Exam HVAC Technician", prefix: "hv", chapters: 5 },
  { slug: "red-seal-exam-preparation-machinist", title: "Red Seal Exam Preparation Machinist", prefix: "mc", chapters: 1 },
];

const CHAPTER_ACTIVITIES = ["read-1", "read-2", "lecture", "practice", "match", "assess"];
const FINAL_ACTIVITIES = ["final-prep", "closing-lecture", "eval-sheet", "final-exam"];

export function selfpacedCourse(slug: string) {
  return SELFPACED_COURSES.find((c) => c.slug === slug);
}

export function expectedActivityIds(course: SelfpacedCourse) {
  const ids: string[] = [];
  for (let n = 1; n <= course.chapters; n++) {
    const chapter = `${course.prefix}-${String(n).padStart(2, "0")}`;
    for (const a of CHAPTER_ACTIVITIES) ids.push(`${chapter}-${a}`);
  }
  for (const a of FINAL_ACTIVITIES) ids.push(`${course.prefix}-${a}`);
  return ids;
}
