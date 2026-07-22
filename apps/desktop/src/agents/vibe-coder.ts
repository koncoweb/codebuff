/**
 * KoncoVibe Vibe Coder Agent
 *
 * Custom agent definition yang kompatibel dengan Codebuff SDK.
 * Mengkombinasikan generasi kode HTML/CSS/JS dengan research dan review otomatis.
 *
 * Hybrid Mode:
 * - Dapat dijalankan via Codebuff SDK (membutuhkan CODEBUFF_API_KEY)
 * - Dapat dijalankan via SumoPod fallback (lihat codebuff-integration.ts)
 *
 * Saat KoncoVibe berjalan sebagai desktop app (Tauri), agent ini akan:
 * 1. Men-spawn researcher-web untuk cari inspirasi/referensi UI
 * 2. Generate kode HTML/CSS/JS self-contained
 * 3. Men-spawn vibe-reviewer untuk validasi kode
 * 4. Menulis file ke disk via write_file tool
 */
import type { AgentDefinition } from '@codebuff/sdk'

export const vibeCoderAgent: AgentDefinition = {
  id: 'vibe-coder',
  displayName: 'KoncoVibe Vibe Coder',
  model: 'anthropic/claude-sonnet-4.5',

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
  ],

  spawnableAgents: [
    'researcher-web',
    'code-reviewer',
  ],

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
10. Untuk mode EDIT: output LENGKAP HTML yang sudah diperbarui. JANGAN singkat dengan komentar seperti "<!-- same as before -->".`,

  spawnerPrompt: 'Generate atau edit aplikasi web HTML/CSS/JS self-contained. Gunakan untuk membuat landing page, komponen UI, atau aplikasi web sederhana.',

  outputMode: 'last_message',

  async *handleSteps({ prompt, logger }) {
    // Step 1: Think about the request
    logger.info('KoncoVibe: Menganalisis permintaan user...')
    yield {
      toolName: 'think_deeply',
      input: {
        topic: `Analisis permintaan user: "${prompt}". Tentukan struktur HTML, palette warna, dan library CDN yang dibutuhkan.`,
      },
    }

    // Step 2: Research if needed (web search untuk inspirasi)
    if (prompt.length > 50) {
      logger.info('KoncoVibe: Mencari referensi web...')
      yield {
        toolName: 'spawn_agents',
        input: {
          agents: [
            {
              agent_type: 'researcher-web',
              prompt: `Cari inspirasi dan best practices untuk: "${prompt.substring(0, 200)}". Fokus pada: desain modern, color palette, dan layout yang relevan.`,
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
