import { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { BaseMessage } from '@langchain/core/messages';
import computeSimilarity from './computeSimilarity'; // cosine similarity util — see note below

/**
 * Shape returned by every createBasicXSearchRetrieverChain: the rephrased
 * query plus the raw (un-reranked) docs pulled from Searxng. Group A agents
 * pipe this into rerankDocs.
 */
export interface BasicChainInput {
  query: string;
  docs: Document[];
}

/**
 * Embeds the query + every doc in parallel, scores each doc by cosine
 * similarity to the query, filters out anything below 0.5, and returns the
 * top 15 MOST similar docs.
 *
 * --- Section 1.3 audit result ---
 * To keep the most-similar docs after `.slice(0, 15)`, the array must be
 * sorted so the HIGHEST similarity comes first — i.e. DESCENDING order:
 *   .sort((a, b) => b.similarity - a.similarity)
 * A comparator of `(a, b) => a.similarity - b.similarity` (ascending) would
 * keep the top 15 *least* similar docs, which is wrong. Implemented
 * correctly (descending) below.
 *
 * IMPORTANT: I do not have your actual given academicSearchAgent.ts to
 * check its comparator against. Per the assignment instructions, diff this
 * function's sort call against the real reference file yourself — if the
 * reference sorts ascending, flag it in your submission as a bug in the
 * given code rather than silently "fixing" that file.
 */
export const rerankDocs = async ({
  query,
  docs,
}: BasicChainInput, embeddings: Embeddings): Promise<Document[]> => {
  if (docs.length === 0) {
    return [];
  }

  const [docEmbeddings, queryEmbedding] = await Promise.all([
    embeddings.embedDocuments(docs.map((doc) => doc.pageContent)),
    embeddings.embedQuery(query),
  ]);

  const similarity = docEmbeddings.map((docEmbedding, i) => {
    const sim = computeSimilarity(queryEmbedding, docEmbedding);
    return { index: i, similarity: sim };
  });

  const sortedDocs = similarity
    .filter((sim) => sim.similarity > 0.5)
    .sort((a, b) => b.similarity - a.similarity) // descending: highest similarity first
    .slice(0, 15)
    .map((sim) => docs[sim.index]);

  return sortedDocs;
};

/** Turns the reranked docs into a numbered context string for the answer prompt. */
export const processDocs = (docs: Document[]): string => {
  return docs
    .map((doc, index) => `${index + 1}. ${doc.pageContent}`)
    .join('\n');
};

export const formatChatHistoryAsString = (history: BaseMessage[]): string => {
  return history
    .map((message) => `${message._getType()}: ${message.content}`)
    .join('\n');
};
