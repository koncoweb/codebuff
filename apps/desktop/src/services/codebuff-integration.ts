/**
 * Codebuff Integration Service untuk KoncoVibe
 *
 * Hybrid Mode Implementation:
 * - Jika CODEBUFF_API_KEY tersedia: gunakan Codebuff SDK dengan multi-agent pipeline
 * - Jika tidak: fallback ke SumoPod AI (pipeline existing di sidecar-api.ts)
 *
 * Arsitektur Desktop (Tauri):
 * Saat KoncoVibe berjalan sebagai desktop app, service ini akan berkomunikasi
 * dengan Codebuff SDK sidecar process via JSON-RPC over stdio.
 *
 * Lihat: docs/architecture.md untuk diagram alur lengkap.
 */
import { vibeCoderAgent } from '../agents/vibe-coder'
import { vibeReviewerAgent } from '../agents/vibe-reviewer'
import { sendVibePrompt, addDebugLog } from './sidecar-api'
import type { VibeAgentStep, PipelinePhase, ChatMessage } from './sidecar-api'

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
}

/**
 * Deteksi mode backend yang aktif.
 * Saat desktop mode (Tauri), check apakah Codebuff sidecar binary tersedia.
 * Selalu fallback ke SumoPod jika sidecar belum siap.
 */
export async function getBackendMode(): Promise<BackendMode> {
  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const sidecarReady = await invoke<boolean>('check_codebuff_sidecar')
      if (sidecarReady) return 'codebuff'
    } catch {
      // Tauri API tidak tersedia atau command gagal — fallback
    }
  }
  return 'sumopod-fallback'
}

/**
 * Kirim prompt vibe coding ke backend.
 * Automatically memilih Codebuff SDK atau SumoPod fallback.
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
    await sendViaCodebuffSDK(options)
  } else {
    await sendVibePrompt(
      options.prompt,
      options.providerConfig,
      options.onStep,
      options.onGeneratedHtml,
      options.currentHtml,
      options.signal,
      options.chatHistory
    )
  }
}

/**
 * Jalankan via Codebuff SDK (desktop/Tauri mode).
 *
 * Agent pipeline:
 * 1. vibe-coder: think → research → generate → review
 * 2. Events dikirim ke UI via onStep callback
 *
 * TODO: Implement saat Tauri sidecar siap.
 * Sementara ini throw error informatif.
 */
async function sendViaCodebuffSDK(options: VibePromptOptions): Promise<void> {
  // Dynamic import — hanya load SDK di desktop mode
  try {
    const { CodebuffClient } = await import('@codebuff/sdk')

    const client = new CodebuffClient({
      apiKey: options.providerConfig.apiKey || process.env.CODEBUFF_API_KEY,
      cwd: typeof process !== 'undefined' ? process.cwd() : '/',
      agentDefinitions: [vibeCoderAgent, vibeReviewerAgent],
      handleEvent: (event: any) => {
        // Map Codebuff event ke VibeAgentStep UI
        const step = mapCodebuffEventToStep(event)
        if (step) {
          options.onStep(step)
        }
      },
    })

    addDebugLog('info', 'LLM_REQUEST', 'Codebuff SDK client initialized', {
      agent: vibeCoderAgent.id,
      model: vibeCoderAgent.model,
    })

    const result = await client.run({
      agent: vibeCoderAgent,
      prompt: options.currentHtml
        ? `EDIT existing HTML:\n\`\`\`html\n${options.currentHtml}\n\`\`\`\n\nREQUEST: ${options.prompt}`
        : options.prompt,
    })

    // Extract generated HTML dari output agent
    const output = result.output?.last_message || ''
    if (output && options.onGeneratedHtml) {
      // Parse HTML dari output (sama seperti extractCleanHtml di sidecar-api)
      const { extractCleanHtml } = await import('./sidecar-api')
      const cleaned = extractCleanHtml(output)
      if (cleaned) {
        options.onGeneratedHtml(cleaned)
      }
    }

    addDebugLog('success', 'LLM_RESPONSE', 'Codebuff SDK run completed', {
      traceSessionId: result.traceSessionId,
    })
  } catch (err: any) {
    addDebugLog('error', 'LLM_RESPONSE', `Codebuff SDK error, falling back to default pipeline: ${err?.message}`, { error: err })

    // Graceful fallback ke SumoPod
    await sendVibePrompt(
      options.prompt,
      options.providerConfig,
      options.onStep,
      options.onGeneratedHtml,
      options.currentHtml,
      options.signal,
      options.chatHistory
    )
  }
}

