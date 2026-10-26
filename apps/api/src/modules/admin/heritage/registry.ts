import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type RawDataPoint = { id: string; type: string; label: string; status: string; evidence: string };
export type RawScreen = {
  id: string;
  module: string;
  name: string;
  screenType: string;
  status: string;
  route: string;
  flow: string;
  condition: string;
  evidence: string;
  dataPoints: RawDataPoint[];
  openPoint: { gap: string; confirmation: string; status: string } | null;
};
export type RawSidebarEntry = { root: string; level: string; section: string; label: string; evidence: string };
export type RawRegistry = {
  source: string;
  generatedFrom: string;
  counts: Record<string, number>;
  modules: Array<{ name: string; screens: Array<{ id: string; name: string; route: string }>; dataPointCount: number }>;
  sidebar: RawSidebarEntry[];
  screens: RawScreen[];
};

export type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "money"
  | "percent"
  | "date"
  | "datetime"
  | "time"
  | "daterange"
  | "email"
  | "tel"
  | "url"
  | "password"
  | "select"
  | "multiselect"
  | "ref"
  | "checkbox"
  | "file"
  | "color"
  | "display"
  | "feature";

export type Feature = "pagination" | "perPage" | "resultsCount" | "alphabet" | "bulk" | "confirm" | "rowSelect" | "photo" | "rowAction";

export type FieldDef = {
  id: string;
  key: string;
  label: string;
  rawLabel: string;
  kind: FieldKind;
  required: boolean;
  options?: string[];
  ref?: string;
  feature?: Feature;
  partial: boolean;
};

export type ActionKind =
  | "create"
  | "submit"
  | "edit"
  | "delete"
  | "confirm"
  | "cancel"
  | "search"
  | "export"
  | "view"
  | "status"
  | "copy"
  | "upload"
  | "select"
  | "bulk"
  | "reorder"
  | "run";

export type ActionDef = { id: string; label: string; kind: ActionKind; row: boolean; status?: string };
export type ColumnDef = { id: string; key: string; label: string; feature?: Feature };

export type ScreenMode = "directory" | "form" | "settings" | "error" | "nav" | "gate";
export type ContextType = "student" | "course" | "program" | "term" | "brand" | "institution";

export type ScreenSchema = {
  id: string;
  module: string;
  name: string;
  screenType: string;
  status: string;
  partial: boolean;
  flow: string[];
  condition: string;
  evidence: string;
  openPoint: RawScreen["openPoint"];
  mode: ScreenMode;
  context: ContextType | null;
  fields: FieldDef[];
  filters: FieldDef[];
  columns: ColumnDef[];
  actions: ActionDef[];
  submitLabel: string;
  dataPointCount: number;
};

const REGISTRY_FILE = fileURLToPath(new URL("../heritage-master.json", import.meta.url));

let cached: RawRegistry | null = null;
export function rawRegistry(): RawRegistry {
  if (!cached) cached = JSON.parse(readFileSync(REGISTRY_FILE, "utf8")) as RawRegistry;
  return cached;
}

export function slug(label: string) {
  return (
    label
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "value"
  );
}

