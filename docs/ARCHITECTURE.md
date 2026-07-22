# KoncoVibe — Architecture Documentation

> **Terakhir diperbarui:** 2026-07-22

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Tauri 2.0 Window (WebView2)               │
│                                                              │
│  ┌──────────┐  ┌──────────────────────┐  ┌───────────────┐ │
│  │ ChatPanel│  │  LivePreview (iframe)│  │  CodeViewer   │ │
│  │ (kiri)   │  │  (kanan atas)        │  │  (kanan bawah)│ │
│  │          │  │                      │  │               │ │
│  │ User →   │  │  Blob URL injection  │  │ Virtual files │ │
│  │ AI ←     │  │  ← generatedHtml     │  │ ← generatedHtml│ │
│  └────┬─────┘  └──────────▲───────────┘  └───────▲───────┘ │
│       │                   │                      │         │
│       │  sendVibeCodingPrompt()                  │         │
│       │                   │                      │         │
│  ┌────▼───────────────────┴──────────────────────┴───────┐ │
│  │           codebuff-integration.ts                      │ │
│  │                                                         │ │
│  │  getBackendMode()                                       │ │
│  │    ├─ window.__TAURI_INTERNALS__?  → 'codebuff'         │ │
│  │    └─ else                          → 'sumopod-fallback'│ │
│  │                                                         │ │
│  │  ┌─────────────────┐    ┌──────────────────────────┐   │ │
│  │  │  Codebuff SDK   │    │  SumoPod Fallback        │   │ │
│  │  │  (desktop mode) │───▶│  (sidecar-api.ts)        │   │ │
│  │  │                 │    │                          │   │ │
│  │  │ CodebuffClient  │    │  fetch(baseUrl + key)    │   │ │
│  │  │ .run(vibe-coder)│    │  → system prompt         │   │ │
│  │  │                 │    │  → extractCleanHtml()    │   │ │
│  │  │ handleEvent →   │    │  → onStep() callbacks    │   │ │
│  │  │   mapToStep()   │    │  → onGeneratedHtml()     │   │ │
│  │  └────────┬────────┘    └──────────┬───────────────┘   │ │
│  │           │ error fallback ────────┘                    │ │
│  └───────────┼─────────────────────────────────────────────┘ │
│              │                                               │
│  ┌───────────▼───────────────────────────────────────────┐   │
│  │         Rust Backend (src-tauri/)                      │   │
│  │  Commands: get_app_info, check_codebuff_sidecar,      │   │
│  │             save_html_to_disk                          │   │
│  │  Future: Codebuff sidecar (JSON-RPC over stdio)       │   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

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

### 2.2 Desktop Mode (Codebuff SDK — Future)

```
User types prompt in ChatPanel
         │
         ▼
codebuff-integration.ts: sendVibeCodingPrompt()
         │
         │  getBackendMode() → 'codebuff'
         │  emit user_message step
         ▼
sendViaCodebuffSDK()
         │
         ├──▶ import('@codebuff/sdk')
         ├──▶ new CodebuffClient({ apiKey, agentDefinitions })
         │
         ├──▶ client.run({
         │      agent: vibeCoderAgent,
         │      prompt: userPrompt,
         │      handleEvent: (event) => mapCodebuffEventToStep(event)
         │    })
         │
         │    vibe-coder handleSteps:
         │    ├─ yield think_deeply    → step(thinker, thinking)
         │    ├─ yield spawn_agents    → step(researcher-web, researching)
         │    │    └─ researcher-web: web_search + read_url
         │    ├─ yield 'STEP_ALL'      → LLM generates code
         │    │    └─ write_file       → step(editor, generating)
         │    └─ yield spawn_agents    → step(reviewer, reviewing)
         │         └─ code-reviewer: validate
         │
         ├──▶ result.output.last_message
         ├──▶ extractCleanHtml(output)
         │
         └──▶ onGeneratedHtml(cleanedHtml)
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

### 5.1 Agent Definition → SDK

```
vibe-coder.ts                    Codebuff SDK
─────────────                    ────────────
AgentDefinition ───────────────▶ CodebuffClient.run({
  id: 'vibe-coder'                 agent: vibeCoderAgent,
  model: 'claude-sonnet-4.5'       prompt: userPrompt,
  toolNames: [...]                 handleEvent: (event) => ...
  handleSteps: function*           })
  spawnableAgents: [...]
                                  Agent runtime:
                                  ├─ Parse handleSteps generator
                                  ├─ Execute yield'd tool calls
                                  ├─ Spawn sub-agents
                                  ├─ Stream LLM responses
                                  └─ Emit events via handleEvent
```

### 5.2 Event Mapping

```
Codebuff SDK Event          →    VibeAgentStep
──────────────────────             ─────────────
{ type: 'assistant_message' }  →   { type: 'assistant_message',
                                    agentGroup: 'reviewer',
                                    pipelinePhase: 'done' }

{ type: 'tool_call',             →   { type: mapToolNameToStepType(),
  toolName: 'write_file',             agentGroup: 'editor',
  input: { path, content } }          pipelinePhase: 'generating',
                                      affectedFile: path }

{ type: 'tool_result',          →   { type: 'change_file',
  toolName: 'write_file',             status: 'completed' }
  output: '...' }

{ type: 'subagent_start',       →   { type: 'thinking',
  agentType: 'researcher-web',        agentGroup: 'researcher-web',
  prompt: '...' }                     pipelinePhase: 'researching' }

{ type: 'error',                →   { type: 'error',
  message: '...' }                    status: 'failed' }
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

### 6.2 Future (Tauri Desktop)

```
Tauri Filesystem
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
└── Codebuff sidecar (externalBin)
    ├── codebuff-sidecar-x86_64-pc-windows-msvc.exe
    └── communicates via JSON-RPC over stdio
```
