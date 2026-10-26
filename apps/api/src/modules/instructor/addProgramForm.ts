/** Shared Add Program form chrome — options match MySIS screenshots (open dropdowns only). */

export type FormFieldOpt = { label: string; value: string; filterKey?: string };

export type AddProgramField = {
  label: string;
  value: string;
  type?: "text" | "select" | "textarea" | "number" | "checkbox" | "file" | "weekdays" | "pair";
  options?: FormFieldOpt[];
  unitValue?: string;
  unitOptions?: FormFieldOpt[];
  dependsOn?: string;
  hint?: string;
  sublabel?: string;
  language?: string;
  visibleWhen?: string;
  visibleValue?: string;
};

function opts(...labels: string[]): FormFieldOpt[] {
  return labels.map((label) => ({ label, value: label }));
}

function numRange(from: number, to: number, extra: FormFieldOpt[] = []): FormFieldOpt[] {
  const nums = Array.from({ length: to - from + 1 }, (_, i) => {
    const n = String(from + i);
    return { label: n, value: n };
  });
  return [...extra, ...nums];
}

const noLimitNums = (to: number) => numRange(1, to, opts("No Limit"));

export const ADD_PROGRAM_DESIGNATION_MODAL = {
  title: "Add Designation",
  submitLabel: "Save Designation",
  groups: [
    {
      title: "Designation Details",
      fields: [
        { label: "Designation Label", value: "", type: "text" as const, language: "English" },
        {
          label: "Designation Type",
          value: "",
          type: "select" as const,
          options: [{ label: "-- Select Type --", value: "" }, ...opts("Standing", "Honours")],
        },
        {
          label: "Disciplinary Action",
          value: "None",
          type: "select" as const,
          options: opts("None", "Alert / Warning", "Probation", "Suspension", "Withdrawal", "Expulsion"),
        },
      ],
    },
    {
      title: "Designation Conditions",
      fields: [
        {
          label: "Courses Completed",
          value: "1",
          type: "select" as const,
          options: numRange(1, 18),
        },
        {
          label: "Terms Completed",
          value: "1",
          type: "select" as const,
          options: numRange(1, 20),
        },
      ],
    },
    {
      title: "Average Condition",
      fields: [
        {
          label: "Designation Condition",
          value: "Grade Point Average",
          type: "select" as const,
          options: opts("Grade Point Average", "Average Percentage"),
        },
        { label: "Required Average", value: "0.0000", type: "number" as const },
        {
          label: "Previous Designation",
          value: "None",
          type: "select" as const,
          options: opts("None", "Standing", "Honours", "Probation"),
        },
        {
          label: "Improvement Leniency",
          value: "No Leniency",
          type: "select" as const,
          options: [
            ...opts("No Leniency", "No Limit", "Custom Average / Condition"),
            ...numRange(1, 20).map((o) => ({ label: `${o.label} term${o.label === "1" ? "" : "s"}`, value: `${o.value} terms` })),
          ],
        },
        {
          label: "Apply consecutive conditions.",
          value: "false",
          type: "checkbox" as const,
        },
      ],
    },
    {
      title: "Failing Grade Conditions",
      fields: [
        {
          label: "Failing Grades",
          value: "Ignore Fails",
          type: "select" as const,
          options: [{ label: "Ignore Fails", value: "Ignore Fails" }, ...numRange(0, 17)],
        },
        {
          label: "Retroactively count failing grades from last suspension.",
          value: "false",
          type: "checkbox" as const,
        },
        {
          label: "Previous Designation (Fails)",
          value: "None",
          type: "select" as const,
          options: opts("None", "Probation", "Suspension", "Withdrawal"),
        },
        {
          label: "Apply consecutive conditions (Fails).",
          value: "false",
          type: "checkbox" as const,
        },
      ],
    },
    {
      title: "Designation Consequences",
      fields: [
        {
          label: "Change Student Status",
          value: "Do not change",
          type: "select" as const,
          options: opts(
            "Do not change",
            "New Inquiry",
            "Approved Application",
            "Pre-enrolment Application",
            "CLOA",
            "LOA",
            "Cancelled / Did not proceed",
            "Follow Up",
            "In-active Leads",
          ),
        },
        {
          label: "Previous Infractions",
          value: "None",
          type: "select" as const,
          options: opts("None", "Probation", "Suspension", "Withdrawal"),
        },
        {
          label: "Standing Flag",
          value: "None",
          type: "select" as const,
          options: opts("None", "Warning", "Probation", "Good Standing"),
        },
      ],
    },
  ],
};

