/**
 * KoncoVibe Vibe Coder Agent
 *
 * Custom agent definition yang kompatibel dengan Codebuff SDK.
 * Mengkombinasikan generasi kode HTML/CSS/JS dengan research dan review otomatis.
 *
 * Hybrid Mode:
 * - Dapat dijalankan via Codebuff SDK sidecar (desktop/Tauri)
 * - Dapat dijalankan via SumoPod fallback (lihat codebuff-integration.ts)
 *
 * Fitur:
 * 1. Men-spawn researcher-web untuk cari inspirasi/referensi UI
 * 2. Generate kode HTML/CSS/JS self-contained
 * 3. Men-spawn vibe-reviewer untuk validasi kode
 * 4. Menulis file ke disk via write_file tool
 * 5. MCP servers: Filesystem, GitHub, Playwright, Supabase
 * 6. Context-pruner untuk token efficiency
 */
import type { AgentDefinition } from '@codebuff/sdk'

export const vibeCoderAgent: AgentDefinition = {
  id: 'vibe-coder',
  displayName: 'KoncoVibe Vibe Coder',
  model: 'anthropic/claude-sonnet-4.5',

  // Reasoning untuk efisiensi: effort medium cukup, tidak perlu max
  reasoningOptions: {
    enabled: true,
    effort: 'medium',
    exclude: false,
  },

  toolNames: [
    'write_file',
    'str_replace',
    'read_files',
    'run_terminal_command',
    'web_search',
    'read_url',
    'think_deeply',
    'set_output',
    'spawn_agents',
    'ask_user',
    // MCP tools tersedia otomatis dari mcpServers di bawah.
    // Format: 'mcpServerName/toolName' untuk limit tools tertentu,
    // atau biarkan tanpa prefix untuk akses semua tools dari server.
  ],

  spawnableAgents: [
    'researcher-web',
    'code-reviewer',
    'context-pruner',
  ],

  // MCP Servers — Codebuff SDK akan otomatis connect, discover tools,
  // dan membuatnya tersedia untuk agent. Env vars ($VAR) di-resolve
  // oleh Codebuff's env-var substitution.
  mcpServers: {
    // Filesystem: baca/tulis file lokal proyek
    filesystem: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    },
    // GitHub: kelola repo, PR, issues
    github: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: '$GITHUB_TOKEN',
      },
    },
    // Playwright: otomasi browser, screenshot, E2E test
    playwright: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@playwright/mcp'],
    },
    // Supabase: akses database & auth
    supabase: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@supabase/mcp-server-supabase'],
      env: {
        SUPABASE_ACCESS_TOKEN: '$SUPABASE_TOKEN',
      },
    },
  },

  instructionsPrompt: `Anda adalah KoncoVibe AI, asisten vibe coding expert yang menghasilkan aplikasi web HTML/CSS/JS self-contained.

ATURAN MUTLAK (ikuti semua atau output akan GAGAL):
1. Output HARUS berupa HTML lengkap mulai dari <!DOCTYPE html> hingga </html>.
2. DILARANG menggunakan React, Vue, Angular, Svelte, atau framework yang membutuhkan build step.
3. Semua CSS HARUS di dalam tag <style> di <head>. Tidak boleh file .css eksternal.
4. Semua JavaScript HARUS di dalam tag <script> di bawah <body>. Tidak boleh file .js eksternal.
5. BOLEH menggunakan CDN terpercaya: Tailwind CDN (https://cdn.tailwindcss.com), Alpine.js, GSAP, Three.js.
6. <body> HARUS berisi konten HTML yang terlihat (teks, tombol, kartu) — TIDAK boleh hanya tag <script>.
7. Default background: gelap (#0b0f17 atau #0f172a). Default text: putih/terang.
8. Halaman HARUS terlihat benar saat dimuat di <iframe> tanpa server atau build process.
9. JANGAN truncate output. Output LENGKAP dari <!DOCTYPE html> sampai </html>.
10. Untuk mode EDIT: output LENGKAP HTML yang sudah diperbarui. JANGAN singkat dengan komentar seperti "<!-- same as before -->".

TOKEN EFFICIENCY:
- Gunakan str_replace untuk editing presisi, HINDARI write_file untuk rewrite seluruh file kecuali membuat file baru.
- Jika user memberikan ELEMENT CONTEXT (selector, tag, dll), edit HANYA elemen tersebut.
- Gunakan MCP tools (filesystem, github, playwright, supabase) ketika relevan untuk akses data eksternal.
- Ringkas output tool yang panjang sebelum menyimpan ke context.`,

  spawnerPrompt: 'Generate atau edit aplikasi web HTML/CSS/JS self-contained. Gunakan untuk membuat landing page, komponen UI, atau aplikasi web sederhana.',

  outputMode: 'last_message',

  *handleSteps({ prompt, logger }) {
    const userPrompt = prompt ?? ''
    // Step 1: Think about the request
    logger.info('KoncoVibe: Menganalisis permintaan user...')
    yield {
      toolName: 'think_deeply',
      input: {
        thought: `Analisis permintaan user: "${userPrompt}". Tentukan struktur HTML, palette warna, dan library CDN yang dibutuhkan.`,
      },
    }

    // Step 2: Research if needed (web search untuk inspirasi)
    if (userPrompt.length > 50) {
      logger.info('KoncoVibe: Mencari referensi web...')
      yield {
        toolName: 'spawn_agents',
        input: {
          agents: [
            {
              agent_type: 'researcher-web',
              prompt: `Cari inspirasi dan best practices untuk: "${userPrompt.substring(0, 200)}". Fokus pada: desain modern, color palette, dan layout yang relevan.`,
            },
          ],
        },
      }
    }

    // Step 3: Generate the code (LLM decides what to write)
    logger.info('KoncoVibe: Generating kode HTML/CSS/JS...')
    yield 'STEP_ALL'

    // Step 4: Review the generated code
    logger.info('KoncoVibe: Validasi kode...')
    yield {
      toolName: 'spawn_agents',
      input: {
        agents: [
          {
            agent_type: 'code-reviewer',
            prompt: 'Review kode HTML/CSS/JS yang baru saja digenerate. Pastikan: tidak ada tag yang tidak ditutup, CSS valid, JS tidak ada error syntax, dan halaman akan render dengan benar di iframe.',
          },
        ],
      },
    }
  },
}

export default vibeCoderAgent
