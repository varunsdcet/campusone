export function mailConfigured() {
  const url = process.env.HUMANITIX_SEND_MAIL_URL;
  return Boolean(url && url !== "off");
}

export async function sendMailViaHumanitix(input: {
  email: string;
  title: string;
  message: string;
}) {
  if (!mailConfigured()) {
    throw Object.assign(new Error("Mail is not configured"), { status: 503, code: "MAIL_OFF" });
  }
  const email = String(input.email || "").trim();
  if (!email) {
    throw Object.assign(new Error("Email is required"), { status: 400 });
  }

  const url = process.env.HUMANITIX_SEND_MAIL_URL;
  if (!url) throw Object.assign(new Error("Mail is not configured"), { status: 503, code: "MAIL_OFF" });
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      title: String(input.title || "MyHeritage").slice(0, 200),
      message: String(input.message || ""),
      email,
    }),
  });

  const raw = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    body = { raw };
  }

  if (!response.ok) {
    const detail = String(body.error || body.message || raw || `HTTP ${response.status}`);
    throw Object.assign(new Error(`send_mail failed: ${detail}`), { status: 502, code: "MAIL_FAILED" });
  }
  if (body.success === false) {
    throw Object.assign(new Error(`send_mail failed: ${String(body.error || body.message || "unknown")}`), {
      status: 502,
      code: "MAIL_FAILED",
    });
  }
  return body;
}
