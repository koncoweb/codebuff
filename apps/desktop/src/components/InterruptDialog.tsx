import React, { useState, useMemo } from 'react'
import { AlertCircle, Check, X, Edit3, Clock, Send } from 'lucide-react'

export interface InterruptDialogProps {
  interrupts: Array<{
    id: string
    reason: string // 'tool_call' | 'input_required' | 'confirmation'
    message?: string
    toolCallId?: string
    responseSchema?: Record<string, unknown>
    expiresAt?: string
  }>
  onResolve: (interruptId: string, payload: unknown) => void
  onCancel: (interruptId: string) => void
}

// ============================================================================
// Helpers
// ============================================================================

/** Check if the response schema supports `editedArgs` (enables "Edit & Approve"). */
function schemaSupportsEdit(schema?: Record<string, unknown>): boolean {
  if (!schema) return false
  const props = schema.properties as Record<string, unknown> | undefined
  return !!props && 'editedArgs' in props
}

/**
 * Extract tool name and args from the interrupt.
 * Tries to parse `message` as a JSON object ({ toolName, args }); falls back to
 * using `toolCallId` as the tool name and `message` as a plain-text description.
 */
function parseToolInfo(
  message?: string,
  toolCallId?: string
): { toolName: string; args: Record<string, unknown> | null; isJsonMessage: boolean } {
  if (message) {
    try {
      const parsed = JSON.parse(message)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>
        const rawArgs = obj.args ?? obj.arguments ?? obj.input ?? null
        return {
          toolName: String(obj.toolName ?? obj.tool ?? obj.name ?? toolCallId ?? 'unknown'),
          args: rawArgs as Record<string, unknown> | null,
          isJsonMessage: true,
        }
      }
    } catch {
      // message is plain text, not JSON — fall through
    }
  }
  return { toolName: toolCallId || 'unknown', args: null, isJsonMessage: false }
}

// ============================================================================
// Shared UI
// ============================================================================

const CardHeader: React.FC<{ title: string; expiresAt?: string }> = ({ title, expiresAt }) => (
  <div className="flex items-center gap-2 mb-3">
    <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0" />
    <span className="text-sm font-semibold text-slate-200">{title}</span>
    {expiresAt && (
      <span className="flex items-center gap-1 ml-auto text-[10px] text-slate-500">
        <Clock className="w-3 h-3" />
        {new Date(expiresAt).toLocaleTimeString()}
      </span>
    )}
  </div>
)

// Reusable button class builders
const btnBase = 'flex items-center gap-1.5 rounded-lg px-4 py-2 font-medium text-sm border transition-colors'
const btnApprove = `${btnBase} bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-cyan-500/40`
const btnDeny = `${btnBase} bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30`
const btnEdit = `${btnBase} bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border-purple-500/30`
const btnGhost = 'rounded-lg px-3 py-2 font-medium text-xs text-slate-500 hover:text-slate-300 transition-colors'

// ============================================================================
// Tool Call Card — approval with optional arg editing
// ============================================================================

