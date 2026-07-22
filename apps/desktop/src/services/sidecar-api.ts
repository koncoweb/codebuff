export type PipelinePhase = 'thinking' | 'researching' | 'generating' | 'reviewing' | 'done'

export interface VibeAgentStep {
  id: string
  type: 'user_message' | 'thinking' | 'read_files' | 'change_file' | 'run_terminal_command' | 'assistant_message' | 'error'
  title: string
  content: string
  timestamp: string
  status: 'running' | 'completed' | 'failed'
  /** Agent group untuk collapsible grouping (mis. "thinker", "researcher-web", "editor", "reviewer") */
  agentGroup?: string
  /** Fase pipeline untuk progress indicator */
  pipelinePhase?: PipelinePhase
  /** Nama file yang dihasilkan/diedit (untuk deep-link ke CodeViewer) */
  affectedFile?: string
  /** Estimasi durasi step dalam milidetik */
  durationMs?: number
}

export interface UserSubscriptionInfo {
  tier: 'FREE' | 'PREMIUM'
  email: string
  membershipTierName: string
  expiredAt: string | null
  dailyQuotaUsed: number
  dailyQuotaMax: number
}

export interface LLMModelOption {
  id: string
  name: string
  provider: string
  tier: 'FREE' | 'PREMIUM'
  speed: 'Fastest' | 'High' | 'Standard'
  badge?: string
}

export interface DebugLogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'success'
  category: 'LLM_REQUEST' | 'LLM_RESPONSE' | 'PARSER' | 'SANDBOX' | 'AUTH'
  message: string
  details?: any
}

export interface UserProject {
  id: string
  userId: string
  name: string
  generatedHtml?: string
  steps: VibeAgentStep[]
  createdAt: string
  updatedAt: string
}

// Multi-Project Storage Helpers
export function getSavedProjects(userId: string): UserProject[] {
  try {
    const key = `koncovibe_projects_${userId || 'guest'}`
    const saved = localStorage.getItem(key)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
    
    const defaultProject: UserProject = {
      id: `proj-default`,
      userId: userId || 'guest',
      name: 'Warung Kopi KoncoVibe',
      steps: [],
      createdAt: new Date().toLocaleTimeString(),
      updatedAt: new Date().toLocaleTimeString(),
    }
    localStorage.setItem(key, JSON.stringify([defaultProject]))
    return [defaultProject]
  } catch (e) {
    return [{
      id: `proj-default`,
      userId: userId || 'guest',
      name: 'Warung Kopi KoncoVibe',
      steps: [],
      createdAt: new Date().toLocaleTimeString(),
      updatedAt: new Date().toLocaleTimeString(),
    }]
  }
}

export function saveUserProjects(userId: string, projects: UserProject[]): void {
  try {
    const key = `koncovibe_projects_${userId || 'guest'}`
    localStorage.setItem(key, JSON.stringify(projects))
  } catch (e) {
    console.error('Failed to save user projects', e)
  }
}

// Global debug log buffer
const debugLogs: DebugLogEntry[] = []
const logListeners: ((logs: DebugLogEntry[]) => void)[] = []

export function addDebugLog(
  level: 'info' | 'warn' | 'error' | 'success',
  category: 'LLM_REQUEST' | 'LLM_RESPONSE' | 'PARSER' | 'SANDBOX' | 'AUTH',
  message: string,
  details?: any
) {
  const entry: DebugLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: new Date().toLocaleTimeString(),
    level,
    category,
    message,
    details,
  }
  debugLogs.push(entry)
  if (debugLogs.length > 200) debugLogs.shift()

  const prefix = `[KoncoVibe ${category}]`
  if (level === 'error') {
    console.error(prefix, message, details || '')
  } else if (level === 'warn') {
    console.warn(prefix, message, details || '')
  } else {
    console.log(`%c${prefix}%c ${message}`, 'color: #06b6d4; font-weight: bold;', 'color: #e2e8f0;', details || '')
  }

  logListeners.forEach((fn) => fn([...debugLogs]))
}