/**
 * Map Codebuff SDK event ke VibeAgentStep untuk UI KoncoVibe.
 */
function mapCodebuffEventToStep(event: any): VibeAgentStep | null {
  if (!event || !event.type) return null

  const timestamp = new Date().toLocaleTimeString()
  const stepId = crypto.randomUUID()

  switch (event.type) {
    case 'assistant_message':
      return {
        id: stepId,
        type: 'assistant_message',
        title: 'KoncoVibe AI (Codebuff)',
        content: event.content || event.message || '',
        timestamp,
        status: 'completed',
        agentGroup: 'reviewer',
        pipelinePhase: 'done',
      }

    case 'tool_call':
      return {
        id: stepId,
        type: mapToolNameToStepType(event.toolName),
        title: formatToolTitle(event.toolName),
        content: event.input ? JSON.stringify(event.input, null, 2).substring(0, 500) : '',
        timestamp,
        status: 'running',
        agentGroup: mapToolNameToAgentGroup(event.toolName),
        pipelinePhase: mapToolNameToPipelinePhase(event.toolName),
        affectedFile: event.input?.path,
      }

    case 'tool_result':
      return {
        id: stepId,
        type: 'change_file',
        title: `${event.toolName} selesai`,
        content: event.output ? String(event.output).substring(0, 500) : 'Completed',
        timestamp,
        status: 'completed',
        agentGroup: mapToolNameToAgentGroup(event.toolName),
        pipelinePhase: mapToolNameToPipelinePhase(event.toolName),
      }

    case 'error':
      return {
        id: stepId,
        type: 'error',
        title: 'Error dari Agent',
        content: event.message || event.error || 'Unknown error',
        timestamp,
        status: 'failed',
        agentGroup: 'editor',
        pipelinePhase: 'done',
      }

    case 'subagent_start':
      return {
        id: stepId,
        type: 'thinking',
        title: `Men-spawn agent: ${event.agentType}`,
        content: event.prompt ? event.prompt.substring(0, 200) : '',
        timestamp,
        status: 'running',
        agentGroup: event.agentType || 'default',
        pipelinePhase: event.agentType === 'researcher-web' ? 'researching' : 'thinking',
      }

    default:
      return null
  }
}

/** Map tool name ke agentGroup untuk UI grouping */
function mapToolNameToAgentGroup(toolName: string): string {
  switch (toolName) {
    case 'think_deeply':
      return 'thinker'
    case 'web_search':
    case 'read_url':
    case 'read_docs':
      return 'researcher-web'
    case 'write_file':
    case 'str_replace':
    case 'apply_patch':
      return 'editor'
    case 'spawn_agents':
      return 'thinker'
    default:
      return 'default'
  }
}

/** Map tool name ke pipelinePhase untuk progress indicator */
function mapToolNameToPipelinePhase(toolName: string): PipelinePhase {
  switch (toolName) {
    case 'think_deeply':
      return 'thinking'
    case 'web_search':
    case 'read_url':
    case 'read_docs':
      return 'researching'
    case 'write_file':
    case 'str_replace':
    case 'apply_patch':
      return 'generating'
    case 'code_search':
    case 'glob':
    case 'read_files':
      return 'reviewing'
    default:
      return 'generating'
  }
}

function mapToolNameToStepType(toolName: string): VibeAgentStep['type'] {
  switch (toolName) {
    case 'write_file':
    case 'str_replace':
    case 'apply_patch':
      return 'change_file'
    case 'read_files':
    case 'read_subtree':
    case 'find_files':
      return 'read_files'
    case 'run_terminal_command':
      return 'run_terminal_command'
    case 'web_search':
    case 'read_url':
    case 'read_docs':
      return 'thinking'
    case 'think_deeply':
      return 'thinking'
    case 'spawn_agents':
      return 'thinking'
    default:
      return 'assistant_message'
  }
}

function formatToolTitle(toolName: string): string {
  const titles: Record<string, string> = {
    write_file: 'Menulis file...',
    str_replace: 'Mengedit kode...',
    read_files: 'Membaca file...',
    run_terminal_command: 'Menjalankan terminal...',
    web_search: 'Mencari di web...',
    read_url: 'Membaca URL...',
    think_deeply: 'Berpikir mendalam...',
    spawn_agents: 'Men-spawn sub-agent...',
    set_output: 'Menyiapkan output...',
    code_search: 'Mencari kode...',
  }
  return titles[toolName] || `Tool: ${toolName}`
}
