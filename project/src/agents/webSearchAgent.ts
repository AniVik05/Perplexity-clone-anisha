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

const webSearchRetrieverPrompt = `
You are an AI question rephraser. Rephrase the follow-up question so it is a
standalone question suitable for a general web search, using the chat
history for context.

If it is a simple greeting or does not require a web search, respond with
"not_needed".

Examples:
1. Follow up question: What is the tallest mountain in the world?
Rephrased: Tallest mountain in the world

2. Follow up question: Summarize this: https://example.com/article
Rephrased: Summarize: https://example.com/article

3. Follow up question: thanks!
Rephrased: not_needed

Conversation:
{chat_history}

Follow up question: {query}
Rephrased question:
`;

const webSearchResponsePrompt = `
You are Perplexica, an AI model skilled in web search and generating
informative, unbiased, journalistic-toned answers.

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

const createBasicWebSearchRetrieverChain = (llm: BaseChatModel) => {
  return RunnableSequence.from([
    PromptTemplate.fromTemplate(webSearchRetrieverPrompt),
    llm,
    new StringOutputParser(),
    RunnableLambda.from(async (input: string) => {
      if (input === 'not_needed') {
        return { query: '', docs: [] };
      }

      // No `engines` key here on purpose — web search uses Searxng's
      // default engine set rather than a curated list.
      const res = await searchSearxng(input, {
        language: 'en',
      });

      const docs = res.results.map(
        (r) =>
          new Document({
            pageContent: r.content ?? r.title,
            metadata: { title: r.title, url: r.url },
          }),
      );

      return { query: input, docs };
    }),
  ]);
};

const createBasicWebSearchAnsweringChain = (
  llm: BaseChatModel,
  embeddings: Embeddings,
) => {
  const retrieverChain = createBasicWebSearchRetrieverChain(llm);

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
    // Plain, generic persona — deliberately no focus-mode line, unlike
    // Academic/Reddit/Youtube.
    ChatPromptTemplate.fromMessages([
      ['system', webSearchResponsePrompt],
      new MessagesPlaceholder('chat_history'),
      ['user', '{query}'],
    ]),
    llm,
    new StringOutputParser(),
  ]).withConfig({ runName: 'FinalResponseGenerator' });
};

export const handleWebSearch = (
  query: string,
  history: BaseMessage[],
  llm: BaseChatModel,
  embeddings: Embeddings,
) => {
  const emitter = new EventEmitter();
  const answeringChain = createBasicWebSearchAnsweringChain(llm, embeddings);

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
