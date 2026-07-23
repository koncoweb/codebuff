/**
 * AG-UI Event → VibeAgentStep Mapper
 *
 * Mengkonversi AG-UI-inspired events menjadi VibeAgentStep untuk backward
 * compatibility dengan UI components yang sudah ada (ChatPanel, pipeline bar).
 *
 * REFACTOR NOTE: Sebelumnya file ini ada di dalam codebuff-integration.ts dengan
 * 4 fungsi switch terpisah (mapToolNameToAgentGroup, mapToolNameToPipelinePhase,
 * mapToolNameToStepType, formatToolTitle) yang harus sinkron manual dan rentan
 * error. Sekarang digabung menjadi satu TOOL_MAPPINGS table — tambah tool baru
 * cukup di satu tempat.
 */
import type { VibeAgentStep, PipelinePhase } from './sidecar-api'
import type { AguiEvent } from '../types/agui-events'

// ============================================================================
// Single Source of Truth: Tool Name → UI Mapping
// ============================================================================

interface ToolMapping {
  agentGroup: string
  pipelinePhase: PipelinePhase
  stepType: VibeAgentStep['type']
  title: string
}

/**
 * Lookup table untuk semua tool names Codebuff.
 * Untuk menambahkan tool baru, cukup tambah entry di sini — tidak perlu
 * mengupdate 4 switch statement terpisah.
 */
const TOOL_MAPPINGS: Record<string, ToolMapping> = {
  // --- Thinker ---
  think_deeply: {
    agentGroup: 'thinker',
    pipelinePhase: 'thinking',
    stepType: 'thinking',
    title: 'Berpikir mendalam...',
  },
  spawn_agents: {
    agentGroup: 'thinker',
    pipelinePhase: 'thinking',
    stepType: 'thinking',
    title: 'Men-spawn sub-agent...',
  },

  // --- Researcher (Web) ---
  web_search: {
    agentGroup: 'researcher-web',
    pipelinePhase: 'researching',
    stepType: 'thinking',
    title: 'Mencari di web...',
  },
  read_url: {
    agentGroup: 'researcher-web',
    pipelinePhase: 'researching',
    stepType: 'thinking',
    title: 'Membaca URL...',
  },
  read_docs: {
    agentGroup: 'researcher-web',
    pipelinePhase: 'researching',
    stepType: 'thinking',
    title: 'Membaca dokumentasi...',
  },

  // --- Editor ---
  write_file: {
    agentGroup: 'editor',
    pipelinePhase: 'generating',
    stepType: 'change_file',
    title: 'Menulis file...',
  },
  str_replace: {
    agentGroup: 'editor',
    pipelinePhase: 'generating',
    stepType: 'change_file',
    title: 'Mengedit kode...',
  },
  apply_patch: {
    agentGroup: 'editor',
    pipelinePhase: 'generating',
    stepType: 'change_file',
    title: 'Menerapkan patch...',
  },

  // --- Reader ---
  read_files: {
    agentGroup: 'default',
    pipelinePhase: 'reviewing',
    stepType: 'read_files',
    title: 'Membaca file...',
  },
  read_subtree: {
    agentGroup: 'default',
    pipelinePhase: 'reviewing',
    stepType: 'read_files',
    title: 'Membaca subtree...',
  },
  find_files: {
    agentGroup: 'default',
    pipelinePhase: 'reviewing',
    stepType: 'read_files',
    title: 'Mencari file...',
  },
  code_search: {
    agentGroup: 'default',
    pipelinePhase: 'reviewing',
    stepType: 'thinking',
    title: 'Mencari kode...',
  },

  // --- Terminal ---
  run_terminal_command: {
    agentGroup: 'default',
    pipelinePhase: 'generating',
    stepType: 'run_terminal_command',
    title: 'Menjalankan terminal...',
  },

  // --- Output ---
  set_output: {
    agentGroup: 'reviewer',
    pipelinePhase: 'done',
    stepType: 'assistant_message',
    title: 'Menyiapkan output...',
  },
}

/** Default mapping untuk tool yang tidak dikenal (termasuk MCP tools). */
const DEFAULT_MAPPING: ToolMapping = {
  agentGroup: 'default',
  pipelinePhase: 'generating',
  stepType: 'assistant_message',
  title: '',
}

/**
 * Lookup mapping untuk sebuah tool name.
 * MCP tools (format: `mcpName__toolName`) otomatis dapat agentGroup 'mcp'.
 */
export function getToolMapping(toolName: string): ToolMapping {
  // MCP tools use format: mcpName__toolName
  if (toolName?.includes('__')) {
    const [mcpName, tool] = toolName.split('__')
    return {
      ...DEFAULT_MAPPING,
      agentGroup: 'mcp',
      title: `${mcpName}/${tool}`,
    }
  }

  return TOOL_MAPPINGS[toolName] ?? {
    ...DEFAULT_MAPPING,
    title: `Tool: ${toolName}`,
  }
}

// ============================================================================
// Event → Step Converter (stateful)
// ============================================================================

/**
 * Stateful converter yang melacak ID mapping antara AG-UI events dan steps.
 *
 * Gunakan satu instance per run (sendViaSidecar membuat instance baru setiap run).
 * Ini mengisolasi state sehingga tidak ada kebocoran antar runs.
 */
export class AguiStepMapper {
  /** messageId/toolCallId → stepId (untuk update step yang sudah ada) */
  private stepIdMap = new Map<string, string>()
  /** toolCallId → toolCallName (ToolCallArgsEvent tidak punya toolCallName) */
  private toolNameMap = new Map<string, string>()

