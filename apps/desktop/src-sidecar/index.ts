/**
 * Codebuff SDK Sidecar Process — Entry Point
 *
 * A standalone Node.js/Bun process that runs the Codebuff SDK and communicates
 * with the KoncoVibe frontend via JSON-RPC 2.0 over stdio.
 *
 * REFACTOR: Sebelumnya 477 baris dengan semua logic inline. Sekarang menjadi
 * thin entry point yang menggabungkan modul-modul terpisah:
 * - json-rpc.ts          → protocol layer (send/receive JSON-RPC)
 * - stream-chunk-handler.ts → token streaming (text/reasoning deltas)
 * - interrupt-bridge.ts   → human-in-the-loop interrupt handling
 * - agui-event-mapper.ts  → Codebuff PrintModeEvent → AG-UI events
 *
 * Run directly:  bun run apps/desktop/src-sidecar/index.ts
 * Compiled:      binaries/codebuff-bridge (via bun build --compile)
 */
import { vibeCoderAgent } from '../src/agents/vibe-coder'
import { vibeReviewerAgent } from '../src/agents/vibe-reviewer'
import type {
  AguiEvent,
  CancelParams,
  JsonRpcRequest,
  RunParams,
  RunResult,
} from '../src/types/agui-events'
import {
  createMapperState,
  mapCodebuffEventToAgui,
  mapStateSnapshotToAgui,
  type MapperState,
} from './agui-event-mapper'
import { createJsonRpcIO, type JsonRpcIO } from './json-rpc'
import { createStreamChunkHandler } from './stream-chunk-handler'
import { resolveInterrupt, setupInterruptBridge } from './interrupt-bridge'

// ============================================================================
// Run state (module-level — shared across handlers within one process)
// ============================================================================

let activeRunId: string | null = null
let activeAbortController: AbortController | null = null
let lastRunState: unknown = null
let activeThreadId: string | null = null
let codebuffClient: any = null

// ============================================================================
// Codebuff SDK Client (lazy-initialized)
// ============================================================================

async function getClient(apiKey: string | undefined, io: JsonRpcIO): Promise<any> {
  if (codebuffClient) return codebuffClient

  const { CodebuffClient } = await import('@codebuff/sdk')

  const mapperState: MapperState = createMapperState()
  const threadId = activeThreadId || `thread-${Date.now()}`

  codebuffClient = new CodebuffClient({
    apiKey: apiKey || process.env.CODEBUFF_API_KEY,
    cwd: process.cwd(),
    agentDefinitions: [vibeCoderAgent, vibeReviewerAgent],

    // Structured events (tool calls, lifecycle, errors)
    handleEvent: (event: any) => {
      if (!activeRunId) return
      const aguiEvents = mapCodebuffEventToAgui(event, mapperState, threadId, activeRunId)
      for (const evt of aguiEvents) {
        io.sendEvent(evt)
      }
    },

    // Token-level streaming (text + reasoning deltas)
    handleStreamChunk: createStreamChunkHandler(mapperState, (evt: AguiEvent) => {
      if (activeRunId) io.sendEvent(evt)
    }),
  })

  return codebuffClient
}

// ============================================================================
// JSON-RPC method handlers
// ============================================================================

async function handleRun(params: RunParams, id: string | number, io: JsonRpcIO): Promise<void> {
  const runId = `run-${Date.now()}`
  activeRunId = runId
  activeThreadId = params.threadId
  activeAbortController = new AbortController()

  try {
    const client = await getClient(params.apiKey, io)

    // Build the prompt with element context if provided
    let prompt = params.prompt
    if (params.elementContext) {
      prompt = buildElementContextPrompt(params.prompt, params.elementContext)
    }

    const result = await client.run({
      agent: vibeCoderAgent,
      prompt,
      signal: activeAbortController.signal,
      previousRun: params.previousRunState as any,
      onStateSnapshot: (runState: any) => {
        lastRunState = runState
        const mapperState = createMapperState()
        const events = mapStateSnapshotToAgui(
          { ...runState, threadId: params.threadId, runId } as any,
          mapperState,
        )
        for (const evt of events) {
          io.sendEvent(evt)
        }
      },
    })

    lastRunState = result

    const output = extractOutput(result)
    const runResult: RunResult = {
      status: 'success',
      output,
      traceSessionId: result?.traceSessionId,
      runState: result?.sessionState,
    }

    io.sendResponse(id, runResult)
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      io.sendResponse(id, {
        status: 'success',
        output: '(dibatalkan oleh user)',
        runState: lastRunState,
      })
    } else {
      io.sendError(id, -32603, err?.message || 'Unknown error during run')
    }
  } finally {
    activeRunId = null
    activeAbortController = null
  }
}

