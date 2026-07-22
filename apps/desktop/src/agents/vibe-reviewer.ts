/**
 * KoncoVibe Vibe Reviewer Agent
 *
 * Custom reviewer khusus untuk validasi kode HTML/CSS/JS yang digenerate.
 * Tidak melakukan edit — hanya memberikan feedback dan saran perbaikan.
 *
 * Dipanggil oleh vibe-coder agent setelah generasi kode.
 */
import type { AgentDefinition } from '@codebuff/sdk'

export const vibeReviewerAgent: AgentDefinition = {
  id: 'vibe-reviewer',
  displayName: 'KoncoVibe Code Reviewer',

  model: 'anthropic/claude-sonnet-4.5',

  toolNames: [
    'read_files',
    'set_output',
  ],

  // Tidak bisa spawn agent lain — reviewer adalah terminal agent
  spawnableAgents: [],

  includeMessageHistory: true,

  instructionsPrompt: `Anda adalah reviewer kode HTML/CSS/JS yang teliti (Nit Picker).

Tugas Anda: review kode yang baru saja digenerate dan berikan feedback konstruktif.

CHECKLIST REVIEW (cek semua):
1. HTML: Semua tag dibuka dan ditutup dengan benar (</div>, </body>, </html>, dll)
2. CSS: Tidak ada syntax error di <style> block. Properti CSS valid.
3. JS: Tidak ada syntax error di <script> block. Variabel terdefinisi sebelum digunakan.
4. ACCESSIBILITY: Ada alt text pada <img>, label pada <input>, semantic HTML.
5. RESPONSIVE: Layout akan terlihat benar di mobile dan desktop.
6. PERFORMANCE: Tidak ada operasi blocking yang berat. CDN lazy-loaded jika memungkinkan.
7. SECURITY: Tidak ada inline event handler yang berbahaya. Tidak ada eval().

OUTPUT: Berikan list masalah yang ditemukan (jika ada) dan saran perbaikan.
Jika kode sudah baik, katakan "Kode valid dan siap untuk preview."`,

  spawnerPrompt: 'Review kode HTML/CSS/JS yang baru digenerate. Cek: syntax error, tag tidak tertutup, accessibility, responsive design, dan security.',

  outputMode: 'last_message',
}

export default vibeReviewerAgent
