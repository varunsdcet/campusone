"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FieldGrid, initialValues, loadRefOptions, lx, missingRequired, sectionsOf, useLocationMeta, type Data, type Field, type Meta, type RefOptions, type RefTarget, type Row } from "./shared";

export const SLUG: Record<string, string> = {
  brands: "brands",
  emailServices: "email-services",
  regions: "regions",
  provinces: "provinces",
  campuses: "campuses",
  classrooms: "classrooms",
  classroomTypes: "classroom-types",
  ministries: "ministries",
  institutions: "institutions",
  agreements: "agreements",
  bridgePrograms: "bridge-programs",
  transferCourses: "transfer-courses",
};

export type EntityForm = {
  meta: Meta | null;
  metaError: string | null;
  loadError: string | null;
  fields: Field[];
  values: Data | null;
  record: Row | null;
  refs: RefOptions;
  dirty: boolean;
  busy: boolean;
  setValue: (k: string, v: unknown) => void;
  save: (extra?: Data) => Promise<{ id: string; message: string }>;
  reloadRefs: () => void;
};

/** Loads field definitions, reference dropdowns and (when editing) the record; saves via POST / PATCH. */
export function useEntityForm(entity: string, id: string | null, opts: { parentId?: string; defaults?: Data; firstRef?: string } = {}): EntityForm {
  const { meta, error: metaError } = useLocationMeta();
  const fields = useMemo(() => meta?.entities[entity]?.fields ?? [], [meta, entity]);
  const [values, setValues] = useState<Data | null>(null);
  const [record, setRecord] = useState<Row | null>(null);
  const [refs, setRefs] = useState<RefOptions>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const snapshot = useRef("");
  const defaults = useRef(opts.defaults);
  const firstRef = useRef(id ? undefined : opts.firstRef);

  const reloadRefs = useCallback(() => {
    if (!meta) return;
    const targets = [...new Set(fields.filter((f) => f.kind === "ref").map((f) => f.ref!))] as RefTarget[];
    void loadRefOptions(targets, meta)
      .then((r) => {
        setRefs(r);
        const key = firstRef.current;
        const target = fields.find((f) => f.key === key)?.ref;
        const first = target ? r[target]?.[0]?.id : undefined;
        if (!key || !first) return;
        firstRef.current = undefined;
        setValues((s) => {
          if (!s || s[key]) return s;
          const pristine = JSON.stringify(s) === snapshot.current;
          const next = { ...s, [key]: first };
          if (pristine) snapshot.current = JSON.stringify(next);
          return next;
        });
      })
      .catch(() => setRefs({}));
  }, [meta, fields]);

  useEffect(() => {
    if (!meta) return;
    reloadRefs();
    if (id) {
      setValues(null);
      void lx<Row>(`/${SLUG[entity]}/${id}`)
        .then((r) => {
          const v = initialValues(fields, r);
          snapshot.current = JSON.stringify(v);
          setRecord(r);
          setValues(v);
        })
        .catch((e: Error) => setLoadError(e.message));
    } else {
      const v = initialValues(fields, defaults.current);
      snapshot.current = JSON.stringify(v);
      setRecord(null);
      setValues(v);
    }
  }, [meta, id, entity, fields, reloadRefs]);

  const setValue = useCallback((k: string, v: unknown) => setValues((s) => (s ? { ...s, [k]: v } : s)), []);

  async function save(extra?: Data) {
    if (!values) throw new Error("Form is still loading");
    const merged = { ...values, ...extra };
    const missing = missingRequired(fields, merged);
    if (missing.length) throw new Error(`Please complete: ${missing.join(", ")}`);
    const { hasPassword: _hp, ...body } = merged;
    void _hp;
    setBusy(true);
    try {
      const out = id
        ? await lx<{ id: string; message: string }>(`/${SLUG[entity]}/${id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await lx<{ id: string; message: string }>(`/${SLUG[entity]}`, { method: "POST", body: JSON.stringify({ ...body, ...(opts.parentId ? { parentId: opts.parentId } : {}) }) });
      snapshot.current = JSON.stringify(values);
      return out;
    } finally {
      setBusy(false);
    }
  }

  return {
    meta,
    metaError,
    loadError,
    fields,
    values,
    record,
    refs,
    dirty: values ? JSON.stringify(values) !== snapshot.current : false,
    busy,
    setValue,
    save,
    reloadRefs,
  };
}

/** One card per field section (or a single card), rendered from the server field definitions. */
export function EntitySections({
  form,
  only,
  title,
  accept,
  after,
}: {
  form: EntityForm;
  only?: string[];
  title?: string;
  accept?: Record<string, string>;
  after?: Record<string, ReactNode>;
}) {
  if (!form.meta || !form.values) return null;
  const fields = only ? form.fields.filter((f) => only.includes(f.key)) : form.fields;
  const sections = sectionsOf(fields);
  if (!sections.length || title)
    return (
      <section className="mh-sa__card">
        {title ? (
          <div className="mh-sa__card-head">
            <h2>{title}</h2>
          </div>
        ) : null}
        <FieldGrid fields={fields} values={form.values} setValue={form.setValue} meta={form.meta} refs={form.refs} accept={accept} />
        {title && after?.[title] ? after[title] : null}
      </section>
    );
  return (
    <>
      {sections.map((sec) => (
        <section key={sec.name} className="mh-sa__card">
          <div className="mh-sa__card-head">
            <h2>{sec.name}</h2>
          </div>
          <FieldGrid fields={sec.fields} values={form.values!} setValue={form.setValue} meta={form.meta!} refs={form.refs} accept={accept} />
          {after?.[sec.name] ?? null}
        </section>
      ))}
    </>
  );
}

/** Warn before leaving a form with unsaved edits. */
export function useLeaveGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);
}
