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

// Given in the video reference per the assignment — same "standalone
// question" framing as imageSearchChainPrompt, adapted for video content.
const videoSearchChainPrompt = `
You will be given a conversation below and a follow up question. You need to
rephrase the follow-up question so it is a standalone question that can be
used by an LLM to search the web for videos.

Cross-reference the conversation history for context if needed.

Example:
1. Follow up question: How does a car engine work?
Rephrased: Car engine working

2. Follow up question: What are some good workout routines?
Rephrased: Good workout routines

Conversation:
{chat_history}

Follow up question: {query}
Rephrased question:
`;

type VideoSearchChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

interface VideoSearchResult {
  img_src: string;
  url: string;
  title: string;
  iframe_src: string;
}

const createVideoSearchChain = (llm: BaseChatModel) => {
  return RunnableSequence.from([
    RunnableMap.from({
      chat_history: (input: VideoSearchChainInput) =>
        formatChatHistoryAsString(input.chat_history),
      query: (input: VideoSearchChainInput) => input.query,
    }),
    PromptTemplate.fromTemplate(videoSearchChainPrompt),
    llm,
    new StringOutputParser(),
    RunnableLambda.from(async (input: string) => {
      const res = await searchSearxng(input, {
        engines: ['youtube'],
      });

      const videos: VideoSearchResult[] = [];

      res.results.forEach((result) => {
        // Mapped to `img_src` (not `thumbnail`) so the frontend can treat
        // image and video results consistently — see section 2.2.
        if (result.thumbnail && result.url && result.title && result.iframe_src) {
          videos.push({
            img_src: result.thumbnail,
            url: result.url,
            title: result.title,
            iframe_src: result.iframe_src,
          });
        }
      });

      return videos.slice(0, 10);
    }),
  ]);
};

export const handleVideoSearch = (
  input: VideoSearchChainInput,
  llm: BaseChatModel,
) => {
  const videoSearchChain = createVideoSearchChain(llm);
  return videoSearchChain.invoke(input);
};
