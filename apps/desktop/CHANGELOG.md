# Changelog — KoncoVibe Desktop App

Semua perubahan penting pada aplikasi Vibe Coding Desktop (`apps/desktop`) didokumentasikan di sini.

---

## [Unreleased] — 2026-07-23

### 🎯 Hard Task: Click-to-Inspect Visual Inspector

**Status:** ✅ Implementasi selesai

#### Perubahan

1. **Click-to-Inspect di LivePreview**
   - Sebelumnya: toggle inspector hanya menampilkan overlay info — tidak ada fungsionalitas click-to-edit
   - Sekarang: saat inspector mode aktif, script diinjeksi ke iframe HTML yang:
     - Menampilkan highlight overlay ungu saat hover element
     - Mengirim element info (tag, id, classes, text, CSS selector) via `postMessage` ke parent saat click
   - **File:** `LivePreview.tsx`

2. **Context chip di ChatPanel**
   - Element yang diklik muncul sebagai purple context chip di atas textarea
   - Menampilkan CSS selector dan preview text dari element
   - Tombol X untuk hapus context
   - Saat prompt dikirim, inspected element disertakan sebagai context: `[Element: selector — "text"] prompt`
   - **File:** `ChatPanel.tsx`

3. **App.tsx wiring**
   - State `inspectedElement` menghubungkan LivePreview → ChatPanel
   - `onInspectElement` callback dari LivePreview set state
   - `inspectedElement` + `onClearInspected` props ke ChatPanel
   - **File:** `App.tsx`

---

### 🚀 Medium Improvements: Streaming, Multi-turn, Persistence (5 Tasks)

**Status:** ✅ Implementasi selesai

#### Perubahan

1. **Streaming SSE Response**
   - Sebelumnya: `fetch()` non-streaming — user melihat typing indicator tanpa feedback incremental
   - Sekarang: `stream: true` + ReadableStream parsing — step content diupdate real-time setiap 500ms dengan progress "Sedang membuat kode... {N} karakter diterima."
   - SSE chunks (`data: {...}`) diparse incremental dengan TextDecoder
   - **File:** `sidecar-api.ts`

2. **Multi-turn Context**
   - Sebelumnya: setiap prompt dikirim tanpa history percakapan — prompt "edit halaman di atas" harus include full HTML lama
   - Sekarang: chat history (user + assistant messages) diekstrak dari steps dan dikirim sebagai `messages` array (maks 6 pesan terakhir untuk hemat token)
   - Tipe baru `ChatMessage` di-export dari `sidecar-api.ts`
   - **File:** `sidecar-api.ts`, `codebuff-integration.ts`, `App.tsx`

3. **Settings Persistence (localStorage)**
   - Sebelumnya: providerConfig (API key, baseUrl, model) hilang saat reload page
   - Sekarang: disimpan ke `localStorage` key `koncovibe_provider_config` dan di-restore saat init
   - **File:** `App.tsx`

4. **Provider Switching Fix**
   - Sebelumnya: memilih OpenAI/OpenRouter tidak mengubah baseUrl — tetap pakai field yang sama
   - Sekarang: `handleProviderChange()` auto-update baseUrl per provider:
     - SumoPod AI → `https://ai.sumopod.com/v1`
     - OpenAI Direct → `https://api.openai.com/v1`
     - OpenRouter → `https://openrouter.ai/api/v1`
   - **File:** `SettingsModal.tsx`

5. **CodeViewer Sync dengan LivePreview**
   - Sebelumnya: saat HTML baru di-generate, CodeViewer tidak auto-highlight file yang baru
   - Sekarang: prop `generationVersion` — increment pada setiap generasi, CodeViewer auto-select `index.html`
   - **File:** `CodeViewer.tsx`, `App.tsx`

---

### 🔧 Easy Wins: Bug Fixes & Security Improvements (12 Tasks)

**Status:** ✅ Implementasi selesai

#### Perubahan

1. **Stop button benar-benar membatalkan request (AbortController)**
   - `onStop` sebelumnya hanya `setIsRunning(false)` tanpa membatalkan fetch
   - Sekarang menggunakan `AbortController` yang benar-benar meng-abort fetch LLM
   - AbortError ditangani dengan graceful — tidak menampilkan error step
   - **File:** `App.tsx`, `sidecar-api.ts`, `codebuff-integration.ts`

