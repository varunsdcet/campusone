/** Shared Add Session / Offering form chrome (MySIS-parity). */

export type SessionFormField = {
  label: string;
  value: string;
  type?:
    | "text"
    | "select"
    | "textarea"
    | "number"
    | "checkbox"
    | "checkboxes"
    | "date"
    | "file"
    | "weekdays"
    | "pair";
  options?: Array<{ label: string; value: string; filterKey?: string; group?: string }>;
  hint?: string;
  sublabel?: string;
  optional?: boolean;
  dependsOn?: string;
};

export type SessionFormGroup = {
  title: string;
  fields: SessionFormField[];
};

export type AddSessionFormConfig = {
  submitLabel: string;
  groups: SessionFormGroup[];
  weeklyTimings?: {
    title?: string;
    days: Array<{
      day: string;
      startHour: string;
      startMinute: string;
      finishHour: string;
      finishMinute: string;
    }>;
  };
  examSchedule?: {
    title?: string;
    addLabel?: string;
    exams: Array<{ id: string; date: string; startTime: string; finishTime: string; location: string }>;
  };
  gradingPreview?: {
    title?: string;
    schemeLabel?: string;
    columns: string[];
    rows: Array<{ letter: string; credit: string; condition: string }>;
  };
  tuitionNote?: string;
};

const CAMPUSES = [
  { label: "-- Select Campus / Location --", value: "" },
  { label: "#110 Heritage College- Surrey", value: "#110 Heritage College- Surrey" },
  { label: "Heritage Community College - Distance", value: "Heritage Community College - Distance" },
  { label: "Heritage Community College - Victoria", value: "Heritage Community College - Victoria" },
];

const CLASSROOMS = [
  { label: "-- Select Classroom --", value: "" },
  { label: "Room 101", value: "Room 101" },
  { label: "Room 102", value: "Room 102" },
  { label: "Room 201", value: "Room 201" },
  { label: "Lab A", value: "Lab A" },
  { label: "Online / Virtual", value: "Online / Virtual" },
];

