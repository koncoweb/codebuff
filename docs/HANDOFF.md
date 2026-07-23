# KoncoVibe — Handoff Document

> **Tujuan:** Dokumen ini untuk melanjutkan development KoncoVibe di chat/session baru.
> **Dibuat:** 2026-07-22
> **Diperbarui:** 2026-07-23
> **Status Proyek:** Alpha — Web preview berjalan penuh, Codebuff SDK sidecar terimplementasi, AG-UI event layer aktif

---

## 1. Cara Mulai Cepat

```bash
# Install dependencies
cd c:\projects\koncoweb
bun install

# Jalankan web preview (browser mode — SumoPod fallback)
bun run dev:desktop
# → buka http://localhost:5173/

# Jalankan desktop app (Codebuff SDK sidecar aktif di Tauri mode)
cd apps/desktop
bun run tauri:dev

# Build production
bun run build:all          # sidecar binary + vite bundle
bun run tauri:build        # full Tauri installer (.msi/.exe)
```

---

## 2. Current State (Apa yang Sudah Berjalan)

### ✅ Berfungsi Penuh
| Fitur | File | Status |
|:---|:---|:---|
| Chat bubble layout (user kanan, AI kiri) | `src/components/ChatPanel.tsx` | ✅ |
| Multiline textarea + Enter/Shift+Enter | `src/components/ChatPanel.tsx` | ✅ |
| Agent-grouped collapsible pipeline steps | `src/components/ChatPanel.tsx` | ✅ |
| Pipeline progress bar (Analisis → Riset → Kode → Cek) | `src/components/ChatPanel.tsx` | ✅ |
| Reasoning panel (collapsible thinking display, token streaming) | `src/components/ReasoningPanel.tsx` | ✅ Baru |
| Interrupt dialog (human-in-the-loop approval cards) | `src/components/InterruptDialog.tsx` | ✅ Baru |
| Typing indicator + blinking caret | `src/components/ChatPanel.tsx` + `index.css` | ✅ |
| Stop button (AbortController — benar-benar membatalkan fetch) | `src/components/ChatPanel.tsx` + `App.tsx` | ✅ |
| Smart auto-scroll + jump-to-bottom | `src/components/ChatPanel.tsx` | ✅ |
| Post-gen status card + follow-up chips | `src/components/ChatPanel.tsx` | ✅ |
| Inspector context chip (element dari LivePreview) | `src/components/ChatPanel.tsx` | ✅ |
| Inline Edit Mode (klik elemen → ketik instruksi → agent edit) | `src/components/LivePreview.tsx` | ✅ Ditingkatkan |
| Attach button (disabled + tooltip "segera hadir") | `src/components/ChatPanel.tsx` | ✅ |
| Streaming SSE Response (progress real-time setiap 500ms) | `src/services/sidecar-api.ts` | ✅ |
| True delta streaming via AG-UI events (token-by-token) | `src/services/agui-event-store.ts` | ✅ Baru |
| Multi-turn Context (chat history + previousRunState passing) | `src/services/sidecar-api.ts` + `codebuff-integration.ts` | ✅ |
| Virtual File Tree (index.html, style.css, script.js) | `src/components/CodeViewer.tsx` | ✅ |
| CodeViewer auto-sync (auto-select index.html saat generate) | `src/components/CodeViewer.tsx` | ✅ |
| Live Preview via Blob URL | `src/components/LivePreview.tsx` | ✅ |
| Rich Click-to-Inspect (selector path, computed styles, outerHTML) | `src/components/LivePreview.tsx` | ✅ Ditingkatkan |
| DiffView (before/after code review, unified/split, edit & apply) | `src/components/DiffView.tsx` | ✅ Baru |
| Generative UI Registry (6 widget types) | `src/components/generative-ui/Registry.tsx` | ✅ Baru |
| LLM generation pipeline (SumoPod fallback, streaming SSE) | `src/services/sidecar-api.ts` | ✅ |
| Hybrid Codebuff integration (sidecar transport + event→step bridge) | `src/services/codebuff-integration.ts` | ✅ Ditingkatkan |
| **Codebuff SDK Sidecar** (JSON-RPC over stdio, Node.js/Bun process) | `src-sidecar/index.ts` | ✅ Baru |
| **AG-UI Event Mapper** (Codebuff PrintModeEvent → AG-UI events) | `src-sidecar/agui-event-mapper.ts` | ✅ Baru |
| **Sidecar Transport** (Tauri shell plugin, lifecycle management) | `src/services/codebuff-sidecar-transport.ts` | ✅ Baru |
| **MCP Servers** (5 servers: Filesystem, GitHub, Playwright, Supabase, Neon) | `src/agents/vibe-coder.ts` + `.agents/mcp.json` | ✅ Baru |
| MCP Settings UI (toggle, token inputs, test connection, custom servers) | `src/components/McpSettings.tsx` | ✅ Baru |
| Token efficiency (reasoning effort medium, context-pruner, state deltas) | `src/agents/vibe-coder.ts` | ✅ Baru |
| Neon Auth (fallback hanya saat network error, tier `regular`) | `src/services/neon-auth.ts` | ✅ |
| Multi-project management (localStorage + debug log reset) | `src/App.tsx` | ✅ |
| Settings modal (BYOK, provider switching, tab navigation, MCP tab) | `src/components/SettingsModal.tsx` | ✅ Ditingkatkan |
| API key via Vite env variable (`.env` + `.env.example`) | `.env` + 3 source files | ✅ |
| Neon Auth config via env variable | `.env` + `neon-auth.ts` | ✅ |
| Tauri 2.0 foundation (Rust + sidecar detection + icon generation) | `src-tauri/` | ✅ Ditingkatkan |
| **Production build berhasil** (Vite externalizes Codebuff SDK) | `vite.config.ts` | ✅ Diperbaiki |
| Custom agent definitions (vibe-coder, vibe-reviewer) | `src/agents/` | ✅ Ditingkatkan |

