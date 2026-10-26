/** FD-07 fixture content for screens without a full backend yet. */

export const FD07 = {
  institution: "CampusOne",
  campus: "Surrey, BC",
  term: "Fall 2026",
  student: {
    name: "Marcus Vance",
    number: "ST-2024-001",
    program: "Computer Science",
    standing: "good",
    dob: "2003-11-14",
  },
  instructor: {
    name: "Elena Vance",
    email: "vance.instructor@heritage.edu",
  },
  admin: {
    name: "Aisha Khan",
    email: "admin@heritage.edu",
  },
  courses: [
    { code: "CS301", title: "Algorithms", section: "CS301-01", credits: 3, instructor: "Elena Vance", percent: 88, letter: "A-" },
    { code: "ACC201", title: "Financial Accounting", section: "ACC201-01", credits: 3, instructor: "James Pendelton", percent: 76, letter: "B" },
  ],
  peers: [
    { name: "Priya Sandhu", number: "ST-2024-014", program: "Nursing" },
    { name: "Daniel Okafor", number: "ST-2023-088", program: "Computer Science", standing: "alert" },
  ],
  sectionId: "77777777-7777-4777-8777-777777777701",
};
