"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { AddActivityChooser } from "@/components/AddActivityChooser";
import { CourseAiBuilderDialog } from "@/components/ai-draft/CourseAiBuilderDialog";
import { CourseAiDraftDialog } from "@/components/ai-draft/CourseAiDraftDialog";
import { LmsAddForm } from "@/components/lms/LmsAddForm";
import { LMS_ACCESS_RESTRICTIONS_KEY } from "@/components/lms/LmsAccessRestrictions";
import {
  ActionMenu,
  ActivityCompetenciesPanel,
  AddGradeItemPanel,
  AttendancePanel,
  ActivityReportPanel,
  ClassListPanel,
  CompetencyBreakdownPanel,
  CourseParticipationPanel,
  CreateGroupForm,
  EditSectionPanel,
  FiltersPanel,
  GradesBoard,
  GroupsExtras,
  LogsPanel,
  PageEditPanel,
  PermissionsPanel,
  PostMarksModal,
  QuestionHistory,
  QuestionPreview,
  QuestionTagsModal,
  ReportNav,
  ResourceView,
  SettingsPanel,
} from "@/components/lms/LmsScreens";
import { decorateLmsActivityTypes } from "@/lib/lmsActivityTypes";
import type { CourseLmsMoreId, CourseLmsQuestion, CourseLmsState, TeacherScreenConfig } from "@/lib/teacherCatalog";
import { useOptionalTeacherLive } from "@/lib/useTeacherSisLive";

const LMS_TABS = ["Course", "Class List", "Attendance", "Grades", "Badges", "More"] as const;
const QUESTION_TYPES = [
  { label: "Multiple choice", help: "Choose one correct answer from a list of options." },
  { label: "True/False", help: "A simple statement that is either true or false." },
  { label: "Short answer", help: "A one-word or short phrase answer, graded against a model response." },
  { label: "Numerical", help: "A numerical answer, with optional units and tolerance." },
  { label: "Calculated", help: "A calculated question using wildcards in a formula." },
  { label: "Essay", help: "A longer written response that is graded manually." },
  { label: "Matching", help: "Match each prompt with the correct response from a list." },
  { label: "Random short-answer matching", help: "Matching drawn from short-answer questions in a category." },
  { label: "Embedded answers (Cloze)", help: "A passage of text with missing words filled in." },
  { label: "Calculated multichoice", help: "Multiple choice where answers are calculated from a formula." },
  { label: "Drag and drop into text", help: "Missing words are dragged into gaps in the text." },
] as const;

type LmsNav = {
  tab?: string;
  more?: string | null;
  action?: string | null;
  qtype?: string | null;
  qid?: string | null;
  aid?: string | null;
  atype?: string | null;
  topic?: string | null;
  sid?: string | null;
};
type Props = { config: TeacherScreenConfig };