2. **API key dipindahkan ke Vite env variable**
   - Hapus hardcoded API key `sk-ch86786...` dari 3 file source code
   - Buat `.env` (gitignored) dan `.env.example` (template) di `apps/desktop/`
   - Variabel: `VITE_SUMOPOD_API_KEY`, `VITE_SUMOPOD_BASE_URL`, `VITE_SUMOPOD_DEFAULT_MODEL`
   - **File:** `App.tsx`, `sidecar-api.ts`, `SettingsModal.tsx`, `.env`, `.env.example`

3. **Neon Auth fallback hanya saat network error**
   - Sebelumnya: setiap error (termasuk password salah) → auto-login sebagai `pro` user
   - Sekarang: hanya network error (offline/CORS) yang fallback ke demo mode dengan tier `regular`
   - Auth failure (401/403) menampilkan pesan error spesifik ke user
   - **File:** `neon-auth.ts`, `NeonAuthModal.tsx`

4. **Neon Auth config dipindahkan ke env variable**
   - URL backend dan project ID tidak lagi hardcoded di source
   - Variabel: `VITE_NEON_AUTH_BASE_URL`, `VITE_NEON_AUTH_PROJECT_ID`
   - **File:** `neon-auth.ts`, `.env`

5. **Fix getBackendMode logic**
   - Sebelumnya: return `'codebuff'` di Tauri, tapi SDK gagal di webview → error percuma setiap request
   - Sekarang: async check via `invoke('check_codebuff_sidecar')` — return codebuff hanya jika sidecar siap
   - **File:** `codebuff-integration.ts`

6. **Fix Step ID collision**
   - Sebelumnya: `step-${Date.now()}-N` rentan collision (ms berdekatan)
   - Sekarang: `crypto.randomUUID()` untuk semua step ID
   - Step running→completed menggunakan variabel ID yang disimpan (bukan re-generate)
   - **File:** `sidecar-api.ts`, `codebuff-integration.ts`

7. **Attach button di-disable dengan tooltip**
   - Tombol paperclip sebelumnya tidak punya handler → confusing
   - Sekarang: `disabled` + tooltip "Fitur lampiran segera hadir"
   - **File:** `ChatPanel.tsx`

8. **Fix label model count**
   - Sebelumnya: "35+ Models Available" padahal hanya 15 model
   - Sekarang: dynamic count dari `CURATED_LLM_MODELS.length`
   - **File:** `SettingsModal.tsx`

9. **Clean provider name dari debug log**
   - Hapus semua mention "SumoPod" dari debug log messages
   - Ganti dengan generic terms: "LLM API", "LLM Provider"
   - **File:** `sidecar-api.ts`, `codebuff-integration.ts`

10. **Reset debug logs saat switch project**
    - Sebelumnya: log dari project lama tetap muncul di project baru
    - Sekarang: `clearDebugLogs()` dipanggil saat `activeProjectId` berubah
    - **File:** `sidecar-api.ts` (new `clearDebugLogs()`), `App.tsx`

11. **Fix SettingsModal state sync**
    - Sebelumnya: local state hanya init dari props sekali → stale data jika props berubah
    - Sekarang: `useEffect` re-sync state saat modal dibuka
    - **File:** `SettingsModal.tsx`

12. **Fix project double-save race condition**
    - Sebelumnya: save effect memiliki `activeProjectId` di deps → data project lama tersimpan ke project baru saat switch
    - Sekarang: gunakan `useRef` untuk track `activeProjectId` — hapus dari deps
    - **File:** `App.tsx`

---

## [Sebelumnya] — 2026-07-22

### 💬 Chat UI Redesign: Bubble Layout + Compact Dark Mode

**Status:** ✅ Implementasi selesai

#### Perubahan

1. **Chat bubble layout (user kanan, AI kiri)**
   - Pesan user muncul sebagai bubble cyan di kanan dengan avatar bulat
   - Respons AI muncul sebagai bubble gelap di kiri dengan avatar sparkle
   - Agent group cards sejajar kiri dengan AI bubble

2. **Provider & model name disembunyikan**
   - Hapus semua mention "SumoPod", model ID, dan baseUrl dari UI
   - Step titles sekarang newbie-friendly: "Menganalisis...", "Menulis kode...", "Selesai!"
   - Badge model di header ChatPanel dihapus

3. **Icon & UI compact konsisten dark mode**
   - Semua icon diperkecil ke `w-2.5 h-2.5` atau `w-3 h-3` (sebelumnya `w-3.5`–`w-4`)
   - Avatar bulat `w-5 h-5` dengan border tipis
   - Padding dan gap diperkecil untuk tampilan compact
   - Font size `text-[9px]`–`text-[11px]` (sebelumnya `text-xs`–`text-sm`)
   - Semua tombol pakai rounded-lg dengan padding `p-1.5`