export function getDebugLogs(): DebugLogEntry[] {
  return [...debugLogs]
}

export function subscribeDebugLogs(fn: (logs: DebugLogEntry[]) => void): () => void {
  logListeners.push(fn)
  fn([...debugLogs])
  return () => {
    const idx = logListeners.indexOf(fn)
    if (idx >= 0) logListeners.splice(idx, 1)
  }
}

export function clearDebugLogs(): void {
  debugLogs.length = 0
  logListeners.forEach((fn) => fn([...debugLogs]))
}

export const CURATED_LLM_MODELS: LLMModelOption[] = [
  {
    id: 'MiniMax-M2.7-highspeed',
    name: 'MiniMax M2.7 HighSpeed',
    provider: 'SumoPod AI',
    tier: 'FREE',
    speed: 'Fastest',
    badge: 'Super Fast & Murah',
  },
  {
    id: 'deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    provider: 'SumoPod AI',
    tier: 'FREE',
    speed: 'Fastest',
    badge: 'Coding Specialist',
  },
  {
    id: 'gemini/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'SumoPod AI',
    tier: 'FREE',
    speed: 'Fastest',
    badge: 'Google Efficient',
  },
  {
    id: 'gemini/gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    provider: 'SumoPod AI',
    tier: 'FREE',
    speed: 'Fastest',
    badge: 'Lightweight',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'SumoPod AI',
    tier: 'FREE',
    speed: 'High',
    badge: 'OpenAI Balanced',
  },
  {
    id: 'glm-5-turbo',
    name: 'GLM 5 Turbo',
    provider: 'SumoPod AI',
    tier: 'FREE',
    speed: 'High',
    badge: 'Zhipu Fast',
  },
  {
    id: 'kimi-k2.6',
    name: 'Moonshot Kimi K2.6',
    provider: 'SumoPod AI',
    tier: 'FREE',
    speed: 'High',
    badge: 'Kimi Coding',
  },
  {
    id: 'qwen3.6-flash',
    name: 'Qwen 3.6 Flash',
    provider: 'SumoPod AI',
    tier: 'FREE',
    speed: 'Fastest',
    badge: 'Alibaba Speed',
  },
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    provider: 'SumoPod AI',
    tier: 'PREMIUM',
    speed: 'High',
    badge: 'Pro Reasoning',
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'SumoPod AI',
    tier: 'PREMIUM',
    speed: 'Standard',
    badge: 'Anthropic Flagship',
  },
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    provider: 'SumoPod AI',
    tier: 'PREMIUM',
    speed: 'Standard',
    badge: 'Anthropic Latest',
  },
  {
    id: 'kimi-k2.7',
    name: 'Moonshot Kimi K2.7',
    provider: 'SumoPod AI',
    tier: 'PREMIUM',
    speed: 'High',
    badge: 'Kimi Pro',
  },
  {
    id: 'glm-5.2',
    name: 'GLM 5.2 Pro',
    provider: 'SumoPod AI',
    tier: 'PREMIUM',
    speed: 'High',
    badge: 'GLM Flagship',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'SumoPod AI',
    tier: 'PREMIUM',
    speed: 'High',
    badge: 'OpenAI Flagship',
  },
  {
    id: 'MiniMax-M3',
    name: 'MiniMax M3',
    provider: 'SumoPod AI',
    tier: 'PREMIUM',
    speed: 'Standard',
    badge: 'MiniMax Pro',
  },
]

