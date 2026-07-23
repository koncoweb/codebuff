/**
 * Codebuff Integration Service untuk KoncoVibe
 *
 * Hybrid Mode Implementation:
 * - Desktop (Tauri): Codebuff SDK sidecar via JSON-RPC over stdio
 * - Browser/ fallback: SumoPod AI (pipeline existing di sidecar-api.ts)
 *
 * The sidecar runs the Codebuff SDK in a Node.js/Bun process, communicating
 * via AG-UI-inspired events streamed over JSON-RPC. The frontend never imports
 * @codebuff/sdk directly (which would break the production build).
 *
 * REFACTOR: Event→step mapping logic diekstrak ke `agui-step-mapper.ts`
 * sebagai class terpisah dengan TOOL_MAPPINGS table tunggal. File ini
 * sekarang hanya berisi orchestration logic (mode detection, dispatch,
 * event subscription, fallback).
 *
 * Lihat: docs/architecture.md untuk diagram alur lengkap.
 */
import { sendVibePrompt, addDebugLog, extractCleanHtml } from './sidecar-api'
import type { VibeAgentStep, ChatMessage } from './sidecar-api'
import { sidecarTransport } from './codebuff-sidecar-transport'
import { AguiStepMapper } from './agui-step-mapper'
import type { AguiEvent, RunResult } from '../types/agui-events'

export type BackendMode = 'codebuff' | 'sumopod-fallback'

export interface CodebuffConfig {
  apiKey?: string
  cwd?: string
}

export interface VibePromptOptions {
  prompt: string
  providerConfig: {
    provider: string
    apiKey: string
    baseUrl: string
    selectedModel: string
  }
  onStep: (step: VibeAgentStep) => void
  onGeneratedHtml?: (html: string) => void
  currentHtml?: string
  signal?: AbortSignal
  chatHistory?: ChatMessage[]
  elementContext?: {
    selector: string
    tag: string
    id?: string
    classes: string[]
    text?: string
    outerHTML?: string
  }
}

// Track the active thread for multi-turn continuity
let activeThreadId: string | null = null
let previousRunState: unknown = null

/**
 * Deteksi mode backend yang aktif.
 * Saat desktop mode (Tauri), coba start sidecar dan ping.
 * Fallback ke SumoPod jika sidecar tidak tersedia.
 */
export async function getBackendMode(): Promise<BackendMode> {
  if (!sidecarTransport.isDesktopMode()) {
    return 'sumopod-fallback'
  }

  try {
    const started = await sidecarTransport.start()
    if (!started) return 'sumopod-fallback'

    const result = await sidecarTransport.ping().catch(() => null)
    if (result?.pong) {
      addDebugLog('info', 'LLM_REQUEST', 'Codebuff sidecar active', { pid: result })
      return 'codebuff'
    }
  } catch (err: any) {
    addDebugLog('warn', 'LLM_REQUEST', `Sidecar unavailable: ${err?.message}`, {})
  }

  return 'sumopod-fallback'
}

/**
 * Kirim prompt vibe coding ke backend.
 * Automatically memilih Codebuff sidecar atau SumoPod fallback.
 */
export async function sendVibeCodingPrompt(options: VibePromptOptions): Promise<void> {
  const mode = await getBackendMode()

  // Emit user message sebagai chat bubble pertama
  options.onStep({
    id: crypto.randomUUID(),
    type: 'user_message',
    title: 'Anda',
    content: options.prompt,
    timestamp: new Date().toLocaleTimeString(),
    status: 'completed',
  })

  addDebugLog('info', 'LLM_REQUEST', `Backend mode: ${mode}`, {
    mode,
    prompt: options.prompt.substring(0, 100),
  })

  if (mode === 'codebuff') {
    await sendViaSidecar(options)
  } else {
    await sendVibePrompt(
      options.prompt,
      options.providerConfig,
      options.onStep,
      options.onGeneratedHtml,
      options.currentHtml,
      options.signal,
      options.chatHistory,
    )
  }
}

/**
 * Jalankan via Codebuff SDK sidecar (desktop/Tauri mode).
 *
 * Streams AG-UI-inspired events from the sidecar and converts them to
 * VibeAgentStep for backward compatibility with the existing UI.
 */
async function sendViaSidecar(options: VibePromptOptions): Promise<void> {
  if (!activeThreadId) {
    activeThreadId = `thread-${Date.now()}`
  }

  // One mapper instance per run — isolates stepId/toolName tracking
  const mapper = new AguiStepMapper()
  let latestAssistantContent = ''

  const unsubscribe = sidecarTransport.onEvent((event: AguiEvent) => {
    const steps = mapper.convert(event)
    for (const step of steps) {
      if (step.type === 'assistant_message' && step.content) {
        latestAssistantContent = step.content
      }
      options.onStep(step)
    }
  })

  // Handle abort
  if (options.signal) {
    options.signal.addEventListener('abort', () => {
      if (activeThreadId) {
        sidecarTransport.cancelRun(activeThreadId)
      }
    })
  }

  try {
    const result: RunResult = await sidecarTransport.runPrompt({
      prompt: options.prompt,
      threadId: activeThreadId,
      previousRunState,
      apiKey: options.providerConfig.apiKey,
      elementContext: options.elementContext,
    })

    // Store run state for multi-turn continuity
    if (result.runState) {
      previousRunState = result.runState
    }

    // Extract generated HTML from the output
    const output = result.output || latestAssistantContent
    if (output && options.onGeneratedHtml) {
      const cleaned = extractCleanHtml(output)
      if (cleaned) {
        options.onGeneratedHtml(cleaned)
      }
    }

    addDebugLog('success', 'LLM_RESPONSE', 'Codebuff sidecar run completed', {
      status: result.status,
      cost: result.totalCost,
    })
  } catch (err: any) {
    addDebugLog('error', 'LLM_RESPONSE', `Sidecar error, falling back: ${err?.message}`, { error: err })

    // Graceful fallback ke SumoPod
    await sendVibePrompt(
      options.prompt,
      options.providerConfig,
      options.onStep,
      options.onGeneratedHtml,
      options.currentHtml,
      options.signal,
      options.chatHistory,
    )
  } finally {
    unsubscribe()
  }
}

/** Reset conversation state (new chat). */
export function resetConversation(): void {
  activeThreadId = null
  previousRunState = null
}
