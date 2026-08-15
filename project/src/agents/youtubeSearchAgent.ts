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

const youtubeSearchRetrieverPrompt = `
You are an AI question rephraser. Rephrase the follow-up question so it is a
standalone question suitable for searching YouTube videos, using the chat
history for context.

If it is a simple greeting or does not require a search, respond with
"not_needed".

Examples:
1. Follow up question: How do I make sourdough bread?
Rephrased: Sourdough bread tutorial

2. Follow up question: Are there any good video essays about that movie?
Rephrased: Video essay analysis of the movie

3. Follow up question: cool, thanks
Rephrased: not_needed

Conversation:
{chat_history}

Follow up question: {query}
Rephrased question:
`;

const youtubeSearchResponsePrompt = `
You are Perplexica, an AI model skilled in summarizing YouTube video content
into an unbiased, journalistic-toned answer. You are set to 'Youtube' focus
mode, so the context below was retrieved from Youtube.

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

const createBasicYoutubeSearchRetrieverChain = (llm: BaseChatModel) => {
  return RunnableSequence.from([
    PromptTemplate.fromTemplate(youtubeSearchRetrieverPrompt),
    llm,
    new StringOutputParser(),
    RunnableLambda.from(async (input: string) => {
      if (input === 'not_needed') {
        return { query: '', docs: [] };
      }

      const res = await searchSearxng(input, {
        language: 'en',
        engines: ['youtube'],
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

const createBasicYoutubeSearchAnsweringChain = (
  llm: BaseChatModel,
  embeddings: Embeddings,
) => {
  const retrieverChain = createBasicYoutubeSearchRetrieverChain(llm);

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
      ['system', youtubeSearchResponsePrompt],
      new MessagesPlaceholder('chat_history'),
      ['user', '{query}'],
    ]),
    llm,
    new StringOutputParser(),
  ]).withConfig({ runName: 'FinalResponseGenerator' });
};

export const handleYoutubeSearch = (
  query: string,
  history: BaseMessage[],
  llm: BaseChatModel,
  embeddings: Embeddings,
) => {
  const emitter = new EventEmitter();
  const answeringChain = createBasicYoutubeSearchAnsweringChain(llm, embeddings);

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
