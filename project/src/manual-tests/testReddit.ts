/**
 * Manual drain test per assignment section 5. Wire up your actual llm /
 * embeddings instances (whatever provider setup your repo already uses —
 * OpenAI, Ollama, etc.) before running this.
 *
 * Test cases to run (per the submission checklist):
 *   1. A normal question -> should return "sources" then streamed "response" chunks, then "end"
 *   2. A greeting like "hi" -> should hit not_needed, sources: [] , still answers gracefully
 *   3. A follow-up referencing chat_history -> confirm the rephrase step pulls in prior context
 */

import { handleRedditSearch } from '../agents/redditSearchAgent';
// import your actual llm/embeddings setup here, e.g.:
// import { llm, embeddings } from '../lib/providers';

declare const llm: any; // replace with real provider instance
declare const embeddings: any; // replace with real provider instance

const emitter = handleRedditSearch(
  'What do people think about the new iPhone?',
  [],
  llm,
  embeddings,
);

emitter.on('data', (d) => console.log(JSON.parse(d)));
emitter.on('end', () => console.log('done'));
emitter.on('error', (e) => console.error(e));