/** Government identifiers are never collected, displayed or stored (docs/CLAUDE.md). */
export const GOVERNMENT_ID = /social insurance|\bSIN\b|\bSSN\b|social security|passport (no|number|#)/i;

function cleanLabel(raw: string) {
  return raw
    .replace(/^\*\s*/, "")
    .replace(/\s*\[[^\]]*\]\s*/g, " ")
    .replace(/\s+(checkbox(es)?|toggle|dropdown|selector|field|switch)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

const REFS: Array<[RegExp, string]> = [
  [/time ?zone/, "timezones"],
  [/currenc/, "currencies"],
  [/language/, "languages"],
  [/payment method/, "paymentMethods"],
  [/(ledger|tuition|fee) type/, "ledgerTypes"],
  [/tax (rate|code)|\btax\b(?!.*(year|form|document))/, "taxRates"],
  [/program type/, "programTypes"],
  [/course categor/, "courseCategories"],
  [/course type/, "courseTypes"],
  [/course group/, "courseGroups"],
  [/reason/, "reasonCodes"],
  [/grading scheme/, "gradingSchemes"],
  [/access level|profile type/, "accessLevels"],
  [/funding source|fund source/, "fundingSources"],
  [/disbursement type/, "disbursementTypes"],
  [/rate categor/, "rateCategories"],
  [/assessment categor/, "assessmentCategories"],
  [/classroom type|room type/, "classroomTypes"],
  [/classroom|\broom\b/, "classrooms"],
  [/document template|\btemplate\b/, "templates"],
  [/brand/, "brands"],
  [/campus/, "campuses"],
  [/region/, "regions"],
  [/province|\bstate\b(?!ment)/, "provinces"],
  [/country|nationality/, "countries"],
  [/pathway/, "pathways"],
  [/workshop/, "workshops"],
  [/(admission|program|academic|start|intake|enrolment) term|\bterm\b/, "terms"],
  [/program(me)? of study|\bprogram\b(?! (type|term|settings))/, "programs"],
  [/faculty\b(?! (member|profile))/, "faculties"],
  [/\b(course )?(section|offering|session)s?\b(?! (type|date|time|length))/, "sections"],
  [/\bcourse\b(?! (type|categor|group|code|name|title|description|fee|file))/, "courses"],
  [/^student\b(?! (status|number|#|list|portal))|\bstudent\b(?! (status|number|#|list|portal|self|active|standing|plan|records|:))/, "students"],
  [/\bagent\b/, "agents"],
  [/advisor|instructor|teacher|staff|assignee|\buser\b|faculty member|moderator|editor/, "staff"],
  [/competenc/, "competencies"],
  [/\bbadge/, "badges"],
  [/student status|\bstatus\b/, "statuses"],
];

function refFor(lower: string): string | undefined {
  for (const [re, ref] of REFS) if (re.test(lower)) return ref;
  return undefined;
}

export function classifyField(id: string, raw: string, partial: boolean, asFilter = false): Omit<FieldDef, "key"> {
  const required = /^\*/.test(raw.trim());
  const optMatch = raw.match(/\[([^\]]+)\]/);
  const label = cleanLabel(raw) || raw;
  const lower = raw.toLowerCase();
  const base = { id, label, rawLabel: raw, required, partial };

  if (/^results?( count)?$|^results per page$|^page( selector| number)?$|^pagination/.test(lower))
    return { ...base, kind: "feature", feature: lower.includes("per page") ? "perPage" : lower.startsWith("result") ? "resultsCount" : "pagination" };
  if (/alphabet (filter|selector|index)/.test(lower)) return { ...base, kind: "feature", feature: "alphabet" };
  if (/with checked|bulk action/.test(lower)) return { ...base, kind: "feature", feature: "bulk" };
  if (/(delete|removal|remove|restore|release|cancel) confirmation|^confirmation( modal| dialog| prompt)?$/.test(lower))
    return { ...base, kind: "feature", feature: "confirm" };
  if (/^row (checkbox|select)/.test(lower)) return { ...base, kind: "feature", feature: "rowSelect" };

  if (optMatch) {
    const options = optMatch[1]
      .split(/\s*[,;]\s*/)
      .map((o) => o.trim())
      .filter(Boolean);
    const multi = /checkboxes|multi|days|weekdays/.test(lower);
    return { ...base, kind: multi ? "multiselect" : "select", options };
  }

  if (/\((no editable|read[- ]only|display only|not editable)|^(displayed|read-only)\b|\b(history|log|preview|summary list|records? list|unavailable|empty state|error message)\b|\b(icon|breadcrumb|sidebar|expand \/ collapse)\b|\btab$|\blinks?$|\barea\b|columns$|validation|^notice|warning$|appear after|^footer version|^log out$|counts?$|totals$|# \/ date \/ status/.test(lower) && !asFilter)
    return { ...base, kind: "display" };

  if (asFilter && /date range|period|from \/ to|between/.test(lower)) return { ...base, kind: "daterange" };
  if (asFilter && /^(text filter|search|keyword|name|student # or last name|filter)$/.test(lower)) return { ...base, kind: "text" };

  if (/^active ?\/ ?inactive$|^active$|^inactive$|^resolved$/.test(lower)) return { ...base, kind: "select", options: ["Active", "Inactive"] };
  if (/domestic ?\/ ?international/.test(lower)) return { ...base, kind: "select", options: ["Domestic", "International"] };
  if (/^gender$/.test(label.toLowerCase())) return { ...base, kind: "select", options: ["Male", "Female", "Other"] };
  if (/permission row|permission modes/.test(lower))
    return { ...base, kind: "select", options: ["Override", "Full Access", "Read Only", "No Access", "Customize"] };
  if (/weekdays?|weekly schedule checkboxes|sunday-saturday/.test(lower))
    return { ...base, kind: "multiselect", options: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] };
  if (/checkboxes|multi-select|dual lists|selected .* list|available .* list|^(campuses|programs|courses|statuses|terms|student statuses|assign to (programs|courses)|specify programs)$/.test(lower)) {
    const ref = refFor(lower.replace(/statuses/, "status").replace(/campuses/, "campus").replace(/programs/, "program").replace(/courses/, "course").replace(/terms/, "term").replace(/tax rates/, "tax rate"));
    return { ...base, kind: "multiselect", ...(ref ? { ref } : { ref: `options:${slug(label)}` }) };
  }
  if (/^allow .* (from|until|to)$|^posts (from|to) date/.test(lower)) return { ...base, kind: "datetime" };

  if (/checkbox|toggle|switch|acknowledg|yes ?\/ ?no|\benabled?\b$/.test(lower)) return { ...base, kind: "checkbox" };
  if (
    /^(show|hide|disable|enable|allow|require|include|exclude|send|notify|apply hold|is|use|force|prevent|restrict|permit|lock|auto-?(assign|collection|create|continue|commit|apply)|automatically|wait for|the session may|combine|display|always|remove html|visible to|default)\b/.test(lower) &&
    !/\b(name|title|message|text|label|template|url|address|frequency|status|based on|method|type|format|code|colou?r|amount|rate|agency|form|access|password|grouping|order|number|date|time|days)\b/.test(lower.replace(/^(show|hide|display|include) /, "")) &&
    !/^required\b|^requirement/.test(lower)
  )
    return { ...base, kind: "checkbox" };
  if (/^(show|hide) /.test(lower)) return { ...base, kind: "checkbox" };
  if (/colou?r/.test(lower)) return { ...base, kind: "color" };
  if (/(upload|attachment|\bimage\b|\blogo\b|\bphoto\b|picture|avatar|banner|choose file|\bfile\b(?! (type|naming|name|format|size|retention))(?!-type))/.test(lower) && !/retention|course files|bulk exports|allowed|types?\b|max(imum)? (file|upload)|size/.test(lower))
    return { ...base, kind: "file" };
  if (/(password|secret|api key|access key|\btoken\b)/.test(lower) && !/(length|attempts|days|expir|history|polic|recovery|reset|minimum|maximum|complexity|requires?|lockout)/.test(lower))
    return { ...base, kind: "password" };
  if (/date ?\/ ?time|datetime|timestamp|date and time/.test(lower)) return { ...base, kind: "datetime" };
  if (/\btimes?\b/.test(lower) && !/time ?zone|timeframe|full-time|part-time|times? (limit|out)|real[- ]time|first time|time-zone|times? allowed|attempt/.test(lower))
    return { ...base, kind: "time" };
  if (/\b(date|dob|birth|expiry|expires|expiration|deadline|due|effective|starts? on|ends? on|issued|start date|end date)\b/.test(lower) && !/filter|format|setting|range|\bdays\b|visibility|display|show|leeway|type|action|calculation|controls|timing|selectors?|variants|context|unit|calendar|from number|value/.test(lower))
    return { ...base, kind: asFilter && /range/.test(lower) ? "daterange" : "date" };
  if (/(^|\s)e-?mail( address)?$|e-?mail address|^e-?mail\b(?!.*(setting|template|relay|service|configuration|messaging|change|notification|merge|system|forward|filter|department))|sender (address|e-?mail)|reply-to/.test(lower))
    return { ...base, kind: "email" };
  if (/\b(phone|fax|mobile|cell)\b/.test(lower) && !/type|provider|authentication|app\b/.test(lower)) return { ...base, kind: "tel" };
  if (/\burl\b|website|web address|\blink\b(?! (type|text))|endpoint/.test(lower)) return { ...base, kind: "url" };
  if (/%|percent/.test(lower)) return { ...base, kind: "percent" };
  if (
    /\b(amount|fees?|price|cost|tuition|balance|charge|bonus|deposit|salary|rate|value|interest|payment|penalty|refund|credit amount|commission|total|subtotal|earnings|compensation)\b/.test(lower) &&
    !/(type|status|categor|method|name|code|template|description|note|trigger|ledger|plan\b|schedule|frequency|source|condition|calculation|allocation|title|option|setting|notes|reason|statement|date|term|rule|mode|order|per page|currency|class|tier|test|profile|visibility|account|eligib|item|list|level|basis|hours|credits|length|original|updated|count)/.test(
      lower,
    )
  )
    return { ...base, kind: "money" };
  if (/\bunit$/.test(lower) && /length|duration|enrol|course|time|term/.test(lower))
    return { ...base, kind: "select", options: ["Hours", "Days", "Weeks", "Months", "Years", "Terms", "Courses", "Credits"] };
  if (
    /\b(days?|weeks?|months?|years?|hours?|minutes?|count|quantity|qty|capacity|credits?|gpa|limit|number of|max(imum)?|min(imum)?|threshold|weight|weighting|sequence|attempts|length|duration|seats|score|marks?|points|decimals?|interval|leeway|instal?lments?|retention|age|precision|occurrences|grace)\b/.test(
      lower,
    ) &&
    !/(phone|id number|student number|type|name|status|note|text|format|label|description|message|title|filter|code|category|method|setting|display|show|rule|mode|scheme|calculation|policy|visibility|item|option|template|source|reason|list|date|time)/.test(
      lower,
    )
  )
    return { ...base, kind: "number" };
  if (
    /(description|message|\bbody\b|\bnotes?\b|comment|biography|statement|instructions?|summary|details|content|\btext\b|explanation|outline|criteria|feedback|signature|agreement content|terms and|disclaimer|footer|header text|bio\b|purpose|remarks|academic history|background|experience|organizations|office hours|general information|introduction|welcome)/.test(
      lower,
    ) &&
    !/(type|status|setting|visibility|format|categor|date|filter|title|name|level|ordering|order|selector|count|area|mode|boundaries)\b/.test(lower)
  )
    return { ...base, kind: "textarea" };

  if (!asFilter && /\b(name|abbreviation|description|title|label|code|number|#|prefix|login)\b/.test(lower) && !/selector|selection/.test(lower))
    return { ...base, kind: "text" };
  const ref = refFor(lower);
  if (ref) return { ...base, kind: "ref", ref };
  if (/\b(type|category|method|mode|level|format|scope|visibility|availability|frequency|role|classification|state|condition|basis|calculation|trigger|operation|outcome|result|grade|layout|position|placement|priority|direction)\b/.test(lower))
    return { ...base, kind: "ref", ref: `options:${slug(label)}` };
  return { ...base, kind: "text" };
}

export function classifyAction(id: string, raw: string): ActionDef {
  const label = raw.replace(/\s+/g, " ").trim();
  const l = label.toLowerCase();
  const mk = (kind: ActionKind, row = false, status?: string): ActionDef => ({ id, label, kind, row, ...(status ? { status } : {}) });
  if (/^(save|update|submit|post|apply payment|save and|ok$|done$|finish|bulk save)/.test(l)) return mk("submit");
  if (/^confirm|^yes\b/.test(l)) return mk("confirm");
  if (/^(cancel|close|discard|no\b|dismiss)/.test(l)) return mk("cancel");
  if (/\b(delete|remove|archive)\b/.test(l)) return mk("delete", !/role assignment|restriction|row$|item$|condition$/.test(l));
  if (/^(search|find|show |filter|go$|apply filter|refresh|load|look ?up)/.test(l)) return mk("search");
  if (/export|download|print|\bcsv\b|\bpdf\b|retrieve document/.test(l)) return mk("export", /receipt|retrieve/.test(l));
  if (/^(copy|duplicate|clone)/.test(l)) return mk("copy", true);
  if (/^(approve|accept)/.test(l)) return mk("status", true, "Approved");
  if (/^(decline|reject|deny)/.test(l)) return mk("status", true, "Declined");
  if (/^restore/.test(l)) return mk("status", true, "Restored");
  if (/^release/.test(l)) return mk("status", true, "Released");
  if (/^(activate|enable)/.test(l)) return mk("status", true, "Active");
  if (/^(deactivate|disable|suspend)/.test(l)) return mk("status", true, "Inactive");
  if (/^(issue refund|refund)/.test(l)) return mk("run", true);
  if (/^(edit|modify|change|manage|pencil|update )/.test(l)) return mk("edit", !/mode$|status$|time zone/.test(l));
  if (/^(view|open|review|inspect|preview|receipt|details|notes|compare|see )/.test(l)) return mk("view", true);
  if (/choose file|^upload|^browse|^attach|select file|^record\b/.test(l)) return mk("upload");
  if (/bulk|with checked|select rows|select all/.test(l)) return mk("bulk");
  if (/reorder|^move|^sort|drag/.test(l)) return mk("reorder", true);
  if (/^(add|create|new|\+|insert)/.test(l)) return mk("create");
  if (/^(select|choose|pick)/.test(l)) return mk("select");
  return mk("run");
}

const SETTINGS_RE = /settings|polic|multi-factor|time zone|presentation|global configuration|general settings|accessibility/i;
const CONTEXT: Array<[RegExp, ContextType]> = [
  [/^S(0[3-9]|1\d|2[0-2])$|^SF\d\d$/, "student"],
  [/^C0[3-7]$|^LM\d\d$|^A\d\d$/, "course"],
  [/^PR(0[3-9]|1[0-2])$/, "program"],
  [/^PR15$/, "term"],
  [/^L0[2-7]$/, "brand"],
  [/^L1[6-9]$/, "institution"],
];

function uniqueKey(seen: Set<string>, label: string) {
  let key = slug(label);
  if (!seen.has(key)) {
    seen.add(key);
    return key;
  }
  let n = 2;
  while (seen.has(`${key}_${n}`)) n++;
  key = `${key}_${n}`;
  seen.add(key);
  return key;
}

function matchKey(label: string, fields: FieldDef[]) {
  const s = slug(cleanLabel(label));
  const exact = fields.find((f) => f.key === s || slug(f.label) === s);
  if (exact) return exact.key;
  const contains = fields.find((f) => f.kind !== "feature" && (slug(f.label).includes(s) || s.includes(slug(f.label))) && s.length > 2);
  return contains?.key;
}

const ENTITY_REFS = new Set(["students", "staff", "courses", "sections", "programs", "workshops", "faculties", "agents", "brands", "campuses", "classrooms"]);

/** Settings screens hold policies, not entity links; option sets the sheet does not list stay free text with suggestions. */
function refineSetting(f: FieldDef): FieldDef {
  if (f.kind === "feature" || f.kind === "display") return f;
  const lower = f.rawLabel.toLowerCase();
  const base = { ...f, options: undefined, ref: undefined };
  if (/visibility: student \/ staff|: student \/ staff$/.test(lower)) return { ...base, kind: "multiselect", options: ["Student", "Staff"] };
  if (/\brequired$|^enforce\b|enabled for|matching$|registration$|authentication$|\bshow\b|filters?$|opt-in\/out|captcha|tracking|^truncate\b/.test(lower))
    return { ...base, kind: "checkbox" };
  if (/expiry|recycling|rate limit|length$|leeway|\bdays?$|minutes$|threshold|maximum|minimum|lockout/.test(lower)) return { ...base, kind: "number" };
  if (f.kind === "money" && !/fee|amount|commission|price|cost/.test(lower))
    return /total|limit|value|weight/.test(lower) ? { ...base, kind: "number" } : { ...base, kind: "ref", ref: "settingValues" };
  if (f.kind === "ref" && (ENTITY_REFS.has(f.ref ?? "") || f.ref?.startsWith("options:"))) return { ...base, kind: "ref", ref: "settingValues" };
  if (f.kind === "password" && !/default user password/.test(lower)) return { ...base, kind: "ref", ref: "settingValues" };
  if (f.kind === "file" && !/image|logo|photo|picture/.test(lower)) return { ...base, kind: "ref", ref: "settingValues" };
  if (f.kind === "text" && !/name|prefix|numbering|handle|e-mail|id number|tags|grouping/.test(lower)) return { ...base, kind: "ref", ref: "settingValues" };
  return f;
}

const FIELD_OVERRIDES: Record<string, Partial<FieldDef>> = {
  "P12-FLD01": { kind: "display" },
  "P12-FLD02": { kind: "ref", ref: "timezones", required: true },
  "S02-FLD22": { kind: "select", options: ["In-person", "Blended", "Online"] },
  "SC25-FLD11": { kind: "checkbox" },
  "SC25-FLD12": { kind: "checkbox" },
  "SC25-FLD13": { kind: "checkbox" },
  "SC25-FLD14": { kind: "checkbox" },
  "SC25-FLD15": { kind: "select", options: ["E-mail", "Security questions", "E-mail and security questions"] },
  "SC26-FLD01": { kind: "checkbox" },
  "SC26-FLD05": { kind: "select", options: ["Every login", "New device only", "Daily", "Weekly", "Monthly"] },
  "SC26-FLD08": { kind: "text" },
  "L06-FLD03": { kind: "select", options: ["Bottom right", "Bottom left", "Top right", "Top left"] },
  "L06-FLD04": { kind: "select", options: ["Small", "Medium", "Large"] },
  "LM13-FLD03": { kind: "select", options: ["Show", "Hide"] },
  "LM13-FLD06": { kind: "checkbox" },
  "LM13-FLD09": { kind: "select", options: ["HTML format", "Moodle auto-format", "Plain text format", "Markdown format"] },
  "LM13-FLD11": { kind: "select", options: ["Custom sections", "Weekly sections", "Single activity", "Social"] },
  "LM13-FLD12": { kind: "select", options: ["Hidden sections are shown as not available", "Hidden sections are completely invisible"] },
  "LM13-FLD13": { kind: "select", options: ["Show all sections on one page", "Show one section per page"] },
  "LM13-FLD21": { kind: "select", options: ["No groups", "Separate groups", "Visible groups"] },
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`LM13-FLD${24 + i}`, { kind: "text" as const }])),
};

function applyOverride(f: FieldDef): FieldDef {
  const o = FIELD_OVERRIDES[f.id];
  return o ? { ...f, options: undefined, ref: undefined, ...o } : f;
}

export function buildSchema(screen: RawScreen): ScreenSchema {
  const partial = screen.status !== "Readable fields";
  const seen = new Set<string>();
  const fields: FieldDef[] = [];
  const filters: FieldDef[] = [];
  const columns: ColumnDef[] = [];
  const actions: ActionDef[] = [];

  for (const dp of screen.dataPoints) {
    if (GOVERNMENT_ID.test(dp.label)) continue;
    const dpPartial = dp.status !== "Readable fields";
    if (dp.type.startsWith("Field")) {
      const def = classifyField(dp.id, dp.label, dpPartial);
      fields.push({ ...def, key: def.kind === "feature" ? `_${def.feature}_${dp.id}` : uniqueKey(seen, def.label) });
    } else if (dp.type === "Filter") {
      const def = classifyField(dp.id, dp.label, dpPartial, true);
      filters.push({ ...def, key: "" });
    } else if (dp.type === "Table column") {
      const rawLower = dp.label.toLowerCase().trim();
      columns.push({
        id: dp.id,
        key: "",
        label: cleanLabel(dp.label) || dp.label,
        ...(/^row (checkbox|select)|^select$|^checkbox$/.test(rawLower) ? { feature: "rowSelect" as const } : {}),
      });
    } else {
      actions.push(classifyAction(dp.id, dp.label));
    }
  }

  const colSeen = new Set<string>();
  for (const col of columns) {
    const l = col.label.toLowerCase();
    if (col.feature) {
      /* already classified from the raw label */
    } else if (/^(photo|image|avatar|picture)$/.test(l)) col.feature = "photo";
    else if (/^(view|edit|delete|remove|actions?|manage|receipt|options|open|tools|push|results|grades|attendance)$/.test(l)) col.feature = "rowAction";
    const key = col.feature ? `_${col.feature}_${col.id}` : matchKey(col.label, fields) ?? slug(col.label);
    col.key = colSeen.has(key) ? `${key}_${col.id.toLowerCase()}` : key;
    colSeen.add(col.key);
  }
  for (const f of filters) {
    if (f.kind === "feature") {
      f.key = `_${f.feature}_${f.id}`;
      continue;
    }
    const target = matchKey(f.label, fields) ?? columns.find((c) => !c.feature && slug(c.label) === slug(f.label))?.key;
    f.key = target ?? `f_${slug(f.label)}`;
  }

  let mode: ScreenMode;
  const st = screen.screenType.toLowerCase();
  const dataColumns = columns.filter((c) => !c.feature);
  if (st.includes("error")) mode = "error";
  else if (st.includes("navigation entry")) mode = "nav";
  else if (st.includes("authentication gate")) mode = "gate";
  else if (
    !dataColumns.length &&
    SETTINGS_RE.test(screen.name) &&
    !/list|directory|add |create|management/i.test(screen.name) &&
    !actions.some((a) => a.kind === "create" || a.kind === "delete" || (a.kind === "edit" && a.row))
  )
    mode = "settings";
  else if (dataColumns.length || filters.length || /directory|list|queue|search|records|log|history|results/i.test(screen.name)) mode = "directory";
  else mode = "form";

  for (let i = 0; i < fields.length; i++) fields[i] = applyOverride(mode === "settings" ? refineSetting(fields[i]) : fields[i]);

  const submit = actions.find((a) => a.kind === "submit") ?? [...actions].reverse().find((a) => a.kind === "create" || a.kind === "run");
  const context = CONTEXT.find(([re]) => re.test(screen.id))?.[1] ?? null;

  return {
    id: screen.id,
    module: screen.module,
    name: screen.name,
    screenType: screen.screenType,
    status: screen.status,
    partial,
    flow: screen.flow
      .split(/\s*→\s*/)
      .map((s) => s.replace(/\.$/, "").trim())
      .filter(Boolean),
    condition: screen.condition,
    evidence: screen.evidence,
    openPoint: screen.openPoint,
    mode,
    context,
    fields,
    filters,
    columns,
    actions,
    submitLabel: submit?.label ?? "Save",
    dataPointCount: screen.dataPoints.length,
  };
}

let schemas: Map<string, ScreenSchema> | null = null;
export function screenSchemas(): Map<string, ScreenSchema> {
  if (!schemas) {
    const built = new Map<string, ScreenSchema>();
    for (const s of rawRegistry().screens) built.set(s.id.toUpperCase(), buildSchema(s));
    schemas = built;
  }
  return schemas;
}

export function screenSchema(id: string): ScreenSchema | undefined {
  return screenSchemas().get(id.toUpperCase());
}
