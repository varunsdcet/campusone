"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SelfpacedShell } from "@/components/selfpaced/SelfpacedShell";
import { api, ApiError } from "@/lib/api";

type VerifiedCertificate = {
  certificateId: string;
  holderName: string;
  title: string;
  status: string;
  issuedAt: string | null;
};

type VerifyState =
  | { kind: "loading" }
  | { kind: "found"; certificate: VerifiedCertificate }
  | { kind: "missing" }
  | { kind: "error" };

export default function VerifyCertificatePage() {
  const params = useParams<{ certificateId: string }>();
  const id = params.certificateId || "";
  const [state, setState] = useState<VerifyState>({ kind: "loading" });

  useEffect(() => {
    if (!id) {
      setState({ kind: "missing" });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    api<VerifiedCertificate>(`/public/certificates/${encodeURIComponent(id)}`, {}, undefined, { skipAuthRedirect: true })
      .then((certificate) => {
        if (!cancelled) setState({ kind: "found", certificate });
      })
      .catch((err) => {
        if (cancelled) return;
        setState(err instanceof ApiError && (err.status === 404 || err.status === 400) ? { kind: "missing" } : { kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.kind === "loading") {
    return (
      <SelfpacedShell>
        <div className="sp-verify">
          <p>Checking certificate…</p>
        </div>
      </SelfpacedShell>
    );
  }

  if (state.kind === "found") {
    const { certificate } = state;
    const revoked = certificate.status === "revoked";
    return (
      <SelfpacedShell>
        <div className="sp-verify">
          <p className="sp-kicker">CERTIFICATE VERIFICATION</p>
          <h1>{revoked ? "Certificate revoked" : "Certificate verified"}</h1>
          <p className="sp-lede">
            <strong>{certificate.certificateId}</strong> was issued to {certificate.holderName} · {certificate.title}
            {certificate.issuedAt ? ` · ${new Date(certificate.issuedAt).toLocaleDateString("en-CA")}` : ""}
          </p>
          {revoked ? (
            <p className="sp-tuition__note">CampusOne has revoked this certificate. It is no longer valid.</p>
          ) : (
            <p className="sp-tuition__note">This record was confirmed against CampusOne records.</p>
          )}
        </div>
      </SelfpacedShell>
    );
  }

  return (
    <SelfpacedShell>
      <div className="sp-verify">
        <p className="sp-kicker">CERTIFICATE VERIFICATION</p>
        <h1>{state.kind === "missing" ? "No certificate found" : "Verification unavailable"}</h1>
        <p className="sp-lede">
          {state.kind === "missing"
            ? "We could not find a certificate with that ID."
            : "We could not reach CampusOne records. Try again shortly."}
        </p>
        <Link href="/selfpaced" className="sp-btn sp-btn--primary">
          CampusOne eLearning
        </Link>
      </div>
    </SelfpacedShell>
  );
}
