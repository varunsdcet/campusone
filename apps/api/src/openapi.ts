type OpenApiOperation = {
  summary: string;
  security?: Array<{ bearer: never[] }>;
  "x-idempotent"?: boolean;
  "x-concurrency"?: string;
  "x-generated"?: boolean;
};

type OpenApiPath = Partial<Record<"get" | "post" | "put" | "patch" | "delete" | "options" | "head", OpenApiOperation>>;

export const openApiDocument: {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, OpenApiPath>;
  components: { securitySchemes: { bearer: { type: string; scheme: string } } };
} = {
  openapi: "3.0.3",
  info: { title: "MyHeritage API", version: "0.1.0" },
  paths: {
    "/auth/login": { post: { summary: "Password login", security: [], "x-idempotent": false } },
    "/auth/forgot-password": { post: { summary: "Request password reset email", security: [], "x-idempotent": false } },
    "/auth/reset-password": { post: { summary: "Reset password with token", security: [], "x-idempotent": false } },
    "/me/home": { get: { summary: "Role-aware home feed", security: [{ bearer: [] }] } },
    "/me/profile": { get: { summary: "Student profile", security: [{ bearer: [] }] } },
    "/me/access": { get: { summary: "Effective access level and module permissions", security: [{ bearer: [] }] } },
    "/me/preferences": { patch: { summary: "Update student preferences", security: [{ bearer: [] }] } },
    "/me/profile-change-requests": {
      post: { summary: "Request an official profile change", security: [{ bearer: [] }] },
    },
    "/courses/me": { get: { summary: "Courses for current user", security: [{ bearer: [] }] } },
    "/notifications/me": { get: { summary: "Notifications inbox", security: [{ bearer: [] }] } },
    "/notifications/me/{notificationId}/read": {
      patch: { summary: "Mark own notification read", security: [{ bearer: [] }], "x-idempotent": true },
    },
    "/notifications/me/read-all": {
      post: { summary: "Mark all own notifications read", security: [{ bearer: [] }], "x-idempotent": true },
    },
    "/calendar/me": { get: { summary: "Calendar events", security: [{ bearer: [] }] } },
    "/live/config": { get: { summary: "Live classroom provider (bigbluebutton | jitsi)", security: [{ bearer: [] }] } },
    "/live/sections/{sectionId}": {
      get: { summary: "Live class status for a section (role, running, participants)", security: [{ bearer: [] }] },
    },
    "/live/sections/{sectionId}/join": {
      post: {
        summary: "Signed BigBlueButton join URL — instructor joins as moderator, enrolled students as viewers",
        security: [{ bearer: [] }],
      },
    },
    "/live/sections/{sectionId}/end": { post: { summary: "End the live class for everyone (instructor)", security: [{ bearer: [] }] } },
    "/live/sections/{sectionId}/recordings": {
      get: { summary: "BigBlueButton recordings (students see published only)", security: [{ bearer: [] }] },
    },
    "/grades/me": { get: { summary: "Student published grades", security: [{ bearer: [] }] } },
    "/gradebooks/{sectionId}": { get: { summary: "Instructor gradebook", security: [{ bearer: [] }] } },
    "/grade-items/{id}": { patch: { summary: "Upsert draft grade", security: [{ bearer: [] }], "x-concurrency": "row_version" } },
    "/gradebooks/{sectionId}/publish": {
      post: { summary: "Request grade publish via approval", security: [{ bearer: [] }], "x-idempotent": true },
    },
    "/approvals": { get: { summary: "Approval inbox", security: [{ bearer: [] }] } },
    "/approvals/{id}/decide": { post: { summary: "Decide approval", security: [{ bearer: [] }] } },
    "/approvals/{id}/apply": { post: { summary: "Apply approved publish", security: [{ bearer: [] }] } },
    "/messages/ask-grade": { post: { summary: "Ask about a grade", security: [{ bearer: [] }] } },
    "/student/assignments": {
      get: { summary: "Student assignment list", security: [{ bearer: [] }] },
    },
    "/student/assignments/{assignmentId}": {
      get: { summary: "Student assignment detail", security: [{ bearer: [] }] },
    },
    "/student/assignments/{assignmentId}/files": {
      post: { summary: "Upload a student submission file", security: [{ bearer: [] }] },
    },
    "/student/submission-files/{fileId}": {
      delete: { summary: "Archive a student submission file", security: [{ bearer: [] }] },
    },
    "/student/assignments/{assignmentId}/submit": {
      post: { summary: "Submit a student assignment", security: [{ bearer: [] }], "x-idempotent": true },
    },
    "/student/degree-progress": {
      get: { summary: "Student degree progress analysis", security: [{ bearer: [] }] },
    },
    "/student/degree-scenarios": {
      post: { summary: "Run or save a what-if degree plan scenario", security: [{ bearer: [] }] },
    },
    "/student/transfer-credits": {
      get: { summary: "List the signed-in student's transfer credit evaluations", security: [{ bearer: [] }] },
    },
    "/search": { get: { summary: "Command-K search", security: [{ bearer: [] }] } },
    "/ai/ask": {
      post: { summary: "Ask the grounded role-aware Campus Coach or Student Advisor", security: [{ bearer: [] }], "x-idempotent": true },
    },
    "/ai/history": {
      get: { summary: "Current account Coach history", security: [{ bearer: [] }] },
    },
    "/ai/tools": {
      get: { summary: "List allowlisted AI tools", security: [{ bearer: [] }] },
    },
    "/ai/governance": {
      get: { summary: "AI governance snapshot for admin/registrar", security: [{ bearer: [] }] },
    },
    "/ai/eval": {
      get: { summary: "Run deterministic AI eval suite", security: [{ bearer: [] }] },
    },
    "/student/advising/appointments": {
      get: { summary: "List student advising appointments", security: [{ bearer: [] }] },
      post: { summary: "Request advising appointment", security: [{ bearer: [] }] },
    },
  },
  components: {
    securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
  },
};

