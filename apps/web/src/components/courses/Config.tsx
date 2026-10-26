"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { SaModal } from "@/components/superadmin/shared";
import { GradingPreview } from "./Courses";
import { EntityList, EntityPage, yes } from "./Entities";
import { EntityModal, HREF, arr, money, str, useNotice, type Row } from "./kit";

const useId = () => useSearchParams()?.get("id") || null;
const muted = (t: string) => <span className="cm-muted">{t}</span>;
const pill = (on: boolean, yesText = "Active", noText = "Inactive") => <span className={`cm-pill${on ? " cm-pill--on" : ""}`}>{on ? yesText : noText}</span>;
const isActive = (r: Row, key = "active") => str(r[key]) !== "Inactive";

/* ------------------------------------------------------------------ */
/* Course Textbooks (master catalogue)                                  */
/* ------------------------------------------------------------------ */

export function TextbookList() {
  return (
    <EntityList
      entity="textbooks"
      label="Textbook"
      title="Course Textbooks"
      crumb="Course Textbooks"
      active={HREF.textbooks}
      createLabel="Add Textbook"
      formHref={HREF.textbooks}
      empty="No textbooks were found."
      columns={[
        {
          label: "Textbook",
          cell: (r) => (
            <div className="cm-stack">
              <strong>{str(r.name)}</strong>
              <span className="cm-muted">
                {str(r.format) || "Format not set"}
                {arr(r._courses).length ? ` · ${arr(r._courses).length} course(s)` : ""}
              </span>
            </div>
          ),
        },
        { label: "ISBN", cell: (r) => str(r.isbn) || muted("—") },
        {
          label: "Price",
          cell: (r) => (
            <div className="cm-stack">
              <span>Domestic: {money(r.domestic)}</span>
              <span className="cm-muted">International: {money(r.international)}</span>
            </div>
          ),
        },
      ]}
    />
  );
}

export function TextbookForm() {
  const id = useId();
  return <EntityPage entity="textbooks" id={id} title={id ? "Edit Textbook" : "Add Textbook"} crumbs={["Course Textbooks", id ? "Edit Textbook" : "Add Textbook"]} active={HREF.textbooks} back={HREF.textbooks} />;
}

/* ------------------------------------------------------------------ */
/* Entry & Progress Tests                                               */
/* ------------------------------------------------------------------ */

export function TestList() {
  return (
    <EntityList
      entity="tests"
      label="Entry / Progress Test"
      title="Manage Entry / Progress Tests"
      crumb="Entry & Progress Tests"
      active={HREF.tests}
      createLabel="Create Entry / Progress Test"
      formHref={HREF.tests}
      empty="No tests were found."
      columns={[
        {
          label: "Entry / Progress Test",
          cell: (r) => (
            <div className="cm-stack">
              <strong>{str(r.name)}</strong>
              <span className="cm-muted">
                {str(r._scheme) || "No grading scheme"}
                {r.enableLms ? " · Moodle LMS enabled" : ""}
              </span>
            </div>
          ),
        },
        {
          label: "Fees",
          cell: (r) => (
            <div className="cm-stack">
              <span>Domestic: {money(r.domestic)}</span>
              <span className="cm-muted">International: {money(r.international)}</span>
            </div>
          ),
        },
        { label: "Instructor(s)", cell: (r) => (arr(r._instructors).length ? arr(r._instructors).map(String).join(", ") : muted("Not Set")) },
      ]}
    />
  );
}

