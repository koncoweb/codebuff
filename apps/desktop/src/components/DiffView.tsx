import React, { useMemo, useState } from 'react'
import { FileCode, Check, X, Edit3 } from 'lucide-react'

export interface DiffViewProps {
  oldContent: string
  newContent: string
  filename?: string
  onApply?: () => void
  onReject?: () => void
  onEditAndApply?: (editedContent: string) => void
}

type DiffRowType = 'added' | 'removed' | 'unchanged'

interface DiffRow {
  type: DiffRowType
  oldNum: number | null
  newNum: number | null
  content: string
}

interface DiffResult {
  rows: DiffRow[]
  additions: number
  deletions: number
  oldLines: string[]
  newLines: string[]
  oldSet: Set<string>
  newSet: Set<string>
}

/**
 * Simple line-by-line diff. Splits old/new by `\n`, uses a Set for efficient
 * membership lookup. Stats count lines present in one side but not the other;
 * the unified walk emits removed/added rows adjacent to make changes scannable.
 */
function computeDiff(oldContent: string, newContent: string): DiffResult {
  const oldLines = oldContent ? oldContent.split('\n') : []
  const newLines = newContent ? newContent.split('\n') : []
  const oldSet = new Set(oldLines)
  const newSet = new Set(newLines)

  const additions = newLines.filter((l) => !oldSet.has(l)).length
  const deletions = oldLines.filter((l) => !newSet.has(l)).length

  const rows: DiffRow[] = []
  const maxLen = Math.max(oldLines.length, newLines.length)
  for (let i = 0; i < maxLen; i++) {
    const o = oldLines[i]
    const n = newLines[i]
    if (o === n) {
      rows.push({ type: 'unchanged', oldNum: i + 1, newNum: i + 1, content: o ?? '' })
    } else {
      if (o !== undefined) rows.push({ type: 'removed', oldNum: i + 1, newNum: null, content: o })
      if (n !== undefined) rows.push({ type: 'added', oldNum: null, newNum: i + 1, content: n })
    }
  }

  return { rows, additions, deletions, oldLines, newLines, oldSet, newSet }
}

const rowClass: Record<DiffRowType, string> = {
  added: 'bg-emerald-500/10 text-emerald-300',
  removed: 'bg-red-500/10 text-red-400',
  unchanged: 'text-slate-400',
}

const UnifiedRows: React.FC<{ rows: DiffRow[] }> = ({ rows }) => (
  <div>
    {rows.map((row, idx) => (
      <div key={idx} className={`flex ${rowClass[row.type]}`}>
        <span className="w-10 shrink-0 text-right pr-2 text-slate-600 select-none">
          {row.newNum ?? row.oldNum ?? ''}
        </span>
        <span className="w-4 shrink-0 select-none">
          {row.type === 'added' ? '+' : row.type === 'removed' ? '-' : ' '}
        </span>
        <span className="flex-1 whitespace-pre">{row.content}</span>
      </div>
    ))}
  </div>
)

const SplitRows: React.FC<{
  oldLines: string[]
  newLines: string[]
  oldSet: Set<string>
  newSet: Set<string>
}> = ({ oldLines, newLines, oldSet, newSet }) => (
  <div className="grid grid-cols-2">
    <div className="border-r border-white/10">
      {oldLines.map((line, i) => {
        const removed = !newSet.has(line)
        return (
          <div key={i} className={`flex ${removed ? 'bg-red-500/10 text-red-400' : 'text-slate-400'}`}>
            <span className="w-10 shrink-0 text-right pr-2 text-slate-600 select-none">{i + 1}</span>
            <span className="w-4 shrink-0 select-none">{removed ? '-' : ' '}</span>
            <span className="flex-1 whitespace-pre">{line}</span>
          </div>
        )
      })}
    </div>
    <div>
      {newLines.map((line, i) => {
        const added = !oldSet.has(line)
        return (
          <div key={i} className={`flex ${added ? 'bg-emerald-500/10 text-emerald-300' : 'text-slate-400'}`}>
            <span className="w-10 shrink-0 text-right pr-2 text-slate-600 select-none">{i + 1}</span>
            <span className="w-4 shrink-0 select-none">{added ? '+' : ' '}</span>
            <span className="flex-1 whitespace-pre">{line}</span>
          </div>
        )
      })}
    </div>
  </div>
)

export const DiffView: React.FC<DiffViewProps> = ({
  oldContent,
  newContent,
  filename,
  onApply,
  onReject,
  onEditAndApply,
}) => {
  const [view, setView] = useState<'unified' | 'split'>('unified')
  const [editMode, setEditMode] = useState(false)
  const [editedContent, setEditedContent] = useState(newContent)

  const diff = useMemo(() => computeDiff(oldContent, newContent), [oldContent, newContent])

  const handleSave = () => {
    onEditAndApply?.(editedContent)
    setEditMode(false)
  }

  const handleCancelEdit = () => {
    setEditedContent(newContent)
    setEditMode(false)
  }

  return (
    <div className="bg-slate-900/60 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900/80 border-b border-white/10 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
          {filename && <span className="font-mono text-xs text-slate-300 truncate">{filename}</span>}
          <span className="text-xs">
            <span className="text-emerald-400">+{diff.additions}</span>{' '}
            <span className="text-red-400">-{diff.deletions}</span>
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setView('unified')}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              view === 'unified' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Unified
          </button>
          <button
            onClick={() => setView('split')}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              view === 'split' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Split
          </button>
        </div>
      </div>

      {/* Body */}
      {editMode ? (
        <div className="p-3 space-y-2">
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            spellCheck={false}
            className="font-mono bg-slate-950 text-slate-200 min-h-[200px] w-full rounded-lg p-3 text-xs border border-white/10"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg px-4 py-2 font-medium text-sm transition-colors"
            >
              <Check className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg px-4 py-2 font-medium text-sm transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="font-mono text-xs overflow-x-auto max-h-[400px] overflow-y-auto select-text">
            {view === 'unified' ? (
              <UnifiedRows rows={diff.rows} />
            ) : (
              <SplitRows
                oldLines={diff.oldLines}
                newLines={diff.newLines}
                oldSet={diff.oldSet}
                newSet={diff.newSet}
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-white/10">
            <button
              onClick={() => onApply?.()}
              className="flex items-center gap-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg px-4 py-2 font-medium text-sm transition-colors"
            >
              <Check className="w-4 h-4" />
              Apply
            </button>
            <button
              onClick={() => onReject?.()}
              className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg px-4 py-2 font-medium text-sm transition-colors"
            >
              <X className="w-4 h-4" />
              Reject
            </button>
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg px-4 py-2 font-medium text-sm transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Edit & Apply
            </button>
          </div>
        </>
      )}
    </div>
  )
}
