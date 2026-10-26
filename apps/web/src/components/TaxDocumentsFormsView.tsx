"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, loadSession, openAuthenticatedPdf } from "@/lib/api";

export type TaxDoc = {
  id: string;
  docType: string;
  taxYear: number;
  title: string;
  status: string;
  issuedAt: string | null;
  downloadUrl: string | null;
};

type TaxPayload = {
  documents: TaxDoc[];
  formOptions?: Array<{ value: string; label: string }>;
  emptyNotice?: string | null;
};

export function TaxDocumentsFormsView({
  role,
  apiPath,
  shell,
  activeHref,
}: {
  role: "student" | "instructor";
  apiPath: string;
  activeHref: string;
  shell: (props: { children: ReactNode; userName: string }) => ReactNode;
}) {
  const router = useRouter();
  const [docs, setDocs] = useState<TaxDoc[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(role === "student" ? "Student" : "Instructor");
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setName(`${session.givenName} ${session.familyName}`.trim() || (role === "student" ? "Student" : "Instructor"));
    setLoading(true);
    api<TaxPayload>(apiPath, {}, session.accessToken)
      .then((d) => {
        setDocs(d.documents ?? []);
        setSelected("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load tax documents"))
      .finally(() => setLoading(false));
  }, [apiPath, router, role]);

  const options = useMemo(() => {
    return docs.map((d) => ({
      value: d.id,
      label: `${d.docType} — ${d.taxYear} · ${d.title}`,
      doc: d,
    }));
  }, [docs]);

  const chosen = options.find((o) => o.value === selected)?.doc ?? null;
  const empty = !loading && docs.length === 0;
  const pdfPath = chosen
    ? chosen.downloadUrl && (chosen.downloadUrl.startsWith("https://") || chosen.downloadUrl.includes("/pdf"))
      ? chosen.downloadUrl
      : `${apiPath}/${chosen.id}/pdf`
    : null;

  async function openChosen() {
    const session = loadSession();
    if (!session || !chosen || !pdfPath) return;
    setError(null);
    setOpening(true);
    try {
      await openAuthenticatedPdf(pdfPath, session.accessToken, `${chosen.docType}-${chosen.taxYear}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open tax document");
    } finally {
      setOpening(false);
    }
  }

  return (
    <>
      {shell({
        userName: name,
        children: (
          <div className="mh-hcc-page mh-sis-tax" data-role={role} data-stu={role === "student" ? "STU-22" : undefined}>
            <p className="mh-hcc-profile__crumb">
              Home <span>›</span> Tax Documents / Forms
            </p>
            <h1 className="mh-sis-tax__title">TAX DOCUMENTS / FORMS</h1>

            {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}

            <div className="mh-sis-tax__banner">GENERATE TAX DOCUMENTS / FORMS</div>

            <div className="mh-sis-tax__panel">
              <label className="mh-sis-tax__field">
                <span>Tax Document / Form</span>
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  disabled={loading || empty}
                >
                  <option value="">-- Select Tax Document / Form --</option>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              {chosen ? (
                <div className="mh-sis-tax__actions">
                  <button
                    type="button"
                    className="mh-sis-tax__download"
                    onClick={() => void openChosen()}
                    disabled={opening}
                  >
                    {opening ? "Opening…" : "Download / Open"}
                  </button>
                  <span className="mh-teacher-muted">
                    {chosen.status}
                    {chosen.issuedAt ? ` · Issued ${new Date(chosen.issuedAt).toLocaleDateString()}` : ""}
                  </span>
                </div>
              ) : null}
            </div>

            {empty ? (
              <div className="mh-sis-tax__notice" role="status">
                There are currently no tax documents or forms available.
              </div>
            ) : null}

            {!empty && !chosen && !loading ? (
              <p className="mh-teacher-muted" style={{ marginTop: 12 }}>
                Select a document above to download the generated form.
              </p>
            ) : null}
          </div>
        ),
      })}
    </>
  );
}
