export type LmsFieldType = "text" | "textarea" | "checkbox" | "select" | "file" | "datetime" | "number" | "static" | "matrix";

export type LmsFormField = {
  name: string;
  label: string;
  type: LmsFieldType;
  required?: boolean;
  options?: string[];
  default?: string;
  enable?: boolean;
  help?: string;
  checked?: boolean;
  rows?: string[];
  columns?: string[];
};

export type LmsFormSection = { title: string; fields: LmsFormField[] };

const text = (name: string, label: string, required = false, def = ""): LmsFormField => ({
  name, label, type: "text", required, default: def,
});
const area = (name: string, label: string, required = false): LmsFormField => ({
  name, label, type: "textarea", required,
});
const chk = (name: string, label: string, checked = false): LmsFormField => ({
  name, label, type: "checkbox", checked,
});
const sel = (name: string, label: string, options: string[], def?: string): LmsFormField => ({
  name, label, type: "select", options, default: def || options[0],
});
const file = (name: string, label: string, help = "PDF, Office documents, text or images up to 8 MB."): LmsFormField => ({
  name, label, type: "file", help,
});
const dt = (name: string, label: string): LmsFormField => ({
  name, label, type: "datetime", enable: true,
});
const num = (name: string, label: string, def = ""): LmsFormField => ({
  name, label, type: "number", default: def,
});
const stat = (name: string, label: string, def: string): LmsFormField => ({
  name, label, type: "static", default: def,
});

const COMMON: LmsFormSection[] = [
  {
    title: "Common module settings",
    fields: [
      sel("Availability", "Availability", ["Show on course page", "Hide from students"]),
      text("ID number", "ID number"),
      sel("Group mode", "Group mode", ["No groups", "Separate groups", "Visible groups"]),
    ],
  },
  {
    title: "Restrict access",
    fields: [],
  },
  {
    title: "Tags",
    fields: [text("Tags", "Enter tags…"), stat("manageTags", "Manage standard tags", "No selection")],
  },
  {
    title: "Competencies",
    fields: [
      stat("Course competencies", "Course competencies", "No selection"),
      sel("Upon activity completion", "Upon activity completion", ["Do nothing", "Attach evidence", "Send for review"]),
      chk("Send content change notification", "Send content change notification"),
    ],
  },
];

const displayOnPage = chk("Display description on course page", "Display description on course page");