function joinPath(base: string, route: string) {
  const value = `${base}/${route}`.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
  return value
    .replace(/:([A-Za-z0-9_]+)/g, "{$1}")
    .replace(/\(\?:[^)]+\)/g, "{value}")
    .replace(/\*/g, "{wildcard}");
}

/** Express does not retain the literal mount path, only this compiled regexp. */
function mountPath(layer: { regexp?: RegExp }) {
  const regexp = layer.regexp as (RegExp & { fast_slash?: boolean }) | undefined;
  if (!regexp || regexp.fast_slash) return "";
  const source = regexp.source;
  const fixed = source.match(/^\^\\\/(.+?)\\\/\?\(\?=\\\/\|\$\)$/)?.[1];
  if (!fixed || fixed.includes("(")) return "";
  return `/${fixed.replace(/\\\//g, "/").replace(/\\([.-])/g, "$1")}`;
}

type ExpressLayer = {
  route?: { path: string | string[]; methods: Record<string, boolean> };
  regexp?: RegExp;
  handle?: { stack?: ExpressLayer[] };
};

function documentStack(stack: ExpressLayer[], base = "") {
  for (const layer of stack) {
    if (layer.route) {
      const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
      for (const route of paths) {
        if (typeof route !== "string") continue;
        const path = joinPath(base, route);
        const item = (openApiDocument.paths[path] ??= {});
        for (const method of Object.keys(layer.route.methods)) {
          if (!(["get", "post", "put", "patch", "delete", "options", "head"] as const).includes(method as never)) continue;
          const verb = method as keyof OpenApiPath;
          item[verb] ??= {
            summary: `${method.toUpperCase()} ${path}`,
            security: [{ bearer: [] }],
            "x-generated": true,
          };
        }
      }
      continue;
    }
    if (layer.handle?.stack) documentStack(layer.handle.stack, joinPath(base, mountPath(layer)));
  }
}

/** Adds every mounted Express route to the public contract while preserving hand-written descriptions. */
export function documentExpressApp(app: { _router?: { stack?: ExpressLayer[] } }) {
  documentStack(app._router?.stack ?? []);
  for (const publicPath of ["/health", "/api/openapi.json", "/api/docs"]) {
    const operation = openApiDocument.paths[publicPath]?.get;
    if (operation) operation.security = [];
  }
  for (const path of Object.keys(openApiDocument.paths)) {
    if (path.startsWith("/public/") || path === "/auth/login" || path === "/auth/forgot-password" || path === "/auth/reset-password") {
      for (const operation of Object.values(openApiDocument.paths[path] ?? {})) if (operation) operation.security = [];
    }
  }
  for (const publicPath of ["/selfpaced/programs", "/selfpaced/programs/{slug}", "/selfpaced/register"]) {
    for (const operation of Object.values(openApiDocument.paths[publicPath] ?? {})) if (operation) operation.security = [];
  }
  return openApiDocument;
}

export const REGISTERED_ROUTES = Object.keys(openApiDocument.paths);