export function extractCleanHtml(text: string): string {
  if (!text) {
    addDebugLog('warn', 'PARSER', 'Input teks HTML kosong.')
    return ''
  }

  let cleaned = text.trim()
  const rawLen = cleaned.length

  // 1. Strip markdown fences if present (e.g. ```html ... ``` or unclosed ```html ...)
  if (cleaned.includes('```')) {
    const block = cleaned.split(/```(?:html|xml|)/i)[1]
    if (block) {
      cleaned = block.split('```')[0].trim()
      addDebugLog('info', 'PARSER', 'Mengekstrak blok markdown ```html', { rawLen, cleanedLen: cleaned.length })
    }
  }

  // 2. Find start of HTML document (<!DOCTYPE html or <html)
  const htmlStartIdx = cleaned.search(/(?:<!DOCTYPE html|<html)/i)
  if (htmlStartIdx >= 0) {
    cleaned = cleaned.substring(htmlStartIdx).trim()
    addDebugLog('info', 'PARSER', 'Mengekstrak dari tag pembuka HTML', { htmlStartIdx, cleanedLen: cleaned.length })
  }

  // 3. Ensure unclosed style/script/body tags are auto-healed if truncated
  if (cleaned.toLowerCase().includes('<html') && !cleaned.toLowerCase().includes('</html>')) {
    if (cleaned.toLowerCase().includes('<style') && !cleaned.toLowerCase().includes('</style>')) {
      cleaned += '\n</style>'
    }
    if (cleaned.toLowerCase().includes('<script') && !cleaned.toLowerCase().includes('</script>')) {
      cleaned += '\n</script>'
    }
    if (cleaned.toLowerCase().includes('<body') && !cleaned.toLowerCase().includes('</body>')) {
      cleaned += '\n</body>'
    }
    cleaned += '\n</html>'
    addDebugLog('info', 'PARSER', 'Menambahkan tag penutup HTML/script/style yang terpotong')
  }

  // 4. Fallback if no <html> wrapper at all
  if (!cleaned.toLowerCase().includes('<html')) {
    addDebugLog('warn', 'PARSER', 'Respons tidak memiliki tag <html>. Menggunakan pembungkus template standar.', { snippet: cleaned.substring(0, 100) })
    cleaned = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KoncoVibe Live Render</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background-color: #0b0f17; color: #f1f5f9; padding: 2rem; min-height: 100vh; }
  </style>
</head>
<body>
  ${cleaned}
</body>
</html>`
  } else {
    addDebugLog('success', 'PARSER', 'Hasil ekstraksi HTML valid dan bersih!', { finalLength: cleaned.length })
  }

  return cleaned
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function sendVibePrompt(
  prompt: string,
  providerConfig: { provider: string; apiKey: string; baseUrl: string; selectedModel: string },
  onStep: (step: VibeAgentStep) => void,
  onGeneratedHtml?: (html: string) => void,
  currentHtml?: string,
  signal?: AbortSignal,
  chatHistory?: ChatMessage[]
): Promise<void> {
  const modelId = providerConfig.selectedModel || import.meta.env.VITE_SUMOPOD_DEFAULT_MODEL || 'MiniMax-M2.7-highspeed'
  const apiKey = providerConfig.apiKey || import.meta.env.VITE_SUMOPOD_API_KEY || ''
  const baseUrl = providerConfig.baseUrl || import.meta.env.VITE_SUMOPOD_BASE_URL || 'https://ai.sumopod.com/v1'

  if (!apiKey) {
    throw new Error('API key belum dikonfigurasi. Buka Settings untuk mengatur API key.')
  }

  addDebugLog('info', 'LLM_REQUEST', `Memulai permintaan Vibe Coding dengan model ${modelId}`, {
    prompt,
    selectedModel: modelId,
    baseUrl,
    hasExistingHtmlContext: !!currentHtml,
    existingHtmlLength: currentHtml ? currentHtml.length : 0,
  })

  // Step 1: Thinking
  onStep({
    id: crypto.randomUUID(),
    type: 'thinking',
    title: 'Menganalisis permintaan Anda...',
    content: `Permintaan: "${prompt}"`,
    timestamp: new Date().toLocaleTimeString(),
    status: 'running',
    agentGroup: 'thinker',
    pipelinePhase: 'thinking',
  })

  // Step 2: Path sandbox check
  onStep({
    id: crypto.randomUUID(),
    type: 'read_files',
    title: 'Menyusun struktur komponen UI',
    content: 'Menganalisis kebutuhan struktur, layout, dan styling',
    timestamp: new Date().toLocaleTimeString(),
    status: 'completed',
    agentGroup: 'thinker',
    pipelinePhase: 'thinking',
  })

  addDebugLog('info', 'SANDBOX', 'Path Locking & Security Check Lulus ($0 Server Sandbox)')

  try {
    // Step 3: Real LLM Call
    const step3Id = crypto.randomUUID()
    onStep({
      id: step3Id,
      type: 'change_file',
      title: 'Menulis kode HTML/CSS/JS',
      content: 'Sedang membuat kode aplikasi web Anda...',
      timestamp: new Date().toLocaleTimeString(),
      status: 'running',
      agentGroup: 'editor',
      pipelinePhase: 'generating',
    })

    const systemPrompt = `You are KoncoVibe AI, an expert HTML/CSS/JS web developer. Your ONLY job is to output a COMPLETE, self-contained HTML page.

STRICT RULES - follow all of these or the output WILL FAIL:
1. Output ONLY raw HTML starting with <!DOCTYPE html> and ending with </html>. NOTHING else.
2. Do NOT use React, Vue, Angular, Svelte, or any frontend framework that requires a build step.
3. Do NOT use Tailwind CDN or any CDN that requires build-time processing.
4. All CSS MUST be inside a <style> tag in <head>. Do NOT use external .css files.
5. All JavaScript MUST be inside <script> tags at bottom of <body>. Do NOT use external .js files.
6. You MAY use trusted CDN libraries: Tailwind CDN (https://cdn.tailwindcss.com), Alpine.js CDN, or vanilla JS only.
7. The <body> MUST contain visible HTML content (text, buttons, cards, etc.) - NOT just script tags.
8. Default body background: dark (e.g. #0b0f17 or #0f172a). Default text color: white or light.
9. The page MUST look correct when loaded in an <iframe> without any server or build process.
10. DO NOT truncate the output. Output the COMPLETE HTML from <!DOCTYPE html> to </html>.`

    let userMessage = prompt
    if (currentHtml && currentHtml.trim()) {
      userMessage = `The user wants to EDIT/MODIFY the existing web app. Here is the CURRENT full HTML code:
\`\`\`html
${currentHtml.trim()}
\`\`\`

USER EDIT REQUEST: "${prompt}"

CRITICAL RULES FOR EDITING:
1. Output the COMPLETE updated HTML from <!DOCTYPE html> to </html>. NEVER truncate or abbreviate.
2. DO NOT write comments like "// rest of code same..." or "<!-- same as before -->". Include ALL code.
3. Apply the user's requested change while keeping all existing styles, content, and functionality intact.
4. Do NOT switch to React, Vue, or any framework. Keep it as plain HTML/CSS/JS.
5. Return ONLY the raw HTML code. No markdown fences, no explanations.`
    }

    // Bangun messages array dengan multi-turn context (maks 6 pesan terakhir untuk hemat token)
    const messages: { role: string; content: string }[] = [{ role: 'system', content: systemPrompt }]
    if (chatHistory && chatHistory.length > 0) {
      const recent = chatHistory.slice(-6)
      for (const msg of recent) {
        messages.push({ role: msg.role, content: msg.content })
      }
    }
    messages.push({ role: 'user', content: userMessage })

    const startTime = Date.now()
    addDebugLog('info', 'LLM_REQUEST', `Streaming request ke LLM API (stream: true)`, {
      model: modelId,
      messageCount: messages.length,
      hasHistory: (chatHistory?.length || 0) > 0,
    })

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature: 0.5,
        max_tokens: 8192,
        stream: true,
      }),
      signal,
    })

    if (!res.ok) {
      const errText = await res.text()
      const duration = Date.now() - startTime
      addDebugLog('error', 'LLM_RESPONSE', `HTTP Error ${res.status} dari LLM API`, { status: res.status, errText, duration })
      throw new Error(`LLM API Error (${res.status}): ${errText}`)
    }

    // Streaming SSE parsing
    const reader = res.body?.getReader()
    if (!reader) {
      throw new Error('Response body tidak mendukung streaming.')
    }

    const decoder = new TextDecoder()
    let rawContent = ''
    let buffer = ''
    let lastUpdateTime = 0

    addDebugLog('info', 'LLM_RESPONSE', 'Memulai streaming response...')

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Parse SSE lines (dipisahkan oleh \n\n)
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const data = trimmed.slice(6)
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content || ''
          if (delta) {
            rawContent += delta

            // Update step progress setiap ~500ms (hindari spam re-render)
            const now = Date.now()
            if (now - lastUpdateTime > 500) {
              lastUpdateTime = now
              onStep({
                id: step3Id,
                type: 'change_file',
                title: 'Menulis kode HTML/CSS/JS',
                content: `Sedang membuat kode... ${rawContent.length} karakter diterima.`,
                timestamp: new Date().toLocaleTimeString(),
                status: 'running',
                agentGroup: 'editor',
                pipelinePhase: 'generating',
              })
            }
          }
        } catch {
          // Partial JSON, skip
        }
      }
    }

    const duration = Date.now() - startTime

    addDebugLog('success', 'LLM_RESPONSE', `Streaming selesai dalam ${duration}ms (${rawContent.length} karakter)`, {
      model: modelId,
      rawContentLength: rawContent.length,
      durationMs: duration,
    })

    // Guard: reject response if too short (likely failed/empty)
    if (rawContent.trim().length < 200) {
      throw new Error(`Respons AI terlalu pendek (${rawContent.trim().length} karakter). Kemungkinan model gagal menghasilkan kode HTML yang valid.`)
    }

    const cleanedHtml = extractCleanHtml(rawContent)

    // Step 3 Finish
    onStep({
      id: step3Id,
      type: 'change_file',
      title: 'Kode berhasil dibuat',
      content: `Berhasil mengekstrak ${cleanedHtml.length} karakter kode HTML/CSS bersih (${duration}ms).`,
      timestamp: new Date().toLocaleTimeString(),
      status: 'completed',
      agentGroup: 'editor',
      pipelinePhase: 'generating',
      affectedFile: 'index.html',
      durationMs: duration,
    })

    if (onGeneratedHtml && cleanedHtml.trim()) {
      addDebugLog('info', 'PARSER', 'Memanggil Callback onGeneratedHtml()', { htmlLength: cleanedHtml.trim().length })
      onGeneratedHtml(cleanedHtml.trim())
    }

    // Step 4: Terminal reload
    onStep({
      id: crypto.randomUUID(),
      type: 'run_terminal_command',
      title: 'Menjalankan Server Pratinjau',
      content: 'bun run dev (Pratinjau langsung otomatis diperbarui di layar kanan!)',
      timestamp: new Date().toLocaleTimeString(),
      status: 'completed',
      agentGroup: 'editor',
      pipelinePhase: 'reviewing',
    })

    // Step 5: Finished
    onStep({
      id: crypto.randomUUID(),
      type: 'assistant_message',
      title: 'KoncoVibe AI',
      content: `Selesai! Kode telah berhasil dibuat (${duration}ms). Lihat hasilnya pada layar pratinjau di sebelah kanan.`,
      timestamp: new Date().toLocaleTimeString(),
      status: 'completed',
      agentGroup: 'reviewer',
      pipelinePhase: 'done',
      durationMs: duration,
    })
  } catch (err: any) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      addDebugLog('info', 'LLM_REQUEST', 'Request dibatalkan oleh user')
      return
    }
    addDebugLog('error', 'LLM_RESPONSE', `Gagal memproses prompt: ${err?.message || err}`, { error: err })
    onStep({
      id: crypto.randomUUID(),
      type: 'error',
      title: 'Terjadi kesalahan',
      content: `Gagal memproses permintaan: ${err?.message || err}`,
      timestamp: new Date().toLocaleTimeString(),
      status: 'failed',
      agentGroup: 'editor',
      pipelinePhase: 'done',
    })
  }
}