4. **User message tracking**
   - Tipe `user_message` baru di `VibeAgentStep`
   - User prompt emit sebagai step sebelum pipeline dimulai
   - Chat terlihat seperti percakapan natural (user → AI → user → AI)

---

### 🎨 UI/UX Overhaul: Chat Panel Modern Vibe Coding Experience

**Status:** ✅ Implementasi selesai

Redesign menyeluruh ChatPanel mengikuti pola UI/UX aplikasi vibe coding populer (Lovable, v0, Bolt.new, Google AI Studio) dengan memanfaatkan struktur multi-agent Codebuff SDK.

---

#### 1. Multiline Textarea dengan Auto-Grow

**Sebelum:** Single-line `<input>` — tidak bisa multiline, tidak bisa attach.
**Sesudah:** `<textarea>` auto-growing (1-5 baris) dengan `Enter` untuk kirim, `Shift+Enter` untuk baris baru. Tombol attach (paperclip) untuk lampirkan gambar referensi.

---

#### 2. Agent-Grouped Collapsible Pipeline View

**Sebelum:** Flat list — semua step tampil sebagai card terpisah tanpa grouping.
**Sesudah:** Steps dikelompokkan per agent (`thinker`, `researcher-web`, `editor`, `reviewer`) sebagai collapsible cards:
- Header menampilkan: nama agent, status (running/completed/failed), jumlah langkah, total durasi
- Auto-expand saat ada step running
- Auto-collapse 3 detik setelah semua step completed
- Klik header untuk toggle manual

---

#### 3. Pipeline Progress Indicator

Bar visual di header ChatPanel menampilkan 4 fase pipeline: `Think → Research → Code → Review`
- Fase aktif: pulsing cyan dengan icon
- Fase completed: emerald dengan checkmark
- Fase pending: slate gray

---

#### 4. Streaming UX: Typing Indicator + Blinking Caret

- **Typing dots** (3 bouncing dots) muncul saat agent bekerja tapi belum ada step baru
- **Status messages** per fase: "Menganalisis permintaan...", "Mencari referensi...", "Menulis kode...", "Memvalidasi..."
- **Blinking caret** `▋` di akhir assistant message yang sedang streaming

---

#### 5. Stop Button

Tombol stop (icon square, rose-colored) menggantikan tombol send saat agent sedang bekerja. User bisa membatalkan generasi kapan saja.

---

#### 6. Smart Auto-Scroll

- Auto-scroll ke bottom saat step baru ditambahkan
- **Pause otomatis** saat user manual scroll ke atas untuk membaca history
- **Jump-to-bottom floating button** muncul saat user tidak di bottom

---

#### 7. Post-Generation Status Card + Follow-up Suggestions

Setelah generasi selesai:
- **Status card** dengan gradient emerald-cyan: "Generasi Selesai" + tombol "Lihat Kode"
- **Follow-up suggestion chips**: "Tambahkan dark mode toggle", "Buat responsive untuk mobile", dll.

---

#### 8. Categorized Quick Prompts

Empty state sekarang punya tab kategori: 🚀 Landing Page, 📊 Dashboard, 🧩 Komponen — masing-masing dengan 2 prompt contoh.

---

#### 9. Inline Model Badge

Model LLM aktif ditampilkan sebagai badge kecil di header ChatPanel untuk visibility.

---

#### 10. Step → CodeViewer Deep-Link

Step yang menghasilkan file (mis. `write_file index.html`) punya tombol external-link yang langsung switch ke tab Code Viewer.

---

### 📁 File yang Dimodifikasi

| File | Perubahan |
|:---|:---|
| `src/components/ChatPanel.tsx` | Full rewrite: multiline, grouping, typing indicator, pipeline bar, stop, auto-scroll |
| `src/services/sidecar-api.ts` | `VibeAgentStep` tambah `agentGroup`, `pipelinePhase`, `affectedFile`, `durationMs`. Semua onStep calls dikategorisasi |
| `src/services/codebuff-integration.ts` | `mapCodebuffEventToStep` kirim agentGroup + pipelinePhase. Tambah `mapToolNameToAgentGroup` & `mapToolNameToPipelinePhase` |
| `src/App.tsx` | Pass `onStop`, `onSwitchToCode`, `activeModel` props ke ChatPanel |
| `src/index.css` | Animations: `typing-dot`, `blink`, `slide-in`. Gradient utilities. Details/summary styling |