function handleResume(params: any, id: string | number, io: JsonRpcIO): void {
  const resumes = params.resume || []
  for (const resume of resumes) {
    resolveInterrupt(resume)
  }

  // After resolving interrupts, continue the run if there's a new prompt
  if (params.prompt) {
    handleRun(params, id, io)
  } else {
    io.sendResponse(id, { status: 'resumed' })
  }
}

function handleCancel(_params: CancelParams): void {
  if (activeAbortController) {
    activeAbortController.abort()
  }
}

async function handlePing(id: string | number, io: JsonRpcIO): Promise<void> {
  io.sendResponse(id, {
    pong: true,
    version: '1.0.0',
    sdkLoaded: codebuffClient !== null,
  })
}

async function handleListMcpTools(params: any, id: string | number, io: JsonRpcIO): Promise<void> {
  try {
    const { listMCPTools } = await import('@codebuff/common/mcp/client')
    const tools: Record<string, unknown> = {}
    for (const serverName of Object.keys(params.servers || {})) {
      try {
        const clientId = `${serverName}-discovery`
        const toolList = await listMCPTools(clientId)
        tools[serverName] = toolList || []
      } catch (err: any) {
        tools[serverName] = { error: err?.message || 'Connection failed' }
      }
    }
    io.sendResponse(id, { tools })
  } catch (err: any) {
    io.sendError(id, -32603, err?.message || 'Failed to list MCP tools')
  }
}

// ============================================================================
// Helpers
// ============================================================================

/** Build a prompt with element context for targeted editing. */
function buildElementContextPrompt(
  userPrompt: string,
  ctx: NonNullable<RunParams['elementContext']>,
): string {
  const ctxStr = [
    'ELEMENT TARGET:',
    `  Tag: ${ctx.tag}`,
    ctx.id ? `  ID: ${ctx.id}` : '',
    ctx.classes.length ? `  Classes: ${ctx.classes.join(', ')}` : '',
    `  Selector: ${ctx.selector}`,
    ctx.text ? `  Text: ${ctx.text.substring(0, 200)}` : '',
    ctx.outerHTML ? `  HTML: ${ctx.outerHTML.substring(0, 500)}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return `${ctxStr}\n\nEDIT INSTRUCTION: ${userPrompt}\n\nEdit ONLY the targeted element. Use str_replace for precise edits, NOT write_file for the whole document.`
}

/** Extract output string from Codebuff run result. */
function extractOutput(result: any): string {
  if (result?.output?.type === 'last_message') {
    return result.output.last_message
  }
  if (typeof result?.output === 'string') {
    return result.output
  }
  return result?.output?.last_message || ''
}

// ============================================================================
// Main entry point
// ============================================================================

async function main(): Promise<void> {
  const io = createJsonRpcIO()

  // Setup interrupt bridge for ask_user
  await setupInterruptBridge(
    () => activeRunId,
    () => activeThreadId,
    (evt) => io.sendEvent(evt),
  )

  // Signal readiness
  io.sendNotification('ready', { version: '1.0.0', pid: process.pid })

  // Route incoming JSON-RPC requests to handlers
  io.onMessage(async (request: JsonRpcRequest) => {
    const id = request.id ?? 0

    switch (request.method) {
      case 'ping':
        await handlePing(id, io)
        break

      case 'run':
        await handleRun(request.params as RunParams, id, io)
        break

      case 'resume':
        handleResume(request.params, id, io)
        break

      case 'cancel':
        handleCancel(request.params as CancelParams)
        break

      case 'listMcpTools':
        await handleListMcpTools(request.params, id, io)
        break

      default:
        io.sendError(request.id, -32601, `Method not found: ${request.method}`)
    }
  })

  io.start()
}

main().catch((err) => {
  process.stderr.write(`Fatal sidecar error: ${err}\n`)
  process.exit(1)
})