  /**
   * Convert satu AG-UI event menjadi nol atau lebih VibeAgentStep.
   * Setiap event type ditangani oleh dedicated handler method — mudah
   * untuk tambah event type baru tanpa menyentuh yang lain.
   */
  convert(event: AguiEvent): VibeAgentStep[] {
    const timestamp = new Date().toLocaleTimeString()

    switch (event.type) {
      case 'RUN_STARTED':
        return [this.makeStep('thinking', 'Memulai pipeline...', '', 'running', 'thinker', 'thinking', timestamp)]

      case 'TEXT_MESSAGE_CONTENT':
        return [this.handleTextContent(event, timestamp)]

      case 'TEXT_MESSAGE_END':
        return this.handleTextEnd(event, timestamp)

      case 'TOOL_CALL_START':
        return [this.handleToolCallStart(event, timestamp)]

      case 'TOOL_CALL_ARGS':
        return this.handleToolCallArgs(event, timestamp)

      case 'TOOL_CALL_RESULT':
        return this.handleToolCallResult(event, timestamp)

      case 'STEP_STARTED':
        return [this.handleStepStarted(event, timestamp)]

      case 'STEP_FINISHED':
        return [] // Steps complete naturally — no action needed

      case 'RUN_ERROR':
        return [this.makeStep('error', 'Error', event.message, 'failed', 'editor', 'done', timestamp)]

      case 'RUN_FINISHED':
        return [this.makeStep('assistant_message', 'Pipeline selesai', '', 'completed', 'reviewer', 'done', timestamp, 0)]

      default:
        // REASONING_*, STATE_*, CUSTOM events consumed by new UI components
        return []
    }
  }

  // --- Private handlers (satu method per event type) ---

  private handleTextContent(
    event: Extract<AguiEvent, { type: 'TEXT_MESSAGE_CONTENT' }>,
    timestamp: string,
  ): VibeAgentStep {
    let stepId = this.stepIdMap.get(event.messageId)
    if (!stepId) {
      stepId = crypto.randomUUID()
      this.stepIdMap.set(event.messageId, stepId)
    }
    return this.makeStep(
      'assistant_message', 'KoncoVibe AI', event.delta,
      'running', 'reviewer', 'done', timestamp, undefined, stepId,
    )
  }

  private handleTextEnd(
    event: Extract<AguiEvent, { type: 'TEXT_MESSAGE_END' }>,
    timestamp: string,
  ): VibeAgentStep[] {
    const stepId = this.stepIdMap.get(event.messageId)
    if (!stepId) return []
    return [this.makeStep(
      'assistant_message', 'KoncoVibe AI', '',
      'completed', 'reviewer', 'done', timestamp, undefined, stepId,
    )]
  }

  private handleToolCallStart(
    event: Extract<AguiEvent, { type: 'TOOL_CALL_START' }>,
    timestamp: string,
  ): VibeAgentStep {
    const stepId = crypto.randomUUID()
    this.stepIdMap.set(event.toolCallId, stepId)
    this.toolNameMap.set(event.toolCallId, event.toolCallName)

    const m = getToolMapping(event.toolCallName)
    return this.makeStep(
      m.stepType, m.title, '', 'running',
      m.agentGroup, m.pipelinePhase, timestamp, undefined, stepId,
    )
  }

  private handleToolCallArgs(
    event: Extract<AguiEvent, { type: 'TOOL_CALL_ARGS' }>,
    timestamp: string,
  ): VibeAgentStep[] {
    const stepId = this.stepIdMap.get(event.toolCallId)
    if (!stepId) return []

    const toolName = this.toolNameMap.get(event.toolCallId) || ''
    const m = getToolMapping(toolName)

    try {
      const parsed = JSON.parse(event.delta)
      return [this.makeStep(
        m.stepType, m.title,
        JSON.stringify(parsed, null, 2).substring(0, 500),
        'running', m.agentGroup, m.pipelinePhase,
        timestamp, parsed?.path || parsed?.file_path, stepId,
      )]
    } catch {
      return [] // Partial JSON — skip
    }
  }

  private handleToolCallResult(
    event: Extract<AguiEvent, { type: 'TOOL_CALL_RESULT' }>,
    timestamp: string,
  ): VibeAgentStep[] {
    const stepId = this.stepIdMap.get(event.toolCallId)
    if (!stepId) return []

    const toolName = this.toolNameMap.get(event.toolCallId) || ''
    const m = getToolMapping(toolName)

    return [this.makeStep(
      'change_file', 'Selesai',
      event.content.substring(0, 500),
      'completed', m.agentGroup, 'done',
      timestamp, undefined, stepId,
    )]
  }

  private handleStepStarted(
    event: Extract<AguiEvent, { type: 'STEP_STARTED' }>,
    timestamp: string,
  ): VibeAgentStep {
    const phase = event.stepName?.includes('research') ? 'researching' : 'thinking'
    return this.makeStep(
      'thinking', `Agent: ${event.stepName}`, '',
      'running', event.stepName || 'default', phase, timestamp,
    )
  }

  // --- Helper ---

  /** Buat VibeAgentStep dengan parameter lengkap. */
  private makeStep(
    type: VibeAgentStep['type'],
    title: string,
    content: string,
    status: VibeAgentStep['status'],
    agentGroup: string,
    pipelinePhase: PipelinePhase,
    timestamp: string,
    durationMs?: number,
    id?: string,
    affectedFile?: string,
  ): VibeAgentStep {
    return {
      id: id ?? crypto.randomUUID(),
      type,
      title,
      content,
      timestamp,
      status,
      agentGroup,
      pipelinePhase,
      ...(affectedFile !== undefined && { affectedFile }),
      ...(durationMs !== undefined && { durationMs }),
    }
  }
}
