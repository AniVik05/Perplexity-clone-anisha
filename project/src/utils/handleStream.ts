import { EventEmitter } from 'events';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import { StreamEvent } from '@langchain/core/tracers/log_stream';

/**
 * Walks the output of `.streamEvents()` on a tagged RunnableSequence and
 * re-emits normalized events on a plain Node EventEmitter.
 *
 * This function is IDENTICAL across every agent in the project (see
 * Assignment section 0.1) — it is copy-pasted verbatim into every reference
 * agent, so it has been pulled out here and should be imported everywhere
 * instead of being re-defined per file.
 *
 * It relies on two runName tags being present on the answering chain:
 *  - "FinalSourceRetriever": the sub-chain whose *output* is the reranked
 *    Document[] that should be shown to the user as sources.
 *  - "FinalResponseGenerator": the sub-chain whose *stream* is the token-by-
 *    token answer text.
 *
 * Agents with no retrieval step (writingAssistantAgent) simply never trigger
 * the "FinalSourceRetriever" branch, so no "sources" event is ever emitted —
 * that's expected, not a bug.
 */
export const handleStream = async (
  stream: IterableReadableStream<StreamEvent>,
  emitter: EventEmitter,
) => {
  for await (const event of stream) {
    if (
      event.event === 'on_chain_end' &&
      event.name === 'FinalSourceRetriever'
    ) {
      emitter.emit(
        'data',
        JSON.stringify({ type: 'sources', data: event.data.output }),
      );
    }

    if (
      event.event === 'on_chain_stream' &&
      event.name === 'FinalResponseGenerator'
    ) {
      emitter.emit(
        'data',
        JSON.stringify({ type: 'response', data: event.data.chunk }),
      );
    }

    if (
      event.event === 'on_chain_end' &&
      event.name === 'FinalResponseGenerator'
    ) {
      emitter.emit('end');
    }
  }
};
