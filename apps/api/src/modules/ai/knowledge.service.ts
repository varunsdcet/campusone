import { retrieveKnowledgeHits } from "@myheritage/ai";
import type { KnowledgeHit } from "@myheritage/contracts";
import { prisma } from "@myheritage/db";

export async function listKnowledgeDocuments(input: {
  institutionId: string;
  question: string;
  docType?: string;
}): Promise<KnowledgeHit[]> {
  const documents = await prisma.knowledgeDocument.findMany({
    where: {
      institutionId: input.institutionId,
      status: "published",
      ...(input.docType ? { docType: input.docType } : {}),
    },
    take: 50,
  });
  const hits = retrieveKnowledgeHits({
    question: input.question,
    documents: documents.map((doc) => ({
      id: doc.id,
      slug: doc.slug,
      title: doc.title,
      docType: doc.docType,
      body: doc.body,
      uri: doc.uri,
      versionLabel: doc.versionLabel,
      status: doc.status,
    })),
  });
  if (hits.length) return hits;
  // Fall back to any published docs so citeOrRefuse can still ground services answers.
  return documents.slice(0, 3).map((doc) => ({
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    docType: doc.docType,
    uri: doc.uri.startsWith("/") ? doc.uri : `/${doc.uri}`,
    versionLabel: doc.versionLabel,
    excerpt: doc.body.slice(0, 400),
  }));
}
