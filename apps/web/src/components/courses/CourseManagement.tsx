"use client";

import { useEffect, type ComponentType } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CourseDirectory, CourseFormPage, CoursePage, SessionFormPage } from "./Courses";
import { ActiveCourses, PendingSessions, ViewCourse } from "./Delivery";
import { BackupsScreen, RepositoryDirectory, RepositoryForm, RepositoryManage } from "./Repository";
import {
  BadgeForm,
  BadgeList,
  CategoryForm,
  CategoryList,
  CompetencyForm,
  CompetencyList,
  GradingForm,
  GradingList,
  GroupForm,
  GroupList,
  ResourcesScreen,
  TestForm,
  TestList,
  TextbookForm,
  TextbookList,
  TypeForm,
  TypeList,
} from "./Config";
import { AssignEvaluation, AssignedResults, EvaluationForm, EvaluationList, EvaluationResults, QuestionBank } from "./Evaluations";
import { Frame, HREF } from "./kit";

const crud = (list: ComponentType, form: ComponentType, base: string): Record<string, ComponentType> => ({ [base]: list, [`${base}/new`]: form, [`${base}/edit`]: form });

const SCREENS: Record<string, ComponentType> = {
  courses: CourseDirectory,
  "courses/new": CourseFormPage,
  "courses/view": CoursePage,
  "courses/session": SessionFormPage,
  pending: PendingSessions,
  active: ActiveCourses,
  "active/view": ViewCourse,
  repository: RepositoryDirectory,
  "repository/new": RepositoryForm,
  "repository/edit": RepositoryForm,
  "repository/manage": RepositoryManage,
  backups: BackupsScreen,
  ...crud(TextbookList, TextbookForm, "textbooks"),
  ...crud(TestList, TestForm, "tests"),
  ...crud(CategoryList, CategoryForm, "categories"),
  ...crud(GroupList, GroupForm, "groups"),
  ...crud(TypeList, TypeForm, "types"),
  resources: ResourcesScreen,
  ...crud(BadgeList, BadgeForm, "badges"),
  ...crud(CompetencyList, CompetencyForm, "competencies"),
  ...crud(GradingList, GradingForm, "grading"),
  ...crud(EvaluationList, EvaluationForm, "evaluations"),
  "evaluations/assign": AssignEvaluation,
  questions: QuestionBank,
  results: AssignedResults,
  "results/view": EvaluationResults,
};

export function CourseManagement() {
  const params = useParams<{ slug?: string[] }>();
  const router = useRouter();
  const key = (params?.slug ?? []).join("/");
  const Screen = Object.hasOwn(SCREENS, key) ? SCREENS[key] : undefined;
  useEffect(() => {
    if (!key) router.replace(HREF.courses);
  }, [key, router]);
  if (Screen) return <Screen key={key} />;
  return key ? <NotFound /> : null;
}

function NotFound() {
  return (
    <Frame title="Page not found" crumbs={["Not found"]} active={HREF.courses}>
      <section className="mh-sa__card">
        <p>This Course Management page does not exist. The link may be mistyped or the page may have moved.</p>
        <p>
          <Link className="mh-sa__btn mh-sa__btn--primary" href={HREF.courses}>
            Go to Manage Courses &amp; Sessions
          </Link>
        </p>
      </section>
    </Frame>
  );
}
