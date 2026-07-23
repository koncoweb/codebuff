# KoncoVibe — Architecture Documentation

> **Terakhir diperbarui:** 2026-07-23

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Tauri 2.0 Window (WebView2)                     │
│                                                                    │
│  ┌──────────────┐  ┌──────────────────────┐  ┌───────────────┐   │
│  │  ChatPanel   │  │  LivePreview (iframe)│  │  CodeViewer   │   │
│  │  +Reasoning  │  │  +Edit Mode          │  │               │   │
│  │  +Interrupt  │  │  +Click-to-Inspect   │  │  +Debug Log   │   │
│  │  (kiri)      │  │  (kanan atas)        │  │  (kanan bawah)│   │
│  │              │  │                      │  │               │   │
│  │  User →      │  │  Blob URL injection  │  │ Virtual files │   │
│  │  AI ←        │  │  ← generatedHtml     │  │ ← generatedHtml│  │
│  └──────┬───────┘  └──────────▲───────────┘  └───────▲───────┘   │
│         │                     │                      │           │
│         │  sendVibeCodingPrompt()                    │           │
│         │                     │                      │           │
│  ┌──────▼─────────────────────┴──────────────────────┴─────────┐ │
│  │           codebuff-integration.ts                            │ │
│  │                                                              │ │
│  │  getBackendMode()                                            │ │
│  │    ├─ sidecar transport ping OK?  → 'codebuff'               │ │
│  │    └─ else                         → 'sumopod-fallback'      │ │
│  │                                                              │ │
│  │  ┌──────────────────────┐    ┌──────────────────────────┐   │ │
│  │  │  Sidecar Transport   │    │  SumoPod Fallback        │   │ │
│  │  │  (JSON-RPC stdio)    │    │  (sidecar-api.ts)        │   │ │
│  │  │                      │    │                          │   │ │
│  │  │  AG-UI Event Stream  │    │  fetch(baseUrl + key)    │   │ │
│  │  │  ↓                   │    │  → system prompt         │   │ │
│  │  │  AguiStepMapper      │    │  → extractCleanHtml()    │   │ │
│  │  │    .convert()        │    │  → onStep() callbacks    │   │ │
│  │  │  → onStep()          │    │  → onGeneratedHtml()     │   │ │
│  │  └──────────┬───────────┘    └──────────┬───────────────┘   │ │
│  │             │ error fallback ───────────┘                    │ │
│  └─────────────┼────────────────────────────────────────────────┘ │
│                │                                                  │
│  ┌─────────────▼──────────────────────────────────────────────┐   │
│  │  ┌─────────────────────────────────────┐ (separate proc)   │   │
│  │  │   Codebuff SDK Sidecar              │                   │   │
│  │  │   (Node.js/Bun via shell plugin)    │                   │   │
│  │  │                                     │                   │   │
│  │  │   • CodebuffClient + Agents         │                   │   │
│  │  │   • MCP Client (5 servers)          │                   │   │
│  │  │   • AG-UI Event Mapper              │                   │   │
│  │  │   • Interrupt Bridge (AskUserBridge)│                   │   │
│  │  └─────────────────────────────────────┘                   │   │
│  │         Rust Backend (src-tauri/)                          │   │
│  │  Commands: get_app_info, check_codebuff_sidecar,           │   │
│  │             save_html_to_disk                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 1.1 AG-UI Event Layer (gap-filler untuk Codebuff)

KoncoVibe mengadopsi pola event AG-UI (docs.ag-ui.com) sebagai layer tambahan untuk mengisi gap Codebuff. Codebuff strengths tetap dipertahankan.

