# KoncoVibe — Handoff Document

> **Tujuan:** Dokumen ini untuk melanjutkan development KoncoVibe di chat/session baru.
> **Dibuat:** 2026-07-22
> **Diperbarui:** 2026-07-23
> **Status Proyek:** Alpha — Web preview berjalan, desktop Tauri foundation siap

---

## 1. Cara Mulai Cepat

```bash
# Install dependencies
cd c:\projects\koncoweb
bun install

# Jalankan web preview (browser mode)
bun run dev:desktop
# → buka http://localhost:5173/

# Jalankan desktop app (butuh Rust toolchain, sudah terinstall: rustc 1.93.0)
cd apps/desktop
bun run tauri:dev
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
| Typing indicator + blinking caret | `src/components/ChatPanel.tsx` + `index.css` | ✅ |
| Stop button (AbortController — benar-benar membatalkan fetch) | `src/components/ChatPanel.tsx` + `App.tsx` | ✅ |
| Smart auto-scroll + jump-to-bottom | `src/components/ChatPanel.tsx` | ✅ |
| Post-gen status card + follow-up chips | `src/components/ChatPanel.tsx` | ✅ |
| Inspector context chip (element dari LivePreview) | `src/components/ChatPanel.tsx` | ✅ |
| Attach button (disabled + tooltip "segera hadir") | `src/components/ChatPanel.tsx` | ✅ |
| Streaming SSE Response (progress real-time setiap 500ms) | `src/services/sidecar-api.ts` | ✅ |
| Multi-turn Context (chat history, maks 6 pesan) | `src/services/sidecar-api.ts` + `App.tsx` | ✅ |
| Virtual File Tree (index.html, style.css, script.js) | `src/components/CodeViewer.tsx` | ✅ |
| CodeViewer auto-sync (auto-select index.html saat generate) | `src/components/CodeViewer.tsx` | ✅ |
| Live Preview via Blob URL | `src/components/LivePreview.tsx` | ✅ |
| Click-to-Inspect (highlight element → context ke chat) | `src/components/LivePreview.tsx` | ✅ |
| LLM generation pipeline (SumoPod fallback, streaming SSE) | `src/services/sidecar-api.ts` | ✅ |
| Hybrid Codebuff integration (async sidecar check) | `src/services/codebuff-integration.ts` | ✅ |
| Neon Auth (fallback hanya saat network error, tier `regular`) | `src/services/neon-auth.ts` | ✅ |
| Multi-project management (localStorage + debug log reset) | `src/App.tsx` | ✅ |
| Settings modal (BYOK, provider switching, persistence) | `src/components/SettingsModal.tsx` | ✅ |
| API key via Vite env variable (`.env` + `.env.example`) | `.env` + 3 source files | ✅ |
| Neon Auth config via env variable | `.env` + `neon-auth.ts` | ✅ |
| Tauri 2.0 foundation (Rust) | `src-tauri/` | ✅ Foundation |
| Custom agent definitions (vibe-coder, vibe-reviewer) | `src/agents/` | ✅ |

### ⚠️ Sisa Kendala (Belum Diselesaikan)

| Masalah | Lokasi | Detail |
|:---|:---|:---|
| **Codebuff SDK tidak jalan di browser/Tauri webview** | `codebuff-integration.ts` | `getBackendMode()` sekarang async check `invoke('check_codebuff_sidecar')`, tapi sidecar binary belum di-bundle. Selalu fallback ke SumoPod. |
| **Tauri build belum diverifikasi** | `src-tauri/` | Foundation ada tapi belum pernah di-compile. `@codebuff/sdk` import Node.js modules yang gagal di rollup build. |
| **Production build gagal** | `vite.config.ts` | `@codebuff/sdk` import `node:module` (`createRequire`) yang tidak kompatibel browser. Perlu `external` config atau dynamic import yang di-tree-shake. |
| **Attach/file upload belum diimplementasi** | `ChatPanel.tsx` | Tombol di-disabled dengan tooltip. Full upload gambar = task future. |

---

## 3. Kendala yang Dihadapi Saat Ini

### 3.1 Codebuff SDK Tidak Bisa Jalan di Browser
**Masalah:** `@codebuff/sdk` membutuhkan runtime Node/Bun dengan akses filesystem. Di browser (Vite dev mode), `import('@codebuff/sdk')` akan gagal.

**Status:** `getBackendMode()` sekarang async — cek `invoke('check_codebuff_sidecar')` di Tauri. Karena sidecar belum di-bundle, selalu fallback ke SumoPod tanpa error percuma.

**Yang perlu dilakukan:**
- Saat Tauri sidecar siap, bundle Codebuff SDK sebagai `externalBin` dengan JSON-RPC over stdio
- Atau: gunakan `@tauri-apps/plugin-shell` untuk spawn Bun process yang load SDK

### 3.2 Tauri Build Belum Diverifikasi
**Masalah:** `src-tauri/` foundation sudah ada, tapi belum pernah di-compile/di-run dengan `bun run tauri:dev`.

**Yang perlu dilakukan:**
```bash
cd apps/desktop
bun run tauri:dev
```
Kemungkinan error pertama:
- Icon files belum ada di `src-tauri/icons/` → generate dengan `bun run tauri icon path/to/icon.png`
- `tauri.conf.json` schema URL mungkin perlu update ke `https://schema.tauri-config/v2`
- WebView2 runtime belum terinstall di Windows 10 (pre-installed di Windows 11)