### ⚠️ Sisa Kendala (Belum Diselesaikan)

| Masalah | Lokasi | Detail |
|:---|:---|:---|
| **Sidecar binary belum di-compile** | `binaries/codebuff-bridge-*.exe` | Placeholder file ada. Perlu `bun run build:sidecar` untuk meng-compile binary nyata via Bun `--compile`. Saat ini sidecar detection di `lib.rs` fallback ke `bun`/`node` jika binary tidak ditemukan. |
| **Attach/file upload belum diimplementasi** | `ChatPanel.tsx` | Tombol di-disabled dengan tooltip. Full upload gambar = task future. |
| **AskUserBridge interrupt belum teruji** | `src-sidecar/index.ts` | `setupInterruptBridge()` mencoba import `@codebuff/common/utils/ask-user-bridge` yang mungkin tidak di-export dari SDK. Fallback: interrupt hanya via tool_call events. |
| **Sidecar spawn di browser mode** | `codebuff-sidecar-transport.ts` | `isDesktopMode()` cek `window.__TAURI_INTERNALS__`. Di browser murni, sidecar tidak akan start — fallback ke SumoPod. |

---

## 3. Yang Sudah Dikerjakan (AG-UI Strengthening Workstreams)

Mengacu pada plan: `.trae/documents/ag-ui-codebuff-strengthening-plan.md`

### 3.1 ✅ Codebuff SDK Sidecar Bridge
Sidecar process (Node.js/Bun) menjalankan Codebuff SDK, komunikasi via JSON-RPC over stdio. Frontend tidak pernah import `@codebuff/sdk` langsung (yang akan break production build).