---

### 🏗️ Arsitektur Baru: Hybrid Codebuff Integration + Tauri 2.0 Foundation

**Status:** ✅ Implementasi selesai — menunggu build Tauri (butuh Rust toolchain)

#### Ringkasan Perubahan

KoncoVibe kini siap menjadi **aplikasi desktop Windows native** dengan Tauri 2.0 (Rust + WebView2), sekaligus mengintegrasikan **Codebuff SDK** secara hybrid untuk multi-agent pipeline.

---

#### 1. CodeViewer: Static Snippets → Virtual File Tree Nyata

**Masalah:** CodeViewer menampilkan code snippet hardcoded (`codeSnippets` record) alih-alih file proyek yang sebenarnya digenerate.

**Solusi:**
- Parser `parseHtmlToVirtualFiles()` mengekstrak HTML/CSS/JS dari `generatedHtml` menjadi virtual file tree
- Setiap tag `<style>` diekstrak menjadi `style.css` terpisah
- Setiap tag `<script>` inline diekstrak menjadi `script.js` terpisah
- Metadata proyek ditampilkan sebagai `project.json` (baris, ukuran, jumlah block CSS/JS)
- Icon dan badge warna berbeda per tipe file (HTML=orange, CSS=blue, JS=yellow, JSON=emerald)
- Empty state ketika belum ada kode yang digenerate

**File:** `src/components/CodeViewer.tsx`

---

#### 2. Hybrid Codebuff SDK Integration

**Masalah:** `@codebuff/sdk` dependency tertera di package.json tapi tidak pernah dipakai — semua pipeline LLM adalah direct `fetch()` ke SumoPod.

**Solusi:** Arsitektur hybrid dengan auto-fallback:

```
User Prompt → codebuff-integration.ts → [deteksi mode]
                                          ↓
                              ┌─── Codebuff SDK (desktop/Tauri)
                              │    - Multi-agent: vibe-coder → researcher-web → code-reviewer
                              │    - handleSteps generator untuk kontrol programatik
                              │    - Real file I/O via write_file, str_replace tools
                              │    - Fallback ke SumoPod jika SDK error
                              │
                              └─── SumoPod Fallback (browser mode)
                                   - Pipeline existing (sidecar-api.ts)
                                   - Direct fetch ke OpenAI-compatible API
```

**File baru:**
- `src/agents/vibe-coder.ts` — Custom agent definition dengan `handleSteps` generator
- `src/agents/vibe-reviewer.ts` — Reviewer agent untuk validasi HTML/CSS/JS
- `src/services/codebuff-integration.ts` — Hybrid service dengan auto-fallback

**File diubah:**
- `src/App.tsx` — `sendVibePrompt()` → `sendVibeCodingPrompt()` (hybrid service)

---

#### 3. Tauri 2.0 Desktop Foundation

**Tujuan:** Membungkus web app Vite+React menjadi desktop app Windows native dengan jalur menuju Rust.

**Struktur baru:**
```
apps/desktop/
├── src-tauri/              # Rust backend (Tauri 2.0)
│   ├── Cargo.toml          # Dependencies: tauri 2, tauri-plugin-shell, serde
│   ├── tauri.conf.json     # Window config, bundle settings, beforeDevCommand
│   ├── build.rs            # Tauri build script
│   ├── capabilities/
│   │   └── default.json    # Permission set (core, shell)
│   └── src/
│       ├── main.rs         # Binary entry → calls lib::run()
│       └── lib.rs          # Tauri commands: get_app_info, check_codebuff_sidecar, save_html_to_disk
├── vite.config.ts          # Updated: strictPort, Tauri env prefix, chrome105 target
└── package.json            # Updated: @tauri-apps/cli, @tauri-apps/api, @tauri-apps/plugin-shell
```

**Rust Commands (siap pakai):**
- `get_app_info()` — nama, versi, platform, arch
- `check_codebuff_sidecar()` — deteksi sidecar binary (TODO: implement saat packaging)
- `save_html_to_disk(content, filename)` — simpan HTML ke filesystem (TODO: plugin-dialog)

**Roadmap Tauri:**
1. ✅ Foundation: window, config, commands
2. ⬜ Sidecar: bundle Codebuff SDK sebagai `externalBin` dengan JSON-RPC over stdio
3. ⬜ Auto-updater: tauri-plugin-updater
4. ⬜ Code signing: Windows installer (.msi/.exe)