### 3.3 Production Build Gagal (Rollup)
**Masalah:** `bun run build` gagal karena `@codebuff/sdk` (`sdk/dist/index.mjs`) import `createRequire` dari `node:module` yang tidak kompatibel dengan browser bundle.

**Yang perlu dilakukan:**
- Tambahkan `@codebuff/sdk` ke `build.rollupOptions.external` di `vite.config.ts`
- Atau: pisahkan import `@codebuff/sdk` ke file terpisah yang di-load hanya saat Tauri mode aktif (dynamic import yang di-tree-shake di browser build)
- Atau: gunakan `resolve.alias` untuk mock SDK di browser build

### ~~3.4 Streaming~~ ✅ Selesai
Streaming SSE sudah diimplementasikan. `sendVibePrompt()` sekarang menggunakan `stream: true` + ReadableStream parsing. Step content diupdate real-time setiap 500ms.

### ~~3.5 Multi-turn Context~~ ✅ Selesai
Chat history (user + assistant messages) diekstrak dari steps dan dikirim sebagai `messages` array (maks 6 pesan terakhir).

---

## 4. Next Steps Prioritas

### ~~Prioritas TINGGI~~ ✅ Semua Selesai
1. ~~**Streaming LLM response**~~ — ✅ SSE streaming dengan progress real-time
2. ~~**AbortController untuk Stop button**~~ — ✅ Benar-benar membatalkan fetch
3. ~~**Multi-turn context**~~ — ✅ Chat history dikirim sebagai messages array
4. ~~**Pindahkan API key ke env/backend**~~ — ✅ Vite env variable (`.env`)
5. **Verifikasi Tauri build** — jalankan `bun run tauri:dev` dan fix error (belum dilakukan)
6. **Fix production build** — `@codebuff/sdk` import `node:module` yang gagal di rollup

### ~~Prioritas SEDANG~~ ✅ Selesai
7. ~~**File upload (attach)**~~ — ✅ Disabled + tooltip (full implementation = task future)
8. **Tauri sidecar untuk Codebuff SDK** — bundle SDK sebagai externalBin
9. **Codebuff SDK integration test** — pastikan `client.run()` bekerja di Tauri env
10. **localStorage → Tauri FS** — pindahkan project persistence ke filesystem native
11. **Export project** — save HTML ke disk via `save_html_to_disk` Rust command
12. ~~**Settings persistence**~~ — ✅ localStorage `koncovibe_provider_config`
13. ~~**Provider switching**~~ — ✅ baseUrl auto-update per provider
14. ~~**CodeViewer sync**~~ — ✅ Auto-select index.html saat generate
15. ~~**Debug log reset per project**~~ — ✅ `clearDebugLogs()` saat switch project

### Prioritas RENDAH
16. ~~**Click-to-inspect di LivePreview**~~ — ✅ Inspector script + context chip
17. **Template gallery** — pre-built templates sebagai starting point
18. **Diff mode** — visual diff antar generasi
19. **Auto-updater** — tauri-plugin-updater untuk update otomatis
20. **System tray** — minimize to tray

---

## 5. File Index Penting

