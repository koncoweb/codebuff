# KoncoVibe — Requirement Specification

> **Status:** Living document — diperbarui setiap ada perubahan fitur, UX, UI, atau arsitektur.
> **Terakhir diperbarui:** 2026-07-22

---

## 1. Identitas Produk

| Field | Value |
|:---|:---|
| **Nama** | KoncoVibe |
| **Tagline** | AI Vibe Coding Studio |
| **Tipe** | Desktop Application (Windows) |
| **Fondasi** | Dibangun di atas Codebuff framework (`CodebuffAI/codebuff`) |
| **Frontend** | Vite 6 + React 19 + TypeScript |
| **Desktop Shell** | Tauri 2.0 (Rust + WebView2) |
| **Package Manager** | Bun 1.3.14 |
| **Identifier** | `id.koncoweb.koncovibe` |

---

## 2. Arsitektur Sistem

```
┌─────────────────────────────────────────────────────┐
│                  Tauri 2.0 Window                    │
│  ┌───────────────────────────────────────────────┐  │
│  │           React 19 + Vite 6 (WebView2)        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐   │  │
│  │  │ChatPanel │  │LivePreview│  │CodeViewer│   │  │
│  │  │(prompt)  │  │(iframe)   │  │(files)   │   │  │
│  │  └────┬─────┘  └─────▲────┘  └────▲─────┘   │  │
│  │       │              │            │          │  │
│  │  ┌────▼──────────────┴────────────┴─────┐   │  │
│  │  │     codebuff-integration.ts           │   │  │
│  │  │  ┌─────────┐    ┌──────────────────┐ │   │  │
│  │  │  │Codebuff │    │ SumoPod Fallback │ │   │  │
│  │  │  │  SDK    │───▶│  (sidecar-api)   │ │   │  │
│  │  │  └────┬────┘    └──────────────────┘ │   │  │
│  │  └───────┼──────────────────────────────┘   │  │
│  └──────────┼──────────────────────────────────┘  │
│             │                                      │
│  ┌──────────▼──────────────────────────────────┐  │
│  │         Rust Backend (src-tauri/)           │  │
│  │  Commands: get_app_info, save_html_to_disk  │  │
│  │  Future: Codebuff sidecar (JSON-RPC stdio)  │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 3. Fitur Fungsional

### 3.1 Vibe Coding Chat Panel (Kiri)
- **Chat bubble layout**: user di kanan (cyan bubble + User avatar), AI di kiri (slate bubble + Sparkles avatar)
- **Multiline textarea** auto-growing (1-5 baris) dengan `Enter` kirim, `Shift+Enter` baris baru
- Tombol **attach** (paperclip) — dinonaktifkan dengan tooltip "Fitur lampiran segera hadir" (fitur upload gambar belum diimplementasi)
- **Agent-grouped collapsible pipeline view**: steps dikelompokkan per agent (thinker, researcher-web, editor, reviewer)
  - Auto-expand saat running, auto-collapse 2.5s setelah completed
  - Header menampilkan: nama agent, status, jumlah langkah, total durasi
- **Pipeline progress indicator**: Analisis → Riset → Kode → Cek (visual bar compact dengan fase aktif/completed/pending)
- **Typing indicator** (3 bouncing dots) dengan status message per fase pipeline
- **Streaming progress**: step content diupdate real-time setiap 500ms dengan jumlah karakter diterima (SSE streaming)
- **Blinking caret** pada assistant message yang sedang streaming
- **Stop button** (rose-colored) untuk batalkan generasi — membatalkan fetch LLM secara nyata via `AbortController`
- **Smart auto-scroll**: auto-scroll ke bottom, pause saat user scroll ke atas, jump-to-bottom button
- **Post-generation status card**: "Generasi Selesai" + tombol "Lihat Kode" (deep-link ke CodeViewer)
- **Follow-up suggestion chips**: "Dark mode toggle", "Responsive mobile", dll.
- **Categorized quick prompts**: Landing, Dashboard, Komponen (tab switching)
- **Provider & model name disembunyikan** dari UI untuk pengalaman newbie-friendly
- **Step → CodeViewer deep-link**: tombol external-link pada step yang menghasilkan file
- **Inspector context chip**: element yang diklik di LivePreview muncul sebagai purple chip di atas textarea — disertakan sebagai context saat prompt dikirim
- **Compact dark mode**: semua icon `w-2.5 h-2.5`–`w-3 h-3`, font `text-[9px]`–`text-[11px]`, padding minimal

### 3.2 Live Preview (Kanan Atas)
- iFrame preview dengan **Blob URL injection** (cross-browser compatible)
- Toggle antara "Live Render AI" (blob) dan "Server Port 3000" (localhost)
- Responsive mode: Desktop / Tablet / Mobile
- Refresh button untuk reload preview
- **Click-to-Inspect**: inspector mode menginjeksi script ke iframe — hover menampilkan highlight ungu, click mengirim element info (tag, id, classes, text, CSS selector) ke ChatPanel sebagai context chip
- Mock browser address bar dengan indikator HTTP 200

### 3.3 Code Viewer (Kanan Bawah)
- **Virtual File Tree** dari generatedHtml:
  - `index.html` — HTML lengkap
  - `style.css` — CSS diekstrak dari tag `<style>`
  - `script.js` — JS diekstrak dari tag `<script>` inline
  - `project.json` — Metadata proyek (baris, ukuran, statistik)
- Icon dan badge warna per tipe file
- Tombol copy-to-clipboard
- Tab "Debug Log" dengan filter kategori real-time
- **Auto-sync**: auto-select `index.html` saat HTML baru di-generate

### 3.4 Multi-Project Management
- Buat, pilih, hapus proyek
- Setiap proyek punya generatedHtml dan steps history sendiri
- Persistence via `localStorage` (`koncovibe_projects_<userId>`)
- Minimum 1 proyek aktif (tidak boleh kosong)

### 3.5 LLM Provider Configuration
- **15 model** dikelompokkan FREE/PREMIUM (label count dinamis)
- Provider: SumoPod AI (default), OpenAI Direct, OpenRouter
- BYOK (Bring Your Own Key) — user bisa set API key sendiri
- Base URL dan model configurable via Settings modal
- Default API key, base URL, dan model dari Vite env variable (`VITE_SUMOPOD_*`)
- **Provider switching**: baseUrl auto-update saat ganti provider (SumoPod/OpenAI/OpenRouter)
- **Settings persistence**: providerConfig disimpan ke localStorage (`koncovibe_provider_config`)

### 3.6 Authentication (Neon Auth)
- Sign in / Sign up dengan email-password
- Session persistent di `localStorage`
- Membership tier: regular, pro, special, vip
- Fallback offline mode (demo session tier `regular`) hanya saat network error (offline/CORS/server unreachable)
- Auth failure (401/403) menampilkan pesan error spesifik ke user — tidak auto-login
- Config URL backend via env variable (`VITE_NEON_AUTH_BASE_URL`, `VITE_NEON_AUTH_PROJECT_ID`)

---

## 4. Hybrid Codebuff Integration

### 4.1 Mode Operasi

| Mode | Trigger | Behavior |
|:---|:---|:---|
| **Codebuff SDK** | Desktop (Tauri) + API key tersedia | Multi-agent pipeline: vibe-coder → researcher-web → code-reviewer |
| **SumoPod Fallback** | Browser mode atau SDK error | Direct fetch ke SumoPod AI (pipeline existing) |

### 4.2 Custom Agents

#### vibe-coder
- **Model:** `anthropic/claude-sonnet-4.5`
- **Tools:** write_file, str_replace, read_files, run_terminal_command, web_search, read_url, think_deeply, spawn_agents, ask_user, set_output
- **Spawnable:** researcher-web, code-reviewer
- **handleSteps:** think_deeply → [researcher-web] → STEP_ALL → [code-reviewer]

#### vibe-reviewer
- **Model:** `anthropic/claude-sonnet-4.5`
- **Tools:** read_files, set_output (review only — no editing)
- **Checklist:** HTML tag closure, CSS syntax, JS syntax, accessibility, responsive, performance, security

---

## 5. Desktop (Tauri 2.0) Specification

### 5.1 Window Configuration
- **Title:** "KoncoVibe — AI Vibe Coding Studio"
- **Size:** 1400×900 (min: 1024×700)
- **Resizable:** Yes
- **DevTools:** Auto-open di debug mode

### 5.2 Rust Commands
| Command | Deskripsi | Status |
|:---|:---|:---|
| `get_app_info()` | Info versi, platform, arch | ✅ Ready |
| `check_codebuff_sidecar()` | Deteksi sidecar binary | ⬜ TODO |
| `save_html_to_disk(content, filename)` | Simpan HTML ke filesystem | ⬜ TODO (plugin-dialog) |

### 5.3 Roadmap Desktop
1. ✅ **Foundation** — Window, config, commands, Vite integration
2. ⬜ **Sidecar** — Bundle Codebuff SDK sebagai externalBin + JSON-RPC stdio
3. ⬜ **File System** — Save/load proyek ke disk (tauri-plugin-dialog + tauri-plugin-fs)
4. ⬜ **Auto-updater** — tauri-plugin-updater
5. ⬜ **System Tray** — Minimize to tray, quick prompt
6. ⬜ **Code Signing** — Windows installer (.msi/.exe)

---

## 6. Pipeline AI

### 6.1 System Prompt (SumoPod Mode)
10 aturan ketat:
1. Output HARUS HTML lengkap dari `<!DOCTYPE html>` sampai `</html>`
2. DILARANG React, Vue, Angular, Svelte (butuh build step)
3. Semua CSS di `<style>` tag
4. Semua JS di `<script>` tag
5. Boleh pakai CDN: Tailwind, Alpine.js, GSAP, Three.js
6. Body HARUS ada konten visible
7. Default: dark background, light text
8. Harus render di iframe tanpa server
9. Jangan truncate output
10. Mode edit: output LENGKAP, tidak boleh abbreviate

### 6.2 Parameter
- `temperature: 0.5` (deterministic)
- `max_tokens: 8192` (cukup untuk HTML besar)
- `stream: true` (SSE streaming untuk feedback real-time)
- Guard: reject jika respons < 200 karakter

### 6.3 Multi-turn Context
- Chat history (user + assistant messages) diekstrak dari steps
- Dikirim sebagai `messages` array ke LLM API (maks 6 pesan terakhir)
- Memberikan konteks percakapan untuk permintaan edit beruntun

### 6.4 HTML Parser
- Strip markdown fences (` ```html ... ``` `)
- Extract dari `<!DOCTYPE html>` atau `<html>`
- Auto-heal tag terpotong: `</style>` → `</script>` → `</body>` → `</html>`
- Fallback wrapper jika tidak ada `<html>` tag

---

## 7. Data Model

### 7.1 UserProject
```typescript
interface UserProject {
  id: string           // "proj-{timestamp}"
  userId: string
  name: string
  generatedHtml?: string
  steps: VibeAgentStep[]
  createdAt: string    // ISO time
  updatedAt: string    // ISO time
}
```

### 7.2 VibeAgentStep
```typescript
type PipelinePhase = 'thinking' | 'researching' | 'generating' | 'reviewing' | 'done'

