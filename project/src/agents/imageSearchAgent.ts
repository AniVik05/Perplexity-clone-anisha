/**
 * ⚠️ RECREATED FROM THE ASSIGNMENT SPEC — NOT YOUR ACTUAL GIVEN FILE.
 * See the note at the top of academicSearchAgent.ts — same caveat applies.
 * DELETE this and drop in your real given imageSearchAgent.ts before submitting.
 */

import {
  RunnableSequence,
  RunnableMap,
  RunnableLambda,
} from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';

import { searchSearxng } from '../lib/searxng';
import { formatChatHistoryAsString } from '../utils/searchHelpers';

const imageSearchChainPrompt = `
You will be given a conversation below and a follow up question. You need to
rephrase the follow-up question so it is a standalone question that can be
used by an LLM to search the web for images.

Cross-reference the conversation history for context if needed.

Example:
1. Follow up question: What is a cat?
Rephrased: A cat

2. Follow up question: What is a car? How does it work?
Rephrased: Car working

Conversation:
{chat_history}

Follow up question: {query}
Rephrased question:
`;

type ImageSearchChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

const createImageSearchChain = (llm: BaseChatModel) => {
  return RunnableSequence.from([
    RunnableMap.from({
      chat_history: (input: ImageSearchChainInput) =>
        formatChatHistoryAsString(input.chat_history),
      query: (input: ImageSearchChainInput) => input.query,
    }),
    PromptTemplate.fromTemplate(imageSearchChainPrompt),
    llm,
    new StringOutputParser(),
    RunnableLambda.from(async (input: string) => {
      const res = await searchSearxng(input, {
        categories: ['images'],
        engines: ['bing images', 'google images'],
      });

      const images: { img_src: string; url: string; title: string }[] = [];

      res.results.forEach((result) => {
        if (result.img_src && result.url && result.title) {
          images.push({
            img_src: result.img_src,
            url: result.url,
            title: result.title,
          });
        }
      });

      return images.slice(0, 10);
    }),
  ]);
};

export const handleImageSearch = (
  input: ImageSearchChainInput,
  llm: BaseChatModel,
) => {
  const imageSearchChain = createImageSearchChain(llm);
  return imageSearchChain.invoke(input);
};
