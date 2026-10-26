import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function luminance(hex) {
  const c = hex.replace("#", "");
  const rgb = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrast(a, b) {
  const L1 = luminance(a);
  const L2 = luminance(b);
  const light = Math.max(L1, L2);
  const dark = Math.min(L1, L2);
  return (light + 0.05) / (dark + 0.05);
}

const tokens = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/tokens.json"), "utf8"),
);

// Classtrack-inspired portal palette (blue brand, navy sidebar).
const pairs = [
  ["text/bg", tokens.color.text, tokens.color.bg, 4.5],
  ["text/surface", tokens.color.text, tokens.color.surface, 4.5],
  ["muted/bg", tokens.color.textMuted, tokens.color.bg, 4.5],
  ["brand/soft", tokens.color.brand, tokens.color.brandSoft, 4.5],
  ["olive/soft", tokens.color.olive, tokens.color.oliveSoft, 4.5],
  ["warning/soft", tokens.color.warning, tokens.color.warningSoft, 4.5],
  ["danger/soft", tokens.color.danger, tokens.color.dangerSoft, 4.5],
  ["text/borderStrong", tokens.color.text, tokens.color.borderStrong, 3],
  ["sidebarText/sidebar", tokens.color.sidebarText, tokens.color.sidebar, 4.5],
];

if (tokens.color.brand !== "#2563EB") {
  console.error("FAIL locked brand must be #2563EB (Classtrack blue)");
  process.exit(1);
}
if (tokens.color.sidebar !== "#1E1E2D") {
  console.error("FAIL locked sidebar must be #1E1E2D");
  process.exit(1);
}

let failed = false;
for (const [name, fg, bg, min] of pairs) {
  const ratio = contrast(fg, bg);
  const ok = ratio >= min;
  console.log(`${ok ? "OK" : "FAIL"} ${name}: ${ratio.toFixed(2)} (min ${min})`);
  if (!ok) failed = true;
}

if (failed) {
  process.exit(1);
}
