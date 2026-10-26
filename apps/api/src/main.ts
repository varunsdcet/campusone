import express, { type Express } from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { authRouter } from "./modules/auth/auth.router.js";
import { gradesRouter } from "./modules/grades/grades.router.js";
import { approvalsRouter } from "./modules/approvals/approvals.router.js";
import { messagesRouter } from "./modules/messages/messages.router.js";
import { searchRouter } from "./modules/search/search.router.js";
import { meRouter } from "./modules/me/me.router.js";
import { coursesRouter } from "./modules/courses/courses.router.js";
import { notificationsRouter } from "./modules/notifications/notifications.router.js";
import { calendarRouter } from "./modules/calendar/calendar.router.js";
import { documentExpressApp, openApiDocument } from "./openapi.js";
import { catalogRouter } from "./modules/catalog/catalog.router.js";
import { portalRouter } from "./modules/portal/portal.router.js";
import { adminRouter } from "./modules/admin/admin.router.js";
import { instructorRouter } from "./modules/instructor/instructor.router.js";
import { studentRouter } from "./modules/student/student.router.js";
import { plannerRouter } from "./modules/student/planner.router.js";
import { academicRouter } from "./modules/academic/academic.router.js";
import { aiRouter } from "./modules/ai/ai.router.js";
import { applicantRouter } from "./modules/applicant/applicant.router.js";
import { employerRouter } from "./modules/employer/employer.router.js";
import { mailRouter } from "./modules/mail/mail.router.js";
import { campusComplianceRouter } from "./modules/campusCompliance/campusCompliance.router.js";
import { liveRouter } from "./modules/live/live.router.js";
import { lmsFilesRouter } from "./modules/instructor/lmsFiles.router.js";
import { publicRouter } from "./modules/public/public.router.js";
import { selfpacedRouter } from "./modules/selfpaced/selfpaced.router.js";
import { errorHandler } from "./middleware/error-handler.js";
import { trustProxySetting } from "./lib/clientIp.js";
import { sensitiveEndpointRateLimit } from "./middleware/rateLimit.js";

const app: Express = express();
app.set("trust proxy", trustProxySetting(process.env.TRUST_PROXY));
const allowedOrigins = (process.env.WEB_ORIGIN ??
  "https://myvccbc.com,http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin tools / server-to-server (no Origin) and listed browser origins
      if (!origin || allowedOrigins.includes(origin) || (process.env.NODE_ENV !== "production" && allowedOrigins.includes("*"))) {
        cb(null, true);
        return;
      }
      try {
        const parsed = new URL(origin);
        if (process.env.NODE_ENV !== "production" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
          cb(null, true);
          return;
        }
      } catch {
        // Invalid origins are rejected below.
      }
      cb(null, false);
    },
    credentials: true,
  }),
);
app.use("/student", express.json({ limit: "15mb" }));
app.use("/applicant", express.json({ limit: "15mb" }));
app.use("/admin/super", express.json({ limit: "2mb" }));
app.use("/admin/heritage", express.json({ limit: "12mb" }));
app.use("/lms-files", express.json({ limit: "12mb" }));
app.use(express.json());
app.use(sensitiveEndpointRateLimit);
app.use((req, _res, next) => {
  (req as express.Request & { correlationId: string }).correlationId =
    (req.header("x-correlation-id") as string) || randomUUID();
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "myheritage-api" }));
app.get("/api/openapi.json", (_req, res) => res.json(openApiDocument));
app.get("/api/docs", (_req, res) => {
  res.type("html").send(`<!doctype html><html><body style="font-family:sans-serif;padding:2rem">
  <h1>MyHeritage API</h1>
  <p>OpenAPI JSON: <a href="/api/openapi.json">/api/openapi.json</a></p>
  <ul>
    <li>POST /auth/login</li>
    <li>GET /me/home</li>
    <li>GET /courses/me</li>
    <li>GET /notifications/me</li>
    <li>GET /calendar/me</li>
    <li>GET /grades/me</li>
    <li>GET /gradebooks/:sectionId</li>
    <li>PATCH /grade-items/:id</li>
    <li>POST /gradebooks/:sectionId/publish</li>
    <li>GET /approvals</li>
    <li>POST /approvals/:id/decide</li>
    <li>POST /approvals/:id/apply</li>
    <li>POST /messages/ask-grade</li>
    <li>GET /search</li>
    <li>POST /ai/ask</li>
    <li>GET /ai/history</li>
    <li>POST /auth/forgot-password</li>
    <li>POST /auth/reset-password</li>
    <li>GET /portal/view?path=</li>
    <li>GET /portal/bootstrap</li>
    <li>GET /admin/users</li>
    <li>POST /admin/users</li>
    <li>GET /admin/campus-overview</li>
    <li>GET /admin/sections</li>
    <li>POST /admin/sections</li>
    <li>POST /admin/enrolments</li>
    <li>POST /admin/assignments</li>
    <li>GET /admin/sis/screen?path=</li>
    <li>POST /admin/sis/action</li>
    <li>GET /instructor/sis/bootstrap</li>
    <li>GET /instructor/sis/screen?path=</li>
    <li>POST /instructor/sis/action</li>
    <li>GET /public/verify</li>
    <li>GET /public/certificates/:id</li>
    <li>POST /public/apply</li>
    <li>POST /selfpaced/certificates</li>
  </ul></body></html>`);
});