interface VibeAgentStep {
  id: string
  type: 'user_message' | 'thinking' | 'read_files' | 'change_file' | 'run_terminal_command' | 'assistant_message' | 'error'
  title: string
  content: string
  timestamp: string
  status: 'running' | 'completed' | 'failed'
  agentGroup?: string         // 'thinker' | 'researcher-web' | 'editor' | 'reviewer' — untuk collapsible grouping
  pipelinePhase?: PipelinePhase  // untuk progress indicator
  affectedFile?: string       // nama file untuk deep-link ke CodeViewer
  durationMs?: number         // estimasi durasi step dalam milidetik
}
```

### 7.3 NeonUser
```typescript
interface NeonUser {
  id: string
  email: string
  name?: string
  membershipTier: 'regular' | 'pro' | 'special' | 'vip'
  expiredAt?: string | null
}
```

---

## 8. Design System

### 8.1 Color Palette
- Background: `#0b0f17` (slate-950), `#0f172a` (slate-900)
- Surface: `rgba(15, 23, 42, 0.75)` (glassmorphism)
- Primary: `#06b6d4` (cyan-500) → `#4f46e5` (indigo-500) → `#9333ea` (purple-500)
- Text: `#f1f5f9` (slate-100), `#94a3b8` (slate-400)

### 8.2 Typography
- Display: `'Outfit', sans-serif`
- Body: `'Inter', system-ui, sans-serif`
- Mono: `'Fira Code', monospace`

