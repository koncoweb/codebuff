import React, { useState, useEffect, useRef } from 'react'
import { Brain, ChevronDown } from 'lucide-react'

export interface ReasoningPanelProps {
  reasoning: Array<{
    id: string
    content: string
    agentId?: string
    isStreaming: boolean
    timestamp: number
  }>
}

export const ReasoningPanel: React.FC<ReasoningPanelProps> = ({ reasoning }) => {
  const [collapsed, setCollapsed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const isStreaming = reasoning.some((r) => r.isStreaming)

  // Auto-expand while streaming; auto-collapse 1s after all streaming stops
  useEffect(() => {
    if (isStreaming) {
      setCollapsed(false)
    } else {
      const timer = setTimeout(() => setCollapsed(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [isStreaming])

  // Auto-scroll to bottom as content streams in
  useEffect(() => {
    if (!collapsed && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [reasoning, collapsed])

  // Render nothing when there are no reasoning entries
  if (reasoning.length === 0) return null

  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-lg overflow-hidden animate-slide-in">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-slate-800/30 transition-colors"
      >
        <Brain className={`w-3 h-3 shrink-0 ${isStreaming ? 'text-purple-400' : 'text-slate-500'}`} />
        <span className="text-[10px] font-medium text-slate-300">Thinking...</span>
        {isStreaming && (
          <span className="w-1 h-1 rounded-full bg-purple-400 animate-blink" />
        )}
        <ChevronDown
          className="w-3 h-3 text-slate-500 transition-all shrink-0 ml-auto"
          style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
        />
      </button>

      {/* Scrollable reasoning content */}
      {!collapsed && (
        <div
          ref={scrollRef}
          className="px-2.5 pb-2 space-y-1.5 overflow-y-auto"
          style={{ maxHeight: '200px' }}
        >
          {reasoning.map((entry) => (
            <div key={entry.id} className="animate-slide-in">
              {entry.agentId && (
                <div className="text-[9px] text-slate-500 font-mono mb-0.5 uppercase tracking-wider">
                  {entry.agentId}
                </div>
              )}
              <p className="text-xs font-mono text-slate-400 whitespace-pre-wrap break-words">
                {entry.content}
                {entry.isStreaming && (
                  <span className="inline-block w-1 h-3 bg-purple-400 ml-0.5 animate-blink align-middle" />
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
