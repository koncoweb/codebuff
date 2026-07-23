/**
 * AG-UI Event Mapper
 *
 * Maps Codebuff's PrintModeEvent to AG-UI-inspired events.
 * Fills gaps: true delta streaming, tool args streaming, state deltas.
 *
 * This runs in the sidecar (Node.js/Bun process) — safe to use Node APIs.
 */
import type { PrintModeEvent } from '@codebuff/common/types/print-mode'

import type {
  AguiEvent,
  JsonPatchOp,
} from '../src/types/agui-events'

// ============================================================================
// State tracking for delta computation
// ============================================================================

interface MapperState {
  /** Accumulated text per agent — used to compute text deltas */
  textAccumulator: Map<string, string>
  /** Currently open text message ID per agent */
  openTextMessageId: Map<string, string>
  /** Currently open reasoning message ID per agent */
  openReasoningId: Map<string, string>
  /** Last full state snapshot — used to compute state deltas */
  lastStateSnapshot: Record<string, unknown> | null
  /** Whether we've sent the initial state snapshot */
  stateInitialized: boolean
}

function createMapperState(): MapperState {
  return {
    textAccumulator: new Map(),
    openTextMessageId: new Map(),
    openReasoningId: new Map(),
    lastStateSnapshot: null,
    stateInitialized: false,
  }
}

// ============================================================================
// Minimal JSON-Patch diff (RFC 6902 subset: add, remove, replace)
// ============================================================================

/**
 * Compute a minimal JSON-patch between two objects.
 * Only handles top-level and one-level-deep changes (sufficient for session state).
 * Falls back to a full replace for deeply nested changes.
 */
export function computeJsonPatch(
  oldObj: Record<string, unknown> | null,
  newObj: Record<string, unknown>,
): JsonPatchOp[] {
  if (!oldObj) {
    return [{ op: 'add', path: '', value: newObj }]
  }

  const ops: JsonPatchOp[] = []
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])

  for (const key of allKeys) {
    const path = `/${key}`
    const oldVal = oldObj[key]
    const newVal = newObj[key]

    if (!(key in newObj)) {
      ops.push({ op: 'remove', path })
    } else if (!(key in oldObj)) {
      ops.push({ op: 'add', path, value: newVal })
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      // For changed values, do a shallow replace (deep diff is expensive)
      ops.push({ op: 'replace', path, value: newVal })
    }
  }

  return ops
}

// ============================================================================
// Main mapper function
// ============================================================================

/**
 * Map a single Codebuff PrintModeEvent to zero or more AG-UI-inspired events.
 * Returns an array because one Codebuff event may produce multiple AG-UI events
 * (e.g., `text` needs Start/Content/End lifecycle).
 */
