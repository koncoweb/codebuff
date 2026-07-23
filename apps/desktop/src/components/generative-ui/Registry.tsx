import React from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, Info, ExternalLink } from 'lucide-react'

// ============================================================================
// Widget Type Definitions
// ============================================================================

export interface BaseWidget {
  type: string
}

export interface ButtonWidget extends BaseWidget {
  type: 'button'
  text: string
  link?: string
  variant?: 'primary' | 'secondary'
}

export interface CodePreviewWidget extends BaseWidget {
  type: 'code_preview'
  code: string
  language?: string
}

export interface DiffViewWidget extends BaseWidget {
  type: 'diff_view'
  oldContent: string
  newContent: string
  filename?: string
}

export interface ImageGridWidget extends BaseWidget {
  type: 'image_grid'
  images: Array<{ url: string; alt?: string }>
}

export interface StatusCardWidget extends BaseWidget {
  type: 'status_card'
  icon?: string
  title: string
  message?: string
  variant?: 'success' | 'warning' | 'error' | 'info'
}

export interface ActionChipsWidget extends BaseWidget {
  type: 'action_chips'
  chips: Array<{ label: string; action?: string }>
}

export type Widget =
  | ButtonWidget
  | CodePreviewWidget
  | DiffViewWidget
  | ImageGridWidget
  | StatusCardWidget
  | ActionChipsWidget

export type GenerativeUIComponent = React.FC<{
  widget: Widget
  onInteract?: (data: unknown) => void
}>

// ============================================================================
// 1. ButtonWidgetView
//    Rounded button — primary = cyan gradient, secondary = slate.
//    Opens link in new tab if provided.
// ============================================================================