export function TestForm() {
  const id = useId();
  const title = id ? "Edit Entry / Progress Test" : "Add Entry / Progress Test";
  return (
    <EntityPage
      entity="tests"
      id={id}
      title={title}
      crumbs={["Entry & Progress Tests", title]}
      active={HREF.tests}
      back={HREF.tests}
      after={(form) => ({ Grading: <GradingPreview schemeId={str(form.values?.gradingScheme)} full /> })}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Course Categories                                                    */
/* ------------------------------------------------------------------ */

export function CategoryList() {
  return (
    <EntityList
      entity="categories"
      label="Course Category"
      title="Manage Course Categories"
      crumb="Course Categories"
      active={HREF.categories}
      createLabel="Create Course Category"
      formHref={HREF.categories}
      empty="No course categories were found."
      columns={[
        {
          label: "Course Category Name",
          cell: (r) => (
            <div className="cm-stack">
              <strong>{str(r.name)}</strong>
              <span className="cm-muted">
                {str(r._parent) && str(r._parent) !== "Primary Category" ? `Under ${str(r._parent)} · ` : ""}
                {Number(r._courses) || 0} course(s)
              </span>
            </div>
          ),
        },
        { label: "Abbreviation", cell: (r) => str(r.abbreviation) || muted("—") },
        { label: "Active", cell: (r) => pill(isActive(r)) },
      ]}
    />
  );
}

export function CategoryForm() {
  const id = useId();
  const title = id ? "Edit Course Category" : "Add Course Category";
  return <EntityPage entity="categories" id={id} title={title} crumbs={["Course Categories", title]} active={HREF.categories} back={HREF.categories} />;
}

/* ------------------------------------------------------------------ */
/* Course Groups                                                        */
/* ------------------------------------------------------------------ */

export function GroupList() {
  return (
    <EntityList
      entity="groups"
      label="Course Group"
      title="Manage Course Groups"
      crumb="Course Groups"
      active={HREF.groups}
      createLabel="Create Course Group"
      formHref={HREF.groups}
      empty="No course groups were found."
      deleteTitle="Delete Course Group"
      deleteLabel="Delete Course Group"
      deleteBody={(r) => (
        <p>
          You are about to delete the course group <strong>{str(r.name)}</strong>. Courses using this group must be moved to another group first. Are you sure you want to delete it?
        </p>
      )}
      columns={[
        { label: "Course Group Name", cell: (r) => <strong>{str(r.name)}</strong> },
        { label: "Abbreviation", cell: (r) => str(r.abbreviation) || muted("—") },
      ]}
    />
  );
}

export function GroupForm() {
  const id = useId();
  const title = id ? "Edit Course Group" : "Add Course Group";
  return <EntityPage entity="groups" id={id} title={title} crumbs={["Course Groups", title]} active={HREF.groups} back={HREF.groups} />;
}

/* ------------------------------------------------------------------ */
/* Course Types                                                         */
/* ------------------------------------------------------------------ */

export function TypeList() {
  return (
    <EntityList
      entity="types"
      label="Course Type"
      title="Manage Course Types"
      crumb="Course Types"
      active={HREF.types}
      createLabel="Create Course Type"
      formHref={HREF.types}
      empty="No course types were found."
      columns={[
        {
          label: "Course Type Name",
          cell: (r) => (
            <div className="cm-stack">
              <strong>{str(r.name)}</strong>
              <span className="cm-muted">
                {str(r.learningStyle) || "Learning style not set"}
                {str(r.asynchronous) === "Yes" ? " · Asynchronous" : ""}
              </span>
            </div>
          ),
        },
        { label: "Abbreviation", cell: (r) => str(r.abbreviation) || muted("—") },
        { label: "Active", cell: (r) => pill(isActive(r)) },
      ]}
    />
  );
}

export function TypeForm() {
  const id = useId();
  const title = id ? "Edit Course Type" : "Add Course Type";
  return <EntityPage entity="types" id={id} title={title} crumbs={["Course Types", title]} active={HREF.types} back={HREF.types} />;
}

/* ------------------------------------------------------------------ */
/* Course Resources (resource categories + resources; not Repository)   */
/* ------------------------------------------------------------------ */

export function ResourcesScreen() {
  return (
    <EntityList
      entity="resources"
      label="Course Resource"
      title="Manage Course Resources"
      crumb="Course Resources"
      active={HREF.resources}
      createLabel="Create Resource"
      modal={{ createTitle: "Create Resource", editTitle: "Edit Resource", saveLabel: "Save Resource" }}
      empty="No course resources were found."
      filterPlaceholder="Enter Resource Name"
      toolbar={<ResourceCategoryButton />}
      columns={[
        { label: "Resource Name", cell: (r) => <strong>{str(r.name)}</strong> },
        { label: "Course", cell: (r) => str(r._course) || muted("Course no longer in catalogue") },
        { label: "Category", cell: (r) => str(r._category) || muted("No Category") },
        { label: "Quantities", cell: (r) => yes(r.allowQuantities) },
      ]}
    />
  );
}

function ResourceCategoryButton() {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const notice = useNotice();
  return (
    <>
      <button type="button" className="mh-sa__btn" onClick={() => setAdding(true)}>
        Create Category
      </button>
      <button type="button" className="mh-sa__btn" onClick={() => setOpen(true)}>
        Resource Categories
      </button>
      {notice.node}
      {adding ? (
        <EntityModal
          entity="resourceCategories"
          id={null}
          title="Add Course Resource Category"
          saveLabel="Save Resource Category"
          onClose={() => setAdding(false)}
          onSaved={(out) => {
            setAdding(false);
            notice.ok(out.message);
          }}
        />
      ) : null}
      {open ? (
        <SaModal title="Resource Categories" onClose={() => setOpen(false)} wide>
          <EntityList
            embedded
            entity="resourceCategories"
            label="Resource Category"
            title="Course Resource Categories"
            crumb="Course Resources"
            active={HREF.resources}
            createLabel="Create Category"
            modal={{ createTitle: "Add Course Resource Category", editTitle: "Edit Course Resource Category", saveLabel: "Save Resource Category" }}
            filterPlaceholder={null}
            empty="No resource categories have been created."
            columns={[
              { label: "Category Name", cell: (r) => <strong>{str(r.name)}</strong> },
              { label: "Resources", cell: (r) => String(Number(r._resources) || 0) },
            ]}
          />
        </SaModal>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Badges & Accomplishments (central configuration)                     */
/* ------------------------------------------------------------------ */

export function BadgeList() {
  return (
    <EntityList
      entity="badges"
      label="Badge / Accomplishment"
      title="Badges & Accomplishments"
      crumb="Badges & Accomplishments"
      active={HREF.badges}
      createLabel="Add Badge / Accomplishment"
      formHref={HREF.badges}
      empty="No badges or accomplishments were found."
      columns={[
        {
          label: "Name",
          cell: (r) => (
            <div className="cm-stack">
              <strong>{str(r.name)}</strong>
              {str(r.description) ? <span className="cm-muted">{str(r.description)}</span> : null}
            </div>
          ),
        },
        { label: "Badge Type", cell: (r) => str(r.badgeType) || muted("—") },
        { label: "Badge Approval", cell: (r) => str(r.approval) || muted("—") },
      ]}
    />
  );
}

export function BadgeForm() {
  const id = useId();
  const title = id ? "Edit Badge / Accomplishment" : "Add Badge / Accomplishment";
  return <EntityPage entity="badges" id={id} title={title} crumbs={["Badges & Accomplishments", title]} active={HREF.badges} back={HREF.badges} />;
}

/* ------------------------------------------------------------------ */
/* Competencies                                                         */
/* ------------------------------------------------------------------ */

export function CompetencyList() {
  return (
    <EntityList
      entity="competencies"
      label="Competency"
      title="Competencies"
      crumb="Competencies"
      active={HREF.competencies}
      createLabel="Create Competency"
      formHref={HREF.competencies}
      empty="No competencies were found."
      columns={[
        { label: "Name", cell: (r) => <strong>{str(r.name)}</strong> },
        { label: "Status", cell: (r) => pill(isActive(r, "status")) },
      ]}
    />
  );
}

export function CompetencyForm() {
  const id = useId();
  const title = id ? "Edit Competency" : "Create Competency";
  return <EntityPage entity="competencies" id={id} title={title} crumbs={["Competencies", title]} active={HREF.competencies} back={HREF.competencies} />;
}

/* ------------------------------------------------------------------ */
/* Grading Schemes                                                      */
/* ------------------------------------------------------------------ */

export function GradingList() {
  return (
    <EntityList
      entity="gradingSchemes"
      label="Grading Scheme"
      title="Manage Grading Schemes"
      crumb="Grading Schemes"
      active={HREF.grading}
      createLabel="Create Grading Scheme"
      formHref={HREF.grading}
      empty="No grading schemes were found."
      columns={[
        {
          label: "Grading Scheme Name",
          cell: (r) => (
            <div className="cm-stack">
              <strong>
                {str(r.name)}
                {r.isDefault === true ? <span className="cm-pill cm-pill--info" style={{ marginLeft: 8 }}>Default</span> : null}
              </strong>
              <span className="cm-muted">{arr(r.grades).length} grade(s)</span>
            </div>
          ),
        },
        { label: "Active", cell: (r) => pill(isActive(r)) },
      ]}
    />
  );
}

export function GradingForm() {
  const id = useId();
  const title = id ? "Edit Grading Scheme" : "Add Grading Scheme";
  return <EntityPage entity="gradingSchemes" id={id} title={title} crumbs={["Grading Schemes", title]} active={HREF.grading} back={HREF.grading} />;
}