---

### 📁 File yang Dimodifikasi/Dibuat

| File | Aksi | Perubahan |
|:---|:---|:---|
| `src/components/CodeViewer.tsx` | Refactor | Virtual file tree dari generatedHtml, hapus static snippets |
| `src/agents/vibe-coder.ts` | **Baru** | Custom agent definition dengan handleSteps |
| `src/agents/vibe-reviewer.ts` | **Baru** | HTML/CSS/JS reviewer agent |
| `src/services/codebuff-integration.ts` | **Baru** | Hybrid service: Codebuff SDK + SumoPod fallback |
| `src/App.tsx` | Edit | Pakai sendVibeCodingPrompt, teruskan props ke CodeViewer |
| `src-tauri/tauri.conf.json` | **Baru** | Tauri 2.0 config |
| `src-tauri/Cargo.toml` | **Baru** | Rust dependencies |
| `src-tauri/src/main.rs` | **Baru** | Binary entry point |
| `src-tauri/src/lib.rs` | **Baru** | Tauri commands + setup |
| `src-tauri/build.rs` | **Baru** | Tauri build script |
| `src-tauri/capabilities/default.json` | **Baru** | Permission set |
| `vite.config.ts` | Edit | Tauri compatibility: strictPort, envPrefix, chrome105 |
| `package.json` | Edit | Tauri deps + scripts, rename ke @koncoweb/desktop |

---

## [Sebelumnya] — 2026-07-22

### 🐛 Critical Bug Fix: Live Preview Tidak Tampil (Blank Black Page)

**Dilaporkan oleh:** User (pengujian langsung — membuat web SD, melihat preview, lalu mengedit teks hero)
**Status:** ✅ Terselesaikan

---

#### Akar Masalah (Root Cause Analysis)

Terdapat **tiga lapisan bug yang bersamaan** pada pipeline AI → HTML → Preview:

| Layer | Bug | Dampak |
|:---|:---|:---|
| **LLM Request** | `max_tokens: 2500` terlalu kecil | Kode HTML terpotong di tengah tag `<style>` atau `<script>` |
| **HTML Parser** | `extractCleanHtml()` hanya menutup `</html>` tanpa menutup tag `<style>`/`<script>` yang masih terbuka | Browser menganggap seluruh HTML di bawahnya sebagai isi CSS/JS → blank page |
| **iFrame Render** | `doc.write()` dan `srcDoc` berjalan **bersamaan** (race condition). Lalu `sandbox="allow-same-origin"` + `srcDoc` memblokir JavaScript secara diam-diam (silent JS failure) | CSS termuat (background hitam muncul), tapi konten body yang bergantung pada JS tidak render |

---

#### Perbaikan yang Diterapkan

##### 1. Tingkatkan Batas Token LLM
**File:** `src/services/sidecar-api.ts`

```diff
- max_tokens: 2500,
+ max_tokens: 8192,
```

Mencegah respons HTML terpotong di tengah-tengah pada dokumen besar (terutama saat mode *edit/update* yang mengirim HTML lama sebagai konteks).

---

##### 2. Auto-Healing Tag HTML yang Terpotong
**File:** `src/services/sidecar-api.ts` — fungsi `extractCleanHtml()`

```diff
  if (cleaned.includes('<html') && !cleaned.includes('</html>')) {
-   cleaned += '\n</html>'
+   // Tutup tag dalam urutan terbalik yang benar
+   if (cleaned.includes('<style') && !cleaned.includes('</style>')) cleaned += '\n</style>'
+   if (cleaned.includes('<script') && !cleaned.includes('</script>')) cleaned += '\n</script>'
+   if (cleaned.includes('<body') && !cleaned.includes('</body>')) cleaned += '\n</body>'
+   cleaned += '\n</html>'
  }
```

---

##### 3. System Prompt yang Lebih Ketat
**File:** `src/services/sidecar-api.ts`

Prompt lama hanya berkata "output a complete HTML page". Prompt baru menyertakan 10 aturan eksplisit:
- ❌ Larang React, Vue, Angular, Svelte (membutuhkan build step)
- ✅ Wajib semua CSS di dalam `<style>` tag
- ✅ Wajib semua JS di dalam `<script>` tag
- ✅ Body HARUS memiliki konten HTML yang langsung terlihat (tidak bergantung penuh pada JS)
- ❌ Larang singkatan seperti `<!-- same as before -->` saat mode edit