### Komponen UI
| File | Peran |
|:---|:---|
| `apps/desktop/src/App.tsx` | Root state: user, projects, model, layout. Panggilan `sendVibeCodingPrompt()` |
| `apps/desktop/src/components/ChatPanel.tsx` | Chat bubble layout, agent grouping, pipeline bar, input |
| `apps/desktop/src/components/CodeViewer.tsx` | Virtual file tree dari generatedHtml |
| `apps/desktop/src/components/LivePreview.tsx` | iframe preview via Blob URL |
| `apps/desktop/src/components/Header.tsx` | Top bar: project selector, model selector, user menu |
| `apps/desktop/src/components/SettingsModal.tsx` | Provider/key/model config (BYOK) |
| `apps/desktop/src/components/NeonAuthModal.tsx` | Login/signup |

### Services
| File | Peran |
|:---|:---|
| `apps/desktop/src/services/codebuff-integration.ts` | **Hybrid entry point** — auto-detect Codebuff SDK vs SumoPod. Emit `user_message` step. |
| `apps/desktop/src/services/sidecar-api.ts` | SumoPod LLM pipeline. HTML parser `extractCleanHtml()`. Debug log system. `VibeAgentStep` type. |
| `apps/desktop/src/services/neon-auth.ts` | Neon Auth + localStorage session. Fallback demo session. |

### Agent Definitions
| File | Peran |
|:---|:---|
| `apps/desktop/src/agents/vibe-coder.ts` | Custom agent: think → research → generate → review. `handleSteps` generator. |
| `apps/desktop/src/agents/vibe-reviewer.ts` | HTML/CSS/JS reviewer agent (validation only). |

### Tauri / Rust
| File | Peran |
|:---|:---|
| `apps/desktop/src-tauri/src/lib.rs` | Rust commands: `get_app_info`, `check_codebuff_sidecar`, `save_html_to_disk` |
| `apps/desktop/src-tauri/src/main.rs` | Binary entry → calls `lib::run()` |
| `apps/desktop/src-tauri/tauri.conf.json` | Window config, bundle settings, beforeDevCommand |
| `apps/desktop/src-tauri/Cargo.toml` | Rust dependencies |

### Dokumentasi
| File | Peran |
|:---|:---|
| `requirement.md` | Spec lengkap: fitur, arsitektur, data model, design system |
| `apps/desktop/CHANGELOG.md` | Log perubahan per versi |
| `docs/HANDOFF.md` | Dokumen ini — handoff untuk chat baru |
| `docs/ARCHITECTURE.md` | Diagram alur lengkap |

---

## 6. Perintah Berguna

```bash
# Development
bun run dev:desktop              # Vite dev server (port 5173)
cd apps/desktop && bun run tauri:dev  # Tauri desktop app

# Build
cd apps/desktop && bun run build      # Vite build saja
cd apps/desktop && bun run tauri:build # Tauri full build (.msi/.exe)

# Dependencies
bun install                      # Install semua workspace deps

# Debug
# Buka browser DevTools di http://localhost:5173
# CodeViewer tab "Debug Log" menampilkan real-time sidecar logs
```

---

## 7. Catatan Penting untuk Chat Baru

1. **Baca `requirement.md` dulu** — spec lengkap fitur & data model
2. **Baca `docs/ARCHITECTURE.md`** — diagram alur hybrid integration
3. **API key ada di `.env`** (bukan hardcoded di source) — copy `.env.example` ke `.env` dan isi. File `.env` sudah di-gitignore.
4. **`@codebuff/sdk` dependency** dipakai oleh `src/agents/vibe-coder.ts` dan `src/agents/vibe-reviewer.ts` — jangan remove. Tapi `import('@codebuff/sdk')` hanya terjadi saat `getBackendMode()` return `'codebuff'` (belum pernah, karena sidecar belum di-bundle).
5. **VibeAgentStep type** ada di `sidecar-api.ts` — jika tambah field, update juga `codebuff-integration.ts` dan `ChatPanel.tsx`
6. **ChatMessage type** baru ada di `sidecar-api.ts` — untuk multi-turn context
7. **Provider name disembunyikan dari UI** — jangan tambahkan kembali mention SumoPod/model di step titles, chat bubbles, atau debug log
8. **Compact dark mode** — semua icon `w-2.5 h-2.5`–`w-3 h-3`, font `text-[9px]`–`text-[11px]`. Jaga konsistensi.
9. **`crypto.randomUUID()`** dipakai untuk semua step ID — jangan kembali ke `Date.now()` pattern
10. **Settings persistence** — providerConfig disimpan ke `localStorage` key `koncovibe_provider_config`
11. **Production build masih gagal** — `@codebuff/sdk` import `node:module`. Lihat section 3.3 untuk solusi.
12. **Dev server** — `bun run dev` di `apps/desktop/` → `http://localhost:5173/`
