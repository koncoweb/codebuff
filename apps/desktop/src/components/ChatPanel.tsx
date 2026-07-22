import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  Send, CheckCircle2, Loader2, Sparkles, AlertCircle,
  Wand2, ShieldAlert, Square, ChevronRight, ChevronDown, Brain, Search,
  Code2, Copy, ExternalLink, Paperclip, ArrowDown, User, X, MousePointerClick
} from 'lucide-react'
import type { VibeAgentStep, PipelinePhase } from '../services/sidecar-api'
import type { InspectedElement } from './LivePreview'

export interface ChatPanelProps {
  steps: VibeAgentStep[]
  isRunning: boolean
  onSendPrompt: (prompt: string) => void
  onStop?: () => void
  onSwitchToCode?: () => void
  inspectedElement?: InspectedElement | null
  onClearInspected?: () => void
}

const PIPELINE_PHASES: { phase: PipelinePhase; label: string; icon: React.ReactNode }[] = [
  { phase: 'thinking', label: 'Analisis', icon: <Brain className="w-2.5 h-2.5" /> },
  { phase: 'researching', label: 'Riset', icon: <Search className="w-2.5 h-2.5" /> },
  { phase: 'generating', label: 'Kode', icon: <Code2 className="w-2.5 h-2.5" /> },
  { phase: 'reviewing', label: 'Cek', icon: <CheckCircle2 className="w-2.5 h-2.5" /> },
]

const PHASE_STATUS: Record<string, string> = {
  thinking: 'Menganalisis permintaan Anda...',
  researching: 'Mencari referensi...',
  generating: 'Menulis kode...',
  reviewing: 'Memvalidasi...',
}

const QUICK_PROMPTS = [
  { cat: 'Landing', icon: '🚀', prompts: [
    'Landing page warung kopi modern dengan mode gelap',
    'Landing page SaaS dengan hero, pricing, dan testimoni',
  ]},
  { cat: 'Dashboard', icon: '📊', prompts: [
    'Dashboard admin dengan sidebar dan grafik statistik',
    'Tabel produk dengan pencarian dan sorting',
  ]},
  { cat: 'Komponen', icon: '🧩', prompts: [
    'Kartu profil user dengan avatar dan tombol follow',
    'Form kontak dengan validasi dan efek glassmorphism',
  ]},
]