const ButtonWidgetView: GenerativeUIComponent = ({ widget, onInteract }) => {
  const w = widget as ButtonWidget
  const isPrimary = w.variant !== 'secondary'

  const handleClick = () => {
    onInteract?.({ type: 'button_click', text: w.text, link: w.link })
    if (w.link) {
      window.open(w.link, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
        isPrimary
          ? 'gradient-bg-accent text-white hover:opacity-90'
          : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700'
      }`}
    >
      <span>{w.text}</span>
      {w.link && <ExternalLink className="w-3.5 h-3.5" />}
    </button>
  )
}

// ============================================================================
// 2. CodePreviewWidgetView
//    Monospace code block on dark bg, language label in top-right corner.
// ============================================================================

const CodePreviewWidgetView: GenerativeUIComponent = ({ widget }) => {
  const w = widget as CodePreviewWidget
  return (
    <div className="relative rounded-lg border border-slate-800 overflow-hidden">
      {w.language && (
        <span
          className="absolute z-10 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-cyan-300 uppercase tracking-wider"
          style={{ top: '0.5rem', right: '0.5rem' }}
        >
          {w.language}
        </span>
      )}
      <pre
        className="font-mono text-xs text-slate-200 bg-slate-950 p-4 overflow-x-auto"
        style={{ maxHeight: '300px', overflowY: 'auto' }}
      >
        <code>{w.code}</code>
      </pre>
    </div>
  )
}

// ============================================================================
// 3. DiffViewWidgetView
//    Two-column diff — old (left, red) vs new (right, green).
//    Uses simple set-based line comparison to highlight additions/deletions.
// ============================================================================

const DiffViewWidgetView: GenerativeUIComponent = ({ widget }) => {
  const w = widget as DiffViewWidget
  const oldLines = w.oldContent.split('\n')
  const newLines = w.newContent.split('\n')
  const oldLineSet = new Set(oldLines)
  const newLineSet = new Set(newLines)

  return (
    <div className="rounded-lg border border-slate-800 overflow-hidden">
      {w.filename && (
        <div className="px-3 py-2 border-b border-slate-800 bg-slate-900 flex items-center gap-2">
          <span className="text-xs font-mono text-slate-300 truncate">{w.filename}</span>
        </div>
      )}
      <div className="grid grid-cols-2">
        {/* Old content — deletions in red */}
        <div className="border-r border-slate-800 overflow-hidden">
          <div
            className="px-3 py-1.5 border-b border-slate-800 text-[10px] font-semibold uppercase tracking-wider text-rose-400"
            style={{ backgroundColor: 'rgba(159, 18, 57, 0.15)' }}
          >
            Old
          </div>
          <pre
            className="font-mono text-xs bg-slate-950 p-3 overflow-x-auto"
            style={{ maxHeight: '300px', overflowY: 'auto' }}
          >
            {oldLines.map((line, i) => {
              const isDeleted = !newLineSet.has(line)
              return (
                <div
                  key={i}
                  style={{
                    whiteSpace: 'pre',
                    color: isDeleted ? '#fca5a5' : '#94a3b8',
                    backgroundColor: isDeleted ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                  }}
                >
                  {line || ' '}
                </div>
              )
            })}
          </pre>
        </div>
        {/* New content — additions in green */}
        <div className="overflow-hidden">
          <div
            className="px-3 py-1.5 border-b border-slate-800 text-[10px] font-semibold uppercase tracking-wider text-emerald-400"
            style={{ backgroundColor: 'rgba(6, 78, 59, 0.15)' }}
          >
            New
          </div>
          <pre
            className="font-mono text-xs bg-slate-950 p-3 overflow-x-auto"
            style={{ maxHeight: '300px', overflowY: 'auto' }}
          >
            {newLines.map((line, i) => {
              const isAdded = !oldLineSet.has(line)
              return (
                <div
                  key={i}
                  style={{
                    whiteSpace: 'pre',
                    color: isAdded ? '#6ee7b7' : '#94a3b8',
                    backgroundColor: isAdded ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                  }}
                >
                  {line || ' '}
                </div>
              )
            })}
          </pre>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// 4. ImageGridWidgetView
//    Responsive grid — 1 col for single image, 2 cols for 2-3, 3 cols for 4+.
// ============================================================================

const ImageGridWidgetView: GenerativeUIComponent = ({ widget }) => {
  const w = widget as ImageGridWidget
  if (w.images.length === 0) return null

  const cols = w.images.length === 1 ? 1 : w.images.length <= 3 ? 2 : 3

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {w.images.map((img, i) => (
        <div
          key={i}
          className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-900"
        >
          <img
            src={img.url}
            alt={img.alt || ''}
            className="w-full"
            style={{ aspectRatio: '16 / 9', objectFit: 'cover' }}
            loading="lazy"
          />
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// 5. StatusCardWidgetView
//    Glass card with icon, title, message.
//    success = emerald, warning = amber, error = red, info = cyan.
// ============================================================================

const STATUS_CONFIG: Record<
  NonNullable<StatusCardWidget['variant']>,
  {
    icon: React.ReactElement
    iconColor: string
    titleColor: string
    borderColor: string
    bgTint: string
    iconBg: string
  }
> = {
  success: {
    icon: <CheckCircle className="w-5 h-5" />,
    iconColor: '#34d399',
    titleColor: '#6ee7b7',
    borderColor: 'rgba(6, 78, 59, 0.5)',
    bgTint: 'rgba(16, 185, 129, 0.05)',
    iconBg: 'rgba(16, 185, 129, 0.15)',
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5" />,
    iconColor: '#fbbf24',
    titleColor: '#fcd34d',
    borderColor: 'rgba(120, 53, 15, 0.5)',
    bgTint: 'rgba(245, 158, 11, 0.05)',
    iconBg: 'rgba(245, 158, 11, 0.15)',
  },
  error: {
    icon: <AlertCircle className="w-5 h-5" />,
    iconColor: '#f87171',
    titleColor: '#fca5a5',
    borderColor: 'rgba(159, 18, 57, 0.5)',
    bgTint: 'rgba(239, 68, 68, 0.05)',
    iconBg: 'rgba(239, 68, 68, 0.15)',
  },
  info: {
    icon: <Info className="w-5 h-5" />,
    iconColor: '#22d3ee',
    titleColor: '#67e8f9',
    borderColor: 'rgba(21, 94, 117, 0.4)',
    bgTint: 'rgba(6, 182, 212, 0.05)',
    iconBg: 'rgba(6, 182, 212, 0.15)',
  },
}

const StatusCardWidgetView: GenerativeUIComponent = ({ widget }) => {
  const w = widget as StatusCardWidget
  const variant = w.variant || 'info'
  const config = STATUS_CONFIG[variant]

  return (
    <div
      className="glass-card rounded-xl p-4 border"
      style={{ backgroundColor: config.bgTint, borderColor: config.borderColor }}
    >
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 rounded-lg flex items-center justify-center"
          style={{ width: '2.5rem', height: '2.5rem', backgroundColor: config.iconBg, color: config.iconColor }}
        >
          {w.icon ? <span className="text-lg">{w.icon}</span> : config.icon}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <h4 className="text-sm font-semibold" style={{ color: config.titleColor }}>
            {w.title}
          </h4>
          {w.message && (
            <p className="text-xs text-slate-400" style={{ lineHeight: '1.5' }}>
              {w.message}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// 6. ActionChipsWidgetView
//    Row of pill-shaped buttons (rounded-full, bg-cyan-500/10, hover bg-cyan-500/20).
// ============================================================================

const ActionChipsWidgetView: GenerativeUIComponent = ({ widget, onInteract }) => {
  const w = widget as ActionChipsWidget
  if (w.chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {w.chips.map((chip, i) => (
        <button
          key={i}
          onClick={() =>
            onInteract?.({ type: 'chip_click', label: chip.label, action: chip.action })
          }
          className="px-3 py-1.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs text-cyan-300 transition-colors cursor-pointer"
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}

// ============================================================================
// Registry
// ============================================================================

const registry = new Map<string, GenerativeUIComponent>([
  ['button', ButtonWidgetView],
  ['code_preview', CodePreviewWidgetView],
  ['diff_view', DiffViewWidgetView],
  ['image_grid', ImageGridWidgetView],
  ['status_card', StatusCardWidgetView],
  ['action_chips', ActionChipsWidgetView],
])

export function registerWidget(type: string, component: GenerativeUIComponent) {
  registry.set(type, component)
}

export function renderWidget(
  widget: Widget,
  onInteract?: (data: unknown) => void
): React.ReactElement | null {
  const Component = registry.get(widget.type)
  if (!Component) {
    return null
  }
  return <Component widget={widget} onInteract={onInteract} />
}

// ============================================================================
// Main Component
// ============================================================================

export function GenerativeUIView({
  widget,
  onInteract,
}: {
  widget: Widget
  onInteract?: (data: unknown) => void
}) {
  return renderWidget(widget, onInteract)
}
