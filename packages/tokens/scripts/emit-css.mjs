import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = JSON.parse(readFileSync(join(root, "src/tokens.json"), "utf8"));

const css = `:root {
  --mh-bg: ${tokens.color.bg};
  --mh-surface: ${tokens.color.surface};
  --mh-surface-muted: ${tokens.color.surfaceMuted};
  --mh-text: ${tokens.color.text};
  --mh-text-muted: ${tokens.color.textMuted};
  --mh-text-subtle: ${tokens.color.textSubtle};
  --mh-border: ${tokens.color.border};
  --mh-border-strong: ${tokens.color.borderStrong};
  --mh-brand: ${tokens.color.brand};
  --mh-brand-dark: ${tokens.color.brandDark};
  --mh-brand-soft: ${tokens.color.brandSoft};
  --mh-olive: ${tokens.color.olive};
  --mh-olive-soft: ${tokens.color.oliveSoft};
  --mh-accent-olive: ${tokens.color.accentOlive ?? tokens.color.olive};
  --mh-warning: ${tokens.color.warning};
  --mh-warning-soft: ${tokens.color.warningSoft};
  --mh-danger: ${tokens.color.danger};
  --mh-danger-soft: ${tokens.color.dangerSoft};
  --mh-ai: ${tokens.color.ai};
  --mh-ai-soft: ${tokens.color.aiSoft};
  --mh-sidebar: ${tokens.color.sidebar};
  --mh-sidebar-muted: ${tokens.color.sidebarMuted};
  --mh-sidebar-text: ${tokens.color.sidebarText};
  --mh-sidebar-active: ${tokens.color.sidebarActive};
  --mh-success: ${tokens.color.success};
  --mh-success-soft: ${tokens.color.successSoft};
  --mh-radius-sm: ${tokens.radius.sm}px;
  --mh-radius-md: ${tokens.radius.md}px;
  --mh-radius-lg: ${tokens.radius.lg}px;
  --mh-radius-xl: ${tokens.radius.xl}px;
  --mh-radius-pill: ${tokens.radius.pill}px;
  --mh-font-sans: ${tokens.font.sans};
  --mh-font-display: ${tokens.font.display};
  --mh-body: ${tokens.type.bodyComfortable}px;
  --mh-body-compact: ${tokens.type.bodyCompact}px;
  --mh-h1: ${tokens.type.h1}px;
  --mh-h2: ${tokens.type.h2}px;
  --mh-h3: ${tokens.type.h3}px;
  --mh-h4: ${tokens.type.h4}px;
}
`;

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "src/tokens.css"), css);
writeFileSync(join(root, "dist/tokens.css"), css);
console.log("Wrote tokens.css");