### 8.3 Effects
- Glassmorphism: `backdrop-filter: blur(16px)`
- Glow: `box-shadow: 0 0 25px -5px rgba(6, 182, 212, 0.35)`
- Gradient text: cyan → indigo → purple

---

## 9. File Structure

```
apps/desktop/
├── src/
│   ├── agents/
│   │   ├── vibe-coder.ts           # Custom agent: generate + research + review
│   │   └── vibe-reviewer.ts        # Custom agent: HTML/CSS/JS validation
│   ├── components/
│   │   ├── ChatPanel.tsx           # Sidebar kiri: prompt input + steps timeline
│   │   ├── CodeViewer.tsx          # Virtual file tree + debug log
│   │   ├── Header.tsx              # Top bar: project, model, user
│   │   ├── LivePreview.tsx         # iFrame preview (Blob URL)
│   │   ├── NeonAuthModal.tsx       # Login/signup modal
│   │   └── SettingsModal.tsx       # Provider & model config
│   ├── services/
│   │   ├── codebuff-integration.ts # Hybrid: Codebuff SDK + SumoPod fallback
│   │   ├── neon-auth.ts            # Neon Auth + localStorage session
│   │   └── sidecar-api.ts          # SumoPod LLM pipeline + HTML parser
│   ├── App.tsx                     # Root state + layout
│   ├── index.css                   # Design tokens + utility classes
│   └── main.tsx                    # React 19 entry
├── src-tauri/                      # Rust backend (Tauri 2.0)
│   ├── capabilities/default.json   # Permissions
│   ├── src/
│   │   ├── lib.rs                  # Commands + setup
│   │   └── main.rs                 # Binary entry
│   ├── Cargo.toml                  # Rust deps
│   ├── tauri.conf.json             # Tauri config
│   └── build.rs                    # Build script
├── vite.config.ts                  # Vite + Tauri compatibility
├── package.json                    # @koncoweb/desktop
├── index.html                      # HTML entry
└── CHANGELOG.md                    # Versi & perubahan
```