const ToolCallCard: React.FC<{
  interrupt: InterruptDialogProps['interrupts'][number]
  onResolve: InterruptDialogProps['onResolve']
  onCancel: InterruptDialogProps['onCancel']
}> = ({ interrupt, onResolve, onCancel }) => {
  const { toolName, args, isJsonMessage } = parseToolInfo(interrupt.message, interrupt.toolCallId)
  const canEdit = schemaSupportsEdit(interrupt.responseSchema)

  const [editMode, setEditMode] = useState(false)
  const [editText, setEditText] = useState(() => (args ? JSON.stringify(args, null, 2) : '{}'))
  const [editError, setEditError] = useState('')

  const handleApprove = () => onResolve(interrupt.id, { approved: true })
  const handleDeny = () => onResolve(interrupt.id, { approved: false })

  const handleEditApprove = () => {
    try {
      const editedArgs = JSON.parse(editText)
      onResolve(interrupt.id, { approved: true, editedArgs })
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Invalid JSON')
    }
  }

  return (
    <div className="bg-slate-900/80 border border-cyan-500/30 rounded-xl p-4 animate-slide-in space-y-3">
      <CardHeader title="Tool Approval Required" expiresAt={interrupt.expiresAt} />

      {/* Tool name + ID */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Tool</span>
          <code className="text-xs font-mono text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded">
            {toolName}
          </code>
        </div>
        {interrupt.toolCallId && interrupt.toolCallId !== toolName && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">ID</span>
            <code className="text-[10px] font-mono text-slate-500 truncate">{interrupt.toolCallId}</code>
          </div>
        )}
      </div>

      {/* Proposed args (read-only) */}
      {args && !editMode && (
        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">Proposed Arguments</span>
          <pre className="text-[11px] font-mono text-slate-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800 overflow-x-auto max-h-32">
            {JSON.stringify(args, null, 2)}
          </pre>
        </div>
      )}

      {/* Edit mode — editable JSON textarea */}
      {editMode && (
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Edit Arguments (JSON)</span>
          <textarea
            value={editText}
            onChange={(e) => { setEditText(e.target.value); setEditError('') }}
            rows={6}
            spellCheck={false}
            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-purple-500/50 focus:outline-none text-[11px] font-mono text-slate-200 resize-y overflow-auto transition-colors"
          />
          {editError && <p className="text-[10px] text-rose-400">Invalid JSON: {editError}</p>}
        </div>
      )}

      {/* Plain-text message (when message is not JSON tool info) */}
      {interrupt.message && !isJsonMessage && (
        <p className="text-xs text-slate-400">{interrupt.message}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {editMode ? (
          <>
            <button onClick={handleEditApprove} className={btnEdit}>
              <Check className="w-3.5 h-3.5" />
              Save &amp; Approve
            </button>
            <button
              onClick={() => { setEditMode(false); setEditError('') }}
              className="rounded-lg px-4 py-2 font-medium text-sm bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 border border-slate-700/60 transition-colors"
            >
              Cancel Edit
            </button>
          </>
        ) : (
          <>
            <button onClick={handleApprove} className={btnApprove}>
              <Check className="w-3.5 h-3.5" />
              Approve
            </button>
            <button onClick={handleDeny} className={btnDeny}>
              <X className="w-3.5 h-3.5" />
              Deny
            </button>
            {canEdit && (
              <button onClick={() => setEditMode(true)} className={btnEdit}>
                <Edit3 className="w-3.5 h-3.5" />
                Edit &amp; Approve
              </button>
            )}
            <button onClick={() => onCancel(interrupt.id)} className={`${btnGhost} ml-auto`}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Input Required Card — JSON Schema → form fields
// ============================================================================

const inputClass =
  'w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-cyan-500/50 focus:outline-none text-[11px] text-slate-200 transition-colors'

const InputRequiredCard: React.FC<{
  interrupt: InterruptDialogProps['interrupts'][number]
  onResolve: InterruptDialogProps['onResolve']
  onCancel: InterruptDialogProps['onCancel']
}> = ({ interrupt, onResolve, onCancel }) => {
  const schema = interrupt.responseSchema
  const properties = (schema?.properties ?? {}) as Record<string, Record<string, unknown>>
  const requiredList = (schema?.required ?? []) as string[]
  const requiredSet = useMemo(() => new Set(requiredList), [requiredList])
  const hasFields = Object.keys(properties).length > 0

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {}
    Object.entries(properties).forEach(([key, prop]) => {
      if (prop.default !== undefined) {
        initial[key] = prop.default
      } else if (prop.type === 'boolean') {
        initial[key] = false
      } else {
        initial[key] = ''
      }
    })
    return initial
  })
  // Fallback free-text input when no schema properties are provided
  const [fallback, setFallback] = useState('')

  const setValue = (key: string, val: unknown) => setValues((prev) => ({ ...prev, [key]: val }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!hasFields) {
      if (!fallback.trim()) return
      onResolve(interrupt.id, { response: fallback })
      return
    }

    // Validate required fields
    for (const req of requiredList) {
      const v = values[req]
      if (v === '' || v === undefined || v === null) return
    }

    // Coerce number strings to numbers
    const payload: Record<string, unknown> = {}
    Object.entries(values).forEach(([key, val]) => {
      const propType = properties[key]?.type
      if ((propType === 'number' || propType === 'integer') && val !== '') {
        payload[key] = Number(val)
      } else {
        payload[key] = val
      }
    })
    onResolve(interrupt.id, payload)
  }

  const isRequired = (key: string) => requiredSet.has(key)

  return (
    <div className="bg-slate-900/80 border border-cyan-500/30 rounded-xl p-4 animate-slide-in space-y-3">
      <CardHeader title="Input Required" expiresAt={interrupt.expiresAt} />

      {interrupt.message && <p className="text-xs text-slate-400">{interrupt.message}</p>}

      <form onSubmit={handleSubmit} className="space-y-3">
        {hasFields ? (
          Object.entries(properties).map(([key, prop]) => {
            const type = prop.type as string
            const enumValues = prop.enum as unknown[] | undefined
            const label = (prop.title as string) || key
            const req = isRequired(key)

            return (
              <div key={key} className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-300">
                  {label}
                  {req && <span className="text-rose-400 ml-0.5">*</span>}
                </label>

                {type === 'boolean' ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!values[key]}
                      onChange={(e) => setValue(key, e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 accent-cyan-500"
                    />
                    <span className="text-[11px] text-slate-400">{values[key] ? 'Yes' : 'No'}</span>
                  </label>
                ) : enumValues ? (
                  <select
                    value={String(values[key] ?? '')}
                    onChange={(e) => setValue(key, e.target.value)}
                    className={inputClass}
                  >
                    <option value="" disabled>
                      {req ? 'Select...' : 'Optional...'}
                    </option>
                    {enumValues.map((opt) => (
                      <option key={String(opt)} value={String(opt)}>
                        {String(opt)}
                      </option>
                    ))}
                  </select>
                ) : type === 'number' || type === 'integer' ? (
                  <input
                    type="number"
                    value={String(values[key] ?? '')}
                    onChange={(e) => setValue(key, e.target.value)}
                    className={inputClass}
                  />
                ) : (
                  <input
                    type="text"
                    value={String(values[key] ?? '')}
                    onChange={(e) => setValue(key, e.target.value)}
                    placeholder={(prop.description as string) || ''}
                    className={inputClass}
                  />
                )}
              </div>
            )
          })
        ) : (
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-300">
              Response <span className="text-rose-400 ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={fallback}
              onChange={(e) => setFallback(e.target.value)}
              placeholder="Type your response..."
              className={inputClass}
            />
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button type="submit" className={btnApprove}>
            <Send className="w-3.5 h-3.5" />
            Submit
          </button>
          <button type="button" onClick={() => onCancel(interrupt.id)} className={btnDeny}>
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ============================================================================
// Confirmation Card — simple yes/no
// ============================================================================

const ConfirmationCard: React.FC<{
  interrupt: InterruptDialogProps['interrupts'][number]
  onResolve: InterruptDialogProps['onResolve']
  onCancel: InterruptDialogProps['onCancel']
}> = ({ interrupt, onResolve, onCancel }) => (
  <div className="bg-slate-900/80 border border-cyan-500/30 rounded-xl p-4 animate-slide-in space-y-3">
    <CardHeader title="Confirmation Required" expiresAt={interrupt.expiresAt} />

    {interrupt.message && <p className="text-xs text-slate-300">{interrupt.message}</p>}

    <div className="flex items-center gap-2 pt-1">
      <button
        onClick={() => onResolve(interrupt.id, { confirmed: true })}
        className={btnApprove}
      >
        <Check className="w-3.5 h-3.5" />
        Yes
      </button>
      <button
        onClick={() => onResolve(interrupt.id, { confirmed: false })}
        className={btnDeny}
      >
        <X className="w-3.5 h-3.5" />
        No
      </button>
      <button onClick={() => onCancel(interrupt.id)} className={`${btnGhost} ml-auto`}>
        Dismiss
      </button>
    </div>
  </div>
)

// ============================================================================
// Dispatcher + Main Export
// ============================================================================

const InterruptCard: React.FC<{
  interrupt: InterruptDialogProps['interrupts'][number]
  onResolve: InterruptDialogProps['onResolve']
  onCancel: InterruptDialogProps['onCancel']
}> = ({ interrupt, onResolve, onCancel }) => {
  switch (interrupt.reason) {
    case 'tool_call':
      return <ToolCallCard interrupt={interrupt} onResolve={onResolve} onCancel={onCancel} />
    case 'input_required':
      return <InputRequiredCard interrupt={interrupt} onResolve={onResolve} onCancel={onCancel} />
    case 'confirmation':
      return <ConfirmationCard interrupt={interrupt} onResolve={onResolve} onCancel={onCancel} />
    default:
      // Unknown reason — fall back to a generic confirmation card
      return <ConfirmationCard interrupt={interrupt} onResolve={onResolve} onCancel={onCancel} />
  }
}

export const InterruptDialog: React.FC<InterruptDialogProps> = ({
  interrupts,
  onResolve,
  onCancel,
}) => {
  if (interrupts.length === 0) return null

  return (
    <div className="space-y-3">
      {interrupts.map((interrupt) => (
        <InterruptCard
          key={interrupt.id}
          interrupt={interrupt}
          onResolve={onResolve}
          onCancel={onCancel}
        />
      ))}
    </div>
  )
}