**Yang diambil dari AG-UI:**
| Event | Fills Codebuff Gap |
|---|---|
| `TEXT_MESSAGE_START/CONTENT/END` | True delta streaming (Codebuff's `text` = full-string) |
| `TOOL_CALL_START/ARGS/END` | Streaming tool args (Codebuff sends complete input) |
| `STATE_SNAPSHOT/DELTA` | Incremental sync (Codebuff only has snapshot blobs) |
| `RUN_FINISHED { outcome: interrupt }` | Generic approval with responseSchema + approve-with-edits |
| `REASONING_START/CONTENT/END` | Lifecycle wrapper untuk reasoning_delta |

**Yang TIDAK diambil** (sudah kuat di Codebuff):
- MCP client (Codebuff punya stdio/HTTP/SSE + env-var substitution)
- Subagent orchestration (Codebuff punya parallel spawn + cost aggregation)
- Context-pruner agent (Codebuff punya dedicated agent)
- 33 native tools

---

## 2. Request Flow: User Prompt → Generated HTML

### 2.1 Browser Mode (SumoPod Fallback)

```
User types prompt in ChatPanel
         │
         ▼
App.tsx: handleSendPrompt()
         │  setIsRunning(true)
         │  addStep(user_message)
         ▼
codebuff-integration.ts: sendVibeCodingPrompt()
         │
         │  getBackendMode() → 'sumopod-fallback'
         │  emit user_message step (kanan bubble)
         ▼
sidecar-api.ts: sendVibePrompt()
         │
         │  Step 1: onStep(thinking, running)     → pipeline: thinking
         │  Step 2: onStep(read_files, completed) → pipeline: thinking
         │  Step 3: onStep(change_file, running)  → pipeline: generating
         │
         ├──▶ fetch(baseUrl + '/chat/completions', {
         │      method: 'POST',
         │      headers: { Authorization: 'Bearer ' + apiKey },
         │      body: { model, messages: [system + user], temperature: 0.5 }
         │    })
         │
         │    [Menunggu respons LLM...]
         │
         ├──▶ response.json() → choices[0].message.content
         │
         ├──▶ extractCleanHtml(content)
         │      ├─ Strip ```html fences
         │      ├─ Extract from <!DOCTYPE html> or <html>
         │      ├─ Auto-heal truncated tags
         │      └─ Fallback wrapper if no <html>
         │
         │  Step 3: onStep(change_file, completed) → affectedFile: 'index.html'
         │  Step 4: onStep(run_terminal, completed) → pipeline: reviewing
         │  Step 5: onStep(assistant_msg, completed) → pipeline: done
         │
         └──▶ onGeneratedHtml(cleanedHtml)
                  │
                  ▼
              App.tsx: setGeneratedHtml(html)
                  │
                  ├─▶ LivePreview: iframe src = Blob URL
                  └─▶ CodeViewer: parseHtmlToVirtualFiles(html)
```

### 2.2 Desktop Mode (Codebuff SDK Sidecar — Implemented)

```
User types prompt in ChatPanel
         │
         ▼
codebuff-integration.ts: sendVibeCodingPrompt()
         │
         │  getBackendMode() → 'codebuff' (sidecar ping OK)
         │  emit user_message step
         ▼
sendViaSidecar()
         │
         │  sidecarTransport.runPrompt({ prompt, threadId, previousRunState })
         │  subscribe to AG-UI event stream
         │
         ├──▶ [Sidecar Process — src-sidecar/index.ts]
         │    │
         │    ├──▶ getClient(apiKey)
         │    │    new CodebuffClient({
         │    │      agentDefinitions: [vibeCoder, vibeReviewer],
         │    │      handleEvent: (event) => mapCodebuffEventToAgui(),
         │    │      handleStreamChunk: (chunk) => → TEXT_MESSAGE_DELTA / REASONING_DELTA
         │    │    })
         │    │
         │    ├──▶ client.run({
         │    │      agent: vibeCoderAgent,
         │    │      prompt: userPrompt,
         │    │      previousRunState,    // multi-turn continuity
         │    │    })
         │    │
         │    │    vibe-coder handleSteps (sync generator):
         │    │    ├─ yield think_deeply        → REASONING_START/CONTENT/END
         │    │    ├─ yield spawn_agents        → STEP_STARTED
         │    │    │    └─ researcher-web       → TOOL_CALL_START/ARGS/END
         │    │    │       (web_search, read_url via MCP)
         │    │    ├─ yield 'STEP_ALL'          → LLM generates code
         │    │    │    └─ write_file/str_replace → TOOL_CALL_START/ARGS/END
         │    │    │       → STATE_DELTA (incremental)
         │    │    └─ yield spawn_agents        → STEP_STARTED
         │    │         └─ code-reviewer        → validate
         │    │
         │    │    [Interrupt if AskUserBridge triggers]
         │    │    → RUN_FINISHED { outcome: { type: 'interrupt' } }
         │    │    → waitForInterrupt() → resume with user input
         │    │
         │    └──▶ sendResponse({ status, output, runState, totalCost })
         │
         │  [Frontend — AG-UI Event Stream]
         │  AguiStepMapper.convert() bridges events → VibeAgentStep:
         │    TEXT_MESSAGE_CONTENT  → assistant_message (streaming delta)
         │    TOOL_CALL_START       → change_file/read_files (running)
         │    TOOL_CALL_ARGS        → update step content (parsed JSON)
         │    TOOL_CALL_RESULT      → mark step completed
         │    REASONING_CONTENT     → ReasoningPanel (token streaming)
         │    RUN_FINISHED          → final assistant_message (completed)
         │
         ├──▶ result.output || latestAssistantContent
         ├──▶ extractCleanHtml(output)
         │
         └──▶ onGeneratedHtml(cleanedHtml)
                  │
                  ▼
              App.tsx: setGeneratedHtml(html)
                  │
                  ├─▶ LivePreview: iframe src = Blob URL
                  └─▶ CodeViewer: parseHtmlToVirtualFiles(html)
```

---

## 3. Component Data Flow

```
App.tsx (Root State)
│
├── user: NeonUser                    ← neon-auth.ts (localStorage)
├── projects: UserProject[]           ← sidecar-api.ts (localStorage)
├── activeProjectId: string
├── generatedHtml: string             ← setGeneratedHtml callback
├── steps: VibeAgentStep[]            ← onStep callback
├── isRunning: boolean
├── activeTab: 'preview' | 'code'
├── providerConfig: { provider, apiKey, baseUrl, selectedModel }
│
├── <Header>
│     props: user, projects, activeProjectId, selectedModel, onSettings, onAuth
│
├── <ChatPanel>
│     props: steps, isRunning, onSendPrompt, onStop, onSwitchToCode
│     internal: input, autoScroll, groupedSteps (useMemo)
│     └── emits: onSendPrompt(prompt) → triggers sendVibeCodingPrompt()
│
├── <LivePreview>
│     props: generatedHtml, activeTab
│     internal: blobUrl (useMemo from generatedHtml)
│     └── renders: <iframe src={blobUrl}>
│
└── <CodeViewer>
      props: generatedHtml, projectName
      internal: virtualFiles (useMemo via parseHtmlToVirtualFiles)
      └── renders: file tree + code content + debug log
```

---

## 4. VibeAgentStep Lifecycle

```
┌──────────────────────────────────────────────────────┐
│              VibeAgentStep Lifecycle                  │
│                                                      │
│  sendVibeCodingPrompt()                              │
│    │                                                 │
│    │ 1. Emit user_message (status: completed)        │
│    │    → ChatPanel: UserBubble (kanan, cyan)        │
│    │                                                 │
│    │ 2. Pipeline starts...                           │
│    │    │                                            │
│    │    │ Step: thinking (running)                   │
│    │    │   agentGroup: 'thinker'                    │
│    │    │   pipelinePhase: 'thinking'                │
│    │    │   → PipelineBar: fase "Analisis" aktif     │
│    │    │   → AgentCard: "Analisis" group, expanded  │
│    │    │                                            │
│    │    │ Step: thinking (completed)                 │
│    │    │   → AgentCard: spinner → checkmark         │
│    │    │                                            │
│    │    │ Step: change_file (running)                │
│    │    │   agentGroup: 'editor'                     │
│    │    │   pipelinePhase: 'generating'              │
│    │    │   → PipelineBar: fase "Kode" aktif         │
│    │    │   → New AgentCard: "Kode" group            │
│    │    │   → affectedFile: 'index.html'             │
│    │    │                                            │
│    │    │ [LLM generates HTML...]                    │
│    │    │   → TypingDots shown if no running step    │
│    │    │   → PHASE_STATUS: "Menulis kode..."        │
│    │    │                                            │
│    │    │ Step: change_file (completed)              │
│    │    │   durationMs: actual generation time       │
│    │    │   → onGeneratedHtml(html) called           │
│    │    │   → LivePreview updates via Blob URL       │
│    │    │   → CodeViewer updates virtual files       │
│    │    │                                            │
│    │    │ Step: assistant_message (completed)        │
│    │    │   agentGroup: 'reviewer'                   │
│    │    │   pipelinePhase: 'done'                    │
│    │    │   → AIBubble (kiri, sparkle avatar)        │
│    │    │                                            │
│    │    3. Post-generation                           │
│    │       → StatusCard: "Generasi Selesai"          │
│    │       → FollowUps: chips appear                 │
│    │       → AgentCards auto-collapse after 2.5s     │
│    │                                                 │
│    └── setIsRunning(false)                           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 5. Codebuff SDK Integration Points

### 5.1 Agent Definition → SDK (via Sidecar)

```
vibe-coder.ts                    Codebuff SDK (in sidecar process)
─────────────                    ──────────────────────────────────
AgentDefinition ───────────────▶ CodebuffClient.run({
  id: 'vibe-coder'                 agent: vibeCoderAgent,
  model: 'anthropic/claude-sonnet-4.5'    prompt: userPrompt,
  toolNames: [...]                 previousRunState,  // multi-turn
  handleSteps: function* (sync)    })
  spawnableAgents: ['context-pruner', ...]
  mcpServers: [filesystem, github, ...]
  reasoningOptions: { effort: 'medium' }
                                  Agent runtime (sync generator):
                                  ├─ Parse handleSteps (must be function*, NOT async)
                                  ├─ Execute yield'd tool calls
                                  ├─ Spawn sub-agents (parallel)
                                  ├─ Stream LLM responses → handleStreamChunk
                                  └─ Emit events → handleEvent
```

### 5.2 AG-UI Event Mapping (Codebuff → AG-UI → VibeAgentStep)

The sidecar maps Codebuff's `PrintModeEvent` to AG-UI events, then the frontend
bridges AG-UI events to `VibeAgentStep` for backward compatibility with existing UI.

```
Codebuff SDK Event           →    AG-UI Event              →    VibeAgentStep
─────────────────────              ────────────                  ─────────────
{ type: 'text',               →    TEXT_MESSAGE_START      →    (new step)
  text: 'full string' }            TEXT_MESSAGE_CONTENT         assistant_message
                                   TEXT_MESSAGE_END             (streaming delta)

{ type: 'tool_call',          →    TOOL_CALL_START          →    change_file / read_files
  toolName: 'write_file',          (toolNameMap stores name)     (running, agentGroup from
  input: { path, content } }                                     TOOL_MAPPINGS table)
                                   TOOL_CALL_ARGS               (update content with
                                   (delta = JSON.stringify)      parsed JSON, affectedFile)
                                   TOOL_CALL_END
                                   TOOL_CALL_RESULT             (status: completed)

{ type: 'reasoning_delta',    →    REASONING_START          →    ReasoningPanel
  text: 'chunk' }                  REASONING_CONTENT             (token streaming,
                                   REASONING_END                 auto-collapse after 1s)

{ type: 'subagent_start',     →    STEP_STARTED             →    thinking
  agentType: 'researcher-web'      stepName: agentType           agentGroup: 'researcher-web'
                                                                 pipelinePhase: 'researching'

{ type: 'state_snapshot',     →    STATE_SNAPSHOT           →    (consumed by agui-event-store)
  state: {...} }                   state: {...}

{ type: 'error',              →    RUN_ERROR                →    error
  message: '...' }                 message: '...'               status: 'failed'

(run completes)              →    RUN_FINISHED             →    assistant_message
                                   outcome: { type: 'success' }  (status: completed, pipelinePhase: 'done')

(interrupt triggered)        →    RUN_FINISHED             →    InterruptDialog
                                   outcome: { type: 'interrupt',  (render approval card with
                                     interrupts: [...] }          responseSchema → form)
```

### 5.3 Tool Name → Agent Group Mapping

```
Tool Name              agentGroup          pipelinePhase     stepType
──────────             ──────────          ────────────      ────────
think_deeply           thinker             thinking          thinking
web_search             researcher-web      researching       thinking
read_url               researcher-web      researching       thinking
read_docs              researcher-web      researching       thinking
write_file             editor              generating        change_file
str_replace            editor              generating        change_file
apply_patch            editor              generating        change_file
read_files             (default)           reviewing         read_files
read_subtree           (default)           reviewing         read_files
find_files             (default)           reviewing         read_files
run_terminal_command   (default)           generating        run_terminal_command
spawn_agents           thinker             thinking          thinking
code_search            (default)           reviewing         thinking
mcpName__toolName      mcp                 generating        assistant_message
(other)                default             generating        assistant_message
```

---

## 6. File System & Persistence

### 6.1 Current (Browser Mode)

```
Browser localStorage
├── koncovibe_user_session      → NeonUser JSON
└── koncovibe_projects_<userId> → UserProject[] JSON
                                   └── each project:
                                       ├── id, name, createdAt
                                       ├── generatedHtml (string)
                                       └── steps (VibeAgentStep[])
```

### 6.2 Desktop Mode (Tauri — Foundation Ready)

```
Tauri Filesystem (planned via tauri-plugin-fs)
├── AppData/koncovibe/
│   ├── config.json             → user settings, provider config
│   ├── projects/
│   │   ├── {projectId}/
│   │   │   ├── index.html      → generated HTML
│   │   │   ├── project.json    → metadata
│   │   │   └── history.json    → conversation steps
│   │   └── ...
│   └── sessions/
│       └── session.json        → Neon auth session
│
└── Codebuff sidecar (externalBin — IMPLEMENTED)
    ├── binaries/codebuff-bridge-x86_64-pc-windows-msvc.exe
    │   (compiled via: bun run build:sidecar — Bun --compile)
    ├── communicates via JSON-RPC over stdio
    └── lib.rs fallback: binary → bun → node
```

> **Note:** Saat ini persistence masih via `localStorage` (browser mode).
> Migrasi ke Tauri FS adalah next step (lihat HANDOFF.md section 4, prioritas SEDANG #6).
