/**
 * AG-UI-Inspired Event Types for KoncoVibe
 *
 * These types are inspired by the AG-UI protocol (https://docs.ag-ui.com)
 * but adapted for KoncoVibe's desktop architecture (JSON-RPC over stdio).
 * They fill gaps in Codebuff's PrintModeEvent without duplicating its strengths.
 *
 * Shared between the sidecar (Node.js/Bun process running Codebuff SDK)
 * and the frontend (React/Vite browser bundle).
 */

// ============================================================================
// Base Event
// ============================================================================

export interface AguiBaseEvent {
  type: string
  timestamp?: number
  rawEvent?: unknown
}

// ============================================================================
// Lifecycle Events
// ============================================================================

export interface RunStartedEvent extends AguiBaseEvent {
  type: 'RUN_STARTED'
  threadId: string
  runId: string
  parentRunId?: string
}

export interface RunFinishedEvent extends AguiBaseEvent {
  type: 'RUN_FINISHED'
  threadId: string
  runId: string
  result?: unknown
  outcome?:
    | { type: 'success' }
    | { type: 'interrupt'; interrupts: AguiInterrupt[] }
}

export interface RunErrorEvent extends AguiBaseEvent {
  type: 'RUN_ERROR'
  message: string
  code?: string
}

export interface StepStartedEvent extends AguiBaseEvent {
  type: 'STEP_STARTED'
  stepName: string
  agentId?: string
}

export interface StepFinishedEvent extends AguiBaseEvent {
  type: 'STEP_FINISHED'
  stepName: string
  agentId?: string
}

// ============================================================================
// Text Message Events (true delta streaming — Codebuff's `text` is full-string)
// ============================================================================

export interface TextMessageStartEvent extends AguiBaseEvent {
  type: 'TEXT_MESSAGE_START'
  messageId: string
  role?: 'assistant' | 'user' | 'system' | 'tool'
}

export interface TextMessageContentEvent extends AguiBaseEvent {
  type: 'TEXT_MESSAGE_CONTENT'
  messageId: string
  delta: string
}

export interface TextMessageEndEvent extends AguiBaseEvent {
  type: 'TEXT_MESSAGE_END'
  messageId: string
}

// ============================================================================
// Tool Call Events (streaming args — Codebuff sends complete input)
// ============================================================================

export interface ToolCallStartEvent extends AguiBaseEvent {
  type: 'TOOL_CALL_START'
  toolCallId: string
  toolCallName: string
  parentMessageId?: string
  agentId?: string
}

export interface ToolCallArgsEvent extends AguiBaseEvent {
  type: 'TOOL_CALL_ARGS'
  toolCallId: string
  delta: string
}

export interface ToolCallEndEvent extends AguiBaseEvent {
  type: 'TOOL_CALL_END'
  toolCallId: string
}

export interface ToolCallResultEvent extends AguiBaseEvent {
  type: 'TOOL_CALL_RESULT'
  messageId: string
  toolCallId: string
  content: string
  role?: 'tool'
}

// ============================================================================
// State Management Events (incremental sync — Codebuff only has snapshot blobs)
// ============================================================================

export interface StateSnapshotEvent extends AguiBaseEvent {
  type: 'STATE_SNAPSHOT'
  state: Record<string, unknown>
}

export interface StateDeltaEvent extends AguiBaseEvent {
  type: 'STATE_DELTA'
  delta: JsonPatchOp[]
}

export interface MessagesSnapshotEvent extends AguiBaseEvent {
  type: 'MESSAGES_SNAPSHOT'
  messages: unknown[]
}

// ============================================================================
// Reasoning Events (Codebuff already has reasoning_delta — wrap in lifecycle)
// ============================================================================

export interface ReasoningStartEvent extends AguiBaseEvent {
  type: 'REASONING_START'
  messageId: string
  agentId?: string
}

export interface ReasoningContentEvent extends AguiBaseEvent {
  type: 'REASONING_CONTENT'
  messageId: string
  delta: string
  agentId?: string
}

export interface ReasoningEndEvent extends AguiBaseEvent {
  type: 'REASONING_END'
  messageId: string
}

// ============================================================================
// Custom / Special Events
// ============================================================================

export interface CustomEvent extends AguiBaseEvent {
  type: 'CUSTOM'
  name: string
  value?: unknown
}

export interface ActivitySnapshotEvent extends AguiBaseEvent {
  type: 'ACTIVITY_SNAPSHOT'
  activities: ActivityEntry[]
}

export interface ActivityEntry {
  id: string
  name: string
  status: 'running' | 'completed' | 'failed'
  progress?: number
  message?: string
}

// ============================================================================
// Interrupt Type (AG-UI's human-in-the-loop pattern)
// ============================================================================

export interface AguiInterrupt {
  id: string
  reason: string
  message?: string
  toolCallId?: string
  responseSchema?: Record<string, unknown>
  expiresAt?: string
  metadata?: Record<string, unknown>
}

// ============================================================================
// Resume Type (for interrupt resolution)
// ============================================================================

export interface AguiResume {
  interruptId: string
  status: 'resolved' | 'cancelled'
  payload?: unknown
}

// ============================================================================
// JSON Patch (RFC 6902) for state deltas
// ============================================================================

export type JsonPatchOp =
  | { op: 'add'; path: string; value: unknown }
  | { op: 'remove'; path: string }
  | { op: 'replace'; path: string; value: unknown }
  | { op: 'move'; from: string; path: string }
  | { op: 'copy'; from: string; path: string }
  | { op: 'test'; path: string; value: unknown }

// ============================================================================
// Union of all AG-UI events
// ============================================================================

export type AguiEvent =
  | RunStartedEvent
  | RunFinishedEvent
  | RunErrorEvent
  | StepStartedEvent
  | StepFinishedEvent
  | TextMessageStartEvent
  | TextMessageContentEvent
  | TextMessageEndEvent
  | ToolCallStartEvent
  | ToolCallArgsEvent
  | ToolCallEndEvent
  | ToolCallResultEvent
  | StateSnapshotEvent
  | StateDeltaEvent
  | MessagesSnapshotEvent
  | ReasoningStartEvent
  | ReasoningContentEvent
  | ReasoningEndEvent
  | CustomEvent
  | ActivitySnapshotEvent

// ============================================================================
// JSON-RPC Protocol Types (over stdio)
// ============================================================================

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: unknown
  id?: string | number
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
  id?: string | number
}

export interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: unknown
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification

// ============================================================================
// Sidecar-specific request/response params
// ============================================================================

export interface RunParams {
  prompt: string
  threadId: string
  resume?: AguiResume[]
  previousRunState?: unknown
  mcpConfigPath?: string
  cwd?: string
  apiKey?: string
  elementContext?: ElementContext
}

export interface ElementContext {
  selector: string
  tag: string
  id?: string
  classes: string[]
  text?: string
  computedStyles?: Record<string, string>
  outerHTML?: string
}

export interface RunResult {
  status: 'success' | 'interrupt'
  interrupts?: AguiInterrupt[]
  output?: string
  traceSessionId?: string
  totalCost?: number
  runState?: unknown
}

export interface CancelParams {
  runId: string
}

export interface McpConfigParams {
  servers: Record<string, unknown>
}
