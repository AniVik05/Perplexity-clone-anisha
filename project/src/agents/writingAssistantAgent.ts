import { EventEmitter } from 'events';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';

import { handleStream } from '../utils/handleStream';

const writingAssistantPrompt = `
You are Perplexica, an AI model who is expert at writing, assisting the user
with drafting, editing, and refining text such as essays, emails, articles,
and more.

You are set to 'Writing Assistant' focus mode: you do NOT perform web
searches or have access to real-time information, even if the user asks for
it. If you don't have enough information to help, or the user's request
needs current information you don't have, say so plainly and either ask the
user for more detail or suggest they switch to a search-enabled focus mode
(e.g. Web, Academic) instead of guessing.
`;

const createWritingAssistantChain = (llm: BaseChatModel) => {
  return RunnableSequence.from([
    ChatPromptTemplate.fromMessages([
      ['system', writingAssistantPrompt],
      new MessagesPlaceholder('chat_history'),
      ['user', '{query}'],
    ]),
    llm,
    new StringOutputParser(),
  ]).withConfig({ runName: 'FinalResponseGenerator' });
};

export const handleWritingAssistant = (
  query: string,
  history: BaseMessage[],
  llm: BaseChatModel,
) => {
  const emitter = new EventEmitter();
  const writingAssistantChain = createWritingAssistantChain(llm);

  try {
    const stream = writingAssistantChain.streamEvents(
      { query, chat_history: history },
      { version: 'v1' },
    );

    // Same handleStream as every other agent — it simply never sees a
    // "FinalSourceRetriever" chain end here, so no "sources" event fires.
    // No special-casing needed.
    handleStream(stream, emitter);
  } catch (err) {
    emitter.emit('error', err instanceof Error ? err.message : String(err));
  }

  return emitter;
};
