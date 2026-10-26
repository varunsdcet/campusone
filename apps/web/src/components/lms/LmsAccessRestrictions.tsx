"use client";

import { useEffect, useMemo } from "react";

export const LMS_ACCESS_RESTRICTIONS_KEY = "Access restrictions";

type Rule =
  | { type: "date"; operator: "from" | "until"; value: string }
  | { type: "student"; studentIds: string[] }
  | { type: "group"; groupIds: string[] };

type Restrictions = { match: "all" | "any"; rules: Rule[] };

type Student = { studentId?: string; name: string; studentNumber: string; email?: string };
type Group = { id: string; name: string; members: Array<{ id: string; name: string }> };

function parse(value: string): { restrictions: Restrictions; malformed: boolean } {
  if (!value.trim()) return { restrictions: { match: "all", rules: [] }, malformed: false };
  try {
    const parsed = JSON.parse(value) as Restrictions;
    const rulesAreValid =
      Array.isArray(parsed.rules) &&
      parsed.rules.every((rule) => {
        if (!rule || typeof rule !== "object") return false;
        if (rule.type === "date") return (rule.operator === "from" || rule.operator === "until") && typeof rule.value === "string";
        if (rule.type === "student") return Array.isArray(rule.studentIds) && rule.studentIds.every((id) => typeof id === "string");
        if (rule.type === "group") return Array.isArray(rule.groupIds) && rule.groupIds.every((id) => typeof id === "string");
        return false;
      });
    if ((parsed.match === "all" || parsed.match === "any") && rulesAreValid) {
      return { restrictions: parsed, malformed: false };
    }
  } catch {
    // The server fails closed for malformed legacy data. The editor exposes an explicit reset.
  }
  return { restrictions: { match: "all", rules: [] }, malformed: true };
}