Turunkan `temperature` dari `0.7` → `0.5` untuk output kode yang lebih deterministik dan konsisten.

---

##### 4. Guard Validasi Respons AI
**File:** `src/services/sidecar-api.ts`

```typescript
if (rawContent.trim().length < 200) {
  throw new Error(`Respons AI terlalu pendek. Kemungkinan model gagal menghasilkan HTML yang valid.`)
}
```

---

##### 5. Migrasi Injeksi iFrame: `doc.write()` + `srcDoc` → **Blob URL** ⭐ Fix Utama
**File:** `src/components/LivePreview.tsx`

Ini adalah perbaikan paling kritis. Sebelumnya ada **dua mekanisme injeksi yang bersaing**:
- `srcDoc` prop (deklaratif React)
- `useEffect` dengan `doc.write()` (imperatif)

Keduanya dieksekusi hampir bersamaan, menyebabkan race condition. Lalu saat `srcDoc` + `sandbox="allow-same-origin"` digabungkan, browser modern memblokir JavaScript secara diam-diam.

**Solusi: Blob URL**

```typescript
// Buat Blob dari string HTML, lalu buat URL sementara
const blob = new Blob([activeHtmlContent], { type: 'text/html; charset=utf-8' })
const url = URL.createObjectURL(blob)
setBlobUrl(url)

// Revoke URL lama untuk mencegah memory leak
return () => { URL.revokeObjectURL(url) }
```

```tsx
// iframe menggunakan blob URL sebagai src biasa — tanpa sandbox
<iframe
  key={blobUrl || 'server-mode'}
  src={useFallback ? (blobUrl || undefined) : previewUrl}
  title="KoncoVibe Live App Preview"
  className="w-full flex-1 bg-white border-0"
/>
```

**Keunggulan Blob URL vs Alternatif lain:**

| Metode | JS Berjalan | CDN Bisa Dimuat | Memory Safe | Race Condition |
|:---|:---:|:---:|:---:|:---:|
| `doc.write()` saja | ✅ | ✅ | ✅ | ⚠️ Timing sensitive |
| `srcDoc` tanpa sandbox | ✅ | ✅ | ✅ | ✅ |
| `srcDoc` + `sandbox="allow-same-origin"` | ❌ Silent fail | ❌ | ✅ | ✅ |
| **Blob URL** ⭐ | ✅ | ✅ | ✅ (revoke) | ✅ |

---

#### Pelajaran Teknis (Lessons Learned)

1. **Jangan gabungkan dua mekanisme injeksi iframe** — pilih salah satu: deklaratif (`srcDoc`/`src`) atau imperatif (`doc.write()`), jangan kedua-duanya.

2. **`sandbox="allow-same-origin"` + `srcDoc` adalah kombinasi berbahaya** — Browser memperlakukan ini sebagai potensi kerentanan keamanan dan memblokir JS tanpa pesan error yang jelas. Symptomnya menyesatkan: CSS jalan (background hitam muncul), tapi konten body tidak tampil.

3. **Blob URL adalah solusi terbaik untuk dynamic iframe injection** — Memberikan iframe URL nyata (bukan null-origin atau data URI), memungkinkan semua script dan CDN eksternal berjalan normal, dan tidak memerlukan sandbox.

4. **`max_tokens` yang terlalu kecil adalah penyebab tersembunyi** — HTML terpotong di tengah `<style>` membuat browser menginterpretasikan sisa HTML sebagai CSS, menghasilkan halaman kosong tanpa error yang jelas di console.

5. **Selalu tutup tag dalam urutan terbalik yang benar** — Jika ada truncation, urutan penutupan yang benar adalah: `</style>` → `</script>` → `</body>` → `</html>`, bukan langsung `</html>`.

---

#### Verifikasi Berhasil

Pengujian yang dilakukan user setelah perbaikan:
- ✅ Membuat proyek baru (web SD) → Preview muncul langsung
- ✅ Melihat preview → Konten terlihat jelas, tidak blank
- ✅ Mengedit teks di hero section → Preview diperbarui dengan benar

---

### 📁 File yang Dimodifikasi

| File | Perubahan |
|:---|:---|
| `src/services/sidecar-api.ts` | `max_tokens` 2500→8192, system prompt baru, auto-heal parser, validasi guard |
| `src/components/LivePreview.tsx` | Hapus `doc.write()`, hapus `srcDoc`, implementasi Blob URL |