export function mapCodebuffEventToAgui(
  event: PrintModeEvent,
  state: MapperState,
  threadId: string,
  runId: string,
): AguiEvent[] {
  const timestamp = Date.now()
  const events: AguiEvent[] = []

  switch (event.type) {
    // --- Lifecycle ---
    case 'start': {
      events.push({ type: 'RUN_STARTED', threadId, runId, timestamp })
      break
    }

    case 'finish': {
      // Close any open text/reasoning messages before finishing
      for (const [, msgId] of state.openTextMessageId) {
        events.push({ type: 'TEXT_MESSAGE_END', messageId: msgId, timestamp })
      }
      state.openTextMessageId.clear()

      for (const [, msgId] of state.openReasoningId) {
        events.push({ type: 'REASONING_END', messageId: msgId, timestamp })
      }
      state.openReasoningId.clear()

      events.push({
        type: 'RUN_FINISHED',
        threadId,
        runId,
        timestamp,
        outcome: { type: 'success' },
        result: { totalCost: event.totalCost },
      })
      break
    }

    case 'error': {
      events.push({
        type: 'RUN_ERROR',
        message: event.message,
        timestamp,
      })
      break
    }

    // --- Text streaming (Codebuff sends full string, we convert to delta) ---
    case 'text': {
      const agentKey = event.agentId || 'root'
      const previous = state.textAccumulator.get(agentKey) || ''
      const current = event.text
      const delta = current.slice(previous.length)

      // If text went backwards (rare but possible), restart the message
      if (delta.length === 0 && current !== previous) {
        // Close old message if open
        const oldMsgId = state.openTextMessageId.get(agentKey)
        if (oldMsgId) {
          events.push({ type: 'TEXT_MESSAGE_END', messageId: oldMsgId, timestamp })
        }
        // Start fresh
        const msgId = `msg-${agentKey}-${Date.now()}`
        state.openTextMessageId.set(agentKey, msgId)
        state.textAccumulator.set(agentKey, current)
        events.push({
          type: 'TEXT_MESSAGE_START',
          messageId: msgId,
          role: 'assistant',
          timestamp,
        })
        events.push({
          type: 'TEXT_MESSAGE_CONTENT',
          messageId: msgId,
          delta: current,
          timestamp,
        })
        break
      }

      if (delta.length > 0) {
        state.textAccumulator.set(agentKey, current)

        // Ensure a message is open
        let msgId = state.openTextMessageId.get(agentKey)
        if (!msgId) {
          msgId = `msg-${agentKey}-${Date.now()}`
          state.openTextMessageId.set(agentKey, msgId)
          events.push({
            type: 'TEXT_MESSAGE_START',
            messageId: msgId,
            role: 'assistant',
            timestamp,
          })
        }

        events.push({
          type: 'TEXT_MESSAGE_CONTENT',
          messageId: msgId,
          delta,
          timestamp,
        })
      }
      break
    }

    // --- Reasoning streaming (Codebuff already sends deltas, wrap in lifecycle) ---
    case 'reasoning_delta': {
      const agentKey = event.agentId

      let msgId = state.openReasoningId.get(agentKey)
      if (!msgId) {
        msgId = `reasoning-${agentKey}-${Date.now()}`
        state.openReasoningId.set(agentKey, msgId)
        events.push({
          type: 'REASONING_START',
          messageId: msgId,
          agentId: agentKey,
          timestamp,
        })
      }

      events.push({
        type: 'REASONING_CONTENT',
        messageId: msgId,
        delta: event.text,
        agentId: agentKey,
        timestamp,
      })

      // Note: REASONING_END is emitted when text starts or run finishes
      break
    }

    // --- Tool calls (Codebuff sends complete input, we stream it as JSON) ---
    case 'tool_call': {
      const toolCallId = event.toolCallId
      const toolName = event.toolName
      const agentId = event.agentId

      // Close any open reasoning (text/reasoning transition)
      const reasoningId = state.openReasoningId.get(agentId || 'root')
      if (reasoningId) {
        events.push({ type: 'REASONING_END', messageId: reasoningId, timestamp })
        state.openReasoningId.delete(agentId || 'root')
      }

      events.push({
        type: 'TOOL_CALL_START',
        toolCallId,
        toolCallName: toolName,
        agentId,
        timestamp,
      })

      // Stream the input as a single args chunk (Codebuff provides complete input)
      const argsJson = JSON.stringify(event.input)
      events.push({
        type: 'TOOL_CALL_ARGS',
        toolCallId,
        delta: argsJson,
        timestamp,
      })

      events.push({
        type: 'TOOL_CALL_END',
        toolCallId,
        timestamp,
      })

      break
    }

    case 'tool_result': {
      // Extract text content from the output array
      const outputParts = event.output || []
      const content = outputParts
        .map((part: unknown) => {
          if (typeof part === 'string') return part
          if (part && typeof part === 'object') {
            const p = part as { type?: string; text?: string; json?: unknown }
            if (p.type === 'json') return JSON.stringify(p.json)
            if (p.text) return p.text
          }
          return ''
        })
        .filter(Boolean)
        .join('\n')

      events.push({
        type: 'TOOL_CALL_RESULT',
        messageId: `result-${event.toolCallId}`,
        toolCallId: event.toolCallId,
        content: content || '(empty result)',
        role: 'tool',
        timestamp,
      })
      break
    }

    // --- Subagent lifecycle → Step events ---
    case 'subagent_start': {
      events.push({
        type: 'STEP_STARTED',
        stepName: event.displayName || event.agentType,
        agentId: event.agentId,
        timestamp,
      })

      // Close any open text message from parent agent
      const parentKey = event.parentAgentId || 'root'
      const parentTextId = state.openTextMessageId.get(parentKey)
      if (parentTextId) {
        events.push({ type: 'TEXT_MESSAGE_END', messageId: parentTextId, timestamp })
        state.openTextMessageId.delete(parentKey)
      }

      break
    }

    case 'subagent_finish': {
      // Close any open messages from this subagent
      const agentKey = event.agentId
      const textId = state.openTextMessageId.get(agentKey)
      if (textId) {
        events.push({ type: 'TEXT_MESSAGE_END', messageId: textId, timestamp })
        state.openTextMessageId.delete(agentKey)
      }
      state.textAccumulator.delete(agentKey)

      const reasoningId = state.openReasoningId.get(agentKey)
      if (reasoningId) {
        events.push({ type: 'REASONING_END', messageId: reasoningId, timestamp })
        state.openReasoningId.delete(agentKey)
      }

      events.push({
        type: 'STEP_FINISHED',
        stepName: event.displayName || event.agentType,
        agentId: event.agentId,
        timestamp,
      })
      break
    }

    case 'download': {
      // Ignore download events (not relevant for desktop)
      break
    }
  }

  return events
}

/**
 * Map a Codebuff state snapshot to STATE_SNAPSHOT / STATE_DELTA events.
 * First snapshot is full, subsequent are deltas.
 */
export function mapStateSnapshotToAgui(
  snapshot: Record<string, unknown>,
  state: MapperState,
): AguiEvent[] {
  const timestamp = Date.now()

  if (!state.stateInitialized) {
    state.lastStateSnapshot = snapshot
    state.stateInitialized = true
    return [{ type: 'STATE_SNAPSHOT', state: snapshot, timestamp }]
  }

  const delta = computeJsonPatch(state.lastStateSnapshot, snapshot)
  state.lastStateSnapshot = snapshot

  if (delta.length === 0) {
    return []
  }

  return [{ type: 'STATE_DELTA', delta, timestamp }]
}

/**
 * Create an interrupt event (for ask_user / tool approval).
 */
export function createInterruptEvent(
  threadId: string,
  runId: string,
  interrupt: {
    id: string
    reason: string
    message: string
    toolCallId: string
    responseSchema?: Record<string, unknown>
  },
): AguiEvent {
  return {
    type: 'RUN_FINISHED',
    threadId,
    runId,
    timestamp: Date.now(),
    outcome: { type: 'interrupt', interrupts: [interrupt] },
  }
}

export { createMapperState }
export type { MapperState }
