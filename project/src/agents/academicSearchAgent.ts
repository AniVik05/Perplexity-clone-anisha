/**
 * ⚠️ RECREATED FROM THE ASSIGNMENT SPEC — NOT YOUR ACTUAL GIVEN FILE.
 *
 * The assignment PDF embedded this as a GitHub file card, not literal code,
 * so the exact given source wasn't recoverable from the upload. This
 * reconstruction follows section 1.1/1.2 of the spec exactly (same prompt
 * shape, same engines list, same chain structure, same sort-direction fix
 * from 1.3). DELETE this file and drop in your real given academicSearchAgent.ts
 * before submitting — the other five agents below were written to match
 * this file's structure, so if your real one differs in any small way
 * (import paths, helper names), update the others to match it, not the
 * other way around.
 */

import { EventEmitter } from 'events';
import {
  RunnableSequence,
  RunnableMap,
  RunnableLambda,
} from '@langchain/core/runnables';
import { PromptTemplate, ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';
import { Document } from '@langchain/core/documents';
import { BaseMessage } from '@langchain/core/messages';

import { searchSearxng } from '../lib/searxng';
import { handleStream } from '../utils/handleStream';
import {
  rerankDocs,
  processDocs,
  formatChatHistoryAsString,
} from '../utils/searchHelpers';

const academicSearchRetrieverPrompt = `
You are an AI question rephraser. Rephrase the follow-up question so it is a
standalone academic search query, using the chat history for context.

If it is a simple greeting or does not require a web search, respond with
"not_needed".

Examples:
1. Follow up question: What is the theory of relativity?
Rephrased: Theory of relativity

2. Follow up question: How do transformers work in deep learning?
Rephrased: Transformer architecture deep learning

3. Follow up question: hi, how are you?
Rephrased: not_needed

Conversation:
{chat_history}

Follow up question: {query}
Rephrased question:
`;

const academicSearchResponsePrompt = `
You are Perplexica, an AI model skilled in searching academic literature and
providing answers in an unbiased, journalistic tone. You are set to
'Academic' focus mode, so you search and cite peer-reviewed papers, preprints
and academic sources only.

Generate a response that is informative and relevant, citing sources using
[number] notation next to the relevant part of the sentence, matching the
numbered context below. If a source is not relevant, do not cite it. If you
don't have enough information, say so instead of making things up.

<context>
{context}
</context>

Current date & time in ISO format: {date}
`;

type BasicChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

const createBasicAcademicSearchRetrieverChain = (llm: BaseChatModel) => {
  return RunnableSequence.from([
    PromptTemplate.fromTemplate(academicSearchRetrieverPrompt),
    llm,
    new StringOutputParser(),
    RunnableLambda.from(async (input: string) => {
      if (input === 'not_needed') {
        return { query: '', docs: [] };
      }

      const res = await searchSearxng(input, {
        language: 'en',
        engines: ['arxiv', 'google scholar', 'internetarchivescholar', 'pubmed'],
      });

      const docs = res.results.map(
        (r) =>
          new Document({
            pageContent: r.content ?? '',
            metadata: { title: r.title, url: r.url, ...(r.img_src && { img_src: r.img_src }) },
          }),
      );

      return { query: input, docs };
    }),
  ]);
};

const createBasicAcademicSearchAnsweringChain = (
  llm: BaseChatModel,
  embeddings: Embeddings,
) => {
  const retrieverChain = createBasicAcademicSearchRetrieverChain(llm);

  return RunnableSequence.from([
    RunnableMap.from({
      query: (input: BasicChainInput) => input.query,
      chat_history: (input: BasicChainInput) => input.chat_history,
      context: RunnableSequence.from([
        (input: BasicChainInput) => ({
          query: input.query,
          chat_history: formatChatHistoryAsString(input.chat_history),
        }),
        retrieverChain,
        RunnableLambda.from(async (input: { query: string; docs: Document[] }) =>
          rerankDocs(input, embeddings),
        ).withConfig({ runName: 'FinalSourceRetriever' }),
        processDocs,
      ]),
    }),
    ChatPromptTemplate.fromMessages([
      ['system', academicSearchResponsePrompt],
      new MessagesPlaceholder('chat_history'),
      ['user', '{query}'],
    ]),
    llm,
    new StringOutputParser(),
  ]).withConfig({ runName: 'FinalResponseGenerator' });
};

export const handleAcademicSearch = (
  query: string,
  history: BaseMessage[],
  llm: BaseChatModel,
  embeddings: Embeddings,
) => {
  const emitter = new EventEmitter();
  const answeringChain = createBasicAcademicSearchAnsweringChain(llm, embeddings);

  try {
    const stream = answeringChain.streamEvents(
      { query, chat_history: history },
      { version: 'v1' },
    );

    handleStream(stream, emitter);
  } catch (err) {
    emitter.emit('error', err instanceof Error ? err.message : String(err));
  }

  return emitter;
};
