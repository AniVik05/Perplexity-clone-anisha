import { RunnableSequence, RunnableMap } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';

import ListLineOutputParser from '../lib/outputParsers/listLineOutputParser';
import { formatChatHistoryAsString } from '../utils/searchHelpers';

const suggestionGeneratorPrompt = `
You are an AI suggestion generator for a search/writing assistant. Based on
the conversation below, generate 4-5 relevant, medium-length follow-up
questions the user might want to ask next.

Wrap the suggestions in an XML tag called <suggestions>, one question per
line, with no numbering, bullets, or extra commentary — just the raw
questions.

Conversation:
{chat_history}
`;

type SuggestionGeneratorInput = {
  chat_history: BaseMessage[];
};

const outputParser = new ListLineOutputParser({ key: 'suggestions' });

const createSuggestionGeneratorChain = (llm: BaseChatModel) => {
  return RunnableSequence.from([
    RunnableMap.from({
      chat_history: (input: SuggestionGeneratorInput) =>
        formatChatHistoryAsString(input.chat_history),
    }),
    PromptTemplate.fromTemplate(suggestionGeneratorPrompt),
    llm,
    outputParser,
  ]);
};

export const generateSuggestions = (
  input: SuggestionGeneratorInput,
  llm: BaseChatModel,
) => {
  // Force deterministic, less-repetitive suggestions. Mutated directly on
  // the llm instance (rather than passed as an option) to match the given
  // pattern — don't skip this.
  (llm as any).temperature = 0;

  return createSuggestionGeneratorChain(llm).invoke(input);
};

/**
 * Where this gets called (per assignment section 4, decision documented
 * here as required):
 *
 * WIRING CHOICE: called from the same route handler, right after the main
 * agent's stream ends. Once the route handler receives the "end" event from
 * whichever handle*Search / handleWritingAssistant emitter it's using, it
 * appends the now-complete AI response to chat_history and calls
 * generateSuggestions() with that updated history, then sends the resulting
 * array to the frontend as a final "suggestions" payload (separate from the
 * eventEmitter's data/end/error stream, since this call is a plain
 * .invoke(), not streamed).
 *
 * The alternative (a separate endpoint the frontend calls once rendering
 * finishes) also works and trades one extra round-trip for a slightly
 * simpler route handler — either is defensible; this repo picks the
 * same-handler approach so a single request produces the full answer +
 * follow-ups together.
 */
