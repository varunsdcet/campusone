import type { KnowledgeHit } from "@myheritage/contracts";
import { stripPromptInjection } from "./policy.js";

/** Keyword retrieve over published knowledge docs — no vectors required for v1. */
export function retrieveKnowledgeHits(input: {
  question: string;
  documents: Array<{
    id: string;
    slug: string;
    title: string;
    docType: string;
    body: string;
    uri: string;
    versionLabel: string;
    status: string;
  }>;
  limit?: number;
}): KnowledgeHit[] {
  const limit = input.limit ?? 5;
  const tokens = input.question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  const scored = input.documents
    .filter((doc) => doc.status === "published")
    .map((doc) => {
      const hay = `${doc.title} ${doc.body} ${doc.docType}`.toLowerCase();
      const score = tokens.reduce((sum, token) => (hay.includes(token) ? sum + 1 : sum), 0);
      return { doc, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ doc }) => ({
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    docType: doc.docType,
    uri: doc.uri.startsWith("/") ? doc.uri : `/${doc.uri}`,
    versionLabel: doc.versionLabel,
    excerpt: stripPromptInjection(doc.body).slice(0, 400),
  }));
}