function lmsHref(searchParams: URLSearchParams, next: LmsNav) {
  const params = new URLSearchParams(searchParams.toString());
  if (next.tab) params.set("tab", next.tab);
  if (next.more) params.set("more", next.more);
  else if (next.more === null) params.delete("more");
  if (next.action) params.set("action", next.action);
  else if (next.action === null) {
    params.delete("action");
    params.delete("qtype");
    params.delete("qid");
    params.delete("aid");
    params.delete("atype");
    params.delete("topic");
    params.delete("sid");
  }
  if (next.qtype) params.set("qtype", next.qtype);
  else if (next.qtype === null) params.delete("qtype");
  if (next.qid) params.set("qid", next.qid);
  else if (next.qid === null) params.delete("qid");
  if (next.aid) params.set("aid", next.aid);
  else if (next.aid === null) params.delete("aid");
  if (next.atype) params.set("atype", next.atype);
  else if (next.atype === null) params.delete("atype");
  if (next.topic) params.set("topic", next.topic);
  else if (next.topic === null) params.delete("topic");
  if (next.sid) params.set("sid", next.sid);
  else if (next.sid === null) params.delete("sid");
  if (next.tab && next.tab !== "More") {
    params.delete("more");
    if (next.tab !== "Badges" && next.tab !== "Grades" && next.tab !== "Course") {
      params.delete("action");
      params.delete("qtype");
      params.delete("qid");
      params.delete("aid");
      params.delete("atype");
      params.delete("topic");
      params.delete("sid");
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function RequiredMark() {
  return (
    <span className="mh-lms-required" title="Required">
      !
    </span>
  );
}

function HelpIcon({ text }: { text: string }) {
  return (
    <span className="mh-lms-help" title={text} aria-label={text}>
      ?
    </span>
  );
}

function acswFallbackTopics(): CourseLmsState["topics"] {
  const desc =
    "Social Service Work Fundamentals introduces the values, ethics, and core practices of social service work in community settings. Students examine the history of the profession, fields of practice, and the helping relationship, with emphasis on client-centred, trauma-informed, and culturally responsive work.";
  const objectives =
    "By the end of this course, learners will be able to: (1) describe the origins and current scope of social service work; (2) apply ethical decision-making to intake and case recording; (3) identify community resources across diverse populations; and (4) demonstrate professional communication in classroom and practicum-style scenarios.";
  const page = (name: string, body?: string) => ({
    id: `act-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    type: "PAGE",
    name,
    body,
    modified: "Monday, 2 March 2026, 2:13 PM",
  });
  const quiz = (n: string) => ({ id: `act-chapter-${n}-quiz`, type: "QUIZ", name: `Chapter ${n} Quiz` });
  return [
    {
      id: "topic-resources",
      title: "Resources",
      activities: [
        page("Brief Course Description", desc),
        page("Learning Objectives", objectives),
        { id: "act-class-link", type: "BIGBLUEBUTTON", name: "Class Link" },
      ],
    },
    {
      id: "topic-eval",
      title: "Evaluation Criteria",
      activities: [{ id: "act-evaluation-criteria", type: "FILE", name: "Evaluation Criteria", fileName: "ACSW-200-Evaluation-Criteria.pdf" }],
    },
    {
      id: "topic-week-1",
      title: "Week 1",
      activities: [
        { id: "act-toc-ch01-03", type: "FOLDER", name: "Table of Content and Chapter 01, 02, 03 PDF", fileName: "ACSW200_Ch01-03.pdf" },
        page("Chapter 1 Class Overview & Learning Objectives"),
        page("Chapter 2 Overview & Learning Objectives"),
        page("Chapter 3 Overview & Learning Objectives"),
        quiz("01"),
        quiz("02"),
        quiz("03"),
      ],
    },
    {
      id: "topic-week-2",
      title: "Week 2",
      activities: [
        { id: "act-ch04-05", type: "FOLDER", name: "Chapter 04,05 PDF", fileName: "ACSW200_Ch04-05.pdf" },
        page("Chapter 4 Overview & Learning Objectives"),
        page("Chapter 5 Overview & Learning Objectives"),
        quiz("04"),
        quiz("05"),
      ],
    },
    {
      id: "topic-week-3",
      title: "Week 3",
      activities: [
        { id: "act-ch06-07", type: "FOLDER", name: "Chapter 06, 07 PDF" },
        page("Chapter 6 Overview & Learning Objectives"),
        page("Chapter 7 Overview & Learning Objectives"),
        quiz("06"),
        quiz("07"),
      ],
    },
    {
      id: "topic-week-4",
      title: "Week 4",
      activities: [
        { id: "act-ch08-09", type: "FOLDER", name: "Chapter 08, 09 PDF" },
        page("Chapter 8 Overview & Learning Objectives"),
        page("Chapter 9 Overview & Learning Objectives"),
        quiz("08"),
        quiz("09"),
      ],
    },
    {
      id: "topic-week-5",
      title: "Week 5",
      activities: [
        { id: "act-ch10-11", type: "FOLDER", name: "Chapter 10, 11 PDF" },
        page("Chapter 10 Overview & Learning Objectives"),
        page("Chapter 11 Overview & Learning Objectives"),
        quiz("10"),
        quiz("11"),
      ],
    },
    {
      id: "topic-week-6",
      title: "Week 6",
      activities: [
        { id: "act-ch12-13", type: "FOLDER", name: "Chapter 12, 13 PDF" },
        page("Chapter 12 Overview & Learning Objectives"),
        page("Chapter 13 Overview & Learning Objectives"),
        quiz("12"),
        quiz("13"),
      ],
    },
  ];
}

function fallbackLms(c: NonNullable<TeacherScreenConfig["courseDetail"]>): CourseLmsState {
  const isAcsw = /ACSW\s*200/i.test(c.code);
  const session = c.meta.split(" · ")[2] || c.meta;
  const location = c.meta.split(" · ")[0] || "";
  const first = "Elena";
  const last = "Vance";
  const prompts = [
    "Which statement best describes a core duty of a social service worker?",
    "Identify an ethical boundary in client intake interviews.",
    "What is the primary purpose of a case note?",
    "Select the most appropriate referral for housing instability.",
    "Which practice supports trauma-informed care?",
  ];
  const types = [
    { label: "Multiple choice", code: "M" },
    { label: "True/False", code: "T" },
    { label: "Short answer", code: "S" },
    { label: "Essay", code: "E" },
    { label: "Matching", code: "A" },
  ];
  const questions = Array.from({ length: 160 }, (_, i) => {
    const kind = types[i % types.length];
    return {
      id: `qb-fallback-${i + 1}`,
      type: kind.label,
      typeCode: kind.code,
      text: prompts[i % prompts.length],
      name: `Ch${Math.floor(i / 10) + 1} Q${(i % 10) + 1} — ${kind.label}`,
      status: "Ready",
      version: "v1",
      createdByFirst: first,
      createdByLast: last,
      date: "27 Apr 2026",
      comments: i % 7 === 0 ? 1 : 0,
      needsChecking: "",
      facilityIndex: "",
      discriminativeEfficiency: "",
      usage: i % 5 === 0 ? 2 : 0,
    };
  });
  if (isAcsw) {
    questions.pop();
    questions.unshift({
      id: "qb-fallback-settlement",
      type: "Multiple choice",
      typeCode: "M",
      text: "1. Group practice and community work were historically informed by _____.",
      name: "1. Group practice and community work were historically informed by _____.",
      status: "Ready",
      version: "v1",
      createdByFirst: "Manisha",
      createdByLast: "Manisha",
      date: "23 February 2026, 4:17 PM",
      comments: 0,
      needsChecking: "-",
      facilityIndex: "N/A",
      discriminativeEfficiency: "N/A",
      usage: 1,
      answers: ["settlement houses", "friendly visiting", "charity organization societies", "casework"],
      correct: 0,
    } as CourseLmsQuestion);
  }
  return {
    session,
    location,
    ended: isAcsw,
    endedMessage: "Your course has ended.",
    finalMarksLabel: "Click here to submit your final marks.",
    finalMarksHref: "/instructor/gradebook",
    moreMenu: [
      { id: "competency-breakdown", label: "Competency breakdown" },
      { id: "logs", label: "Logs" },
      { id: "live-logs", label: "Live logs" },
      { id: "activity-report", label: "Activity report" },
      { id: "course-participation", label: "Course participation" },
      { id: "competencies", label: "Course competencies" },
      { id: "filters", label: "Filters" },
      { id: "settings", label: "Edit settings" },
      { id: "groups", label: "Groups" },
      { id: "question-bank", label: "Question bank" },
      { id: "reuse", label: "Course reuse" },
    ],
    topics: isAcsw
      ? acswFallbackTopics()
      : [
          { id: "topic-0", title: "Topic 0", activities: [{ id: "act-announcements", type: "FORUM", name: "Announcements" }] },
          { id: "topic-1", title: "Topic 1", activities: [] },
        ],
    gradeColumns: isAcsw
      ? ["Student", ...Array.from({ length: 13 }, (_, i) => `Chapter ${String(i + 1).padStart(2, "0")} Quiz`), "Final Exam", "Class Participation", "Current Standing"]
      : ["Student", "Chapter 1 Quiz", "Final Exam Quiz", "Class Participation", "Current Standing"],
    gradeWeights: isAcsw
      ? ["", ...Array.from({ length: 13 }, () => "5.00%"), "25.00%", "10.00%", ""]
      : ["", "5.00%", "25.00%", "5.00%", ""],
    gradeEmpty: "No students registered",
    attendanceDates: ["Apr 27, 2026 (Mon)", "Apr 28, 2026 (Tue)", "Apr 29, 2026 (Wed)", "Apr 30, 2026 (Thu)"],
    evaluationRows: isAcsw
      ? [
          ...Array.from({ length: 13 }, (_, i) => ({ component: `Chapter ${String(i + 1).padStart(2, "0")} Quiz`, weight: "5%" })),
          { component: "Final Exam", weight: "25%" },
          { component: "Class Participation", weight: "10%" },
          { component: "Total", weight: "100%" },
        ]
      : [],
    logParticipants: ["All participants", "Monica Dahiya", "Guest user"],
    questionBank: {
      category: `Default for ${c.code}`,
      categoryHelp: `The default category for questions shared in context '${c.code}'.`,
      categories: isAcsw
        ? [
            { label: `Course: ${c.code} (ACSWAPR26-01)`, value: `course-${c.code}` },
            { label: "Top for Social Service Work Fundamentals", value: "top" },
            { label: `Default for ${c.code}`, value: `Default for ${c.code}` },
            { label: "Final Exam Quiz", value: "final-exam" },
            { label: "Quiz 1 (30)", value: "quiz-1" },
            { label: "Quiz 2 (28)", value: "quiz-2" },
            { label: "Quiz 3 (19)", value: "quiz-3" },
            { label: "Quiz 4 (30)", value: "quiz-4" },
            { label: "Quiz 5 (30)", value: "quiz-5" },
            { label: "Quiz 6 (30)", value: "quiz-6" },
            { label: "Quiz 7 (29)", value: "quiz-7" },
            { label: "Quiz 9 (30)", value: "quiz-9" },
            { label: "Quiz 10 (30)", value: "quiz-10" },
            { label: "Quiz 11 (30)", value: "quiz-11" },
            { label: "Quiz 12 (25)", value: "quiz-12" },
            { label: "Diversity and Populations (15)", value: "diversity" },
            { label: "Ethics and Professionalism (15)", value: "ethics" },
            { label: "Fields of Practice (15)", value: "fields" },
            { label: "General Concepts (15)", value: "general" },
            { label: "History and Origins (15)", value: "history" },
          ]
        : [{ label: `Default for ${c.code}`, value: `Default for ${c.code}` }],
      showQuestionText: true,
      showSubcategories: true,
      showOld: false,
      pageSize: 10,
      totalPages: 16,
      questions,
    },
    groups: [],
    availableUsers: [{ id: "u-instructor", name: `${first} ${last}` }],
    competencies: [],
    competencyEmpty: "No competencies have been linked to this course.",
    badges: [],
    badgeForm: {
      issuerName: "CampusOne",
      issuerContact: "support@myhccbc.com",
      languages: [{ label: "English", value: "English" }],
      imageTypes: ["Image (GIF) .gif", "Image (JPEG) .jpe .jpeg .jpg", "Image (PNG) .png"],
    },
  };
}

export function CourseLmsView({ config }: Props) {
  const c = config.courseDetail;
  const lms = c?.lms ?? (c ? fallbackLms(c) : undefined);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const live = useOptionalTeacherLive();
  const moreRef = useRef<HTMLDivElement>(null);

  const tabParam = searchParams.get("tab") || c?.activeTab || "Course";
  const moreFromUrl = (searchParams.get("more") || "") as CourseLmsMoreId | "";
  const actionFromUrl = searchParams.get("action") || "";
  const qtypeFromUrl = searchParams.get("qtype") || "";
  const qidFromUrl = searchParams.get("qid") || "";
  const aidFromUrl = searchParams.get("aid") || "";
  const atypeFromUrl = searchParams.get("atype") || "";
  const topicFromUrl = searchParams.get("topic") || "";
  const sidFromUrl = searchParams.get("sid") || "";
  const editFromUrl = searchParams.get("edit") === "1";
  const [moreParam, setMoreParam] = useState<CourseLmsMoreId | "">(moreFromUrl);
  const [actionParam, setActionParam] = useState(actionFromUrl);
  const [qtypeParam, setQtypeParam] = useState(qtypeFromUrl);
  const [qidParam, setQidParam] = useState(qidFromUrl);
  const [aidParam, setAidParam] = useState(aidFromUrl);
  const [atypeParam, setAtypeParam] = useState(atypeFromUrl);
  const [topicParam, setTopicParam] = useState(topicFromUrl);
  const [sidParam, setSidParam] = useState(sidFromUrl);
  const [editingQuestion, setEditingQuestion] = useState<CourseLmsQuestion | undefined>();
  const [tab, setTab] = useState(LMS_TABS.includes(tabParam as (typeof LMS_TABS)[number]) ? tabParam : "Course");
  const [moreOpen, setMoreOpen] = useState(false);
  const [editMode, setEditMode] = useState(editFromUrl);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [postMarksOpen, setPostMarksOpen] = useState(false);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    setMoreParam(moreFromUrl);
    setActionParam(actionFromUrl);
    setQtypeParam(qtypeFromUrl);
    setQidParam(qidFromUrl);
    setAidParam(aidFromUrl);
    setAtypeParam(atypeFromUrl);
    setTopicParam(topicFromUrl);
    setSidParam(sidFromUrl);
    setEditMode(editFromUrl);
    setTab(LMS_TABS.includes(tabParam as (typeof LMS_TABS)[number]) ? tabParam : "Course");
  }, [moreFromUrl, actionFromUrl, qtypeFromUrl, qidFromUrl, aidFromUrl, atypeFromUrl, topicFromUrl, sidFromUrl, editFromUrl, tabParam]);

  if (!c) {
    return (
      <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
        <p className="mh-teacher-muted">
          {live?.loading
            ? "Opening course…"
            : live?.error
              ? "This course section was not found, or you are not its instructor."
              : "No course workspace available yet."}
        </p>
      </div>
    );
  }

  const go = (next: LmsNav) => {
    if (next.tab) setTab(next.tab);
    if (next.more === null) setMoreParam("");
    else if (next.more) setMoreParam(next.more as CourseLmsMoreId);
    if (next.action === null) {
      setActionParam("");
      setQtypeParam("");
      setQidParam("");
      setAidParam("");
      setAtypeParam("");
      setTopicParam("");
      setSidParam("");
    } else if (next.action) setActionParam(next.action);
    if (next.qtype === null) setQtypeParam("");
    else if (next.qtype) setQtypeParam(next.qtype);
    if (next.qid === null) {
      setQidParam("");
      setEditingQuestion(undefined);
    } else if (next.qid) setQidParam(next.qid);
    if (next.aid === null) setAidParam("");
    else if (next.aid) setAidParam(next.aid);
    if (next.atype === null) setAtypeParam("");
    else if (next.atype) setAtypeParam(next.atype);
    if (next.topic === null) setTopicParam("");
    else if (next.topic) setTopicParam(next.topic);
    if (next.sid === null) setSidParam("");
    else if (next.sid) setSidParam(next.sid);
    router.replace(`${pathname}${lmsHref(searchParams, next)}`, { scroll: false });
  };

  const viewedActivity = lms?.topics.flatMap((t) => t.activities).find((a) => a.id === aidParam);
  const editSectionTopic = lms?.topics.find((t) => t.id === sidParam);
  const previewQuestion =
    lms?.questionBank.questions.find((q) => q.id === qidParam) ||
    (editingQuestion?.id === qidParam ? editingQuestion : undefined);

  function lmsBody() {
    if (!lms || !c) return null;

    if (actionParam === "add-activity" && atypeParam && topicParam) {
      return (
        <LmsAddForm
          code={atypeParam}
          label={atypeParam}
          busy={Boolean(live?.busy)}
          roster={c.roster ?? []}
          groups={lms.groups}
          sectionId={c.sectionId}
          onSave={async (values) => {
            const ok = await live?.runAction?.(
              "Add an activity or resource",
              JSON.stringify({
                ...values,
                TopicId: topicParam,
                ActivityType: atypeParam.toUpperCase(),
                Name: values.Name || `New ${atypeParam}`,
                Code: atypeParam,
              }),
            );
            if (ok) {
              // runAction returns the rebuilt live course payload, so the new module/activity is
              // already visible without a second loading cycle.
              go({ tab: "Course", action: null, atype: null, topic: null });
            }
            return Boolean(ok);
          }}
          onCancel={() => go({ tab: "Course", action: null, atype: null, topic: null })}
        />
      );
    }
    if (actionParam === "edit-section" && editSectionTopic) {
      return (
        <EditSectionPanel
          title={editSectionTopic.title}
          accessRestrictions={editSectionTopic.accessRestrictions}
          roster={c.roster ?? []}
          groups={lms.groups}
          onSave={(name, summary, accessRestrictions) => {
            void (async () => {
              const ok = await live?.runAction?.(
                "Save section",
                JSON.stringify({ TopicId: editSectionTopic.id, Title: name, Summary: summary, AccessRestrictions: accessRestrictions }),
              );
              if (ok) go({ tab: "Course", action: null, sid: null });
            })();
          }}
          onCancel={() => go({ tab: "Course", action: null, sid: null })}
        />
      );
    }
    if (actionParam === "resource-permissions" && viewedActivity) {
      return <PermissionsPanel onBack={() => go({ tab: "Course", action: "view-activity", aid: viewedActivity.id })} />;
    }
    if (actionParam === "resource-filters" && viewedActivity) {
      return (
        <section className="mh-teacher-card">
          <h2>Filter settings in {viewedActivity.name}</h2>
          <FiltersPanel />
          <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => go({ tab: "Course", action: "view-activity", aid: viewedActivity.id })}>
            Back to page
          </button>
        </section>
      );
    }
    if (actionParam === "edit-activity" && viewedActivity && !/^PAGE$/i.test(viewedActivity.type)) {
      const code = viewedActivity.type.toLowerCase().replace(/\s+/g, "");
      const fileFieldName =
        viewedActivity.type.toUpperCase() === "BOOK"
          ? "Book file"
          : viewedActivity.type.toUpperCase() === "FILE"
            ? "Select files"
            : viewedActivity.type.toUpperCase() === "FOLDER"
              ? "Files"
              : /^(H5P|IMSCP|SCORM)$/i.test(viewedActivity.type)
                ? "Package file"
                : "Additional files";
      return (
        <LmsAddForm
          key={viewedActivity.id}
          code={code}
          label={viewedActivity.type}
          busy={Boolean(live?.busy)}
          roster={c.roster ?? []}
          groups={lms.groups}
          sectionId={c.sectionId}
          heading={`Updating ${viewedActivity.type.toLowerCase()}: ${viewedActivity.name}`}
          initial={{
            ...(viewedActivity.description ? { Description: viewedActivity.description } : {}),
            ...(viewedActivity.url ? { "External URL": viewedActivity.url } : {}),
            ...(viewedActivity.body && viewedActivity.type.toUpperCase() === "BOOK" ? { "Book content": viewedActivity.body } : {}),
            ...(viewedActivity.body && viewedActivity.type.toUpperCase() === "CHOICE" ? { "Choice question": viewedActivity.body } : {}),
            ...(viewedActivity.body && !/^(BOOK|CHOICE|PAGE)$/i.test(viewedActivity.type)
              ? { "Activity content": viewedActivity.body }
              : {}),
            ...(viewedActivity.fileId
              ? {
                  FileId: viewedActivity.fileId,
                  [fileFieldName]: `${viewedActivity.fileName || viewedActivity.name}${viewedActivity.fileSize ? ` · ${viewedActivity.fileSize} bytes` : ""}`,
                }
              : {}),
            ...(viewedActivity.settings || {}),
            Name: viewedActivity.name,
            Availability: viewedActivity.hidden ? "Hide from students" : "Show on course page",
          }}
          onSave={(values) => {
            void live
              ?.runAction?.(
                "Save activity settings",
                JSON.stringify({ ...values, Id: viewedActivity.id, ActivityType: viewedActivity.type }),
              )
              .then((ok) => {
                if (ok) go({ tab: "Course", action: "view-activity", aid: viewedActivity.id });
              });
          }}
          onCancel={() => go({ tab: "Course", action: "view-activity", aid: viewedActivity.id })}
        />
      );
    }
    if (actionParam === "edit-activity" && viewedActivity) {
      return (
        <PageEditPanel
          activity={viewedActivity}
          hidden={Boolean(viewedActivity.hidden)}
          roster={c.roster ?? []}
          groups={lms.groups}
          onSave={(values) => {
            void live
              ?.runAction?.(
                "Save page",
                JSON.stringify({
                  Id: viewedActivity.id,
                  Name: values.name,
                  Body: values.body,
                  Hidden: values.hidden ? "yes" : "no",
                  AccessRestrictions: values.accessRestrictions,
                }),
              )
              .then((ok) => {
                if (ok) go({ tab: "Course", action: "view-activity", aid: viewedActivity.id });
              });
          }}
          onCancel={() => go({ tab: "Course", action: "view-activity", aid: viewedActivity.id })}
        />
      );
    }
    if (actionParam === "activity-competencies" && viewedActivity) {
      return (
        <ActivityCompetenciesPanel
          name={viewedActivity.name}
          onBack={() => go({ tab: "Course", action: "view-activity", aid: viewedActivity.id })}
        />
      );
    }
    if ((actionParam === "view-activity" || (aidParam && !actionParam)) && viewedActivity && !moreParam && tab === "Course") {
      return (
        <ResourceView
          activity={viewedActivity}
          evaluationRows={lms.evaluationRows}
          roster={c.roster ?? []}
          sectionId={c.sectionId}
          onEdit={() => go({ tab: "Course", action: "edit-activity", aid: viewedActivity.id })}
          onMore={(which) =>
            go({
              tab: "Course",
              action: which === "filters" ? "resource-filters" : "resource-permissions",
              aid: viewedActivity.id,
            })
          }
          onPublished={() => void live?.refresh?.()}
        />
      );
    }
    if (actionParam === "add-grade") {
      return <AddGradeItemPanel onCancel={() => go({ tab: "Grades", action: null })} />;
    }

    if (moreParam === "question-bank" && actionParam === "preview-question" && previewQuestion) {
      return (
        <QuestionPreview
          question={previewQuestion}
          onClose={() => go({ tab: "More", more: "question-bank", action: null, qid: null })}
        />
      );
    }
    if (moreParam === "question-bank" && actionParam === "history-question" && previewQuestion) {
      return (
        <QuestionHistory
          question={previewQuestion}
          onClose={() => go({ tab: "More", more: "question-bank", action: null, qid: null })}
        />
      );
    }
    if (moreParam === "question-bank" && actionParam === "edit-question" && qidParam) {
      const existing =
        lms.questionBank.questions.find((q) => q.id === qidParam) ||
        (editingQuestion?.id === qidParam ? editingQuestion : undefined);
      if (existing) {
        return (
          <AddQuestionPanel
            type={existing.type || qtypeParam || "Multiple choice"}
            existing={existing}
            lms={lms}
            courseCode={c.code}
            onCancel={() => go({ tab: "More", more: "question-bank", action: null, qtype: null, qid: null })}
          />
        );
      }
      if (live?.loading) {
        return (
          <section className="mh-teacher-card">
            <p className="mh-teacher-muted">Loading question…</p>
          </section>
        );
      }
      return (
        <section className="mh-teacher-card">
          <h2>Question not found</h2>
          <p className="mh-teacher-muted">This question is no longer in the bank.</p>
          <button
            type="button"
            className="mh-teacher-btn mh-teacher-btn--secondary"
            onClick={() => go({ tab: "More", more: "question-bank", action: null, qtype: null, qid: null })}
          >
            Back to question bank
          </button>
        </section>
      );
    }
    if (moreParam === "question-bank" && actionParam === "add-question" && qtypeParam) {
      return (
        <AddQuestionPanel
          type={qtypeParam}
          lms={lms}
          courseCode={c.code}
          onCancel={() => go({ tab: "More", more: "question-bank", action: null, qtype: null, qid: null })}
        />
      );
    }
    if (moreParam === "question-bank" && actionParam === "add-question") {
      return (
        <ChooseQuestionTypePanel
          onAdd={(type) => go({ tab: "More", more: "question-bank", action: "add-question", qtype: type, qid: null })}
          onCancel={() => go({ tab: "More", more: "question-bank", action: null, qtype: null, qid: null })}
        />
      );
    }
    if (moreParam === "question-bank") {
      return (
        <>
          <QuestionBankPanel
            lms={lms}
            courseCode={c.code}
            onCreate={() => go({ tab: "More", more: "question-bank", action: "add-question", qtype: null, qid: null })}
            onEdit={(row) => {
              setEditingQuestion(row);
              go({ tab: "More", more: "question-bank", action: "edit-question", qtype: row.type, qid: row.id });
            }}
            onPreview={(row) => {
              setEditingQuestion(row);
              go({ tab: "More", more: "question-bank", action: "preview-question", qid: row.id });
            }}
            onHistory={(row) => {
              setEditingQuestion(row);
              go({ tab: "More", more: "question-bank", action: "history-question", qid: row.id });
            }}
            onTags={(row) => {
              setEditingQuestion(row);
              go({ tab: "More", more: "question-bank", action: "tags-question", qid: row.id });
            }}
          />
          {actionParam === "tags-question" && previewQuestion ? (
            <QuestionTagsModal
              question={previewQuestion}
              courseTitle={c.title}
              onClose={() => go({ tab: "More", more: "question-bank", action: null, qid: null })}
            />
          ) : null}
        </>
      );
    }
    if (moreParam === "groups") {
      return (
        <GroupsPanel
          lms={lms}
          courseCode={c.code}
          session={lms.session}
          creating={actionParam === "create-group"}
          onCreate={() => go({ tab: "More", more: "groups", action: "create-group" })}
          onCancelCreate={() => go({ tab: "More", more: "groups", action: null })}
        />
      );
    }
    if (moreParam === "competencies") {
      return <CompetenciesPanel lms={lms} />;
    }
    if (moreParam === "filters") {
      return <FiltersPanel />;
    }
    if (moreParam === "settings") {
      return <SettingsPanel courseCode={c.code} title={c.title} />;
    }
    if (moreParam === "reuse") {
      return (
        <PlaceholderPanel title="Course reuse" body="Import, backup, and reuse options for this course will appear here." />
      );
    }
    if (moreParam === "logs" || moreParam === "live-logs" || moreParam === "activity-report" || moreParam === "course-participation" || moreParam === "competency-breakdown" || moreParam === "reports") {
      const current = moreParam === "reports" ? "competency-breakdown" : moreParam;
      return (
        <div className="mh-lms-reports">
          <ReportNav current={current} onSelect={(id) => go({ tab: "More", more: id, action: null })} />
          {current === "competency-breakdown" ? (
            <CompetencyBreakdownPanel lms={lms} onAdd={() => go({ tab: "More", more: "competencies", action: null })} />
          ) : current === "live-logs" ? (
            <LogsPanel lms={lms} title="Live logs" />
          ) : current === "activity-report" ? (
            <ActivityReportPanel lms={lms} />
          ) : current === "course-participation" ? (
            <CourseParticipationPanel lms={lms} />
          ) : (
            <LogsPanel lms={lms} title="Logs" />
          )}
        </div>
      );
    }
    if (actionParam === "add-badge") {
      return <AddCourseBadgePanel lms={lms} onCancel={() => go({ tab: "Badges", more: null, action: null })} />;
    }
    if (tab === "Class List") return <ClassListPanel roster={c.roster ?? []} />;
    if (tab === "Attendance") {
      return <AttendancePanel lms={lms} attendance={c.attendance} sectionId={c.sectionId} />;
    }
    if (tab === "Grades") {
      return (
        <GradesBoard
          lms={lms}
          onAddItem={() => go({ tab: "Grades", action: "add-grade" })}
          onPostMarks={() => setPostMarksOpen(true)}
        />
      );
    }
    if (tab === "Badges") {
      return <BadgesPanel lms={lms} roster={c.roster ?? []} onAdd={() => go({ tab: "Badges", more: null, action: "add-badge" })} />;
    }
    return (
      <CourseContentPanel
        lms={lms}
        editMode={editMode}
        collapsed={collapsed}
        onToggle={(id) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))}
        onCollapseAll={() => {
          const next: Record<string, boolean> = {};
          for (const topic of lms.topics) next[topic.id] = true;
          setCollapsed(next);
        }}
        onExpandAll={() => setCollapsed({})}
        onView={(activity) => go({ tab: "Course", action: "view-activity", aid: activity.id || activity.name })}
        onEditActivity={(activity) => go({ tab: "Course", action: "edit-activity", aid: activity.id || activity.name })}
        onEditSection={(topicId) => go({ tab: "Course", action: "edit-section", sid: topicId })}
        onAddActivity={(topicId, type) =>
          go({ tab: "Course", action: "add-activity", topic: topicId, atype: type.code, aid: null })
        }
        onAssignRoles={(activity) =>
          go({ tab: "Course", action: "resource-permissions", aid: activity.id || activity.name })
        }
      />
    );
  }

  return (
    <div className="mh-lms" data-figma-id={config.figmaId}>
      <header className="mh-lms-head">
        <div>
          <h1 className="mh-lms-title">
            {c.code}: {c.title}
          </h1>
          <p className="mh-lms-meta">
            <strong>Session:</strong> {lms?.session || config.subtitle || c.meta}
          </p>
          <p className="mh-lms-meta">
            <strong>Location:</strong> {lms?.location || "—"}
          </p>
        </div>
        <label className="mh-lms-edit">
          <input
            type="checkbox"
            checked={editMode}
            onChange={(e) => {
              const checked = e.target.checked;
              setEditMode(checked);
              const params = new URLSearchParams(searchParams.toString());
              if (checked) params.set("edit", "1");
              else params.delete("edit");
              const query = params.toString();
              router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
            }}
          />
          Edit mode
        </label>
      </header>

      {lms?.ended ? (
        <div className="mh-lms-banner" role="status">
          <p>{lms.endedMessage || "Your course has ended."}</p>
          <button type="button" className="mh-teacher-link" onClick={() => router.push(lms.finalMarksHref || "/instructor/gradebook")}>
            {lms.finalMarksLabel || "Click here to submit your final marks."}
          </button>
        </div>
      ) : null}

      <div className="mh-lms-tabs" role="tablist" aria-label="Course">
        {LMS_TABS.map((t) =>
          t === "More" ? (
            <div key={t} className="mh-lms-more" ref={moreRef}>
              <button
                type="button"
                role="tab"
                aria-selected={Boolean(moreParam) || tab === "More"}
                aria-expanded={moreOpen}
                className={`mh-lms-tab${moreParam || tab === "More" ? " is-active" : ""}`}
                onClick={() => setMoreOpen((open) => !open)}
              >
                More ▾
              </button>
              {moreOpen ? (
                <div className="mh-lms-more__menu" role="menu">
                  {(lms?.moreMenu ?? []).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      className={moreParam === item.id ? "is-active" : ""}
                      onClick={() => {
                        setMoreOpen(false);
                        go({ tab: "More", more: item.id, action: null });
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={!moreParam && tab === t}
              className={`mh-lms-tab${!moreParam && tab === t ? " is-active" : ""}`}
              onClick={() => go({ tab: t, more: null, action: t === "Badges" && actionParam === "add-badge" ? "add-badge" : null })}
            >
              {t}
            </button>
          ),
        )}
      </div>

      {lmsBody()}

      {postMarksOpen ? <PostMarksModal onClose={() => setPostMarksOpen(false)} /> : null}

      {live?.toast ? (
        <p className="mh-lms-toast" role="status">
          {live.toast}
        </p>
      ) : null}
      {live?.busy ? <p className="mh-teacher-muted">Saving…</p> : null}
    </div>
  );
}

function CourseContentPanel({
  lms,
  editMode,
  collapsed,
  onToggle,
  onCollapseAll,
  onExpandAll,
  onView,
  onEditActivity,
  onEditSection,
  onAddActivity,
  onAssignRoles,
}: {
  lms?: CourseLmsState;
  editMode: boolean;
  collapsed: Record<string, boolean>;
  onToggle: (id: string) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onView: (activity: { id?: string; type: string; name: string }) => void;
  onEditActivity: (activity: { id?: string; type: string; name: string }) => void;
  onEditSection: (topicId: string) => void;
  onAddActivity: (topicId: string, type: { code: string; label: string; kind: string }) => void;
  onAssignRoles: (activity: { id?: string; type: string; name: string }) => void;
}) {
  const live = useOptionalTeacherLive();
  const topics = lms?.topics ?? [];
  const activityTypes = decorateLmsActivityTypes(lms?.activityTypes);
  const [chooserTopicId, setChooserTopicId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const [aiDraftTopicId, setAiDraftTopicId] = useState<string | null>(() => (searchParams.get("aiDraft") === "1" ? "" : null));
  const [aiCourseOpen, setAiCourseOpen] = useState(() => searchParams.get("aiCourse") === "1");
  const allCollapsed = topics.length > 0 && topics.every((topic) => collapsed[topic.id]);

  return (
    <section className="mh-lms-course">
      <div className="mh-lms-course__toolbar">
        <button
          type="button"
          className="mh-teacher-link"
          onClick={allCollapsed ? onExpandAll : onCollapseAll}
          disabled={topics.length === 0}
        >
          {allCollapsed ? "Expand all" : "Collapse all"}
        </button>
        {editMode ? (
          <button
            type="button"
            className="mh-teacher-btn mh-teacher-btn--secondary"
            disabled={live?.busy}
            onClick={() => void live?.runAction?.("Add topic", JSON.stringify({ Title: `Topic ${topics.length}` }))}
          >
            Add topic
          </button>
        ) : null}
        {editMode && live?.path ? (
          <button
            type="button"
            className="mh-teacher-btn"
            disabled={live?.busy || topics.length === 0}
            onClick={() => setAiDraftTopicId("")}
          >
            ✦ AI draft
          </button>
        ) : null}
        {editMode && live?.path ? (
          <button type="button" className="mh-teacher-btn" disabled={live?.busy} onClick={() => setAiCourseOpen(true)}>
            ✦ AI course builder
          </button>
        ) : null}
      </div>
      {topics.map((topic, index) => {
        const shut = Boolean(collapsed[topic.id]);
        return (
          <article key={topic.id} className="mh-lms-topic">
            <header className="mh-lms-topic__head">
              <button type="button" className="mh-lms-topic__toggle" onClick={() => onToggle(topic.id)}>
                {shut ? "▸" : "▾"}
              </button>
              <h2>{topic.title}</h2>
              {topic.accessRestrictions ? <span className="mh-lms-restricted-badge">Restricted</span> : null}
              {editMode ? (
                <ActionMenu
                  label={`Section actions for ${topic.title}`}
                  items={[
                    { label: "Edit section", onClick: () => onEditSection(topic.id) },
                    { label: "AI draft lesson", onClick: () => setAiDraftTopicId(topic.id) },
                    { label: "Highlight", onClick: () => void live?.runAction?.("Highlight section", topic.id) },
                  ]}
                />
              ) : null}
            </header>
            {shut ? null : (
              <div className="mh-lms-topic__body">
                {topic.summary ? <p className="mh-lms-topic__summary">{topic.summary}</p> : null}
                {topic.id === "topic-eval" && lms?.evaluationRows?.length ? (
                  <table className="mh-lms-eval mh-lms-eval--embed">
                    <thead>
                      <tr>
                        <th>Component</th>
                        <th>Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lms.evaluationRows.map((row) => (
                        <tr key={row.component} className={row.component === "Total" ? "is-total" : ""}>
                          <td>{row.component}</td>
                          <td>{row.weight}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                {topic.activities.length === 0 ? (
                  <p className="mh-teacher-muted">No activities in this topic yet.</p>
                ) : (
                  topic.activities.map((activity) => (
                    <div
                      key={activity.id || `${activity.type}-${activity.name}`}
                      className={`mh-lms-activity${activity.hidden ? " is-hidden" : ""}`}
                    >
                      <span className="mh-lms-activity__type">{activity.type}</span>
                      <div>
                        <button type="button" className="mh-lms-activity__name" onClick={() => onView(activity)}>
                          {activity.name}
                        </button>
                        {activity.note ? <p>{activity.note}</p> : null}
                        {activity.hidden ? <p className="mh-teacher-muted">Hidden from students</p> : null}
                        {activity.settings?.[LMS_ACCESS_RESTRICTIONS_KEY] ? <p className="mh-lms-restricted-note">Access restricted</p> : null}
                      </div>
                      {editMode ? (
                        <ActionMenu
                          label={`Actions for ${activity.name}`}
                          items={[
                            { label: "Edit settings", onClick: () => onEditActivity(activity) },
                            { label: "Move", onClick: () => void live?.runAction?.("Move activity", activity.id || activity.name) },
                            {
                              label: activity.hidden ? "Show" : "Hide",
                              onClick: () =>
                                void live?.runAction?.(
                                  activity.hidden ? "Show activity" : "Hide activity",
                                  activity.id || "",
                                ),
                            },
                            {
                              label: "Duplicate",
                              onClick: () =>
                                void live?.runAction?.(
                                  "Duplicate activity",
                                  JSON.stringify({ TopicId: topic.id, Type: activity.type, Name: activity.name, Id: activity.id || "" }),
                                ),
                            },
                            { label: "Assign roles", onClick: () => onAssignRoles(activity) },
                            {
                              label: "Delete",
                              danger: true,
                              onClick: () => void live?.runAction?.("Delete activity", activity.id || ""),
                            },
                          ]}
                        />
                      ) : null}
                    </div>
                  ))
                )}
                {editMode ? (
                  <button
                    type="button"
                    className="mh-teacher-btn mh-teacher-btn--secondary"
                    disabled={live?.busy}
                    onClick={() => setChooserTopicId(topic.id)}
                  >
                    Add an activity or resource
                  </button>
                ) : null}
                {index === topics.length - 1 ? (
                  <p className="mh-teacher-muted mh-lms-next">Add topic · Next content</p>
                ) : null}
              </div>
            )}
          </article>
        );
      })}
      {aiDraftTopicId !== null && live?.path ? (
        <CourseAiDraftDialog
          path={live.path}
          topics={topics}
          initialTopicId={aiDraftTopicId || undefined}
          busy={live.busy}
          runAction={live.runAction}
          onClose={() => setAiDraftTopicId(null)}
        />
      ) : null}
      {aiCourseOpen && live?.path ? (
        <CourseAiBuilderDialog
          path={live.path}
          defaultDelivery={searchParams.get("delivery") === "self_paced" ? "self_paced" : undefined}
          onClose={() => setAiCourseOpen(false)}
          onPublished={() => void live.refresh?.()}
        />
      ) : null}
      {chooserTopicId ? (
        <AddActivityChooser
          types={activityTypes}
          busy={Boolean(live?.busy)}
          onSelect={(type) => {
            const topicId = chooserTopicId;
            setChooserTopicId(null);
            onAddActivity(topicId, type);
          }}
          onClose={() => setChooserTopicId(null)}
        />
      ) : null}
    </section>
  );
}

function BadgesPanel({
  lms,
  roster,
  onAdd,
}: {
  lms: CourseLmsState;
  roster: Array<{ studentId?: string; name: string; studentNumber: string }>;
  onAdd: () => void;
}) {
  const live = useOptionalTeacherLive();
  const [awarding, setAwarding] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const students = roster.filter((r): r is typeof r & { studentId: string } => Boolean(r.studentId));
  const toggle = (id: string) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const open = (badgeId: string) => {
    setAwarding((cur) => (cur === badgeId ? null : badgeId));
    setPicked([]);
  };
  const award = async (badgeId: string) => {
    const ok = await live?.runAction?.("Award course badge", JSON.stringify({ BadgeId: badgeId, StudentIds: picked.join(",") }));
    if (ok) {
      setAwarding(null);
      setPicked([]);
    }
  };

  return (
    <section className="mh-teacher-card">
      <div className="mh-lms-toolbar">
        <button type="button" className="mh-teacher-btn" onClick={onAdd}>
          Add a new badge
        </button>
      </div>
      <h2>Badges</h2>
      {lms.badges.length === 0 ? (
        <p className="mh-teacher-muted">No badges are currently available for users to earn</p>
      ) : (
        <div className="mh-teacher-list">
          {lms.badges.map((badge) => (
            <div key={badge.id} className="mh-teacher-list__item">
              <div>
                <strong>{badge.name}</strong>
                <span>
                  {badge.version ? `${badge.version} · ` : ""}
                  {badge.language || "English"}
                </span>
              </div>
              {live?.runAction ? (
                <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => open(badge.id)}>
                  {awarding === badge.id ? "Cancel" : "Award"}
                </button>
              ) : null}
              {awarding === badge.id ? (
                <div className="mh-teacher-fields">
                  {students.length === 0 ? (
                    <p className="mh-teacher-muted">No students are enrolled in this course yet.</p>
                  ) : (
                    <>
                      <label>
                        <input
                          type="checkbox"
                          checked={picked.length === students.length}
                          onChange={(e) => setPicked(e.target.checked ? students.map((s) => s.studentId) : [])}
                        />{" "}
                        Select all ({students.length})
                      </label>
                      {students.map((s) => (
                        <label key={s.studentId}>
                          <input type="checkbox" checked={picked.includes(s.studentId)} onChange={() => toggle(s.studentId)} /> {s.name}{" "}
                          <span className="mh-teacher-muted">{s.studentNumber}</span>
                        </label>
                      ))}
                      <div className="mh-lms-toolbar">
                        <button type="button" className="mh-teacher-btn" disabled={live?.busy || picked.length === 0} onClick={() => void award(badge.id)}>
                          Award badge to {picked.length} student{picked.length === 1 ? "" : "s"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function QuestionBankPanel({
  lms,
  courseCode,
  onCreate,
  onEdit,
  onPreview,
  onHistory,
  onTags,
}: {
  lms: CourseLmsState;
  courseCode: string;
  onCreate: () => void;
  onEdit: (row: CourseLmsQuestion) => void;
  onPreview: (row: CourseLmsQuestion) => void;
  onHistory: (row: CourseLmsQuestion) => void;
  onTags: (row: CourseLmsQuestion) => void;
}) {
  const qb = lms.questionBank;
  const [category, setCategory] = useState(qb.category);
  const [showText, setShowText] = useState(qb.showQuestionText);
  const [showSub, setShowSub] = useState(qb.showSubcategories);
  const [showOld, setShowOld] = useState(qb.showOld);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return qb.questions.filter((row) => {
      if (!showOld && /old/i.test(row.status)) return false;
      if (!q) return true;
      return `${row.text} ${row.name} ${row.type}`.toLowerCase().includes(q);
    });
  }, [qb.questions, query, showOld]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / qb.pageSize) || qb.totalPages);
  const pageNum = Math.min(page, pageCount);
  const rows = filtered.slice((pageNum - 1) * qb.pageSize, pageNum * qb.pageSize);
  const pages = paginationItems(pageNum, pageCount);

  return (
    <section className="mh-teacher-card mh-lms-qb">
      <h2>Question bank</h2>
      <div className="mh-lms-qb__controls">
        <label>
          <span>Select a category</span>
          <select className="mh-teacher-field" value={category} onChange={(e) => setCategory(e.target.value)}>
            {qb.categories.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <p className="mh-teacher-muted">{qb.categoryHelp || `The default category for questions shared in context '${courseCode}'.`}</p>
        <label>
          <span>Filter by tags...</span>
          <input className="mh-teacher-field" placeholder="No tag filters applied" />
        </label>
        <label className="mh-lms-check">
          <input type="checkbox" checked={showText} onChange={(e) => setShowText(e.target.checked)} />
          Show question text in the question list
        </label>
        <button type="button" className="mh-teacher-link" onClick={() => setSearchOpen((v) => !v)}>
          Search options
        </button>
        {searchOpen ? (
          <input
            className="mh-teacher-field"
            value={query}
            placeholder="Search questions"
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        ) : null}
        <label className="mh-lms-check">
          <input type="checkbox" checked={showSub} onChange={(e) => setShowSub(e.target.checked)} />
          Also show questions from subcategories
        </label>
        <label className="mh-lms-check">
          <input type="checkbox" checked={showOld} onChange={(e) => setShowOld(e.target.checked)} />
          Also show old questions
        </label>
        <div className="mh-lms-qb__create">
          <button type="button" className="mh-teacher-btn" onClick={onCreate}>
            Create a new question ...
          </button>
        </div>
      </div>

      <nav className="mh-lms-pager" aria-label="Question bank pages">
        {pages.map((item, idx) =>
          item === "…" ? (
            <span key={`e-${idx}`}>…</span>
          ) : (
            <button
              key={item}
              type="button"
              className={item === pageNum ? "is-active" : ""}
              onClick={() => setPage(item)}
            >
              {item}
            </button>
          ),
        )}
        {pageNum < pageCount ? (
          <button type="button" onClick={() => setPage(pageNum + 1)}>
            Next »
          </button>
        ) : null}
      </nav>

      <div className="mh-lms-qb-table-wrap">
        <div className="mh-lms-qb-table">
          <div className="mh-lms-qb-table__head">
            <span />
            <span />
            <span>T</span>
            <span>Question</span>
            <span>Actions</span>
            <span>Status</span>
            <span>Version</span>
            <span>Created by</span>
            <span>Comments</span>
            <span>Needs checking?</span>
            <span>Facility index</span>
            <span>Discriminative efficiency</span>
            <span>Usage</span>
          </div>
          {rows.map((row) => (
            <div key={row.id} className="mh-lms-qb-table__row">
              <span>
                <input
                  type="checkbox"
                  checked={Boolean(selected[row.id])}
                  onChange={(e) => setSelected((prev) => ({ ...prev, [row.id]: e.target.checked }))}
                  aria-label={`Select ${row.name}`}
                />
              </span>
              <span className="mh-lms-drag" aria-hidden="true">
                ⋮⋮
              </span>
              <span title={row.type}>{row.typeCode}</span>
              <span>
                <button type="button" className="mh-lms-q-link" onClick={() => onEdit(row)}>
                  <strong>{row.name}</strong>
                  {showText ? <em>{row.text}</em> : null}
                </button>
              </span>
              <span>
                <ActionMenu
                  label={`Question actions for ${row.name}`}
                  items={[
                    { label: "Edit question", onClick: () => onEdit(row) },
                    { label: "Duplicate", onClick: () => onEdit(row) },
                    { label: "Manage tags", onClick: () => onTags(row) },
                    { label: "Preview", onClick: () => onPreview(row) },
                    { label: "History", onClick: () => onHistory(row) },
                    { label: "Delete", danger: true, onClick: () => undefined },
                    { label: "Export as Moodle XML", onClick: () => undefined },
                  ]}
                />
              </span>
              <span>
                <select className="mh-teacher-field" defaultValue={row.status === "Draft" ? "Draft" : "Ready"} aria-label="Status">
                  <option>Ready</option>
                  <option>Draft</option>
                </select>
              </span>
              <span>{row.version}</span>
              <span>
                {row.createdByFirst} {row.createdByLast}
                <em>{row.date}</em>
              </span>
              <span>{row.comments}</span>
              <span>{row.needsChecking || "-"}</span>
              <span>{row.facilityIndex || "N/A"}</span>
              <span>{row.discriminativeEfficiency || "N/A"}</span>
              <span>{row.usage}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function paginationItems(page: number, total: number) {
  const items: Array<number | "…"> = [];
  if (total <= 12) {
    for (let i = 1; i <= total; i += 1) items.push(i);
    return items;
  }
  for (let i = 1; i <= 10; i += 1) items.push(i);
  items.push("…");
  items.push(total);
  if (page > 10 && page < total && !items.includes(page)) {
    items.splice(10, 0, page);
  }
  return items;
}

function GroupsPanel({
  lms,
  courseCode,
  session,
  creating,
  onCreate,
  onCancelCreate,
}: {
  lms: CourseLmsState;
  courseCode: string;
  session: string;
  creating: boolean;
  onCreate: () => void;
  onCancelCreate: () => void;
}) {
  const live = useOptionalTeacherLive();
  const [selectedId, setSelectedId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const sessionCode = session.split(":")[0]?.trim() || courseCode;
  const selected = lms.groups.find((g) => g.id === selectedId);

  if (creating) {
    return <CreateGroupForm onCancel={onCancelCreate} />;
  }

  return (
    <section className="mh-teacher-card">
      <h2>
        {courseCode} ({sessionCode}) Groups
      </h2>
      <div className="mh-lms-groups">
        <div className="mh-lms-groups__pane">
          <h3>Groups</h3>
          <div className="mh-lms-groups__list mh-lms-groups__list--box" role="listbox" aria-label="Groups">
            {lms.groups.map((group) => (
              <button
                key={group.id}
                type="button"
                className={selectedId === group.id ? "is-active" : ""}
                onClick={() => setSelectedId(group.id)}
              >
                {group.name}
              </button>
            ))}
          </div>
          <div className="mh-lms-toolbar">
            <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" disabled={!selected}>
              Edit group settings
            </button>
            <button
              type="button"
              className="mh-teacher-btn mh-teacher-btn--secondary"
              disabled={!selected || live?.busy}
              onClick={() => void live?.runAction?.("Delete selected group", selectedId)}
            >
              Delete selected group
            </button>
            <button type="button" className="mh-teacher-btn" onClick={onCreate}>
              Create group
            </button>
          </div>
          <GroupsExtras
            onAuto={() => void live?.runAction?.("Auto-create groups")}
            onImport={() => void live?.runAction?.("Import groups")}
          />
        </div>
        <div className="mh-lms-groups__pane">
          <h3>Members of: {selected?.name || ""}</h3>
          <div className="mh-lms-groups__list mh-lms-groups__list--box" aria-label="Group members">
            {selected
              ? selected.members.map((member) => <div key={member.id}>{member.name}</div>)
              : null}
          </div>
          <button
            type="button"
            className="mh-teacher-btn mh-teacher-btn--secondary"
            disabled={!selected}
            onClick={() => setPickerOpen(true)}
          >
            Add/remove users
          </button>
          {pickerOpen && selected ? (
            <MemberPicker
              available={lms.availableUsers}
              current={selected.members}
              onClose={() => setPickerOpen(false)}
              onSave={(members) => {
                void live?.runAction?.("Add/remove users", JSON.stringify({ groupId: selected.id, members }));
                setPickerOpen(false);
              }}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function MemberPicker({
  available,
  current,
  onClose,
  onSave,
}: {
  available: Array<{ id: string; name: string }>;
  current: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSave: (members: Array<{ id: string; name: string }>) => void;
}) {
  const [ids, setIds] = useState(() => new Set(current.map((m) => m.id)));
  const users = [...available, ...current].filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i);
  return (
    <div className="mh-lms-picker">
      {users.map((user) => (
        <label key={user.id} className="mh-lms-check">
          <input
            type="checkbox"
            checked={ids.has(user.id)}
            onChange={(e) => {
              const next = new Set(ids);
              if (e.target.checked) next.add(user.id);
              else next.delete(user.id);
              setIds(next);
            }}
          />
          {user.name}
        </label>
      ))}
      <div className="mh-lms-toolbar">
        <button type="button" className="mh-teacher-btn" onClick={() => onSave(users.filter((u) => ids.has(u.id)))}>
          Save
        </button>
        <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function CompetenciesPanel({ lms }: { lms: CourseLmsState }) {
  const live = useOptionalTeacherLive();
  const [resource, setResource] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  return (
    <section className="mh-lms-comp">
      <div className="mh-lms-comp__main">
        <div className="mh-lms-toolbar">
          <h2>Course competencies</h2>
          <button type="button" className="mh-teacher-btn" onClick={() => setAdding(true)}>
            Add competencies to course
          </button>
        </div>
        {adding ? (
          <form
            className="mh-lms-inline"
            onSubmit={(e) => {
              e.preventDefault();
              void live?.runAction?.(
                "Add competencies to course",
                JSON.stringify({ Name: name || "Course competency", Resource: resource }),
              );
              setName("");
              setAdding(false);
            }}
          >
            <input className="mh-teacher-field" value={name} placeholder="Competency name" onChange={(e) => setName(e.target.value)} />
            <button type="submit" className="mh-teacher-btn" disabled={live?.busy}>
              Add
            </button>
          </form>
        ) : null}
        <div className="mh-lms-comp__filters">
          <span className="mh-lms-comp__badge">
            <button
              type="button"
              className="mh-lms-comp__badge-clear"
              aria-label={resource ? "Clear filter" : "No filters applied"}
              onClick={() => setResource("")}
            >
              ×
            </button>
            {resource || "No filters applied"}
          </span>
          <label className="mh-lms-comp__filter-select">
            <span className="mh-teacher-sr-only">Filter competencies by resource or activity</span>
            <select
              className="mh-teacher-field"
              value={resource}
              onChange={(e) => setResource(e.target.value)}
              aria-label="Filter competencies by resource or activity"
            >
              <option value="">Filter competencies by resource or activity</option>
              {lms.topics.flatMap((t) => t.activities).map((a) => (
                <option key={a.id || a.name} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mh-lms-comp__info">
          Competency ratings in this course are updated immediately in learning plans.
          <button type="button" className="mh-lms-gear" aria-label="Competency settings">
            ⚙
          </button>
        </p>
        {lms.competencies.length === 0 ? (
          <p className="mh-teacher-muted">{lms.competencyEmpty}</p>
        ) : (
          <div className="mh-teacher-list">
            {lms.competencies
              .filter((item) => !resource || item.resource === resource)
              .map((item) => (
              <div key={item.id} className="mh-teacher-list__item">
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.resource || "Course"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="mh-teacher-link" onClick={() => void live?.runAction?.("Manage competencies and frameworks")}>
          Manage competencies and frameworks
        </button>
      </div>
    </section>
  );
}

function AddCourseBadgePanel({ lms, onCancel }: { lms: CourseLmsState; onCancel: () => void }) {
  const live = useOptionalTeacherLive();
  const [open, setOpen] = useState({ details: true, issuer: true, expiry: false });
  const [values, setValues] = useState({
    Name: "",
    Version: "",
    Language: lms.badgeForm.languages[0]?.value || "English",
    Description: "",
    Image: "",
    "Image author's name": "",
    "Image author's email": "",
    "Image author's URL": "",
    "Image caption": "",
    "Issuer Name": lms.badgeForm.issuerName,
    Contact: lms.badgeForm.issuerContact,
  });
  const set = (label: string, value: string) => setValues((prev) => ({ ...prev, [label]: value }));
  const expandAll = () => setOpen({ details: true, issuer: true, expiry: true });

  return (
    <section className="mh-teacher-card mh-lms-badge">
      <div className="mh-lms-toolbar">
        <h2>Add a new badge</h2>
        <button type="button" className="mh-teacher-link" onClick={expandAll}>
          Expand all
        </button>
      </div>
      <details open={open.details} onToggle={(e) => setOpen((p) => ({ ...p, details: (e.target as HTMLDetailsElement).open }))}>
        <summary>Badge details</summary>
        <div className="mh-teacher-fields">
          <label>
            <span>
              Name <RequiredMark />
            </span>
            <input className="mh-teacher-field" value={values.Name} onChange={(e) => set("Name", e.target.value)} required />
          </label>
          <label>
            <span>
              Version <HelpIcon text="Optional badge version identifier." />
            </span>
            <input className="mh-teacher-field" value={values.Version} onChange={(e) => set("Version", e.target.value)} />
          </label>
          <label>
            <span>
              Language <HelpIcon text="Language for the badge name and description." />
            </span>
            <select className="mh-teacher-field" value={values.Language} onChange={(e) => set("Language", e.target.value)}>
              {lms.badgeForm.languages.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>
              Description <RequiredMark />
            </span>
            <textarea className="mh-teacher-field mh-teacher-field--tall" rows={5} value={values.Description} onChange={(e) => set("Description", e.target.value)} />
          </label>
          <label>
            <span>
              Image <RequiredMark /> <HelpIcon text="Upload a badge image." />
            </span>
            <div className="mh-teacher-dropzone">
              <input type="file" accept=".gif,.jpe,.jpeg,.jpg,.png,image/gif,image/jpeg,image/png" onChange={(e) => set("Image", e.target.files?.[0]?.name || "")} />
              <ul className="mh-lms-badge__types">
                {lms.badgeForm.imageTypes.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              {values.Image ? <p>{values.Image}</p> : <p className="mh-teacher-muted">0 B · 0%</p>}
            </div>
          </label>
          <label>
            <span>
              Image author&apos;s name <HelpIcon text="Person who created the image." />
            </span>
            <input className="mh-teacher-field" value={values["Image author's name"]} onChange={(e) => set("Image author's name", e.target.value)} />
          </label>
          <label>
            <span>
              Image author&apos;s email <HelpIcon text="Contact email for the image author." />
            </span>
            <input className="mh-teacher-field" value={values["Image author's email"]} onChange={(e) => set("Image author's email", e.target.value)} />
          </label>
          <label>
            <span>
              Image author&apos;s URL <HelpIcon text="Website for the image author." />
            </span>
            <input className="mh-teacher-field" value={values["Image author's URL"]} onChange={(e) => set("Image author's URL", e.target.value)} />
          </label>
          <label>
            <span>
              Image caption <HelpIcon text="Caption shown with the badge image." />
            </span>
            <input className="mh-teacher-field" value={values["Image caption"]} onChange={(e) => set("Image caption", e.target.value)} />
          </label>
        </div>
      </details>
      <details open={open.issuer} onToggle={(e) => setOpen((p) => ({ ...p, issuer: (e.target as HTMLDetailsElement).open }))}>
        <summary>Issuer details</summary>
        <div className="mh-teacher-fields">
          <label>
            <span>
              Name <RequiredMark /> <HelpIcon text="Organization that issues this badge." />
            </span>
            <input className="mh-teacher-field" value={values["Issuer Name"]} onChange={(e) => set("Issuer Name", e.target.value)} />
          </label>
          <label>
            <span>
              Contact <HelpIcon text="Issuer contact email." />
            </span>
            <input className="mh-teacher-field" value={values.Contact} onChange={(e) => set("Contact", e.target.value)} />
          </label>
        </div>
      </details>
      <details open={open.expiry} onToggle={(e) => setOpen((p) => ({ ...p, expiry: (e.target as HTMLDetailsElement).open }))}>
        <summary>Badge expiry</summary>
        <p className="mh-teacher-muted">Set when this badge expires after it is issued.</p>
      </details>
      <p className="mh-lms-legend">
        <RequiredMark /> Required
      </p>
      <div className="mh-lms-toolbar">
        <button
          type="button"
          className="mh-teacher-btn"
          disabled={live?.busy || !values.Name.trim() || !values.Description.trim() || !values.Image.trim()}
          onClick={() => void live?.runAction?.("Create badge", JSON.stringify(values))}
        >
          Create badge
        </button>
        <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}

function PlaceholderPanel({ title, body }: { title: string; body: string }) {
  return (
    <section className="mh-teacher-card">
      <h2>{title}</h2>
      <p className="mh-teacher-muted">{body}</p>
    </section>
  );
}

function ChooseQuestionTypePanel({
  onAdd,
  onCancel,
}: {
  onAdd: (type: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<(typeof QUESTION_TYPES)[number]["label"]>("Multiple choice");
  return (
    <section className="mh-teacher-card mh-lms-qchoose">
      <h2>Choose a question type to add</h2>
      <p className="mh-teacher-muted">Select a type, then click Add to open the question form.</p>
      <div className="mh-lms-qchoose__list" role="radiogroup" aria-label="Question type">
        {QUESTION_TYPES.map((type) => (
          <label key={type.label} className={selected === type.label ? "is-active" : ""}>
            <input
              type="radio"
              name="question-type"
              value={type.label}
              checked={selected === type.label}
              onChange={() => setSelected(type.label)}
            />
            <span>
              <strong>{type.label}</strong>
              <em>{type.help}</em>
            </span>
          </label>
        ))}
      </div>
      <div className="mh-lms-toolbar">
        <button type="button" className="mh-teacher-btn" onClick={() => onAdd(selected)}>
          Add
        </button>
        <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}

function AddQuestionPanel({
  type,
  existing,
  lms,
  courseCode,
  onCancel,
}: {
  type: string;
  existing?: CourseLmsQuestion;
  lms: CourseLmsState;
  courseCode: string;
  onCancel: () => void;
}) {
  const live = useOptionalTeacherLive();
  const known = QUESTION_TYPES.some((item) => item.label === type);
  const typeLabel = existing?.type || (known ? type : "Multiple choice");
  const editing = Boolean(existing);
  const [category, setCategory] = useState(
    existing?.name?.includes("historically informed") ? "quiz-5" : lms.questionBank.category,
  );
  const [name, setName] = useState(existing?.name || "");
  const [text, setText] = useState(existing?.text || "");
  const [status, setStatus] = useState(existing?.status === "Draft" ? "Draft" : "Ready");
  const [mark, setMark] = useState(existing?.mark || "1");
  const [feedback, setFeedback] = useState(existing?.feedback || "");
  const [answers, setAnswers] = useState(
    existing?.answers?.filter(Boolean).length
      ? [...(existing.answers || []), "", "", "", ""].slice(0, 4)
      : ["", "", "", ""],
  );
  const [correct, setCorrect] = useState(existing?.correct ?? 0);
  const [tf, setTf] = useState(existing?.trueFalse || "True");
  const [short, setShort] = useState(existing?.shortAnswer || "");
  const [pairs, setPairs] = useState(
    existing?.pairs?.length
      ? [...existing.pairs, { q: "", a: "" }, { q: "", a: "" }, { q: "", a: "" }].slice(0, 3)
      : [
          { q: "", a: "" },
          { q: "", a: "" },
          { q: "", a: "" },
        ],
  );
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const nextName = String(fd.get("Name") || name).trim();
    const nextText = String(fd.get("Text") || text).trim();
    if (!nextName || !nextText) {
      setError("Question name and question text are required.");
      return;
    }
    if (!live?.runAction) {
      setError("Could not save. Sign in and try again.");
      return;
    }
    setError("");
    const payload = {
      Id: existing?.id || "",
      Type: typeLabel,
      Name: nextName,
      Text: nextText,
      Course: courseCode,
      Category: String(fd.get("Category") || category),
      Mark: String(fd.get("Mark") || mark),
      Feedback: String(fd.get("Feedback") || feedback),
      Version: existing?.version || "v1",
      Status: status,
      CreatedByFirst: existing?.createdByFirst || "",
      CreatedByLast: existing?.createdByLast || "",
      Date: existing?.date || "",
      Comments: String(existing?.comments ?? 0),
      Usage: String(existing?.usage ?? 0),
      Answer1: String(fd.get("Answer1") || answers[0] || ""),
      Answer2: String(fd.get("Answer2") || answers[1] || ""),
      Answer3: String(fd.get("Answer3") || answers[2] || ""),
      Answer4: String(fd.get("Answer4") || answers[3] || ""),
      Correct: String(Number(fd.get("Correct") || correct) + (fd.get("Correct") ? 0 : 1)),
      TrueFalse: String(fd.get("TrueFalse") || tf),
      ShortAnswer: String(fd.get("ShortAnswer") || short),
      Match1: String(fd.get("Match1") || pairs[0]?.q || ""),
      Match1A: String(fd.get("Match1A") || pairs[0]?.a || ""),
      Match2: String(fd.get("Match2") || pairs[1]?.q || ""),
      Match2A: String(fd.get("Match2A") || pairs[1]?.a || ""),
      Match3: String(fd.get("Match3") || pairs[2]?.q || ""),
      Match3A: String(fd.get("Match3A") || pairs[2]?.a || ""),
    };
    const ok = await live.runAction(editing ? "Save question" : "Create a new question", JSON.stringify(payload));
    if (ok) onCancel();
    else setError("Question could not be saved.");
  }

  return (
    <section className="mh-teacher-card mh-lms-qform">
      <h2>{editing ? `Editing ${existing?.name || "question"}` : `Adding a ${typeLabel} question`}</h2>
      <form onSubmit={(e) => void save(e)}>
      <div className="mh-teacher-fields mh-lms-qform__fields">
        <label>
          <span>Category</span>
          <select className="mh-teacher-field" name="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {lms.questionBank.categories.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            Question name <RequiredMark />
          </span>
          <input
            className="mh-teacher-field"
            name="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ch1 Q11 — Case note purpose"
          />
        </label>
        <label>
          <span>
            Question text <RequiredMark />
          </span>
          <textarea
            className="mh-teacher-field"
            name="Text"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter the question students will see"
          />
        </label>
        <label>
          <span>Question status</span>
          <select className="mh-teacher-field" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>Ready</option>
            <option>Draft</option>
          </select>
        </label>
        <label>
          <span>Default mark</span>
          <input className="mh-teacher-field" name="Mark" value={mark} onChange={(e) => setMark(e.target.value)} inputMode="decimal" />
        </label>
        <label>
          <span>General feedback</span>
          <textarea className="mh-teacher-field" name="Feedback" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </label>
      </div>

      {typeLabel === "Multiple choice" ? (
        <div className="mh-lms-answers">
          <h3>Answers</h3>
          <div className="mh-lms-addform__fields">
            <label>
              <span>One or multiple answers?</span>
              <select className="mh-teacher-field" defaultValue="One answer only">
                <option>One answer only</option>
                <option>Multiple answers allowed</option>
              </select>
            </label>
            <label className="mh-lms-check">
              <input type="checkbox" defaultChecked />
              Shuffle the choices?
            </label>
            <label>
              <span>Number the choices?</span>
              <select className="mh-teacher-field" defaultValue="a., b., c. ...">
                <option>a., b., c. ...</option>
                <option>A., B., C. ...</option>
                <option>1., 2., 3. ...</option>
                <option>No numbering</option>
              </select>
            </label>
            <label>
              <span>Show standard instructions</span>
              <select className="mh-teacher-field" defaultValue="No">
                <option>No</option>
                <option>Yes</option>
              </select>
            </label>
          </div>
          <p className="mh-teacher-muted">Select the correct choice.</p>
          {answers.map((answer, idx) => (
            <label key={idx} className="mh-lms-answers__row">
              <input
                type="radio"
                name="Correct"
                value={idx + 1}
                checked={correct === idx}
                onChange={() => setCorrect(idx)}
                aria-label={`Mark choice ${idx + 1} correct`}
              />
              <input
                className="mh-teacher-field"
                name={`Answer${idx + 1}`}
                value={answer}
                placeholder={`Choice ${idx + 1}`}
                onChange={(e) => setAnswers((prev) => prev.map((item, i) => (i === idx ? e.target.value : item)))}
              />
              <select className="mh-teacher-field" defaultValue={idx === correct ? "100%" : "None"} aria-label={`Grade for choice ${idx + 1}`}>
                <option>None</option>
                <option>100%</option>
                <option>50%</option>
                <option>0%</option>
              </select>
              <select className="mh-teacher-field" defaultValue="Moodle auto-format" aria-label={`Format for choice ${idx + 1}`}>
                <option>Moodle auto-format</option>
                <option>HTML format</option>
                <option>Plain text format</option>
                <option>Markdown format</option>
              </select>
            </label>
          ))}
        </div>
      ) : null}

      {typeLabel === "True/False" ? (
        <label className="mh-lms-qform__block">
          <span>Correct answer</span>
          <select className="mh-teacher-field" name="TrueFalse" value={tf} onChange={(e) => setTf(e.target.value)}>
            <option>True</option>
            <option>False</option>
          </select>
        </label>
      ) : null}

      {typeLabel === "Short answer" ? (
        <label className="mh-lms-qform__block">
          <span>Answer</span>
          <input className="mh-teacher-field" name="ShortAnswer" value={short} onChange={(e) => setShort(e.target.value)} placeholder="Model answer" />
        </label>
      ) : null}

      {typeLabel === "Matching" ? (
        <div className="mh-lms-answers">
          <h3>Matching pairs</h3>
          {pairs.map((pair, idx) => (
            <div key={idx} className="mh-lms-answers__pair">
              <input
                className="mh-teacher-field"
                name={`Match${idx + 1}`}
                value={pair.q}
                placeholder={`Prompt ${idx + 1}`}
                onChange={(e) => setPairs((prev) => prev.map((item, i) => (i === idx ? { ...item, q: e.target.value } : item)))}
              />
              <input
                className="mh-teacher-field"
                name={`Match${idx + 1}A`}
                value={pair.a}
                placeholder={`Match ${idx + 1}`}
                onChange={(e) => setPairs((prev) => prev.map((item, i) => (i === idx ? { ...item, a: e.target.value } : item)))}
              />
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="mh-lms-qform__error">{error}</p> : null}
      <p className="mh-lms-legend">
        <RequiredMark /> Required
      </p>
      <div className="mh-lms-toolbar">
        <button type="submit" className="mh-teacher-btn" disabled={live?.busy}>
          {live?.busy ? "Saving…" : "Save changes"}
        </button>
        <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
      </form>
    </section>
  );
}