function getGroupMeta(g?: string) {
  switch (g) {
    case 'thinker': case 'thinking':
      return { label: 'Analisis', icon: <Brain className="w-3 h-3" />, color: 'text-purple-400' }
    case 'researcher-web': case 'researching':
      return { label: 'Riset', icon: <Search className="w-3 h-3" />, color: 'text-cyan-400' }
    case 'editor': case 'generating':
      return { label: 'Kode', icon: <Code2 className="w-3 h-3" />, color: 'text-indigo-400' }
    case 'reviewer': case 'reviewing':
      return { label: 'Cek', icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-emerald-400' }
    default:
      return { label: 'AI', icon: <Sparkles className="w-3 h-3" />, color: 'text-cyan-400' }
  }
}

const TypingDots = () => (
  <div className="flex items-center gap-0.5 py-1">
    {[0, 1, 2].map((i) => (
      <span key={i} className="w-1 h-1 rounded-full bg-cyan-400 animate-typing-dot" style={{ animationDelay: `${i * 0.15}s` }} />
    ))}
  </div>
)

const PipelineBar: React.FC<{ phase?: PipelinePhase; running: boolean }> = ({ phase, running }) => {
  if (!running || !phase) return null
  const idx = PIPELINE_PHASES.findIndex((p) => p.phase === phase)
  return (
    <div className="px-2.5 py-1.5 border-b border-slate-800/80 bg-slate-900/30">
      <div className="flex items-center gap-0.5">
        {PIPELINE_PHASES.map((p, i) => (
          <React.Fragment key={p.phase}>
            <div className={`flex items-center gap-1 text-[9px] font-medium transition-all ${
              i === idx ? 'text-cyan-300' : i < idx ? 'text-emerald-400' : 'text-slate-600'
            }`}>
              <div className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${
                i === idx ? 'bg-cyan-500/20 border-cyan-500/50 animate-pulse' :
                i < idx ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-slate-800 border-slate-700'
              }`}>
                {i < idx ? <CheckCircle2 className="w-2 h-2" /> : p.icon}
              </div>
            </div>
            {i < PIPELINE_PHASES.length - 1 && (
              <div className={`flex-1 h-px ${i < idx ? 'bg-emerald-500/30' : 'bg-slate-800'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

// User message bubble (kanan)
const UserBubble: React.FC<{ step: VibeAgentStep }> = ({ step }) => (
  <div className="flex justify-end animate-slide-in">
    <div className="flex items-start gap-1.5 max-w-[85%]">
      <div className="bg-cyan-600/30 border border-cyan-500/30 rounded-lg rounded-tr-sm px-2.5 py-1.5">
        <p className="text-[11px] text-slate-100 whitespace-pre-wrap break-words">{step.content}</p>
      </div>
      <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 mt-0.5">
        <User className="w-2.5 h-2.5 text-cyan-300" />
      </div>
    </div>
  </div>
)

// Agent group collapsible card (kiri)
const AgentCard: React.FC<{ groupKey: string; steps: VibeAgentStep[]; onCode?: () => void }> = ({ groupKey, steps, onCode }) => {
  const [collapsed, setCollapsed] = useState(false)
  const running = steps.some((s) => s.status === 'running')
  const failed = steps.some((s) => s.status === 'failed')
  const done = steps.every((s) => s.status === 'completed')
  const meta = getGroupMeta(groupKey)
  const totalMs = steps.reduce((a, s) => a + (s.durationMs || 0), 0)

  useEffect(() => {
    if (running) setCollapsed(false)
    else if (done && steps.length > 1) {
      const t = setTimeout(() => setCollapsed(true), 2500)
      return () => clearTimeout(t)
    }
  }, [running, done, steps.length])

  return (
    <div className="flex justify-start animate-slide-in">
      <div className="flex items-start gap-1.5 max-w-[90%]">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
          failed ? 'bg-rose-500/20 border-rose-500/30' :
          done ? 'bg-emerald-500/20 border-emerald-500/30' :
          'bg-slate-800 border-slate-700'
        }`}>
          {running ? <Loader2 className="w-2.5 h-2.5 text-cyan-400 animate-spin" /> :
           failed ? <AlertCircle className="w-2.5 h-2.5 text-rose-400" /> :
           done ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> : meta.icon}
        </div>
        <div className={`rounded-lg rounded-tl-sm border overflow-hidden transition-all ${
          failed ? 'bg-rose-950/20 border-rose-800/30' :
          done ? 'bg-slate-900/50 border-slate-800' :
          'bg-slate-900/50 border-cyan-800/20'
        }`}>
          <button onClick={() => setCollapsed(!collapsed)} className="w-full flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-slate-800/30 transition-colors">
            {collapsed ? <ChevronRight className="w-2.5 h-2.5 text-slate-500" /> : <ChevronDown className="w-2.5 h-2.5 text-slate-500" />}
            <span className={meta.color}>{meta.icon}</span>
            <span className="text-[10px] font-medium text-slate-200">{meta.label}</span>
            <span className="text-[9px] text-slate-600 ml-auto">{steps.length} langkah{totalMs > 0 ? ` · ${(totalMs/1000).toFixed(1)}s` : ''}</span>
          </button>
          {!collapsed && (
            <div className="px-2.5 pb-1.5 space-y-1">
              {steps.map((s, i) => <StepRow key={s.id} step={s} onCode={onCode} last={i === steps.length - 1} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Single step row inside agent card
const StepRow: React.FC<{ step: VibeAgentStep; onCode?: () => void; last: boolean }> = ({ step, onCode, last }) => {
  const [copied, setCopied] = useState(false)
  return (
    <div className={`pl-2.5 ml-1 ${last ? 'border-l-transparent' : 'border-l border-slate-800/50'}`}>
      <div className="flex items-center gap-1 py-0.5">
        {step.status === 'running' && <Loader2 className="w-2.5 h-2.5 text-cyan-400 animate-spin shrink-0" />}
        {step.status === 'completed' && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />}
        {step.status === 'failed' && <AlertCircle className="w-2.5 h-2.5 text-rose-400 shrink-0" />}
        <span className="text-[10px] text-slate-400 truncate flex-1">{step.title}</span>
        {step.durationMs && step.status === 'completed' && <span className="text-[9px] text-slate-600">{(step.durationMs/1000).toFixed(1)}s</span>}
        {step.affectedFile && (
          <button onClick={(e) => { e.stopPropagation(); onCode?.() }} className="p-0.5 hover:bg-slate-800 rounded text-slate-500 hover:text-indigo-300" title="Lihat kode">
            <ExternalLink className="w-2.5 h-2.5" />
          </button>
        )}
        {step.content && (
          <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(step.content); setCopied(true); setTimeout(() => setCopied(false), 1500) }} className="p-0.5 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300" title="Salin">
            {copied ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
          </button>
        )}
      </div>
      {step.content && step.type === 'assistant_message' && (
        <pre className="mt-0.5 text-[10px] font-mono text-slate-300 bg-slate-950/60 p-1.5 rounded border border-slate-800/50 whitespace-pre-wrap break-words">
          {step.content}
          {step.status === 'running' && <span className="inline-block w-1 h-2.5 bg-cyan-400 ml-0.5 animate-blink align-middle" />}
        </pre>
      )}
      {step.content && step.type !== 'assistant_message' && step.type !== 'user_message' && (
        <details className="mt-0.5 group">
          <summary className="text-[9px] text-slate-600 cursor-pointer hover:text-slate-400 select-none list-none">
            <span className="group-open:hidden">▸ Detail</span>
            <span className="hidden group-open:inline">▾ Sembunyikan</span>
          </summary>
          <pre className="mt-0.5 text-[9px] font-mono text-slate-500 bg-slate-950/60 p-1.5 rounded border border-slate-800/50 whitespace-pre-wrap break-words max-h-24 overflow-y-auto">{step.content}</pre>
        </details>
      )}
    </div>
  )
}

// AI assistant message bubble (kiri, full width)
const AIBubble: React.FC<{ step: VibeAgentStep; onCode?: () => void }> = ({ step, onCode }) => (
  <div className="flex justify-start animate-slide-in">
    <div className="flex items-start gap-1.5 max-w-[90%]">
      <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="w-2.5 h-2.5 text-cyan-300" />
      </div>
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg rounded-tl-sm px-2.5 py-1.5">
        <p className="text-[11px] text-slate-200 whitespace-pre-wrap break-words">
          {step.content}
          {step.status === 'running' && <span className="inline-block w-1 h-2.5 bg-cyan-400 ml-0.5 animate-blink align-middle" />}
        </p>
      </div>
    </div>
  </div>
)

// Status card setelah generasi selesai
const StatusCard: React.FC<{ onCode?: () => void }> = ({ onCode }) => (
  <div className="flex justify-start animate-slide-in">
    <div className="flex items-start gap-1.5">
      <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
      </div>
      <div className="bg-gradient-to-tr from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-lg rounded-tl-sm px-2.5 py-1.5 space-y-1">
        <p className="text-[10px] font-semibold text-emerald-300">Generasi Selesai</p>
        <button onClick={onCode} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/60 hover:bg-slate-700 text-[9px] text-slate-300 hover:text-white border border-slate-700/60 transition-colors">
          <Code2 className="w-2.5 h-2.5" /><span>Lihat Kode</span>
        </button>
      </div>
    </div>
  </div>
)

// Follow-up chips
const FollowUps: React.FC<{ onPick: (p: string) => void }> = ({ onPick }) => (
  <div className="flex flex-wrap gap-1 pl-6">
    {['Dark mode toggle', 'Responsive mobile', 'Animasi scroll', 'Ganti warna'].map((s, i) => (
      <button key={i} onClick={() => onPick(s)} className="px-1.5 py-0.5 rounded-full bg-slate-800/50 hover:bg-cyan-500/10 border border-slate-700/50 hover:border-cyan-500/20 text-[9px] text-slate-500 hover:text-cyan-300 transition-all">{s}</button>
    ))}
  </div>
)

// === MAIN ===
export const ChatPanel: React.FC<ChatPanelProps> = ({ steps, isRunning, onSendPrompt, onStop, onSwitchToCode, inspectedElement, onClearInspected }) => {
  const [input, setInput] = useState('')
  const [cat, setCat] = useState(0)
  const [autoScroll, setAutoScroll] = useState(true)
  const [showJump, setShowJump] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = 'auto'
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 100) + 'px'
    }
  }, [input])

  useEffect(() => {
    if (autoScroll && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [steps, autoScroll])

  const onScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 40
    setAutoScroll(atBottom)
    setShowJump(!atBottom && steps.length > 3)
  }

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isRunning) return
    let finalPrompt = input.trim()
    // Sertakan inspected element sebagai context jika ada
    if (inspectedElement) {
      finalPrompt = `[Element: ${inspectedElement.selector}${inspectedElement.text ? ` — "${inspectedElement.text.substring(0, 80)}"` : ''}] ${finalPrompt}`
      onClearInspected?.()
    }
    onSendPrompt(finalPrompt)
    setInput('')
    setAutoScroll(true)
  }

  // Group non-user steps by agentGroup, user messages as separate bubbles
  const rendered = useMemo(() => {
    const items: React.ReactNode[] = []
    let currentGroup: VibeAgentStep[] = []
    let currentKey = ''

    const flushGroup = (idx: number) => {
      if (currentGroup.length === 0) return
      items.push(<AgentCard key={`grp-${idx}`} groupKey={currentKey} steps={currentGroup} onCode={onSwitchToCode} />)
      currentGroup = []
      currentKey = ''
    }

    steps.forEach((step, idx) => {
      if (step.type === 'user_message') {
        flushGroup(idx)
        items.push(<UserBubble key={step.id} step={step} />)
      } else if (step.type === 'assistant_message' && step.agentGroup === 'reviewer') {
        flushGroup(idx)
        items.push(<AIBubble key={step.id} step={step} onCode={onSwitchToCode} />)
      } else if (step.type === 'error') {
        flushGroup(idx)
        items.push(<AIBubble key={step.id} step={step} onCode={onSwitchToCode} />)
      } else {
        const g = step.agentGroup || 'default'
        if (g !== currentKey && currentGroup.length > 0) {
          flushGroup(idx)
        }
        currentKey = g
        currentGroup.push(step)
      }
    })
    flushGroup(steps.length)

    return items
  }, [steps, onSwitchToCode])

  const currentPhase = useMemo(() => steps.find((s) => s.status === 'running')?.pipelinePhase, [steps])
  const hasGenerated = steps.some((s) => s.type === 'assistant_message' && s.status === 'completed')
  const hasError = steps.some((s) => s.type === 'error')
  const isEmpty = steps.length === 0

  return (
    <div className="vibe-chat-sidebar flex flex-col h-full bg-slate-950/60 border-r border-slate-800/80 shrink-0 relative">
      {/* Header */}
      <div className="px-2.5 py-2 border-b border-slate-800/80 flex items-center gap-1.5 bg-slate-900/30">
        <Wand2 className="w-3 h-3 text-cyan-400" />
        <span className="text-[11px] font-medium text-slate-300">Vibe Coding</span>
        <span className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse ml-auto" />
      </div>

      <PipelineBar phase={currentPhase} running={isRunning} />

      {/* Chat area */}
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto p-2 space-y-2 scroll-smooth">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-3 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500/15 via-indigo-500/15 to-purple-500/15 flex items-center justify-center border border-cyan-500/20">
              <Sparkles className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white mb-0.5">Mulai Vibe Coding!</h3>
              <p className="text-[10px] text-slate-500 max-w-[200px] leading-relaxed">Deskripsikan aplikasi web yang Anda inginkan. AI akan menulis kode dan menampilkan pratinjaunya.</p>
            </div>
            <div className="w-full space-y-2">
              <div className="flex gap-0.5 p-0.5 bg-slate-950 rounded-lg border border-slate-800">
                {QUICK_PROMPTS.map((c, i) => (
                  <button key={i} onClick={() => setCat(i)} className={`flex-1 py-1 rounded text-[9px] font-medium transition-all ${cat === i ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-500 hover:text-slate-300'}`}>
                    <span>{c.icon}</span> {c.cat}
                  </button>
                ))}
              </div>
              {QUICK_PROMPTS[cat].prompts.map((p, i) => (
                <button key={i} onClick={() => setInput(p)} className="w-full text-left p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800/60 hover:border-cyan-500/20 text-[10px] text-slate-400 hover:text-white transition-all">
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {rendered}
            {isRunning && steps.every((s) => s.status !== 'running') && (
              <div className="flex justify-start animate-slide-in">
                <div className="flex items-center gap-1.5 pl-6">
                  <TypingDots />
                  <span className="text-[10px] text-slate-500">{currentPhase ? PHASE_STATUS[currentPhase] : 'Memproses...'}</span>
                </div>
              </div>
            )}
            {!isRunning && hasGenerated && !hasError && (
              <>
                <StatusCard onCode={onSwitchToCode} />
                <FollowUps onPick={(p) => setInput(p)} />
              </>
            )}
          </>
        )}
      </div>

      {/* Jump to bottom */}
      {showJump && (
        <button onClick={() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); setAutoScroll(true); setShowJump(false) }} className="absolute bottom-16 right-3 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-cyan-300 hover:border-cyan-500/30 shadow-lg transition-all z-10">
          <ArrowDown className="w-3 h-3" />
        </button>
      )}

      {/* Input */}
      <div className="p-2 border-t border-slate-800/80 bg-slate-900/30">
        {/* Inspected Element Context Chip */}
        {inspectedElement && (
          <div className="mb-1.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30">
            <MousePointerClick className="w-2.5 h-2.5 text-purple-400 shrink-0" />
            <span className="text-[9px] text-purple-300 font-mono truncate flex-1">
              {inspectedElement.selector}
              {inspectedElement.text && <span className="text-slate-500"> · "{inspectedElement.text.substring(0, 40)}{inspectedElement.text.length > 40 ? '...' : ''}"</span>}
            </span>
            <button type="button" onClick={onClearInspected} className="p-0.5 hover:bg-purple-500/20 rounded text-purple-400 hover:text-purple-200 shrink-0">
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
        <form onSubmit={submit}>
          <div className="flex items-end gap-1">
            <button type="button" disabled className="p-1.5 rounded-lg bg-slate-800/40 border border-slate-700/40 text-slate-500 opacity-50 cursor-not-allowed shrink-0" title="Fitur lampiran segera hadir">
              <Paperclip className="w-3 h-3" />
            </button>
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
              disabled={isRunning}
              rows={1}
              placeholder={isRunning ? 'AI sedang bekerja...' : 'Deskripsikan aplikasi web...'}
              className="flex-1 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-cyan-500/50 focus:outline-none text-[11px] text-slate-100 placeholder-slate-600 resize-none overflow-hidden transition-colors"
              style={{ minHeight: '30px', maxHeight: '100px' }}
            />
            {isRunning ? (
              <button type="button" onClick={onStop} className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 transition-colors shrink-0" title="Hentikan">
                <Square className="w-3 h-3 fill-current" />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} className="p-1.5 rounded-lg gradient-bg-accent text-white hover:opacity-90 disabled:opacity-25 disabled:cursor-not-allowed transition-opacity shadow-sm shrink-0" title="Kirim">
                <Send className="w-3 h-3" />
              </button>
            )}
          </div>
        </form>
        <div className="mt-1 flex items-center justify-between text-[8px] text-slate-600">
          <span><kbd className="px-0.5 bg-slate-800 rounded">↵</kbd> kirim · <kbd className="px-0.5 bg-slate-800 rounded">⇧↵</kbd> baris baru</span>
          <span className="flex items-center gap-0.5 text-cyan-400/40"><ShieldAlert className="w-2 h-2" /> Sandbox</span>
        </div>
      </div>
    </div>
  )
}