**Sidecar modul-modul (direfaktor dari monolitik index.ts):**
- `src-sidecar/index.ts` — **thin entry point**: run/resume/cancel/ping handlers, main loop
- `src-sidecar/json-rpc.ts` — **JSON-RPC protocol layer**: `createJsonRpcIO()`, send/receive over stdio
- `src-sidecar/stream-chunk-handler.ts` — **token streaming**: Codebuff chunks → AG-UI TEXT/REASONING events
- `src-sidecar/interrupt-bridge.ts` — **human-in-the-loop**: `waitForInterrupt`, `resolveInterrupt`, `setupInterruptBridge`
- `src-sidecar/agui-event-mapper.ts` — map `PrintModeEvent` → AG-UI events, delta streaming, JSON-patch state diff
- `scripts/build-sidecar.ts` — Bun `--compile` cross-platform build (windows-x64, darwin-arm64, darwin-x64, linux-x64)

**Tauri wiring:**
- `src-tauri/src/lib.rs` — `check_codebuff_sidecar()` deteksi binary → bun → node
- `src-tauri/tauri.conf.json` — `externalBin: ["binaries/codebuff-bridge"]`
- `src-tauri/capabilities/default.json` — `shell:allow-spawn` permission
- `src-tauri/Cargo.toml` — `which = "6"` crate

### 3.2 ✅ AG-UI-Inspired Event Layer
True delta streaming dan lifecycle events yang mengisi gap Codebuff.

**File:**
- `src/types/agui-events.ts` — full type definitions (RunStarted/Finished, TextMessage, ToolCall, StateSnapshot/Delta, Reasoning, Interrupt)
- `src/services/agui-event-store.ts` — frontend accumulator + `useAguiStore()` React hook

