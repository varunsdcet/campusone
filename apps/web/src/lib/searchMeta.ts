/** Client fallback for Advanced Search dropdowns (matches MySIS screenshots + API /search/meta). */

export type SearchOption = { label: string; value: string; indent?: boolean; group?: string };

export const FALLBACK_SEARCH_META = {
  statuses: [
    { label: "All Statuses", value: "" },
    { label: "New Inquiry", value: "New Inquiry" },
    { label: "Approved Application", value: "Approved Application" },
    { label: "Pre-enrolment Application", value: "Pre-enrolment Application" },
    { label: "Cancelled/ Did not proceed", value: "Cancelled/ Did not proceed", indent: true },
    { label: "CLOA", value: "CLOA", indent: true },
    { label: "Duplicate profiles", value: "Duplicate profiles", indent: true },
    { label: "Follow Up", value: "Follow Up", indent: true },
    { label: "In-active Leads", value: "In-active Leads", indent: true },
    { label: "LOA", value: "LOA", indent: true },
    { label: "Declined Application", value: "Declined Application" },
    { label: "Registered Student", value: "Registered Student" },
    { label: "Active Student", value: "Active Student" },
    { label: "Leave of Absence", value: "Leave of Absence", indent: true },
    { label: "On-Hold", value: "On-Hold", indent: true },
    { label: "Graduated", value: "Graduated" },
    { label: "Incomplete", value: "Incomplete" },
    { label: "Withdrawn Students", value: "Withdrawn Students" },
    { label: "Dismissed", value: "Dismissed" },
  ] as SearchOption[],
  campuses: [
    { label: "All Campuses", value: "" },
    { label: "#110 CampusOne - Surrey", value: "#110 Heritage College - Surrey" },
    { label: "CampusOne - Distance", value: "Heritage Community College - Distance" },
    { label: "CampusOne - Victoria", value: "Heritage Community College - Victoria" },
    { label: "Online", value: "Online" },
  ] as SearchOption[],
  deliveryMethods: [
    { label: "All", value: "" },
    { label: "In-Person", value: "In-Person" },
    { label: "Online", value: "Online" },
    { label: "Hybrid", value: "Hybrid" },
    { label: "Distance", value: "Distance" },
  ] as SearchOption[],
  domesticInternational: [
    { label: "All", value: "" },
    { label: "Domestic", value: "Domestic" },
    { label: "International", value: "International" },
  ] as SearchOption[],
  programs: [
    { label: "All Programs", value: "" },
    { label: "CAPA: Certificate in Accounting and Payroll Administrator", value: "CAPA: Certificate in Accounting and Payroll Administrator", group: "ACCOUNTING/PAYROLL" },
    { label: "DAP: Diploma in Accounting and Payroll administrator", value: "DAP: Diploma in Accounting and Payroll administrator", group: "ACCOUNTING/PAYROLL" },
    { label: "BTT: Bank Teller Training", value: "BTT: Bank Teller Training", group: "BUSINESS" },
    { label: "COA: Certificate Office Administration", value: "COA: Certificate Office Administration", group: "BUSINESS" },
    { label: "CSMS: Corporate Sales Management Strategies Certificate", value: "CSMS: Corporate Sales Management Strategies Certificate", group: "BUSINESS" },
    { label: "DIB: Diploma in International Business", value: "DIB: Diploma in International Business", group: "BUSINESS" },
    { label: "DMM: Digital Marketing Management", value: "DMM: Digital Marketing Management", group: "BUSINESS" },
    { label: "HRA: Human Resources Administration", value: "HRA: Human Resources Administration", group: "BUSINESS" },
    { label: "MA: Marketing Administration", value: "MA: Marketing Administration", group: "BUSINESS" },
    { label: "OA: Office Administration", value: "OA: Office Administration", group: "BUSINESS" },
    { label: "RSMS: Retail Sales Management Strategies Certificate", value: "RSMS: Retail Sales Management Strategies Certificate", group: "BUSINESS" },
    { label: "NSA: Network Support Administrator", value: "NSA: Network Support Administrator", group: "COMPUTER SCIENCE" },
    { label: "NST: Network Support Technician", value: "NST: Network Support Technician", group: "COMPUTER SCIENCE" },
    { label: "CS-DIP: Computer Science Diploma", value: "CS-DIP: Computer Science Diploma", group: "COMPUTER SCIENCE" },
    {
      label: "ECEA (Option 2): Child Growth Development Part I & II + Interpersonal Communication",
      value: "ECEA2: ECEA (Option 2): Child Growth Development Part I & II + Interpersonal Communication",
      group: "EARLY CHILDHOOD EDUCATOR ASSISTANT",
    },
    {
      label: "ECEA option1: Child Growth Development part 1 & 2",
      value: "ECEA1: ECEA option1: Child Growth Development part 1 & 2",
      group: "EARLY CHILDHOOD EDUCATOR ASSISTANT",
    },
    { label: "ACSW: Addictions Community Support Worker", value: "ACSW: Addictions Community Support Worker", group: "HEALTH SCIENCE" },
    { label: "HCA: Health Care Assistant", value: "HCA: Health Care Assistant", group: "HEALTH SCIENCE" },
    { label: "Interpersonal Communication (HCA_2)", value: "HCA_2: Interpersonal Communication (HCA_2)", group: "HEALTH SCIENCE" },
  ] as SearchOption[],
  months: [
    { label: "-- Month --", value: "" },
    ...[
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ].map((label, i) => ({ label, value: String(i + 1).padStart(2, "0") })),
  ] as SearchOption[],
  days: [
    { label: "-- Day --", value: "" },
    ...Array.from({ length: 31 }, (_, i) => {
      const v = String(i + 1).padStart(2, "0");
      return { label: v, value: v };
    }),
  ] as SearchOption[],
  years: [
    { label: "-- Year --", value: "" },
    ...Array.from({ length: 81 }, (_, i) => {
      const y = String(new Date().getFullYear() - i);
      return { label: y, value: y };
    }),
  ] as SearchOption[],
};
