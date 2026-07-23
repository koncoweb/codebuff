/**
 * Stream Chunk Handler
 *
 * Handles token-level streaming chunks from Codebuff SDK (handleStreamChunk callback).
 * Converts raw chunks into AG-UI TEXT_MESSAGE_* and REASONING_* events.
 *
 * REFACTOR: Sebelumnya inline 60+ baris di dalam getClient() di index.ts.
 * Sekarang terisolasi — mudah untuk test, debug, dan tambah chunk type baru.
 */
import type { AguiEvent } from '../src/types/agui-events'
import type { MapperState } from './agui-event-mapper'

/**
 * Create a stream chunk handler that emits AG-UI events via the provided callback.
 *
 * @param mapperState Shared state for tracking open message IDs
 * @param emit Callback to send events to the frontend
 * @returns A function to pass as `handleStreamChunk` to CodebuffClient
 */
export function createStreamChunkHandler(
  mapperState: MapperState,
  emit: (event: AguiEvent) => void,
): (chunk: unknown) => void {
  return (chunk: unknown) => {
    // Case 1: Root agent text delta (plain string)
    if (typeof chunk === 'string') {
      handleTextDelta('root', chunk, mapperState, emit)
      return
    }

    // Case 2: Structured chunk objects
    if (chunk && typeof chunk === 'object') {
      const c = chunk as {
        type?: string
        agentId?: string
        chunk?: string
      }

      if (c.type === 'subagent_chunk' && c.agentId) {
        handleTextDelta(c.agentId, c.chunk || '', mapperState, emit)
        return
      }

      if (c.type === 'reasoning_chunk' && c.agentId) {
        handleReasoningDelta(c.agentId, c.chunk || '', mapperState, emit)
        return
      }
    }
    // Unknown chunk type — silently ignore
  }
}

// --- Internal helpers ---

/** Handle a text delta for an agent (root or subagent). */
function handleTextDelta(
  agentKey: string,
  delta: string,
  state: MapperState,
  emit: (event: AguiEvent) => void,
): void {
  let msgId = state.openTextMessageId.get(agentKey)
  if (!msgId) {
    msgId = `msg-${agentKey}-${Date.now()}`
    state.openTextMessageId.set(agentKey, msgId)
    emit({
      type: 'TEXT_MESSAGE_START',
      messageId: msgId,
      role: 'assistant',
      timestamp: Date.now(),
    })
  }
  emit({
    type: 'TEXT_MESSAGE_CONTENT',
    messageId: msgId,
    delta,
    timestamp: Date.now(),
  })
}

/** Handle a reasoning delta for an agent. */
function handleReasoningDelta(
  agentKey: string,
  delta: string,
  state: MapperState,
  emit: (event: AguiEvent) => void,
): void {
  let msgId = state.openReasoningId.get(agentKey)
  if (!msgId) {
    msgId = `reasoning-${agentKey}-${Date.now()}`
    state.openReasoningId.set(agentKey, msgId)
    emit({
      type: 'REASONING_START',
      messageId: msgId,
      agentId: agentKey,
      timestamp: Date.now(),
    })
  }
  emit({
    type: 'REASONING_CONTENT',
    messageId: msgId,
    delta,
    agentId: agentKey,
    timestamp: Date.now(),
  })
}
