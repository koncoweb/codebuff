# Plan: AG-UI-Inspired Improvements for KoncoVibe — Strengthening Codebuff Core

## Summary

Activate the dormant Codebuff SDK path via a Tauri sidecar (Node.js/Bun process), then layer AG-UI-inspired patterns on top to fill Codebuff's gaps: incremental state sync, generic tool-approval interrupts, generative UI components, and true token streaming — all without duplicating Codebuff's existing strengths (reasoning streaming, MCP client, subagent orchestration, 33 native tools, context-pruner agent). Wire 4 popular MCP servers (Filesystem, GitHub, Playwright, Supabase/Neon) into the desktop app. Prioritize token efficiency throughout.

---

## Current State Analysis

### What Codebuff Already Does Well (NOT duplicating)
| Capability | Status | Location |
|---|---|---|
| Event taxonomy (start/text/tool_call/tool_result/reasoning_delta/finish/subagent_start/finish/error) | Strong | [print-mode.ts](file:///c:/projects/koncoweb/common/src/types/print-mode.ts) |
| MCP client (stdio + HTTP + SSE transports, env-var substitution, client pooling) | Strong | [client.ts](file:///c:/projects/koncoweb/common/src/mcp/client.ts) |
| Token-level reasoning streaming | Strong | [print-mode.ts:89-100](file:///c:/projects/koncoweb/common/src/types/print-mode.ts#L89-L100) |
| Subagent orchestration (parallel spawn, cost aggregation, ancestor tracking) | Strong | [spawn-agents.ts](file:///c:/projects/koncoweb/packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts) |
| Token efficiency (trimMessagesToFitTokenLimit, file-tree truncation, context-pruner agent, prompt caching) | Strong (framework) | [messages.ts:182](file:///c:/projects/koncoweb/packages/agent-runtime/src/util/messages.ts#L182), [context-pruner.ts](file:///c:/projects/koncoweb/agents/context-pruner.ts) |
| 33 native tools | Strong | [list.ts:45-84](file:///c:/projects/koncoweb/common/src/tools/list.ts#L45-L84) |
| ask_user (multiple-choice interrupts) | Partial | [ask-user.ts](file:///c:/projects/koncoweb/common/src/tools/params/tool/ask-user.ts) |

### Gaps Where AG-UI Adds Value
| Gap | Codebuff Status | AG-UI Pattern to Adopt |
|---|---|---|
| **Wire protocol** | In-process callbacks only, no network/stdio transport | Standardized JSON-RPC over stdio (sidecar) |
| **Streaming text display** | `text` event is full-string, not delta-chunked | `TextMessageStart` → `TextMessageContent` (delta) → `TextMessageEnd` |
| **Streaming tool args** | `tool_call` sends complete `input` object | `ToolCallStart` → `ToolCallArgs` (delta) → `ToolCallEnd` |
| **State synchronization** | Snapshot-blob at run boundaries only | `StateSnapshot` (initial) + `StateDelta` (incremental JSON-patch) |
| **Generic tool approval** | ask_user is multiple-choice only; approval is implicit | `RunFinished { outcome: { type: "interrupt" } }` with `responseSchema` + approve-with-edits |
| **Generative UI** | Single hardcoded `button` widget | Dynamic component registry with typed props + two-way data flow |
| **MCP in desktop** | Framework has it; desktop app doesn't use it | Wire MCP client via sidecar, pre-configure 4 servers |
| **Token efficiency in desktop** | Only a 6-message cap | Bring framework's trimming/pruning/caching to desktop sessions |

### KoncoVibe Desktop Current State
- **Always runs SumoPod fallback** — `check_codebuff_sidecar()` returns `false` ([lib.rs:23-27](file:///c:/projects/koncoweb/apps/desktop/src-tauri/src/lib.rs#L23-L27))
- **Production build broken** — `@codebuff/sdk` imports `node:module` incompatible with browser bundle ([codebuff-integration.ts:109](file:///c:/projects/koncoweb/apps/desktop/src/services/codebuff-integration.ts#L109))
- **No streaming** — 500ms throttled synthetic steps instead of token deltas ([sidecar-api.ts:516-528](file:///c:/projects/koncoweb/apps/desktop/src/services/sidecar-api.ts#L516-L528))
- **No MCP** — vibe-coder agent has no `mcpServers` field ([vibe-coder.ts:24-35](file:///c:/projects/koncoweb/apps/desktop/src/agents/vibe-coder.ts#L24-L35))
- **localStorage persistence** — no filesystem access for real projects

---

## Proposed Changes

### Workstream 1: Codebuff SDK Sidecar Bridge (Foundation)

**Goal:** Run Codebuff SDK as a separate Node.js/Bun process, communicating via JSON-RPC over stdio, so the browser bundle never imports `node:module`.

#### 1.1 Create sidecar entry point
**New file:** `apps/desktop/src-sidecar/index.ts`

A standalone Node.js/Bun script that:
- Imports `@codebuff/sdk` and `@codebuff/common` (Node.js environment — no browser bundling issues)
- Instantiates `CodebuffClient` with `vibeCoderAgent` + `vibeReviewerAgent` agent definitions
- Reads JSON-RPC requests from stdin: `{ method: "run" | "resume" | "cancel", params: {...}, id: string }`
- Writes JSON-RPC responses/notifications to stdout: `{ method: "event", params: <AguiEvent>, id: string }`
- Maps Codebuff's `PrintModeEvent` → AG-UI-inspired events (see Workstream 2) before emitting
- Handles MCP tool execution in-process (Codebuff already does this — see Workstream 4)
- Uses `handleEvent` and `handleStreamChunk` callbacks from `client.run()` to stream events
- Calls `trimMessagesToFitTokenLimit` between turns for token efficiency (see Workstream 3)

**Protocol design (JSON-RPC 2.0 over stdio):**
```
// Frontend → Sidecar (request)
{ "jsonrpc": "2.0", "method": "run", "params": { "prompt": "...", "threadId": "...", "resume": [...] }, "id": "1" }

// Sidecar → Frontend (streaming notification)
{ "jsonrpc": "2.0", "method": "event", "params": { "type": "TEXT_MESSAGE_CONTENT", "messageId": "...", "delta": "..." } }

// Sidecar → Frontend (response when run completes/interrupts)
{ "jsonrpc": "2.0", "result": { "status": "success" | "interrupt", "interrupts": [...] }, "id": "1" }

// Frontend → Sidecar (cancel)
{ "jsonrpc": "2.0", "method": "cancel", "params": { "runId": "..." } }
```

#### 1.2 Fix production build
**Edit:** `apps/desktop/vite.config.ts`

Add `build.rollupOptions.external` to exclude `@codebuff/sdk` and `@codebuff/common` from the browser bundle (they're only used in the sidecar now):
```ts
build: {
  target: 'chrome105',
  minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
  sourcemap: !!process.env.TAURI_ENV_DEBUG,
  rollupOptions: {
    external: ['@codebuff/sdk', '@codebuff/common'],
  },
},
```

Also remove the dynamic `import('@codebuff/sdk')` from the browser-side code (see 1.3).

#### 1.3 Replace browser-side SDK import with sidecar transport
**Edit:** `apps/desktop/src/services/codebuff-integration.ts`

Replace `sendViaCodebuffSDK()` (lines 106-164) — which does `await import('@codebuff/sdk')` in the browser — with a call to a new sidecar transport service that communicates via Tauri's shell plugin.

**New file:** `apps/desktop/src/services/codebuff-sidecar-transport.ts`

- Uses `@tauri-apps/plugin-shell` `Command::sidecar()` to spawn the sidecar process
- Wraps stdin/stdout as a JSON-RPC client
- Exposes `runPrompt(prompt, threadId, resume?)` → returns an async generator of AG-UI-inspired events
- Exposes `cancelRun(runId)` for the stop button
- Handles reconnection if the sidecar crashes

#### 1.4 Wire Tauri sidecar spawning
**Edit:** `apps/desktop/src-tauri/src/lib.rs`

- Implement `check_codebuff_sidecar()` to actually detect if the sidecar binary/process is available (try spawning it with a `ping` method, check exit code)
- Add a new Tauri command `spawn_codebuff_sidecar()` that uses `tauri-plugin-shell` to start the process and returns a handle
- Add Tauri event forwarding: sidecar stdout lines → `app.emit("codebuff-event", line)` → frontend listens via `@tauri-apps/api/event`

**Edit:** `apps/desktop/src-tauri/tauri.conf.json`

Add the sidecar binary to `bundle.externalBin`:
```json
"externalBin": ["binaries/codebuff-bridge"]
```

**Edit:** `apps/desktop/src-tauri/Cargo.toml`

Add `tauri-plugin-shell` features for sidecar support (already present as dependency, may need feature flags).

#### 1.5 Sidecar build script
**New file:** `apps/desktop/scripts/build-sidecar.ts`

A Bun script that compiles `src-sidecar/index.ts` into a standalone executable using `bun build --compile` (cross-platform targets: `bun-windows-x64`, `bun-darwin-arm64`, `bun-linux-x64`). Output to `apps/desktop/binaries/codebuff-bridge{.exe}`.

**Edit:** `apps/desktop/package.json`

Add scripts:
```json
"build:sidecar": "bun run scripts/build-sidecar.ts",
"build:all": "bun run build:sidecar && bun run build"
```

---

### Workstream 2: AG-UI-Inspired Event Layer

**Goal:** Map Codebuff's `PrintModeEvent` to AG-UI-inspired events that fill the streaming/state/interrupt gaps, without replacing Codebuff's existing event types.

#### 2.1 Define AG-UI-inspired event types
**New file:** `apps/desktop/src-sidecar/agui-event-mapper.ts`

Maps Codebuff `PrintModeEvent` → AG-UI-inspired events in the sidecar before sending to frontend:

| Codebuff Event | AG-UI-Inspired Mapping | Gap Filled |
|---|---|---|
| `start` | `RUN_STARTED` { threadId, runId } | Lifecycle clarity |
| `text` (full string) | `TEXT_MESSAGE_START` → `TEXT_MESSAGE_CONTENT` (delta) → `TEXT_MESSAGE_END` | **True streaming** (split full text into deltas) |
| `reasoning_delta` | `REASONING_MESSAGE_START` → `REASONING_MESSAGE_CONTENT` → `REASONING_MESSAGE_END` | Already delta-based, wrap in lifecycle |
| `tool_call` (complete input) | `TOOL_CALL_START` → `TOOL_CALL_ARGS` (stream JSON args) → `TOOL_CALL_END` | **Args streaming** |
| `tool_result` | `TOOL_CALL_RESULT` { content } | Already complete, wrap properly |
| `subagent_start` | `STEP_STARTED` { stepName: agentType } | Step lifecycle |
| `subagent_finish` | `STEP_FINISHED` { stepName: agentType } | Step lifecycle |
| `finish` | `RUN_FINISHED` { outcome: { type: "success" } } | Interrupt-aware lifecycle |
| `error` | `RUN_ERROR` { message } | Already matches |
| *(new)* | `STATE_SNAPSHOT` / `STATE_DELTA` | **Incremental state sync** (see 2.2) |
| *(new)* | `RUN_FINISHED` { outcome: { type: "interrupt" } } | **Generic interrupts** (see 2.3) |

#### 2.2 Incremental state sync
**In:** `apps/desktop/src-sidecar/agui-event-mapper.ts`

Codebuff's `onStateSnapshot` callback ([run.ts:186](file:///c:/projects/koncoweb/sdk/src/run.ts#L186)) fires every 5s with a full `RunState` blob. Instead of sending the full blob each time:
- First snapshot → emit `STATE_SNAPSHOT` with full state
- Subsequent snapshots → compute JSON-patch diff → emit `STATE_DELTA` with the patch
- This reduces payload size significantly (token efficiency for transport)

Use `fast-json-patch` (or a minimal diff implementation) to compute deltas.

#### 2.3 Interrupt-aware lifecycle (tool approval with edits)
**In:** `apps/desktop/src-sidecar/index.ts`

Intercept Codebuff's `ask_user` tool calls and `run_terminal_command` (mode: 'user') in the sidecar:
- Instead of executing them directly, emit `RUN_FINISHED { outcome: { type: "interrupt", interrupts: [...] } }`
- Each interrupt includes: `id`, `reason: "tool_call"`, `toolCallId`, `message`, `responseSchema`
- For `ask_user`: `responseSchema` = the multiple-choice schema from the tool
- For `run_terminal_command`: `responseSchema` = `{ approved: boolean, editedArgs?: { command: string } }` (approve-with-edits pattern)
- The sidecar process suspends (holds the `client.run()` promise), waits for a `resume` JSON-RPC request, then continues

This replaces Codebuff's implicit approval with AG-UI's explicit, auditable interrupt lifecycle.

#### 2.4 Frontend event consumer
**New file:** `apps/desktop/src/services/agui-event-store.ts`

A lightweight event store (no external library) that:
- Receives AG-UI-inspired events from the sidecar transport
- Accumulates text deltas into messages (by `messageId`)
- Accumulates tool args deltas (by `toolCallId`)
- Maintains a state object (apply `STATE_SNAPSHOT` then `STATE_DELTA` patches)
- Tracks pending interrupts (from `RUN_FINISHED` with interrupt outcome)
- Exposes a React hook `useAguiEvents()` for the UI to consume

---

### Workstream 3: Token Efficiency (HEMAT TOKEN)

**Goal:** Bring Codebuff framework's token efficiency features into the desktop session, plus transport-level efficiency.

#### 3.1 Context window management in sidecar
**In:** `apps/desktop/src-sidecar/index.ts`

- Import and use `trimMessagesToFitTokenLimit` from `@codebuff/agent-runtime/util/messages` between turns
- Set a configurable token budget (default: 100k for desktop, lower than CLI's 190k to save cost)
- Use `getMessagesSubset` to strip `cacheControl` after trimming
- Use `expireMessages` with TTLs for desktop-specific message expiry
- Replace the desktop's current fixed 6-message cap ([sidecar-api.ts:438-446](file:///c:/projects/koncoweb/apps/desktop/src/services/sidecar-api.ts#L438-L446)) with adaptive trimming based on actual token count

#### 3.2 Prompt caching
**In:** `apps/desktop/src-sidecar/index.ts`

- Ensure `includeCacheControl: true` is passed for models that support it (Codebuff already checks `supportsCacheControl`)
- The `vibe-coder` agent uses `anthropic/claude-sonnet-4.5` which supports prompt caching
- This alone can reduce token costs by ~50% for repeated system prompts

#### 3.3 Tool result simplification
**In:** `apps/desktop/src-sidecar/index.ts`

- Import and use `simplifyToolResults` from `@codebuff/agent-runtime/util/simplify-tool-results` to condense verbose terminal/file outputs before they enter message history
- This prevents large tool outputs from consuming context window

#### 3.4 Context-pruner agent
**In:** `apps/desktop/src/agents/vibe-coder.ts`

- Add `context-pruner` to `spawnableAgents` list
- The agent runtime will automatically spawn it when context exceeds limits (Codebuff already does this — just need to ensure the agent is registered)
- Import the existing `context-pruner` agent definition from `agents/context-pruner.ts`

#### 3.5 State delta transport (from Workstream 2.2)
- Sending `STATE_DELTA` instead of full `STATE_SNAPSHOT` reduces wire payload
- Combined with JSON-RPC over stdio (not HTTP), this is the most token/bandwidth-efficient transport

#### 3.6 Model selection for token economy
**In:** `apps/desktop/src/agents/vibe-coder.ts`

- Add a `model` fallback hierarchy: if the user's configured model is expensive, offer a "fast mode" using a cheaper model for research/review sub-agents
- Keep `claude-sonnet-4.5` for main generation, but allow `haiku` for researcher-web and code-reviewer sub-agents (lower cost, sufficient for these tasks)

---

### Workstream 4: MCP Integration (Popular Servers)

**Goal:** Wire Codebuff's existing MCP client into the desktop app via the sidecar, pre-configuring 4 popular servers.

#### 4.1 Add mcpServers to vibe-coder agent
**Edit:** `apps/desktop/src/agents/vibe-coder.ts`

Add `mcpServers` field to the `AgentDefinition`:
```ts
mcpServers: {
  filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '${cwd}'] },
  github: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: { GITHUB_PERSONAL_ACCESS_TOKEN: '$GITHUB_TOKEN' } },
  playwright: { command: 'npx', args: ['-y', '@playwright/mcp'] },
  supabase: { command: 'npx', args: ['-y', '@supabase/mcp-server-supabase'], env: { SUPABASE_ACCESS_TOKEN: '$SUPABASE_TOKEN' } },
}
```

The sidecar (running Codebuff SDK) will automatically:
1. Call `getMCPClient()` for each server config ([client.ts:83](file:///c:/projects/koncoweb/common/src/mcp/client.ts#L83))
2. Call `listMCPTools()` to discover available tools
3. Convert JSON schemas to Zod via `getMCPToolData()` ([mcp.ts:15](file:///c:/projects/koncoweb/packages/agent-runtime/src/mcp.ts#L15))
4. Register tools as `mcpName__toolName` in the agent's `customToolDefinitions`
5. Execute via `callMCPTool()` when the agent invokes them

#### 4.2 MCP config file
**New file:** `apps/desktop/.agents/mcp.json`

A default MCP config that the sidecar loads via `loadMCPConfig()` ([load-mcp-config.ts:95](file:///c:/projects/koncoweb/sdk/src/agents/load-mcp-config.ts#L95)):
```json
{
  "mcpServers": {
    "filesystem": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "."] },
    "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] },
    "playwright": { "command": "npx", "args": ["-y", "@playwright/mcp"] },
    "supabase": { "command": "npx", "args": ["-y", "@supabase/mcp-server-supabase"] }
  }
}
```

Environment variables (`$GITHUB_TOKEN`, `$SUPABASE_TOKEN`) are resolved by Codebuff's env-var substitution ([client.ts:31-53](file:///c:/projects/koncoweb/common/src/mcp/client.ts#L31-L53)).

#### 4.3 MCP management UI
**Edit:** `apps/desktop/src/components/SettingsModal.tsx`

Add an "MCP Servers" tab/section:
- List configured MCP servers with status indicators (connected/disconnected/error)
- Add/remove server config (command, args, env vars)
- Input fields for API tokens (GitHub, Supabase) — stored in localStorage, passed to sidecar as env
- Toggle individual servers on/off
- "Test Connection" button that pings the MCP server via the sidecar

#### 4.4 MCP tool discovery display
**Edit:** `apps/desktop/src/components/ChatPanel.tsx`

When MCP tools are available, show them in the agent card UI:
- MCP tool calls appear as steps with the `mcpName/toolName` display format
- Tool results are rendered with appropriate content type (text, image, resource)
- Add a small "MCP Tools Available" indicator in the header

#### 4.5 Neon DB as alternative to Supabase
Since the project already uses Neon Auth ([neon-auth.ts](file:///c:/projects/koncoweb/apps/desktop/src/services/neon-auth.ts)):
- Add `@neondatabase/mcp-server-neon` as an alternative MCP server
- Config: `{ command: 'npx', args: ['-y', '@neondatabase/mcp-server-neon'], env: { NEON_API_KEY: '$NEON_API_KEY' } }`
- User can choose Supabase OR Neon in settings

---

### Workstream 5: UI/UX Improvements (User-Friendly Display)

**Goal:** Replace the current synthetic-step UI with true streaming, interrupt UI, reasoning panel, and generative UI components.

#### 5.1 True token-by-token streaming display
**Edit:** `apps/desktop/src/components/ChatPanel.tsx`

Replace the 500ms throttled synthetic step updates ([sidecar-api.ts:516-528](file:///c:/projects/koncoweb/apps/desktop/src/services/sidecar-api.ts#L516-L528)) with:
- Consume `TEXT_MESSAGE_CONTENT` deltas from the AG-UI event store
- Append each delta immediately to the active message bubble (no throttling)
- Show a blinking caret while `TEXT_MESSAGE_START` is active and no `TEXT_MESSAGE_END` yet
- This gives true character-by-character streaming (like ChatGPT/Claude UI)

#### 5.2 Tool call visualization with streaming args
**Edit:** `apps/desktop/src/components/ChatPanel.tsx`

Replace the current step-based tool display with AG-UI-inspired tool cards:
- `TOOL_CALL_START` → create a tool card with the tool name + "running" spinner
- `TOOL_CALL_ARGS` (delta) → progressively reveal the arguments JSON as it streams
- `TOOL_CALL_END` → mark args complete, show "executing..."
- `TOOL_CALL_RESULT` → show the result content (text/image/resource)
- MCP tools get a special icon/badge
- File-affecting tools show the affected file path with a click-to-jump link (keep existing behavior from StepRow)

#### 5.3 Reasoning visibility panel
**New component:** `apps/desktop/src/components/ReasoningPanel.tsx`

Codebuff already streams `reasoning_delta` ([print-mode.ts:89-100](file:///c:/projects/koncoweb/common/src/types/print-mode.ts#L89-L100)). Currently the desktop app ignores it. Add:
- A collapsible "Thinking..." panel above the assistant message
- Shows reasoning text as it streams in (token-by-token)
- Attribution to subagents (via `agentId` field)
- Auto-collapse when the reasoning ends and text generation begins
- Monospace font, muted color (like Claude's thinking display)

#### 5.4 Interrupt/approval UI
**New component:** `apps/desktop/src/components/InterruptDialog.tsx`

When `RUN_FINISHED` carries an interrupt outcome:
- Render a modal/inline dialog based on the interrupt type:
  - `reason: "tool_call"` → show the proposed tool call + args, "Approve" / "Deny" / "Edit & Approve" buttons
  - `reason: "input_required"` → render a form based on `responseSchema` (JSON Schema → form fields)
  - `reason: "confirmation"` → simple yes/no
- For approve-with-edits: show an editable JSON/text field pre-filled with the proposed args
- On submit, send a `resume` JSON-RPC request to the sidecar with `{ interruptId, status: "resolved", payload }`
- On cancel, send `{ interruptId, status: "cancelled" }`
- Support parallel interrupts (multiple dialogs/cards)

#### 5.5 Generative UI component registry
**New file:** `apps/desktop/src/components/generative-ui/Registry.tsx`

Expand Codebuff's single `button` widget ([render-ui.ts](file:///c:/projects/koncoweb/common/src/tools/params/tool/render-ui.ts)) into a registry:
- `button` — keep existing (link button)
- `code_preview` — show a code snippet with syntax highlighting
- `diff_view` — show before/after diff for file edits
- `image_grid` — show generated/preview images
- `form` — structured input form (based on JSON Schema)
- `status_card` — progress/status display with icon + message
- `action_chips` — quick action buttons (follow-ups)

Each component:
- Receives typed props from the agent's tool call
- Can emit user interactions back to the agent (via a `onInteract` callback → sidecar → resume)
- Registered in a `Map<string, GenerativeUIComponent>` (like Codebuff's CLI registry but for web)

**In the sidecar:** Extend the `render_ui` tool to accept the expanded widget union (or create a new `render_component` tool). The sidecar maps this to a `TOOL_CALL` event with a special `toolCallName: "render_ui"` that the frontend intercepts and renders via the registry.

#### 5.6 Improved pipeline visualization
**Edit:** `apps/desktop/src/components/ChatPanel.tsx`

Replace the current 4-phase pipeline bar (`PIPELINE_PHASES` at [ChatPanel.tsx:20-25](file:///c:/projects/koncoweb/apps/desktop/src/components/ChatPanel.tsx#L20-L25)) with:
- A dynamic step tracker based on `STEP_STARTED` / `STEP_FINISHED` events
- Shows actual agent steps (think → research → generate → review) with real timing
- Subagent nesting visualization (indented steps for spawned agents)
- Cost/token counter (from Codebuff's `finish` event `totalCost`)

---

### Workstream 6: Intuitive & Precise Editing

**Goal:** Make editing precise and intuitive — the user clicks an element, describes a change, and the agent edits exactly that.

#### 6.1 Enhanced click-to-inspect
**Edit:** `apps/desktop/src/components/LivePreview.tsx`

Improve the current click-to-inspect ([LivePreview.tsx:194-222](file:///c:/projects/koncoweb/apps/desktop/src/components/LivePreview.tsx#L194-L222)):
- Capture richer element context: tag, id, classes, computed styles, text content, bounding rect, parent structure (CSS selector path)
- Send to sidecar as structured context (not just a text string prepended to the prompt)
- Show a visual highlight overlay on the clicked element that persists while editing

#### 6.2 Diff-based editing view
**New component:** `apps/desktop/src/components/DiffView.tsx`

When the agent edits existing HTML (via `str_replace` or `write_file`):
- Show a side-by-side or inline diff of the changes
- Highlight added/removed/changed lines
- "Apply" / "Reject" buttons (uses the interrupt/approval flow)
- "Edit & Apply" — let the user manually adjust the diff before applying

This uses Codebuff's existing `str_replace` tool output (which includes the old/new content) and wraps it in the AG-UI approve-with-edits pattern.

#### 6.3 Element-targeted editing
**In:** `apps/desktop/src-sidecar/index.ts`

When the user provides an inspected element context:
- The sidecar constructs a focused prompt: "Edit ONLY the element matching selector `XYZ`. Current HTML: `...`. Requested change: `...`."
- This reduces the token cost (agent doesn't need to re-read the entire file)
- The agent uses `str_replace` with the exact selector context, not `write_file` (which rewrites everything)
- Result: faster, cheaper, more precise edits

#### 6.4 Inline edit mode
**Edit:** `apps/desktop/src/components/LivePreview.tsx`

Add an "Edit Mode" toggle in the preview:
- When active, clicking an element opens a small inline editor (contentEditable or textarea overlay)
- User can type a natural-language instruction for that specific element
- The instruction + element context is sent to the agent as a targeted edit request
- Visual feedback: the element gets a pulsing border while the agent is editing it

---

### Workstream 7: Documentation Updates

Per user rules: update `requirement.md` and `apps/desktop/CHANGELOG.md` when features/UX change.

#### 7.1 Update requirement.md
**Edit:** `c:\projects\koncoweb\requirement.md`

Add sections for:
- AG-UI-inspired event layer (event taxonomy, interrupt lifecycle)
- Codebuff SDK sidecar architecture
- MCP integration (4 servers, config UI)
- Token efficiency features
- Generative UI component registry
- Enhanced editing (diff view, element targeting, inline edit)

#### 7.2 Update CHANGELOG.md
**Edit:** `apps/desktop/CHANGELOG.md`

Add entries for all new features with version bump.

---

## Implementation Order (Dependencies)

```
1. Sidecar Bridge (WS1) ──┬── 2. Event Layer (WS2) ──┬── 5. UI/UX (WS5)
                          │                          │
                          ├── 3. Token Efficiency (WS3)
                          │
                          └── 4. MCP Integration (WS4)
                                                      └── 6. Editing (WS6)

7. Documentation (WS7) — after all features land
```

- WS1 is the foundation — everything depends on the sidecar running
- WS2 and WS3 can proceed in parallel once WS1 is done
- WS4 depends on WS1 (MCP runs in the sidecar)
- WS5 depends on WS2 (UI consumes AG-UI events)
- WS6 depends on WS5 (uses interrupt UI for approve-with-edits)
- WS7 is last

---

## Assumptions & Decisions

1. **Sidecar binary:** Use `bun build --compile` to create a standalone executable. If Bun cross-compilation has issues, fall back to `pkg` or running `node dist-sidecar/index.js` directly. For dev mode, run `bun run src-sidecar/index.ts` without compilation.

2. **SumoPod fallback retained:** The SumoPod fallback path stays as-is for when the sidecar isn't available (browser-only mode, dev without Tauri). The AG-UI event layer only applies to the Codebuff sidecar path.

3. **No full AG-UI protocol implementation:** We adopt AG-UI's *patterns and event taxonomy* as inspiration, not the full wire protocol spec. The transport is JSON-RPC over stdio (Tauri sidecar), not HTTP/SSE. This is simpler and more efficient for a desktop app.

4. **MCP via npx:** All 4 MCP servers are invoked via `npx -y <package>`. This requires Node.js/npm installed on the user's machine. For packaging, consider bundling the MCP server packages or using Bun's `bunx`.

5. **Env-var security:** API tokens (GitHub, Supabase, Neon) are stored in localStorage (encrypted with Tauri's secure storage in production) and passed to the sidecar as environment variables. Never exposed to the browser bundle.

6. **State delta computation:** Use `fast-json-patch` (RFC 6902) for computing state deltas. If the dependency is too heavy, implement a minimal shallow-diff for top-level keys + deep-diff for changed keys.

7. **Existing Codebuff features stay untouched:** The `common/`, `packages/agent-runtime/`, `sdk/`, `cli/`, and `agents/` directories are NOT modified (except importing from them). All changes are in `apps/desktop/`.

8. **Model cost hierarchy:** Main generation uses the user's configured model (default claude-sonnet-4.5). Sub-agents (researcher-web, code-reviewer) can use cheaper models (haiku) to save tokens. This is configurable in settings.

---

## Verification Steps

### After WS1 (Sidecar):
- [ ] `bun run build` succeeds without `node:module` errors
- [ ] `bun run tauri:dev` spawns the sidecar process
- [ ] Sidecar responds to `ping` JSON-RPC method
- [ ] `check_codebuff_sidecar()` returns `true` when sidecar is running

### After WS2 (Event Layer):
- [ ] Text streams token-by-token (not 500ms throttled)
- [ ] Tool args stream progressively
- [ ] State deltas are smaller than full snapshots
- [ ] Interrupts pause the agent and show in UI

### After WS3 (Token Efficiency):
- [ ] Context window is trimmed adaptively (not fixed 6 messages)
- [ ] Prompt caching is active (check API response headers)
- [ ] Tool results are simplified before entering history
- [ ] Token usage per turn is measurable and lower than before

### After WS4 (MCP):
- [ ] Filesystem MCP: agent can read/write project files
- [ ] GitHub MCP: agent can list repos, create PRs
- [ ] Playwright MCP: agent can take screenshots, run E2E
- [ ] Supabase/Neon MCP: agent can query database
- [ ] MCP server status shows in settings UI

### After WS5 (UI/UX):
- [ ] Streaming text renders smoothly without flicker
- [ ] Reasoning panel shows thinking process
- [ ] Tool approval dialog works (approve/deny/edit)
- [ ] Generative UI components render correctly
- [ ] Pipeline visualization shows real steps with timing

### After WS6 (Editing):
- [ ] Click-to-inspect captures rich element context
- [ ] Diff view shows before/after changes
- [ ] Element-targeted edits are precise (only target element changes)
- [ ] Inline edit mode works in preview

### Overall:
- [ ] SumoPod fallback still works when sidecar is unavailable
- [ ] No regressions in existing features (Blob URL preview, virtual file tree, multi-project, auth)
- [ ] `requirement.md` and `CHANGELOG.md` updated