export const LMS_ACTIVITY_FORMS: Record<string, { heading: string; error?: string; sections: LmsFormSection[] }> = {
  assignment: {
    heading: "Adding a new Assignment",
    sections: [
      {
        title: "General",
        fields: [
          text("Name", "Assignment name", true),
          area("Description", "Description"),
          displayOnPage,
          area("Activity instructions", "Activity instructions"),
          file("Additional files", "Assignment PDF or supporting file", "Upload one PDF, Office document, text file or image up to 8 MB. The file will appear with the assignment."),
          chk("Only show files during submission", "Only show files during submission"),
        ],
      },
      {
        title: "Availability",
        fields: [dt("Allow submissions from", "Allow submissions from"), dt("Due date", "Due date"), dt("Cut-off date", "Cut-off date"), dt("Remind me to grade by", "Remind me to grade by"), chk("Always show description", "Always show description", true)],
      },
      {
        title: "Submission types",
        fields: [
          chk("File submissions", "File submissions", true),
          chk("Online text", "Online text"),
          num("Maximum number of uploaded files", "Maximum number of uploaded files", "20"),
          sel("Maximum submission size", "Maximum submission size", ["Site upload limit (10 MB)", "5 MB", "2 MB", "1 MB"]),
          {
            ...text("Accepted file types", "Accepted file types"),
            help: "Comma-separated, e.g. .pdf, .docx. Students can upload .pdf .doc .docx .xls .xlsx .csv .png .jpg .jpeg .zip. Leave blank to accept all of these.",
          },
        ],
      },
      {
        title: "Grade",
        fields: [num("Maximum grade", "Maximum grade", "100"), num("Course Mark Weight", "Course Mark Weight (%)", "0")],
      },
      {
        title: "Feedback types",
        fields: [chk("Feedback comments", "Feedback comments", true), chk("Annotate PDF", "Annotate PDF"), chk("Feedback files", "Feedback files"), chk("Offline grading worksheet", "Offline grading worksheet"), chk("Comment inline", "Comment inline")],
      },
      ...COMMON,
    ],
  },
  bigbluebutton: {
    heading: "Adding a new Online Class",
    sections: [
      {
        title: "Instance",
        fields: [
          sel("Provider", "Video provider", ["BigBlueButton"]),
          sel("Instance type", "Instance type", ["Room with recordings", "Room only", "Recordings only"]),
        ],
      },
      { title: "General", fields: [text("Name", "Room name", true, "Online Class Link")] },
      {
        title: "Publish to students",
        fields: [
          sel("Audience", "Audience", ["All enrolled students", "Selected students"]),
          sel("Publish meeting", "Publish meeting", ["Yes — notify students now", "No — save room only"]),
          dt("Open date/time", "Open date/time"),
        ],
      },
      {
        title: "Room settings",
        fields: [area("Welcome message", "Welcome message"), chk("Wait for moderator", "Wait for moderator"), chk("The session may be recorded", "The session may be recorded")],
      },
      { title: "Recording view", fields: [stat("Recording view", "Recording view", "No settings can be edited")] },
      {
        title: "Lock settings",
        fields: [chk("Disable webcams", "Disable webcams"), chk("Disable microphones", "Disable microphones"), chk("Disable private chat", "Disable private chat"), chk("Disable public chat", "Disable public chat"), chk("Disable shared notes", "Disable shared notes"), chk("Hide user list", "Hide user list")],
      },
      {
        title: "Role assigned during live session",
        fields: [
          stat("All users", "All users enrolled joins session as", "Viewer"),
          stat("Manager", "Manager", "Moderator"),
          stat("Course creator", "Course creator", "Moderator"),
          stat("Teacher", "Teacher", "Moderator"),
          stat("Non-editing teacher", "Non-editing teacher", "Moderator"),
        ],
      },
      { title: "Session timing", fields: [dt("Close date/time", "Close date/time")] },
      ...COMMON,
    ],
  },
  book: {
    heading: "Adding a new Book",
    sections: [
      {
        title: "General",
        fields: [
          text("Name", "Book name", true),
          area("Description", "Description"),
          displayOnPage,
          file("Book file", "Upload book file", "Upload a PDF, Word document, text file or image up to 8 MB."),
          area("Book content", "Book introduction or chapter content"),
        ],
      },
      { title: "Appearance", fields: [sel("Chapter formatting", "Chapter formatting", ["Numbers", "Bullets", "Indented", "None"]), chk("Custom titles", "Custom titles")] },
      ...COMMON,
    ],
  },
  chat: {
    heading: "Adding a new Chat",
    sections: [
      { title: "General", fields: [text("Name", "Name of this chat room", true), area("Description", "Description"), displayOnPage] },
      {
        title: "Chat sessions",
        fields: [
          dt("Next chat time", "Next chat time"),
          sel("Repeat/publish session times", "Repeat/publish session times", ["Don't publish any chat times", "No repeats", "Daily", "Weekly"]),
          sel("Save past sessions", "Save past sessions", ["Never delete messages", "Delete after 30 days", "Delete after 365 days"]),
          sel("Everyone can view past sessions", "Everyone can view past sessions", ["No", "Yes"]),
        ],
      },
      ...COMMON,
    ],
  },
  checklist: {
    heading: "Adding a new Checklist",
    sections: [
      { title: "General", fields: [text("Name", "Name", true), area("Description", "Description"), displayOnPage] },
      ...COMMON,
    ],
  },
  choice: {
    heading: "Adding a new Choice",
    sections: [
      {
        title: "General",
        fields: [
          text("Name", "Choice name", true),
          area("Choice question", "Choice question or prompt", true),
          area("Description", "Additional instructions"),
          displayOnPage,
          sel("Display mode for options", "Display mode for options", ["Display horizontally", "Display vertically"]),
        ],
      },
      {
        title: "Options",
        fields: [
          sel("Allow choice to be updated", "Allow choice to be updated", ["No", "Yes"]),
          sel("Allow more than one choice to be selected", "Allow more than one choice to be selected", ["No", "Yes"]),
          sel("Limit number of responses allowed", "Limit number of responses allowed", ["No", "Yes"]),
          text("Option 1", "Option 1", true),
          text("Option 2", "Option 2"),
          text("Option 3", "Option 3"),
          text("Option 4", "Option 4"),
          text("Option 5", "Option 5"),
        ],
      },
      {
        title: "Availability",
        fields: [dt("Allow responses from", "Allow responses from"), dt("Allow responses until", "Allow responses until"), chk("Show preview", "Show preview")],
      },
      { title: "Results", fields: [sel("Publish results", "Publish results", ["Do not publish results to students", "Show after answer", "Show after closed", "Always show"])] },
      ...COMMON,
    ],
  },
  database: {
    heading: "Adding a new Database",
    sections: [
      { title: "General", fields: [text("Name", "Name", true), area("Description", "Description"), displayOnPage] },
      {
        title: "Entries",
        fields: [chk("Approval required", "Approval required"), chk("Allow comments on entries", "Allow comments on entries"), num("Entries required before viewing", "Entries required before viewing", "0"), num("Maximum number of entries", "Maximum number of entries", "0")],
      },
      { title: "Availability", fields: [dt("Available from", "Available from"), dt("Available to", "Available to")] },
      { title: "Ratings", fields: [sel("Roles with permission to rate", "Roles with permission to rate", ["Teacher", "Non-editing teacher", "Student"]), sel("Aggregate type", "Aggregate type", ["No ratings", "Average", "Count", "Maximum", "Minimum", "Sum"])] },
      ...COMMON,
    ],
  },
  externaltool: {
    heading: "Adding a new External tool",
    sections: [
      { title: "General", fields: [text("Name", "Activity name", true), stat("Select content", "Select content", "Select content")] },
      {
        title: "Privacy",
        fields: [chk("Share launcher’s name with the tool", "Share launcher’s name with the tool", true), chk("Share launcher’s email with the tool", "Share launcher’s email with the tool", true), chk("Accept grades from the tool", "Accept grades from the tool", true)],
      },
      {
        title: "Grade",
        fields: [sel("Type", "Type", ["Point", "Scale", "None"]), num("Maximum grade", "Maximum grade", "100"), num("Course Mark Weight", "Course Mark Weight", "0"), sel("Grade category", "Grade category", ["Uncategorised"])],
      },
      ...COMMON,
    ],
  },
  mcgrawhill: {
    heading: "Adding a new External tool",
    sections: [],
  },
  feedback: {
    heading: "Adding a new Feedback",
    sections: [
      { title: "General", fields: [text("Name", "Name", true), area("Description", "Description"), displayOnPage] },
      { title: "Availability", fields: [dt("Allow answers from", "Allow answers from"), dt("Allow answers to", "Allow answers to")] },
      {
        title: "Question and submission settings",
        fields: [sel("Record user names", "Record user names", ["Anonymous", "User’s name will be logged and shown with answers"]), chk("Allow multiple submissions", "Allow multiple submissions"), chk("Enable notification of submissions", "Enable notification of submissions"), chk("Auto number questions", "Auto number questions")],
      },
      { title: "After submission", fields: [chk("Show analysis page", "Show analysis page"), area("Completion message", "Completion message"), text("Link to next activity", "Link to next activity")] },
      ...COMMON,
    ],
  },
  file: {
    heading: "Adding a new File",
    sections: [
      { title: "General", fields: [text("Name", "Name", true), area("Description", "Description"), displayOnPage, file("Select files", "Select files")] },
      {
        title: "Appearance",
        fields: [sel("Display", "Display", ["Automatic", "Embed", "Force download", "Open", "In pop-up"]), chk("Show size", "Show size", true), chk("Show type", "Show type", true), chk("Show upload/modified date", "Show upload/modified date", true), chk("Display resource description", "Display resource description")],
      },
      ...COMMON,
    ],
  },
  folder: {
    heading: "Adding a new Folder",
    sections: [
      { title: "General", fields: [text("Name", "Name", true), area("Description", "Description"), displayOnPage] },
      {
        title: "Content",
        fields: [file("Files", "Files"), sel("Display folder contents", "Display folder contents", ["On a separate page", "Inline on a course page"]), chk("Show subfolders expanded", "Show subfolders expanded", true), chk("Show download folder button", "Show download folder button", true), chk("Force download of files", "Force download of files")],
      },
      ...COMMON.filter((s) => s.title !== "Competencies"),
    ],
  },
  forum: {
    heading: "Adding a new Forum",
    sections: [
      { title: "General", fields: [text("Name", "Forum name", true), area("Description", "Description"), displayOnPage, sel("Forum type", "Forum type", ["Standard forum for general use", "A single simple discussion", "Each person posts one discussion", "Q and A forum", "Standard forum displayed in a blog-like format"])] },
      { title: "Availability", fields: [dt("Due date", "Due date"), dt("Cut-off date", "Cut-off date")] },
      { title: "Attachments and word count", fields: [sel("Maximum attachment size", "Maximum attachment size", ["Site upload limit (200 MB)", "50 MB", "20 MB", "10 MB", "5 MB"]), num("Maximum number of attachments", "Maximum number of attachments", "9"), chk("Display word count", "Display word count")] },
      { title: "Subscription and tracking", fields: [sel("Subscription mode", "Subscription mode", ["Optional subscription", "Forced subscription", "Auto subscription", "Subscription disabled"]), sel("Read tracking", "Read tracking", ["Optional", "Off", "Forced"])] },
      { title: "Discussion locking", fields: [sel("Lock discussions after a period of inactivity", "Lock discussions after a period of inactivity", ["Don't lock discussions", "1 day", "1 week", "1 month"])] },
      { title: "Post threshold for blocking", fields: [num("Time period for blocking", "Time period for blocking", "0"), num("Post threshold for blocking", "Post threshold for blocking", "0"), num("Post threshold for warning", "Post threshold for warning", "0")] },
      ...COMMON,
    ],
  },
  glossary: {
    heading: "Adding a new Glossary",
    sections: [
      { title: "General", fields: [text("Name", "Name", true), area("Description", "Description"), displayOnPage, chk("Is this glossary global?", "Is this glossary global?"), sel("Glossary type", "Glossary type", ["Secondary glossary", "Main glossary"])] },
      {
        title: "Entries",
        fields: [chk("Approved by default", "Approved by default", true), chk("Always allow editing", "Always allow editing"), chk("Duplicate entries allowed", "Duplicate entries allowed"), chk("Allow comments on entries", "Allow comments on entries"), chk("Automatically link glossary entries", "Automatically link glossary entries")],
      },
      { title: "Appearance", fields: [sel("Display format", "Display format", ["Simple, dictionary style", "Continuous", "Full with author", "Encyclopedia", "FAQ"]), chk("Show 'Print' link", "Show 'Print' link", true)] },
      ...COMMON,
    ],
  },
  h5p: {
    heading: "Adding a new H5P",
    sections: [
      { title: "General", fields: [text("Name", "Name", true), area("Description", "Description"), file("Package file", "Package file"), sel("H5P package type", "H5P package type", ["Use uploaded package"])] },
      { title: "H5P options", fields: [chk("Allow download", "Allow download"), chk("Embed button", "Embed button"), chk("Copyright button", "Copyright button")] },
      { title: "Grade", fields: [sel("Type", "Type", ["Point", "None"]), num("Maximum grade", "Maximum grade", "100"), num("Course Mark Weight", "Course Mark Weight", "0"), sel("Grade category", "Grade category", ["Uncategorised"])] },
      ...COMMON,
    ],
  },
  imscp: {
    heading: "Adding a new IMS content package",
    sections: [
      { title: "General", fields: [text("Name", "Name", true), area("Description", "Description"), displayOnPage] },
      { title: "Content", fields: [file("Package file", "Package file", "Max 200MB")] },
      ...COMMON,
    ],
  },
  interactive: {
    heading: "Adding a new Interactive Content",
    sections: [
      { title: "General", fields: [area("Description", "Description"), displayOnPage, text("Content type search", "Content-type search")] },
      {
        title: "H5P editor",
        fields: [
          stat("types", "Content types", "Interactive Video · Multiple Choice · Quiz (Question Set) · Fill in the Blanks · Drag the Words · Drag and Drop · Image Hotspots"),
        ],
      },
      { title: "Display Options", fields: [chk("Display action bar and frame", "Display action bar and frame", true), chk("Allow download", "Allow download"), chk("Embed button", "Embed button")] },
      { title: "Grade", fields: [num("Course Mark Weight", "Course Mark Weight", "0"), sel("Grade category", "Grade category", ["Uncategorised"]), num("Maximum grade", "Maximum grade", "100")] },
      ...COMMON,
    ],
  },
  journal: {
    heading: "Adding a new Journal",
    sections: [
      { title: "General", fields: [text("Name", "Journal name", true), area("Journal question", "Journal question"), sel("Days available", "Days available", ["Always open", "7 days", "14 days", "30 days"])] },
      { title: "Grade", fields: [sel("Grade Type", "Grade Type", ["Point", "Scale", "None"]), num("Maximum grade", "Maximum grade", "100"), num("Course Mark Weight", "Course Mark Weight", "0"), sel("Grade category", "Grade category", ["Uncategorised"])] },
      ...COMMON,
    ],
  },
  label: {
    heading: "Adding a new Label",
    sections: [
      { title: "General", fields: [area("Name", "Label text", true)] },
      ...COMMON,
    ],
  },
  lesson: {
    heading: "Adding a new Lesson",
    sections: [
      { title: "General", fields: [text("Name", "Name", true), area("Description", "Description"), displayOnPage] },
      { title: "Appearance", fields: [chk("Progress bar", "Progress bar"), chk("Display menu", "Display menu"), chk("Display ongoing score", "Display ongoing score")] },
      { title: "Availability", fields: [dt("Available from", "Available from"), dt("Deadline", "Deadline")] },
      ...COMMON,
    ],
  },
  page: {
    heading: "Adding a new Page",
    sections: [
      { title: "General", fields: [text("Name", "Name", true), area("Description", "Description"), displayOnPage] },
      { title: "Content", fields: [area("Page content", "Page content", true)] },
      { title: "Appearance", fields: [chk("Display page description", "Display page description"), chk("Display last modified date", "Display last modified date", true)] },
      ...COMMON,
    ],
  },
  quiz: {
    heading: "Adding a new Quiz",
    sections: [
      { title: "General", fields: [text("Name", "Name", true), area("Description", "Description"), displayOnPage] },
      {
        title: "Timing",
        fields: [dt("Open the quiz", "Open the quiz"), dt("Close the quiz", "Close the quiz"), dt("Time limit", "Time limit"), sel("When time expires", "When time expires", ["Open attempts are submitted automatically", "There is a grace period", "Attempts must be submitted before time expires"])],
      },
      { title: "Grade", fields: [sel("Grade category", "Grade category", ["Uncategorised"]), sel("Attempts allowed", "Attempts allowed", ["Unlimited", "1", "2", "3", "4", "5"]), sel("Grading method", "Grading method", ["Highest grade", "Average grade", "First attempt", "Last attempt"])] },
      { title: "Layout", fields: [sel("New page", "New page", ["Every question", "Never, all questions on one page", "Every 5 questions"])] },
      { title: "Question behaviour", fields: [chk("Shuffle within questions", "Shuffle within questions", true), sel("How questions behave", "How questions behave", ["Deferred feedback", "Adaptive mode", "Immediate feedback", "Interactive with multiple tries"])] },
      {
        title: "Review options",
        fields: [
          {
            name: "Review options",
            label: "Review options",
            type: "matrix",
            columns: ["During the attempt", "Immediately after the attempt", "Later, while the quiz is still open", "After the quiz is closed"],
            rows: ["The attempt", "Whether correct", "Marks", "Specific feedback", "General feedback", "Right answer", "Overall feedback"],
          },
        ],
      },
      ...COMMON,
    ],
  },
  scorm: {
    heading: "Adding a new SCORM package",
    sections: [
      { title: "General", fields: [text("Name", "Name", true), area("Description", "Description"), displayOnPage] },
      { title: "Package", fields: [file("Package file", "Package file", "Max 200MB / one file"), sel("Auto-update frequency", "Auto-update frequency", ["Never", "Every day", "Every time"])] },
      { title: "Appearance", fields: [sel("Display package", "Display package", ["Current window", "New window"])] },
      { title: "Availability", fields: [dt("Available from", "Available from"), dt("Available to", "Available to")] },
      { title: "Grade", fields: [sel("Grading method", "Grading method", ["Learning objects", "Highest grade", "Average grade", "Sum"])] },
      ...COMMON,
    ],
  },
  survey: {
    heading: "Adding a new Survey",
    sections: [
      { title: "General", fields: [text("Name", "Name", true), area("Description", "Description"), displayOnPage] },
      {
        title: "Survey type",
        fields: [sel("Template", "Template", ["ATTLS", "COLLES (Preferred)", "COLLES (Actual)", "Critical incidents"])],
      },
      ...COMMON,
    ],
  },
  certificate: {
    heading: "Adding a new Certificate",
    sections: [
      { title: "General", fields: [text("Name", "Name", true), area("Description", "Description"), displayOnPage] },
      {
        title: "Issue options",
        fields: [
          sel("Delivery", "Delivery", ["Download PDF", "Email student", "View in browser"]),
          text("Required grade", "Required grade"),
        ],
      },
      ...COMMON,
    ],
  },
  turnitin: {
    heading: "Adding a new Turnitin Assignment",
    sections: [
      { title: "General", fields: [text("Name", "Assignment name", true), area("Description", "Description"), displayOnPage] },
      { title: "Availability", fields: [dt("Start date", "Start date"), dt("Due date", "Due date"), dt("Post date", "Post date")] },
      ...COMMON,
    ],
  },
  url: {
    heading: "Adding a new URL",
    sections: [
      { title: "General", fields: [text("Name", "Name", true), text("External URL", "External URL", true), stat("Choose a link", "Choose a link", "Choose a link"), area("Description", "Description"), displayOnPage] },
      { title: "Appearance", fields: [sel("Display", "Display", ["Automatic", "Embed", "Open", "In pop-up"]), chk("Display URL description", "Display URL description")] },
      { title: "URL variables", fields: [text("Parameter name", "Parameter name"), sel("Variable", "Variable", ["None", "User ID", "Course ID", "User email"])] },
      ...COMMON,
    ],
  },
  wiki: {
    heading: "Adding a new Wiki",
    sections: [
      { title: "General", fields: [text("Name", "Wiki name", true), area("Description", "Description"), displayOnPage, sel("Wiki mode", "Wiki mode", ["Collaborative wiki", "Individual wiki"]), text("First page name", "First page name", true), sel("Default format", "Default format", ["HTML", "Creole", "NWiki"]), chk("Force format", "Force format")] },
      ...COMMON,
    ],
  },
  workshop: {
    heading: "Adding a new Workshop",
    sections: [
      { title: "General", fields: [text("Name", "Workshop name", true), area("Description", "Description"), displayOnPage] },
      {
        title: "Grading settings",
        fields: [sel("Grading strategy", "Grading strategy", ["Accumulative grading", "Comments", "Number of errors", "Rubric"]), num("Grade for submission", "Grade for submission", "80"), num("Submission grade decimals", "Submission grade decimals", "0"), num("Grade for assessment", "Grade for assessment", "20"), num("Assessment grade decimals", "Assessment grade decimals", "0")],
      },
      { title: "Submission settings", fields: [area("Instructions for submission", "Instructions for submission"), num("Maximum submission attachments", "Maximum submission attachments", "1"), sel("Maximum submission attachment size", "Maximum submission attachment size", ["Site upload limit (200 MB)", "20 MB", "10 MB"])] },
      { title: "Assessment settings", fields: [area("Instructions for assessment", "Instructions for assessment")] },
      ...COMMON,
    ],
  },
};

export function formForActivity(code: string) {
  const mapped = code === "mcgrawhill" ? "externaltool" : code;
  const spec = LMS_ACTIVITY_FORMS[mapped] || {
    heading: `Adding a new ${code}`,
    sections: [{ title: "General", fields: [text("Name", "Name", true), area("Description", "Description")] }, ...COMMON],
  };
  // Every activity needs an actual learner-facing content field. Several Moodle-style
  // forms previously saved only configuration fields, so the activity opened to an
  // empty page even though the instructor had just completed and saved the form.
  if (["assignment", "book", "choice", "page"].includes(mapped)) return spec;
  const content: LmsFormSection = {
    title: "Content",
    fields: [area("Activity content", "Activity content or instructions")],
  };
  const generalIndex = spec.sections.findIndex((section) => section.title === "General");
  const insertAt = generalIndex >= 0 ? generalIndex + 1 : 0;
  return {
    ...spec,
    sections: [...spec.sections.slice(0, insertAt), content, ...spec.sections.slice(insertAt)],
  };
}