app.use("/auth", authRouter);
app.use("/me", meRouter);
app.use("/instructor", instructorRouter);
app.use("/student", studentRouter);
app.use("/student/planner", plannerRouter);
app.use("/student", academicRouter);
app.use("/courses", coursesRouter);
app.use("/notifications", notificationsRouter);
app.use("/calendar", calendarRouter);
app.use("/grades", gradesRouter);
app.use("/gradebooks", gradesRouter);
app.use("/grade-items", gradesRouter);
app.use("/approvals", approvalsRouter);
app.use("/messages", messagesRouter);
app.use("/mail", mailRouter);
app.use("/compliance", campusComplianceRouter);
app.use("/live", liveRouter);
app.use("/lms-files", lmsFilesRouter);
app.use("/search", searchRouter);
app.use("/ai", aiRouter);
app.use("/catalog", catalogRouter);
app.use("/portal", portalRouter);
app.use("/applicant", applicantRouter);
app.use("/employer", employerRouter);
app.use("/selfpaced", selfpacedRouter);
app.use("/admin", adminRouter);

app.use("/public", publicRouter);

documentExpressApp(app as Express & { _router?: { stack?: never[] } });
app.use(errorHandler);

const port = Number(process.env.API_PORT ?? 4000);
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`MyHeritage API listening on http://localhost:${port}`);
  });

  if (process.env.ENABLE_API_SCHEDULERS === "true") void import("./modules/applicant/governmentIdPurge.js")
    .then(({ purgeLegacyGovernmentIdData }) => purgeLegacyGovernmentIdData())
    .then((summary) => {
      if (summary.documents || summary.forms) console.log("government ID purge", summary);
    })
    .catch((err) => console.error("government ID purge failed", err));

  // Run background schedules on exactly one explicitly designated API instance.
  if (process.env.ENABLE_API_SCHEDULERS === "true") {
  // Campus compliance: pre-class reminders, miss escalation, teacher SLAs.
  const sweepMs = Number(process.env.COMPLIANCE_SWEEP_MS ?? 60_000);
  setTimeout(() => {
    void import("./modules/campusCompliance/sweep.js")
      .then(({ runComplianceSweep }) => runComplianceSweep())
      .then((summary) => console.log("compliance bootstrap sweep", summary))
      .catch((err) => console.error("compliance bootstrap failed", err));
  }, 8_000);
  setInterval(() => {
    void import("./modules/campusCompliance/sweep.js")
      .then(({ runComplianceSweep }) => runComplianceSweep())
      .then((summary) => {
        if (
          summary.warned ||
          summary.paused ||
          summary.attendanceSla ||
          summary.gradeSla ||
          summary.preclass ||
          summary.missReminders
        ) {
          console.log("compliance sweep", summary);
        }
      })
      .catch((err) => console.error("compliance sweep failed", err));
  }, Math.max(30_000, sweepMs));

  setInterval(() => {
    void import("./modules/admin/heritage/reports.js")
      .then(({ runDueReportSchedules }) => runDueReportSchedules())
      .then((summary) => {
        if (summary.ran) console.log("report schedule sweep", summary);
      })
      .catch((err) => console.error("report schedule sweep failed", err));
  }, Math.max(60_000, Number(process.env.REPORT_SWEEP_MS ?? 120_000)));
  }
}

export { app };