**Event taxonomy:**
| Event | Fills Codebuff Gap |
|---|---|
| `TEXT_MESSAGE_START/CONTENT/END` | True delta streaming (Codebuff's `text` = full-string) |
| `TOOL_CALL_START/ARGS/END` | Streaming tool args (Codebuff sends complete input) |
| `STATE_SNAPSHOT/DELTA` | Incremental sync (Codebuff only has snapshot blobs) |
| `RUN_FINISHED { outcome: interrupt }` | Generic approval with responseSchema + approve-with-edits |
| `REASONING_START/CONTENT/END` | Lifecycle wrapper untuk reasoning_delta |

### 3.3 ✅ Frontend Transport & Event→Step Bridge
- `src/services/codebuff-sidecar-transport.ts` — manages sidecar lifecycle via `@tauri-apps/plugin-shell`, JSON-RPC client dengan request/response correlation
- `src/services/codebuff-integration.ts` — **thin orchestrator**: mode detection, dispatch, event subscription, fallback. Tidak lagi berisi mapping logic
- `src/services/agui-step-mapper.ts` — **`AguiStepMapper` class** dengan `TOOL_MAPPINGS` table tunggal (single source of truth untuk tool name → agentGroup/pipelinePhase/stepType/title). State per-run terisolasi

### 3.4 ✅ MCP Integration (5 Servers)
- `src/agents/vibe-coder.ts` — `mcpServers`: Filesystem, GitHub, Playwright, Supabase, Neon
- `.agents/mcp.json` — default config
- `src/components/McpSettings.tsx` — management UI (toggle, tokens, test connection, custom servers)

### 3.5 ✅ Token Efficiency
- `reasoningOptions.effort: 'medium'` (bukan max)
- `context-pruner` di `spawnableAgents`
- `previousRunState` passing untuk multi-turn continuity
- State delta transport (bukan full snapshot)
- Instructions: prioritaskan `str_replace` untuk editing presisi

### 3.6 ✅ UI/UX Components Baru
- `ReasoningPanel.tsx` — collapsible thinking display, auto-collapse 1s, blinking caret
- `InterruptDialog.tsx` — 3 mode: tool_call (approve/deny/edit), input_required (JSON Schema → form), confirmation (yes/no)
- `DiffView.tsx` — before/after diff, unified/split toggle, edit & apply
- `generative-ui/Registry.tsx` — 6 widget: button, code_preview, diff_view, image_grid, status_card, action_chips

### 3.7 ✅ Enhanced Editing (LivePreview)
- Rich click-to-inspect: selector path, computed styles, outerHTML, bounding rect
- Inline Edit Mode: klik elemen → floating input overlay → natural language instruction
- Persistent highlight overlay (cyan ring + floating label)

### 3.8 ✅ Production Build Fix
- `vite.config.ts` — `rollupOptions.external` untuk `@codebuff/sdk`, `@codebuff/common`, `@codebuff/agent-runtime`
- `tsc --noEmit` — **exit 0, zero errors**
- `vite build` — **exit 0, 1608 modules, 3.87s**

### 3.9 ✅ TypeScript Error Fixes (8 errors → 0)
| Error | Fix |
|---|---|
| `'SIDECAR'` bukan kategori valid di `DebugLogEntry` | Diganti ke `'LLM_REQUEST'` |
| `event.toolCallName` tidak ada di `ToolCallArgsEvent` | `stepGroupMap` → `toolNameMap` (toolCallId → toolCallName), lookup dari map |
| `async *handleSteps` return AsyncGenerator | Dihapus `async` — Codebuff runtime mensyaratkan sync generator |
| `prompt` possibly undefined | Default `const userPrompt = prompt ?? ''` |
| `think_deeply` input field `topic` (salah) | Diperbaiki ke `thought` sesuai `ThinkDeeplyParams` |

---

## 4. Next Steps Prioritas

### Prioritas TINGGI
1. **Compile sidecar binary nyata** — `bun run build:sidecar` untuk generate `codebuff-bridge-*.exe` yang berfungsi. Verifikasi sidecar spawn dan ping di Tauri desktop mode.
2. **End-to-end test Codebuff SDK flow** — jalankan `bun run tauri:dev`, kirim prompt, verifikasi: sidecar start → CodebuffClient.run() → AG-UI events stream → UI render reasoning/interrupt → HTML generate → LivePreview update
3. **Verifikasi Tauri build** — `bun run tauri:build` untuk generate installer (.msi/.exe) di Windows

### Prioritas SEDANG
4. **Interrupt bridge testing** — verifikasi `AskUserBridge` import path, test human-in-the-loop approval flow end-to-end
5. **MCP server connection testing** — test real connection ke GitHub/Supabase/Neon MCP servers dengan token valid
6. **localStorage → Tauri FS** — pindahkan project persistence ke filesystem native (`tauri-plugin-fs`)
7. **Export project** — save HTML ke disk via `save_html_to_disk` Rust command (sudah ada, perlu UI trigger)
8. **File upload (attach)** — implement full image upload sebagai referensi editing
9. **Template gallery** — pre-built templates sebagai starting point

### Prioritas RENDAH
10. **Auto-updater** — `tauri-plugin-updater` untuk update otomatis
11. **System tray** — minimize to tray
12. **Code signing** — Windows installer certificate
13. **Cross-platform** — test di macOS/Linux, build sidecar untuk target platform lain

---

## 5. File Index Penting

### Komponen UI
| File | Peran |
|:---|:---|
| `apps/desktop/src/App.tsx` | Root state: user, projects, model, layout, AG-UI store. Panggilan `sendVibeCodingPrompt()` |
| `apps/desktop/src/components/ChatPanel.tsx` | Chat bubble layout, agent grouping, pipeline bar, reasoning + interrupt rendering |
| `apps/desktop/src/components/ReasoningPanel.tsx` | Collapsible thinking display, token-by-token reasoning streaming |
| `apps/desktop/src/components/InterruptDialog.tsx` | Human-in-the-loop approval cards (tool_call/input_required/confirmation) |
| `apps/desktop/src/components/DiffView.tsx` | Before/after code diff dengan unified/split views |
| `apps/desktop/src/components/generative-ui/Registry.tsx` | Generative UI widget registry (6 types) |
| `apps/desktop/src/components/CodeViewer.tsx` | Virtual file tree dari generatedHtml |
| `apps/desktop/src/components/LivePreview.tsx` | iframe preview, rich inspect, inline edit mode |
| `apps/desktop/src/components/Header.tsx` | Top bar: project selector, model selector, user menu |
| `apps/desktop/src/components/SettingsModal.tsx` | Provider/key/model config + MCP tab |
| `apps/desktop/src/components/McpSettings.tsx` | MCP server management (5 built-in + custom) |
| `apps/desktop/src/components/NeonAuthModal.tsx` | Login/signup |

### Services
| File | Peran |
|:---|:---|
| `apps/desktop/src/services/codebuff-integration.ts` | **Thin orchestrator** — mode detection, dispatch (sidecar vs SumoPod), event subscription, fallback. Event→step mapping diekstrak ke `agui-step-mapper.ts` |
| `apps/desktop/src/services/agui-step-mapper.ts` | **AG-UI → VibeAgentStep converter** — `TOOL_MAPPINGS` table tunggal (single source of truth), `AguiStepMapper` class dengan state per-run |
| `apps/desktop/src/services/codebuff-sidecar-transport.ts` | Sidecar process lifecycle, JSON-RPC client, streaming events |
| `apps/desktop/src/services/agui-event-store.ts` | Frontend AG-UI event accumulator + `useAguiStore()` hook |
| `apps/desktop/src/services/sidecar-api.ts` | SumoPod LLM pipeline. HTML parser. Debug log system. `VibeAgentStep` type. |
| `apps/desktop/src/services/neon-auth.ts` | Neon Auth + localStorage session. Fallback demo session. |

### Sidecar (Node.js/Bun Process)
| File | Peran |
|:---|:---|
| `apps/desktop/src-sidecar/index.ts` | **Thin entry point** — menggabungkan modul-modul: client init, run/resume/cancel/ping handlers, main loop |
| `apps/desktop/src-sidecar/json-rpc.ts` | **JSON-RPC protocol layer** — `createJsonRpcIO()`, send/receive messages over stdio, readline loop. Pure protocol, no business logic |
| `apps/desktop/src-sidecar/stream-chunk-handler.ts` | **Token streaming** — `createStreamChunkHandler()`, convert raw Codebuff chunks → AG-UI TEXT_MESSAGE/REASONING events |
| `apps/desktop/src-sidecar/interrupt-bridge.ts` | **Interrupt handling** — `waitForInterrupt`, `resolveInterrupt`, `setupInterruptBridge` (AskUserBridge) |
| `apps/desktop/src-sidecar/agui-event-mapper.ts` | Codebuff `PrintModeEvent` → AG-UI events, delta streaming, JSON-patch |
| `apps/desktop/scripts/build-sidecar.ts` | Bun `--compile` cross-platform build script |

### Types
| File | Peran |
|:---|:---|
| `apps/desktop/src/types/agui-events.ts` | AG-UI event type definitions (shared sidecar ↔ frontend) |

### Agent Definitions
| File | Peran |
|:---|:---|
| `apps/desktop/src/agents/vibe-coder.ts` | Custom agent: think → research → generate → review. MCP servers, reasoning medium, context-pruner |
| `apps/desktop/src/agents/vibe-reviewer.ts` | HTML/CSS/JS reviewer agent (validation only) |
| `apps/desktop/.agents/mcp.json` | Default MCP server configuration |

### Tauri / Rust
| File | Peran |
|:---|:---|
| `apps/desktop/src-tauri/src/lib.rs` | Rust commands: `get_app_info`, `check_codebuff_sidecar`, `save_html_to_disk` |
| `apps/desktop/src-tauri/src/main.rs` | Binary entry → calls `lib::run()` |
| `apps/desktop/src-tauri/tauri.conf.json` | Window config, bundle settings, externalBin |
| `apps/desktop/src-tauri/Cargo.toml` | Rust dependencies (tauri 2, serde, which) |
| `apps/desktop/src-tauri/capabilities/default.json` | Permission set (core, shell:allow-spawn) |

### Dokumentasi
| File | Peran |
|:---|:---|
| `requirement.md` | Spec lengkap: fitur, arsitektur, AG-UI event layer, data model, design system |
| `apps/desktop/CHANGELOG.md` | Log perubahan per versi |
| `docs/HANDOFF.md` | Dokumen ini — handoff untuk chat baru |
| `docs/ARCHITECTURE.md` | Diagram alur lengkap (hybrid + sidecar + AG-UI) |

---

## 6. Perintah Berguna

```bash
# Development
bun run dev:desktop              # Vite dev server (port 5173, browser mode)
cd apps/desktop && bun run tauri:dev  # Tauri desktop app (sidecar mode)

# Build
cd apps/desktop && bun run build:sidecar    # Compile sidecar binary (Bun --compile)
cd apps/desktop && bun run build:sidecar:all # Cross-platform sidecar binaries
cd apps/desktop && bun run build:all        # Sidecar + Vite bundle
cd apps/desktop && bun run tauri:build      # Full Tauri installer

# Type check
cd apps/desktop && bunx tsc --noEmit        # Zero errors expected

# Dependencies
bun install                      # Install semua workspace deps

# Debug
# Buka browser DevTools di http://localhost:5173
# CodeViewer tab "Debug Log" menampilkan real-time sidecar logs
# Sidecar stdout: JSON-RPC messages (set CODEBUFF_DEBUG=1 untuk verbose)
```

---

## 7. Catatan Penting untuk Chat Baru

1. **Baca `requirement.md` dulu** — spec lengkap fitur & data model, termasuk section 2.1 AG-UI event layer
2. **Baca `docs/ARCHITECTURE.md`** — diagram alur hybrid integration + sidecar + AG-UI events
3. **API key ada di `.env`** (bukan hardcoded di source) — copy `.env.example` ke `.env` dan isi. File `.env` sudah di-gitignore.
4. **`@codebuff/sdk` dipakai di sidecar** (`src-sidecar/`) dan agent definitions (`src/agents/`). Frontend (`src/`) TIDAK boleh import langsung — gunakan sidecar transport. Vite config sudah externalize SDK dari browser bundle.
5. **AG-UI events** adalah layer tambahan di atas Codebuff — bukan pengganti. Codebuff strengths (MCP, subagent orchestration, 33 tools, context-pruner) tetap dipertahankan.
6. **`handleSteps` HARUS sync generator** — Codebuff runtime memvalidasi `function*` (bukan `async function*`). Lihat `agent-validation.ts`.
7. **`think_deeply` input field** adalah `thought` (bukan `topic`) — sesuai `ThinkDeeplyParams` di SDK.
8. **`VibeAgentStep` type** ada di `sidecar-api.ts` — jika tambah field, update juga `agui-step-mapper.ts` (mapping logic), `codebuff-integration.ts` (orchestrator), dan `ChatPanel.tsx` (UI)
9. **Provider name disembunyikan dari UI** — jangan tambahkan kembali mention SumoPod/model di step titles, chat bubbles, atau debug log
10. **Compact dark mode** — semua icon `w-2.5 h-2.5`–`w-3 h-3`, font `text-[9px]`–`text-[11px]`. Jaga konsistensi.
11. **`crypto.randomUUID()`** dipakai untuk semua step ID — jangan kembali ke `Date.now()` pattern
12. **Settings persistence** — providerConfig di `localStorage` key `koncovibe_provider_config`, MCP tokens di `koncovibe_mcp_tokens`
13. **Production build WORKING** — `vite.config.ts` externalizes Codebuff packages. `tsc --noEmit` exit 0. `vite build` exit 0.
14. **Sidecar binary** — perlu `bun run build:sidecar` untuk compile binary nyata. Tanpa itu, `lib.rs` fallback ke `bun`/`node` runtime.
15. **Tool name → UI mapping** — tambah tool Codebuff baru cukup tambah entry di `TOOL_MAPPINGS` table di `agui-step-mapper.ts`. JANGAN buat fungsi switch terpisah (itu sumber bug sebelumnya).
16. **Sidecar modular structure** — `src-sidecar/` dipecah menjadi: `index.ts` (entry), `json-rpc.ts` (protocol), `stream-chunk-handler.ts` (streaming), `interrupt-bridge.ts` (HITL), `agui-event-mapper.ts` (event mapping). Edit di modul yang relevan, buan di `index.ts`.
