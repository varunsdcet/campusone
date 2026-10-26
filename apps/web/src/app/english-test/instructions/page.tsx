import Link from "next/link";
import { SelfpacedShell } from "@/components/selfpaced/SelfpacedShell";

export default function EnglishTestInstructionsPage() {
  return (
    <SelfpacedShell>
      <section style={{ maxWidth: 820, margin: "0 auto", padding: "56px 20px 80px" }}>
        <p className="sp-kicker">HCC ENGLISH TEST</p>
        <h1>Student instructions</h1>
        <div className="sp-lede">
          <p>Enter your legal identity and current contact details exactly as they appear on your records. If you already have a CampusOne Student ID, enter it twice so the registrar can safely link the profile.</p>
          <p>Saving this form registers your profile for review. It does not start a test, approve admission, or enrol you in a programme. The registrar will contact you with the scheduled test details and credentials.</p>
          <p>Use the institutions field only for organisations you authorize to receive the reviewed result.</p>
        </div>
        <Link href="/english-test" className="sp-btn sp-btn--primary">Return to registration</Link>
      </section>
    </SelfpacedShell>
  );
}
