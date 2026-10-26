import { api, loadSession } from "@/lib/api";

export type PageLayout = "Full Screen" | "Two Columns";
export type DashboardSettings = { title: string; layout: PageLayout };

export type ScopeKey = "campus" | "status" | "program" | "rate" | "nationality" | "advisor";
export type Scope = { mode: "all" | "select"; values: string[] };

export type DashboardBlock = {
  id: string;
  name: string;
  type: "Rich Text Content";
  content: string;
  status: "Active" | "Inactive";
  timeframe: "Immediately" | "Define Dates";
  startDate: string;
  endDate: string;
  access: "Everyone" | "Select Access Level";
  accessLevels: string[];
  studentAccess: Record<ScopeKey, Scope>;
  order: number;
  updatedAt: string;
};

export type BlockInput = Omit<DashboardBlock, "id" | "type" | "order" | "updatedAt"> & { type: DashboardBlock["type"] | "" };

export type StudentScopeOption = { key: ScopeKey; label: string; all: string; select: string; values: string[] };

export type DashboardManage = {
  settings: DashboardSettings;
  blocks: DashboardBlock[];
  canEdit: boolean;
  options: {
    layouts: PageLayout[];
    blockTypes: Array<DashboardBlock["type"]>;
    statuses: Array<DashboardBlock["status"]>;
    timeframes: Array<DashboardBlock["timeframe"]>;
    access: Array<DashboardBlock["access"]>;
    accessLevels: string[];
    studentScopes: StudentScopeOption[];
  };
};

export type DashboardView = {
  settings: DashboardSettings;
  blocks: Array<{ id: string; name: string; content: string }>;
  canEdit: boolean;
};

export function dashApi<T>(path: string, init: RequestInit = {}) {
  return api<T>(`/admin/heritage/dashboard${path}`, init, loadSession()?.accessToken);
}

export function plainText(html: string) {
  return html
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Sanitizer for dashboard rich content                                 */
/* ------------------------------------------------------------------ */

const TAGS = new Set([
  "P", "DIV", "SPAN", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SUB", "SUP", "CODE", "PRE", "BLOCKQUOTE",
  "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "A", "IMG", "VIDEO", "HR", "FONT",
  "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TH", "TD", "CAPTION", "FIGURE", "FIGCAPTION",
]);
const DROP = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "TEMPLATE", "SVG", "MATH", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT"]);
const STYLE_PROPS = new Set([
  "color", "background-color", "background-image", "background-size", "background-position", "background-repeat",
  "text-align", "font-family", "font-size", "font-weight", "font-style", "text-decoration", "text-transform", "letter-spacing", "line-height",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left", "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border", "border-top", "border-right", "border-bottom", "border-left", "border-color", "border-width", "border-style", "border-radius", "border-collapse",
  "width", "max-width", "min-width", "height", "max-height", "display", "flex", "flex-wrap", "flex-direction", "gap", "justify-content", "align-items",
  "vertical-align", "list-style-type", "opacity", "box-shadow",
]);
const ATTRS: Record<string, string[]> = {
  A: ["href", "target", "title"],
  IMG: ["src", "alt", "title", "width", "height"],
  VIDEO: ["src", "controls", "width", "height"],
  TD: ["colspan", "rowspan"],
  TH: ["colspan", "rowspan"],
  FONT: ["face", "color"],
};

function safeUrl(v: string, image = false) {
  const u = v.trim();
  if (/^(https?:|mailto:|tel:)/i.test(u) || /^[/#]/.test(u)) return !/^\/\//.test(u);
  return image && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(u);
}

function cleanStyle(style: string) {
  return style
    .split(";")
    .map((d) => d.trim())
    .filter((d) => {
      const i = d.indexOf(":");
      if (i < 0) return false;
      const prop = d.slice(0, i).trim().toLowerCase();
      const value = d.slice(i + 1).trim().toLowerCase();
      if (!STYLE_PROPS.has(prop) || /expression|javascript:|@import|behavior/.test(value)) return false;
      if (value.includes("url(")) {
        if (prop !== "background-image") return false;
        const m = /url\(\s*['"]?([^'")]+)['"]?\s*\)/.exec(d.slice(i + 1));
        return Boolean(m && safeUrl(m[1]!) && !m[1]!.startsWith("#"));
      }
      return true;
    })
    .join("; ");
}

export function sanitizeDashboardHtml(html: string): string {
  if (!html || typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return "";
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (DROP.has(child.tagName)) {
        child.remove();
        continue;
      }
      walk(child);
      if (!TAGS.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }
      const allowed = ATTRS[child.tagName] ?? [];
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        if (name === "style") {
          const kept = cleanStyle(attr.value);
          if (kept) child.setAttribute("style", kept);
          else child.removeAttribute("style");
        } else if (!allowed.includes(name)) {
          child.removeAttribute(attr.name);
        } else if ((name === "href" || name === "src") && !safeUrl(attr.value, child.tagName === "IMG")) {
          child.removeAttribute(attr.name);
        }
      }
      if (child.tagName === "A" && child.getAttribute("target") === "_blank") child.setAttribute("rel", "noopener noreferrer");
      else if (child.tagName === "A") child.removeAttribute("target");
    }
  };
  walk(root);
  return root.innerHTML;
}