function localDate(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function emit(next: Restrictions, onChange: (value: string) => void) {
  onChange(next.rules.length ? JSON.stringify(next) : "");
}

function validationMessage(restrictions: Restrictions, malformed: boolean) {
  if (malformed) return "The saved restriction data is invalid. Clear it before saving this content.";
  const invalidIndex = restrictions.rules.findIndex((rule) => {
    if (rule.type === "date") return Number.isNaN(new Date(rule.value).getTime());
    if (rule.type === "student") return rule.studentIds.length === 0;
    return rule.groupIds.length === 0;
  });
  if (invalidIndex < 0) return "";
  const rule = restrictions.rules[invalidIndex];
  if (rule.type === "date") return `Choose a valid date and time for rule ${invalidIndex + 1}.`;
  if (rule.type === "student") return `Select at least one student for rule ${invalidIndex + 1}.`;
  return `Select at least one course group for rule ${invalidIndex + 1}.`;
}

export function LmsAccessRestrictionsEditor({
  value,
  roster = [],
  groups = [],
  onChange,
  onValidityChange,
}: {
  value: string;
  roster?: Student[];
  groups?: Group[];
  onChange: (value: string) => void;
  onValidityChange?: (valid: boolean) => void;
}) {
  const parsed = useMemo(() => parse(value), [value]);
  const restrictions = parsed.restrictions;
  const issue = validationMessage(restrictions, parsed.malformed);
  const students = roster.filter((s): s is Student & { studentId: string } => Boolean(s.studentId));

  useEffect(() => {
    onValidityChange?.(!issue);
  }, [issue, onValidityChange]);

  function update(index: number, rule: Rule) {
    const rules = restrictions.rules.map((item, i) => (i === index ? rule : item));
    emit({ ...restrictions, rules }, onChange);
  }

  function add(kind: Rule["type"]) {
    const rule: Rule =
      kind === "student"
        ? { type: "student", studentIds: students[0]?.studentId ? [students[0].studentId] : [] }
        : kind === "group"
          ? { type: "group", groupIds: groups[0]?.id ? [groups[0].id] : [] }
          : { type: "date", operator: "from", value: new Date().toISOString() };
    emit({ ...restrictions, rules: [...restrictions.rules, rule] }, onChange);
  }

  const ruleDescription =
    restrictions.rules.length < 2
      ? "The content opens only when this condition is met."
      : restrictions.match === "all"
        ? "The content opens only when every condition below is met."
        : "The content opens when at least one condition below is met.";

  return (
    <div className="mh-lms-access">
      <div className="mh-lms-access__intro">
        <div>
          <strong>Access conditions</strong>
          <p>{ruleDescription}</p>
        </div>
        <span className={`mh-lms-access__status${restrictions.rules.length ? " is-restricted" : ""}`}>
          {restrictions.rules.length ? `${restrictions.rules.length} active` : "Open to everyone"}
        </span>
      </div>
      {parsed.malformed ? (
        <div className="mh-lms-access__alert" role="alert">
          <span>The previously saved restriction cannot be read. Students remain blocked until it is corrected.</span>
          <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => onChange("")}>
            Clear invalid restriction
          </button>
        </div>
      ) : null}
      {restrictions.rules.length > 1 ? (
        <label className="mh-lms-access__match">
          <span>To open this content, a student must meet</span>
          <select
            className="mh-teacher-field"
            value={restrictions.match}
            onChange={(e) => emit({ ...restrictions, match: e.target.value === "any" ? "any" : "all" }, onChange)}
          >
            <option value="all">all conditions</option>
            <option value="any">any condition</option>
          </select>
        </label>
      ) : null}
      <div className="mh-lms-access__rules">
        {restrictions.rules.map((rule, index) => (
          <article key={`${rule.type}-${index}`} className="mh-lms-access__rule">
            <div className="mh-lms-access__rule-head">
              <div>
                <span>Rule {index + 1}</span>
                <strong>{rule.type === "date" ? "Date and time" : rule.type === "student" ? "Specific students" : "Course groups"}</strong>
              </div>
              <button
                type="button"
                className="mh-lms-access__remove"
                onClick={() => emit({ ...restrictions, rules: restrictions.rules.filter((_, i) => i !== index) }, onChange)}
                aria-label={`Remove restriction ${index + 1}`}
              >
                Remove
              </button>
            </div>
            {rule.type === "date" ? (
              <div className="mh-lms-access__date">
                <label>
                  <span>Allow access</span>
                  <select className="mh-teacher-field" value={rule.operator} onChange={(e) => update(index, { ...rule, operator: e.target.value === "until" ? "until" : "from" })}>
                    <option value="from">From date/time</option>
                    <option value="until">Until date/time</option>
                  </select>
                </label>
                <label>
                  <span>Date and time</span>
                  <input
                    type="datetime-local"
                    className="mh-teacher-field"
                    value={localDate(rule.value)}
                    onChange={(e) => update(index, { ...rule, value: e.target.value ? new Date(e.target.value).toISOString() : "" })}
                  />
                </label>
              </div>
            ) : rule.type === "student" ? (
              students.length ? (
                <div className="mh-lms-access__choices">
                  <p>{rule.studentIds.length} of {students.length} students selected</p>
                  <div className="mh-lms-access__choice-list">
                    {students.map((student) => (
                      <label key={student.studentId} className="mh-lms-check">
                        <input
                          type="checkbox"
                          checked={rule.studentIds.includes(student.studentId)}
                          onChange={(e) =>
                            update(index, {
                              ...rule,
                              studentIds: e.target.checked
                                ? [...new Set([...rule.studentIds, student.studentId])]
                                : rule.studentIds.filter((id) => id !== student.studentId),
                            })
                          }
                        />
                        <span><strong>{student.name}</strong><small>{student.studentNumber || student.email}</small></span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mh-lms-qform__error">No enrolled students are available.</p>
              )
            ) : groups.length ? (
              <div className="mh-lms-access__choices">
                <p>{rule.groupIds.length} of {groups.length} groups selected</p>
                <div className="mh-lms-access__choice-list">
                  {groups.map((group) => (
                    <label key={group.id} className="mh-lms-check">
                      <input
                        type="checkbox"
                        checked={rule.groupIds.includes(group.id)}
                        onChange={(e) =>
                          update(index, {
                            ...rule,
                            groupIds: e.target.checked ? [...new Set([...rule.groupIds, group.id])] : rule.groupIds.filter((id) => id !== group.id),
                          })
                        }
                      />
                      <span><strong>{group.name}</strong><small>{group.members.length} member(s)</small></span>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mh-lms-qform__error">Create a course group first, then add this restriction.</p>
            )}
          </article>
        ))}
      </div>
      {issue && !parsed.malformed ? <p className="mh-lms-access__error" role="alert">{issue}</p> : null}
      <div className="mh-lms-access__add">
        <div>
          <strong>Add a condition</strong>
          <p>Choose what must be true before the content becomes available.</p>
        </div>
        <div className="mh-lms-access__add-actions">
          <button type="button" onClick={() => add("date")}><span aria-hidden="true">◷</span>Date &amp; time</button>
          <button type="button" onClick={() => add("student")} disabled={students.length === 0} title={students.length ? undefined : "No enrolled students available"}>
            <span aria-hidden="true">♙</span>Specific students
          </button>
          <button type="button" onClick={() => add("group")} disabled={groups.length === 0} title={groups.length ? undefined : "Create a course group first"}>
            <span aria-hidden="true">♙♙</span>Course group
          </button>
        </div>
      </div>
      <p className="mh-lms-access__note">Changes take effect after you save this section or activity.</p>
    </div>
  );
}
