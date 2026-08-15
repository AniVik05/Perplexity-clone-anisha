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

const redditSearchRetrieverPrompt = `
You are an AI question rephraser. Rephrase the follow-up question so it is a
standalone question suitable for searching Reddit discussions, using the
chat history for context.

If it is a simple greeting or does not require a search, respond with
"not_needed".

Examples:
1. Follow up question: What do people think about the new iPhone?
Rephrased: Opinions on the new iPhone

2. Follow up question: Is the new Zelda game worth it?
Rephrased: New Zelda game worth it reviews

3. Follow up question: hey, what's up?
Rephrased: not_needed

Conversation:
{chat_history}

Follow up question: {query}
Rephrased question:
`;

const redditSearchResponsePrompt = `
You are Perplexica, an AI model skilled in synthesizing discussion and
opinion from Reddit threads into an unbiased, journalistic-toned answer. You
are set to 'Reddit' focus mode, so the context below was retrieved by Reddit.

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

const createBasicRedditSearchRetrieverChain = (llm: BaseChatModel) => {
  return RunnableSequence.from([
    PromptTemplate.fromTemplate(redditSearchRetrieverPrompt),
    llm,
    new StringOutputParser(),
    RunnableLambda.from(async (input: string) => {
      if (input === 'not_needed') {
        return { query: '', docs: [] };
      }

      const res = await searchSearxng(input, {
        language: 'en',
        engines: ['reddit'],
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

const createBasicRedditSearchAnsweringChain = (
  llm: BaseChatModel,
  embeddings: Embeddings,
) => {
  const retrieverChain = createBasicRedditSearchRetrieverChain(llm);

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
      ['system', redditSearchResponsePrompt],
      new MessagesPlaceholder('chat_history'),
      ['user', '{query}'],
    ]),
    llm,
    new StringOutputParser(),
  ]).withConfig({ runName: 'FinalResponseGenerator' });
};

export const handleRedditSearch = (
  query: string,
  history: BaseMessage[],
  llm: BaseChatModel,
  embeddings: Embeddings,
) => {
  const emitter = new EventEmitter();
  const answeringChain = createBasicRedditSearchAnsweringChain(llm, embeddings);

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
