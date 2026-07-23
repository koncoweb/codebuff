/**
 * AG-UI Event Store
 *
 * Consumes raw AG-UI-inspired events from the sidecar transport and accumulates
 * them into UI-consumable state: messages, tool calls, reasoning, state, interrupts.
 *
 * This replaces the old VibeAgentStep model with a richer, streaming-first model.
 * No external state library — plain React hooks + a singleton store.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { sidecarTransport } from './codebuff-sidecar-transport'
import type {
  AguiEvent,
  AguiInterrupt,
  JsonPatchOp,
} from '../types/agui-events'

// ============================================================================
// UI Data Models (derived from AG-UI events)
// ============================================================================

export interface UIMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  isStreaming: boolean
  timestamp: number
}

export interface UIToolCall {
  id: string
  name: string
  args: string
  argsParsed: Record<string, unknown> | null
  status: 'streaming' | 'executing' | 'completed' | 'failed'
  result?: string
  agentId?: string
  timestamp: number
}

export interface UIReasoning {
  id: string
  content: string
  agentId?: string
  isStreaming: boolean
  timestamp: number
}

export interface UIStep {
  id: string
  name: string
  agentId?: string
  status: 'running' | 'completed'
  startTime: number
  endTime?: number
}

export interface UIRunState {
  isRunning: boolean
  runId: string | null
  threadId: string | null
  totalCost: number
  error: string | null
}

// ============================================================================
// Store implementation
// ============================================================================

interface StoreState {
  messages: UIMessage[]
  toolCalls: Map<string, UIToolCall>
  reasoning: Map<string, UIReasoning>
  steps: Map<string, UIStep>
  agentState: Record<string, unknown> | null
  interrupts: AguiInterrupt[]
  runState: UIRunState
}

function createInitialState(): StoreState {
  return {
    messages: [],
    toolCalls: new Map(),
    reasoning: new Map(),
    steps: new Map(),
    agentState: null,
    interrupts: [],
    runState: {
      isRunning: false,
      runId: null,
      threadId: null,
      totalCost: 0,
      error: null,
    },
  }
}

class AguiEventStore {
  private state: StoreState = createInitialState()
  private listeners = new Set<() => void>()
  private unsubscribeTransport: (() => void) | null = null

  /** Subscribe to state changes. Returns unsubscribe. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Get current snapshot. */
  getState(): StoreState {
    return this.state
  }

  /** Connect to the sidecar transport and start consuming events. */
  connect(): void {
    if (this.unsubscribeTransport) return

    this.unsubscribeTransport = sidecarTransport.onEvent((event) => {
      this.handleEvent(event)
    })
  }

  /** Disconnect from transport. */
  disconnect(): void {
    if (this.unsubscribeTransport) {
      this.unsubscribeTransport()
      this.unsubscribeTransport = null
    }
  }

  /** Clear all state (new conversation). */
  reset(): void {
    this.state = createInitialState()
    this.notify()
  }

  /** Add a user message (local, before sending to agent). */
  addUserMessage(content: string): void {
    const msg: UIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      isStreaming: false,
      timestamp: Date.now(),
    }
    this.state = {
      ...this.state,
      messages: [...this.state.messages, msg],
    }
    this.notify()
  }

  /** Apply a JSON patch to the agent state. */
  private applyPatch(
    target: Record<string, unknown>,
    ops: JsonPatchOp[],
  ): Record<string, unknown> {
    const result = JSON.parse(JSON.stringify(target))
    for (const op of ops) {
      const parts = op.path.split('/').filter(Boolean)
      let current: any = result

      for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]]
      }

      const lastKey = parts[parts.length - 1]
      switch (op.op) {
        case 'add':
        case 'replace':
          if (lastKey) {
            current[lastKey] = op.value
          }
          break
        case 'remove':
          if (lastKey) {
            delete current[lastKey]
          }
          break
        case 'move':
          if (op.from) {
            const fromParts = op.from.split('/').filter(Boolean)
            let fromCurrent: any = result
            for (let i = 0; i < fromParts.length - 1; i++) {
              fromCurrent = fromCurrent[fromParts[i]]
            }
            const value = fromCurrent[fromParts[fromParts.length - 1]]
            current[lastKey] = value
            delete fromCurrent[fromParts[fromParts.length - 1]]
          }
          break
        case 'copy':
          if (op.from) {
            const fromParts = op.from.split('/').filter(Boolean)
            let fromCurrent: any = result
            for (let i = 0; i < fromParts.length - 1; i++) {
              fromCurrent = fromCurrent[fromParts[i]]
            }
            current[lastKey] = fromCurrent[fromParts[fromParts.length - 1]]
          }
          break
      }
    }
    return result
  }

  /** Process a single AG-UI event. */
  private handleEvent(event: AguiEvent): void {
    const state = { ...this.state }
    let changed = false

    // Clone mutable maps for React immutability
    const messages = [...state.messages]
    const toolCalls = new Map(state.toolCalls)
    const reasoning = new Map(state.reasoning)
    const steps = new Map(state.steps)

    switch (event.type) {
      // --- Lifecycle ---
      case 'RUN_STARTED': {
        state.runState = {
          ...state.runState,
          isRunning: true,
          runId: event.runId,
          threadId: event.threadId,
          error: null,
        }
        changed = true
        break
      }

      case 'RUN_FINISHED': {
        if (event.outcome?.type === 'interrupt') {
          state.interrupts = [...state.interrupts, ...event.outcome.interrupts]
        } else {
          state.runState = {
            ...state.runState,
            isRunning: false,
          }
        }

        // Close any streaming messages
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].isStreaming) {
            messages[i] = { ...messages[i], isStreaming: false }
          }
        }

        // Close any streaming reasoning
        for (const [key, r] of reasoning) {
          if (r.isStreaming) {
            reasoning.set(key, { ...r, isStreaming: false })
          }
        }

        // Extract cost from result
        const cost = (event.result as any)?.totalCost
        if (typeof cost === 'number') {
          state.runState.totalCost = cost
        }

        changed = true
        break
      }

      case 'RUN_ERROR': {
        state.runState = {
          ...state.runState,
          isRunning: false,
          error: event.message,
        }
        changed = true
        break
      }

      // --- Text streaming ---
      case 'TEXT_MESSAGE_START': {
        messages.push({
          id: event.messageId,
          role: event.role || 'assistant',
          content: '',
          isStreaming: true,
          timestamp: event.timestamp || Date.now(),
        })
        changed = true
        break
      }

      case 'TEXT_MESSAGE_CONTENT': {
        const msg = messages.find((m) => m.id === event.messageId)
        if (msg) {
          msg.content += event.delta
          changed = true
        }
        break
      }

      case 'TEXT_MESSAGE_END': {
        const msg = messages.find((m) => m.id === event.messageId)
        if (msg) {
          msg.isStreaming = false
          changed = true
        }
        break
      }

      // --- Tool calls ---
      case 'TOOL_CALL_START': {
        toolCalls.set(event.toolCallId, {
          id: event.toolCallId,
          name: event.toolCallName,
          args: '',
          argsParsed: null,
          status: 'streaming',
          agentId: event.agentId,
          timestamp: event.timestamp || Date.now(),
        })
        changed = true
        break
      }

      case 'TOOL_CALL_ARGS': {
        const tc = toolCalls.get(event.toolCallId)
        if (tc) {
          tc.args += event.delta
          try {
            tc.argsParsed = JSON.parse(tc.args)
          } catch {
            // Partial JSON — keep accumulating
          }
          changed = true
        }
        break
      }

      case 'TOOL_CALL_END': {
        const tc = toolCalls.get(event.toolCallId)
        if (tc) {
          try {
            tc.argsParsed = JSON.parse(tc.args)
          } catch {
            // Ignore parse errors
          }
          tc.status = 'executing'
          changed = true
        }
        break
      }

      case 'TOOL_CALL_RESULT': {
        const tc = toolCalls.get(event.toolCallId)
        if (tc) {
          tc.status = 'completed'
          tc.result = event.content
          changed = true
        }

        // Also add as a tool message
        messages.push({
          id: event.messageId,
          role: 'tool',
          content: event.content,
          isStreaming: false,
          timestamp: event.timestamp || Date.now(),
        })
        break
      }

      // --- Reasoning ---
      case 'REASONING_START': {
        reasoning.set(event.messageId, {
          id: event.messageId,
          content: '',
          agentId: event.agentId,
          isStreaming: true,
          timestamp: event.timestamp || Date.now(),
        })
        changed = true
        break
      }

      case 'REASONING_CONTENT': {
        const r = reasoning.get(event.messageId)
        if (r) {
          r.content += event.delta
          changed = true
        }
        break
      }

      case 'REASONING_END': {
        const r = reasoning.get(event.messageId)
        if (r) {
          r.isStreaming = false
          changed = true
        }
        break
      }

      // --- Steps (subagents) ---
      case 'STEP_STARTED': {
        steps.set(event.stepName, {
          id: event.stepName,
          name: event.stepName,
          agentId: event.agentId,
          status: 'running',
          startTime: event.timestamp || Date.now(),
        })
        changed = true
        break
      }

      case 'STEP_FINISHED': {
        const step = steps.get(event.stepName)
        if (step) {
          step.status = 'completed'
          step.endTime = event.timestamp || Date.now()
          changed = true
        }
        break
      }

      // --- State sync ---
      case 'STATE_SNAPSHOT': {
        state.agentState = event.state
        changed = true
        break
      }

      case 'STATE_DELTA': {
        if (state.agentState) {
          state.agentState = this.applyPatch(state.agentState, event.delta)
        }
        changed = true
        break
      }

      case 'MESSAGES_SNAPSHOT': {
        // Replace messages with the snapshot
        state.agentState = { ...state.agentState, messages: event.messages }
        changed = true
        break
      }

      // --- Custom ---
      case 'CUSTOM': {
        // Custom events are handled by specific UI components
        changed = true
        break
      }
    }

    if (changed) {
      state.messages = messages
      state.toolCalls = toolCalls
      state.reasoning = reasoning
      state.steps = steps
      this.state = state
      this.notify()
    }
  }

  /** Resolve an interrupt. */
  resolveInterrupt(interruptId: string, payload: unknown): void {
    const interrupt = this.state.interrupts.find((i) => i.id === interruptId)
    if (!interrupt) return

    const threadId = this.state.runState.threadId
    if (!threadId) return

    // Remove the interrupt from pending
    this.state = {
      ...this.state,
      interrupts: this.state.interrupts.filter((i) => i.id !== interruptId),
      runState: {
        ...this.state.runState,
        isRunning: true,
      },
    }
    this.notify()

    // Send resume to sidecar
    sidecarTransport.resumeRun(threadId, [
      {
        interruptId,
        status: 'resolved',
        payload,
      },
    ])
  }

  /** Cancel an interrupt. */
  cancelInterrupt(interruptId: string): void {
    const threadId = this.state.runState.threadId
    this.state = {
      ...this.state,
      interrupts: this.state.interrupts.filter((i) => i.id !== interruptId),
    }
    this.notify()

    if (threadId) {
      sidecarTransport.resumeRun(threadId, [
        { interruptId, status: 'cancelled' },
      ])
    }
  }

  private notify(): void {
    this.listeners.forEach((l) => l())
  }
}

// Singleton instance
export const aguiEventStore = new AguiEventStore()

// ============================================================================
// React hook
// ============================================================================

export function useAguiStore() {
  const [, forceUpdate] = useState({})
  const stateRef = useRef(aguiEventStore.getState())

  const forceRender = useCallback(() => {
    stateRef.current = aguiEventStore.getState()
    forceUpdate({})
  }, [])

  useEffect(() => {
    aguiEventStore.connect()
    const unsubscribe = aguiEventStore.subscribe(forceRender)
    return () => {
      unsubscribe()
    }
  }, [forceRender])

  return {
    state: stateRef.current,
    store: aguiEventStore,
    // Convert maps to arrays for easier rendering
    toolCalls: Array.from(stateRef.current.toolCalls.values()),
    reasoning: Array.from(stateRef.current.reasoning.values()),
    steps: Array.from(stateRef.current.steps.values()),
  }
}
