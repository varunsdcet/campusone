export type ScriptPart = { text: string; paragraph: number };

export const MAX_PART_CHARS = 600;
/** Smaller first part so the teacher starts speaking quickly. */
export const FIRST_PART_CHARS = 250;

const ENDS_WITH_PAUSE = /[.!?,;:…"'”’)\]]$/;
/** A line ending in a connective ("… and") flows straight into the next line. */
const ENDS_WITH_CONNECTIVE = /\b(and|or|but|nor|of|to|the|a|an|with|for)$/i;

/**
 * Splits a lecture script into sentence-aligned parts of at most MAX_PART_CHARS. Short lines (list items, headings)
 * are merged with their neighbours so each part is a natural stretch of speech; `paragraph` is the index of the
 * line a part starts on.
 */
export function splitScript(
  script: string,
  {
    firstChars = FIRST_PART_CHARS,
    maxChars = MAX_PART_CHARS,
    smallParts = 1,
  }: { firstChars?: number; maxChars?: number; smallParts?: number } = {},
): ScriptPart[] {
  const lines = script
    .split(/\n\s*\n|\n(?=\s*\S)/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .reduce<string[]>((acc, line) => {
      const prev = acc[acc.length - 1];
      if (prev && !ENDS_WITH_PAUSE.test(prev) && ENDS_WITH_CONNECTIVE.test(prev)) acc[acc.length - 1] = `${prev} ${line}`;
      else acc.push(line);
      return acc;
    }, [])
    .map((line) => (ENDS_WITH_PAUSE.test(line) || ENDS_WITH_CONNECTIVE.test(line) ? line : `${line}.`));
  const parts: ScriptPart[] = [];
  let buf = "";
  let start = 0;
  const limit = () => (parts.length < smallParts ? firstChars : maxChars);
  const flush = () => {
    if (buf) parts.push({ text: buf, paragraph: start });
    buf = "";
  };
  lines.forEach((line, index) => {
    const sentences = line.match(/[^.!?]+(?:[.!?]+["'”’)\]]*|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [line];
    for (const sentence of sentences) {
      if (sentence.length > limit()) {
        flush();
        let rest = sentence;
        while (rest.length > limit()) {
          const max = limit();
          let cut = rest.lastIndexOf(" ", max);
          if (cut < max / 2) cut = max;
          parts.push({ text: rest.slice(0, cut).trim(), paragraph: index });
          rest = rest.slice(cut).trim();
        }
        buf = rest;
        start = index;
        continue;
      }
      if (buf && buf.length + sentence.length + 1 > limit()) flush();
      if (!buf) start = index;
      buf = buf ? `${buf} ${sentence}` : sentence;
    }
  });
  flush();
  return parts;
}