export function buildAddProgramFormGroups(): Array<{ title: string; fields: AddProgramField[] }> {
  return [
    {
      title: "Program Details",
      fields: [
        {
          label: "Program Faculty",
          value: "",
          type: "select",
          options: [
            { label: "-- Select Faculty --", value: "" },
            ...opts(
              "Accounting/Payroll",
              "Business",
              "Computer Science",
              "Early Childhood Educator Assistant",
              "Health Science",
              "Hospitality Management",
              "Languages",
            ),
          ],
        },
        { label: "Program Name", value: "", type: "text", language: "English" },
        { label: "Legal Program Name", value: "", type: "text", language: "English" },
        { label: "Abbreviation", value: "", type: "text", language: "English" },
        {
          label: "Program Type",
          value: "",
          type: "select",
          options: [
            { label: "-- Select Program Type --", value: "" },
            ...opts("Bachelor", "Certificate", "Diploma", "Masters", "Not Applicable", "Online study", "Visitor"),
          ],
        },
        {
          label: "Active / Inactive",
          value: "Active",
          type: "select",
          options: opts("Active", "Inactive"),
        },
      ],
    },
    {
      title: "Program Delivery Settings",
      fields: [
        {
          label: "Schedule Type",
          value: "Self-Paced",
          type: "select",
          options: opts("Self-Paced", "Tiers", "Sequential"),
        },
        {
          label: "Financial Scheme",
          value: "By Course",
          type: "select",
          options: opts("By Course", "By Program", "By Timeframe"),
        },
        {
          label: "Prerequisite Program",
          value: "No",
          type: "select",
          options: opts("No", "Yes"),
        },
        {
          label: "Primary Programs",
          value: "Any Eligible Program",
          type: "select",
          options: opts("Any Eligible Program", "Select Programs"),
          visibleWhen: "Prerequisite Program",
          visibleValue: "Yes",
        },
        {
          label: "Allow Applications",
          value: "Yes",
          type: "select",
          options: opts("Yes", "No"),
          visibleWhen: "Prerequisite Program",
          visibleValue: "Yes",
        },
        {
          label: "Allow Course Selection",
          value: "No",
          type: "select",
          options: opts("No", "Yes"),
          visibleWhen: "Prerequisite Program",
          visibleValue: "Yes",
        },
        {
          label: "Enrolment Leniency",
          value: "0",
          type: "number",
          visibleWhen: "Prerequisite Program",
          visibleValue: "Yes",
        },
        {
          label: "Allow Prerequisite Programs",
          value: "No",
          type: "select",
          options: opts("No", "Yes"),
        },
      ],
    },
    {
      title: "Program Enrolment Conditions",
      fields: [
        {
          label: "Maximum Enrolled Courses (per term)",
          value: "No Limit",
          type: "pair",
          options: noLimitNums(15),
          unitValue: "Courses",
          unitOptions: opts("Courses", "Credits"),
        },
        {
          label: "Maximum Enrolled Per Day",
          value: "No Limit",
          type: "select",
          options: noLimitNums(15),
        },
        {
          label: "Maximum Course Attempts",
          value: "No Limit",
          type: "select",
          options: noLimitNums(20),
        },
        {
          label: "Repeat Credited Courses",
          value: "No restrictions",
          type: "select",
          options: [
            ...opts("No restrictions", "Disable self-enrolment"),
            ...numRange(1, 12).map((o) => ({
              label: `${o.label} attempt${o.label === "1" ? "" : "s"}`,
              value: `${o.value} attempts`,
            })),
          ],
        },
        {
          label: "Repeat Failed Courses",
          value: "No restrictions",
          type: "select",
          options: opts("No restrictions", "Must enrol"),
        },
        {
          label: "Tier Prerequisites",
          value: "No restrictions",
          type: "select",
          options: opts("No restrictions", "Force prerequisite tiers"),
        },
        {
          label: "Drop / Withdraw Penalties",
          value: "Always requires approval",
          type: "select",
          options: opts(
            "Always requires approval",
            "Instant approval for non-penalty tuition adjustments",
            "Instant approval for all penalties",
          ),
        },
      ],
    },
    {
      title: "Program Calculations & Statistical Details",
      fields: [
        {
          label: "Full-time Calculation",
          value: "By courses taken per term",
          type: "select",
          options: opts("By courses taken per term", "By program of study definition"),
        },
        {
          label: "Full-time Minimum (per term)",
          value: "3",
          type: "select",
          options: numRange(1, 16),
        },
        {
          label: "Always full-time, if final term of study.",
          value: "true",
          type: "checkbox",
        },
        {
          label: "GPA Calculation",
          value: "Indifferent",
          type: "select",
          options: opts("Indifferent", "Weighted by Credit Value", "Weighted by Course Hours"),
        },
        {
          label: "Enrolment Average (per term)",
          value: "1",
          type: "select",
          options: numRange(1, 16),
        },
        {
          label: "Program Length",
          value: "48",
          type: "pair",
          options: numRange(1, 120),
          unitValue: "Months",
          unitOptions: opts("Days", "Weeks", "Months", "Years"),
        },
        { label: "Average Credits per Course", value: "3.00", type: "number" },
        { label: "Program Credits", value: "0.00", type: "number" },
      ],
    },
    {
      title: "Program Academic Standing Settings",
      fields: [
        {
          label: "Standing Analysis",
          value: "Upon completion of each course",
          type: "select",
          options: opts("Upon completion of each course", "Upon completion of each term"),
        },
        {
          label: "Completion Minimum",
          value: "No Minimum",
          type: "select",
          options: [{ label: "No Minimum", value: "No Minimum" }, ...numRange(1, 20)],
        },
        {
          label: "Include pre-requisite / qualifying programs in standing analysis.",
          value: "false",
          type: "checkbox",
        },
      ],
    },
    {
      title: "Program Graduation Conditions",
      fields: [
        {
          label: "Course Requirement",
          value: "All Courses Credited",
          type: "select",
          options: opts("All Courses Credited", "Minimum Courses Credited", "Select Courses Credited"),
        },
        {
          label: "Graduation Average Type",
          value: "Grade Point Average",
          type: "select",
          options: opts("Grade Point Average", "Average Percentage"),
        },
        { label: "Required Average", value: "0.0000", type: "number" },
        {
          label: "Average Calculation",
          value: "All Courses",
          type: "select",
          options: opts("All Courses", "Program Plan Courses Only", "Maximum Courses", "Select Courses"),
        },
        {
          label: "Repeat Courses",
          value: "Count Highest Attempt",
          type: "select",
          options: opts("Count Highest Attempt", "Count All Attempts"),
        },
        {
          label: "Finance Clearance Required",
          value: "Yes",
          type: "select",
          options: opts("Yes", "No"),
        },
      ],
    },
    {
      title: "Program Chair & Lead Accesses",
      fields: [
        {
          label: "Academic Chair",
          value: "",
          type: "text",
          hint: "Start typing the name of the user(s)",
        },
        {
          label: "Program Lead",
          value: "",
          type: "text",
          hint: "Start typing the name of the user(s)",
        },
      ],
    },
    {
      title: "Program Permissions",
      fields: [
        {
          label: "Campus",
          value: "All Campuses",
          type: "select",
          options: opts("All Campuses", "#110 Heritage College- Surrey", "Heritage College - Main"),
        },
      ],
    },
  ];
}

export function buildAddProgramScreenForm() {
  return {
    submitLabel: "Save Program",
    groups: buildAddProgramFormGroups(),
    designations: {
      columns: ["LABEL", "CONDITION", "REQUIREMENT"],
      addLabel: "Add Designation",
      rows: [] as Array<{ label: string; condition: string; requirement: string }>,
      modal: ADD_PROGRAM_DESIGNATION_MODAL,
    },
  };
}