export function buildAddSessionScreenForm(courseLabel = "0"): AddSessionFormConfig {
  return {
    submitLabel: "Save Session",
    tuitionNote: "Course tuition included in the program cost.",
    groups: [
      {
        title: "Session Settings",
        fields: [
          { label: "Session Name", value: "", type: "text", optional: true },
          {
            label: "Session Type",
            value: "",
            type: "select",
            options: [
              { label: "-- Select Session Type --", value: "" },
              { label: "Lecture", value: "Lecture" },
              { label: "Online", value: "Online" },
            ],
          },
          {
            label: "Campus / Location",
            value: "",
            type: "select",
            options: CAMPUSES,
          },
          {
            label: "Classroom",
            value: "",
            type: "select",
            options: CLASSROOMS,
          },
          { label: "Maximum Enrolments", value: "15", type: "number" },
          {
            label: "Same as classroom size",
            value: "true",
            type: "checkbox",
          },
          { label: "Minimum Enrolments", value: "1", type: "number" },
          {
            label: "Enrolment Waitlist",
            value: "Enabled",
            type: "select",
            options: [
              { label: "Enabled", value: "Enabled" },
              { label: "Disabled", value: "Disabled" },
            ],
          },
          {
            label: "Reserved Enrolments",
            value: "Disabled",
            type: "select",
            options: [
              { label: "Enabled", value: "Enabled" },
              { label: "Disabled", value: "Disabled" },
            ],
          },
          {
            label: "Student Self-Enrolment",
            value: "Enabled",
            type: "select",
            options: [
              { label: "Enabled", value: "Enabled" },
              { label: "Disabled", value: "Disabled" },
            ],
          },
        ],
      },
      {
        title: "Session Instruction & Accesses",
        fields: [
          {
            label: "Instructor(s)",
            value: "",
            type: "text",
            hint: "Start typing the name of the user(s) in the fields below.",
          },
          { label: "Teaching Assistant(s)", value: "", type: "text" },
          { label: "Guest(s)", value: "", type: "text" },
        ],
      },
      {
        title: "Session Schedule",
        fields: [
          {
            label: "This is a continuous feed-in course session.",
            value: "false",
            type: "checkbox",
          },
          { label: "Start Date", value: "", type: "date" },
          { label: "End Date", value: "", type: "date" },
          {
            label: "Schedule Type",
            value: "Simple Weekly Schedule",
            type: "select",
            options: [
              { label: "Simple Weekly Schedule", value: "Simple Weekly Schedule" },
              { label: "Custom Schedule", value: "Custom Schedule" },
              { label: "No Fixed Schedule", value: "No Fixed Schedule" },
            ],
          },
          {
            label: "Weekly Schedule",
            value: "Monday,Tuesday,Wednesday,Thursday,Friday",
            type: "weekdays",
          },
        ],
      },
      {
        title: "Additional Session Dates",
        fields: [
          { label: "Median Date", value: "", type: "date" },
          {
            label: "Automatically calculate median date",
            value: "true",
            type: "checkbox",
          },
          {
            label: "Median Grading",
            value: "Disabled",
            type: "select",
            options: [
              { label: "Enabled", value: "Enabled" },
              { label: "Disabled", value: "Disabled" },
            ],
          },
        ],
      },
      {
        title: "Session Tuition",
        fields: [],
      },
      {
        title: "Grading",
        fields: [
          {
            label: "Grading Scheme",
            value: "Pass / Fail",
            type: "select",
            options: [
              { label: "Pass / Fail", value: "Pass / Fail" },
              { label: "DIB and DAP", value: "DIB and DAP" },
              { label: "HCC Grading", value: "HCC Grading" },
              { label: "Health Care Assistant", value: "Health Care Assistant" },
            ],
          },
        ],
      },
      {
        title: "Self-Enrolment Permissions",
        fields: [
          {
            label: "Over-ride self-enrolment start date.",
            value: "false",
            type: "checkbox",
          },
          {
            label: "Customize enrolment permissions.",
            value: "false",
            type: "checkbox",
          },
          {
            label: "Allow external / direct student enrolment.",
            value: "false",
            type: "checkbox",
          },
        ],
      },
      {
        title: "Course Withdrawal",
        fields: [
          {
            label: "Course Withdrawal",
            value: "Use default deadline settings",
            type: "select",
            options: [
              { label: "Use default deadline settings", value: "Use default deadline settings" },
              { label: "Always require approval", value: "Always require approval" },
              { label: "Disable course withdrawal", value: "Disable course withdrawal" },
            ],
          },
        ],
      },
      {
        title: "Attendance / Participation",
        fields: [
          {
            label: "Attendance Grading",
            value: "Disabled",
            type: "select",
            options: [
              { label: "Enabled", value: "Enabled" },
              { label: "Disabled", value: "Disabled" },
            ],
          },
          {
            label: "Scanner Enrolment",
            value: "Disable automated attendance scanner enrolment",
            type: "select",
            options: [
              {
                label: "Disable automated attendance scanner enrolment",
                value: "Disable automated attendance scanner enrolment",
              },
              {
                label: "Enabled automated attendance scanner enrolment",
                value: "Enabled automated attendance scanner enrolment",
              },
            ],
          },
        ],
      },
      {
        title: "Course Content",
        fields: [
          {
            label: "Enable LMS",
            value: "Disabled",
            type: "select",
            options: [
              { label: "Enabled", value: "Enabled" },
              { label: "Disabled", value: "Disabled" },
            ],
          },
        ],
      },
    ],
    weeklyTimings: {
      title: "Daily Timings",
      days: [
        { day: "Monday", startHour: "08", startMinute: "00", finishHour: "13", finishMinute: "00" },
        { day: "Tuesday", startHour: "08", startMinute: "00", finishHour: "13", finishMinute: "00" },
        { day: "Wednesday", startHour: "08", startMinute: "00", finishHour: "13", finishMinute: "00" },
        { day: "Thursday", startHour: "08", startMinute: "00", finishHour: "13", finishMinute: "00" },
        { day: "Friday", startHour: "08", startMinute: "00", finishHour: "13", finishMinute: "00" },
      ],
    },
    examSchedule: {
      title: "Exam Schedule",
      addLabel: "+ Add Exam Date",
      exams: [
        { id: "exam-1", date: "", startTime: "09:00", finishTime: "12:00", location: "Not Set" },
      ],
    },
    gradingPreview: {
      title: "Grading scheme",
      schemeLabel: courseLabel,
      columns: ["LETTER", "CREDIT", "CONDITION"],
      rows: [
        { letter: "P", credit: "Yes", condition: "—" },
        { letter: "F", credit: "No", condition: "—" },
        { letter: "DR", credit: "No", condition: "Dropped" },
        { letter: "I", credit: "No", condition: "Incomplete" },
        { letter: "W", credit: "No", condition: "Withdrawal" },
      ],
    },
  };
}
