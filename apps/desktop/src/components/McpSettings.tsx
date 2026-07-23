import React, { useState, useEffect, useCallback } from 'react'
import {
  Server,
  Github,
  Database,
  Globe,
  Plug,
  CheckCircle,
  XCircle,
  Loader,
  Plus,
  Trash2,
  Save,
} from 'lucide-react'
import { sidecarTransport } from '../services/codebuff-sidecar-transport'

/** Map of secret/token names to their values (stored in localStorage). */
export interface McpTokenConfig {
  [key: string]: string
}

const MCP_TOKENS_KEY = 'koncovibe_mcp_tokens'
const MCP_SERVERS_KEY = 'koncovibe_mcp_servers'

type McpStatus = 'connected' | 'disconnected' | 'error' | 'testing'

/** Definition of a built-in MCP server entry. */
interface McpServerDef {
  id: string
  name: string
  command: string
  args: string
  icon: React.ComponentType<{ className?: string }>
  tokenKey?: string
  tokenPlaceholder?: string
}

/** A user-defined custom MCP server. */
export interface McpCustomServer {
  id: string
  name: string
  command: string
  args: string
  env: string
}

interface McpServersState {
  enabled: Record<string, boolean>
  custom: McpCustomServer[]
}

/** Curated list of supported MCP servers. */
const DEFAULT_SERVERS: McpServerDef[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    command: 'npx',
    args: '-y @modelcontextprotocol/server-filesystem',
    icon: Server,
  },
  {
    id: 'github',
    name: 'GitHub',
    command: 'npx',
    args: '-y @modelcontextprotocol/server-github',
    icon: Github,
    tokenKey: 'GITHUB_TOKEN',
    tokenPlaceholder: 'ghp_...',
  },
  {
    id: 'playwright',
    name: 'Playwright',
    command: 'npx',
    args: '@playwright/mcp@latest',
    icon: Globe,
  },
  {
    id: 'supabase',
    name: 'Supabase',
    command: 'npx',
    args: '-y @supabase/mcp-server',
    icon: Database,
    tokenKey: 'SUPABASE_TOKEN',
    tokenPlaceholder: 'sbp_...',
  },
  {
    id: 'neon',
    name: 'Neon',
    command: 'npx',
    args: '-y @neondatabase/mcp-server-neon',
    icon: Plug,
    tokenKey: 'NEON_API_KEY',
    tokenPlaceholder: 'neon_...',
  },
]

/** Load the saved MCP token config from localStorage. */
export function loadMcpTokens(): McpTokenConfig {
  try {
    const saved = localStorage.getItem(MCP_TOKENS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed && typeof parsed === 'object') return parsed as McpTokenConfig
    }
  } catch (e) {
    console.error('[McpSettings] Failed to load MCP tokens', e)
  }
  return {}
}

/** Persist the MCP token config to localStorage. */
export function saveMcpTokens(tokens: McpTokenConfig): void {
  try {
    localStorage.setItem(MCP_TOKENS_KEY, JSON.stringify(tokens))
  } catch (e) {
    console.error('[McpSettings] Failed to save MCP tokens', e)
  }
}

/** Load persisted enabled-state and custom servers. */
function loadMcpServersState(): McpServersState {
  const defaults: McpServersState = {
    enabled: Object.fromEntries(DEFAULT_SERVERS.map((s) => [s.id, false])),
    custom: [],
  }
  try {
    const saved = localStorage.getItem(MCP_SERVERS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        enabled: { ...defaults.enabled, ...(parsed?.enabled || {}) },
        custom: Array.isArray(parsed?.custom) ? parsed.custom : [],
      }
    }
  } catch (e) {
    console.error('[McpSettings] Failed to load MCP servers state', e)
  }
  return defaults
}

/** Persist enabled-state and custom servers. */
function saveMcpServersState(state: McpServersState): void {
  try {
    localStorage.setItem(MCP_SERVERS_KEY, JSON.stringify(state))
  } catch (e) {
    console.error('[McpSettings] Failed to save MCP servers state', e)
  }
}

export const McpSettings: React.FC = () => {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => loadMcpServersState().enabled)
  const [customServers, setCustomServers] = useState<McpCustomServer[]>(() => loadMcpServersState().custom)
  const [tokens, setTokens] = useState<McpTokenConfig>(() => loadMcpTokens())
  const [statuses, setStatuses] = useState<Record<string, McpStatus>>({})
  const [testingId, setTestingId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // New custom server form
  const [newName, setNewName] = useState('')
  const [newCommand, setNewCommand] = useState('')
  const [newArgs, setNewArgs] = useState('')
  const [newEnv, setNewEnv] = useState('')

  // Persist tokens whenever they change
  useEffect(() => {
    saveMcpTokens(tokens)
  }, [tokens])

  // Persist enabled + custom servers whenever they change
  useEffect(() => {
    saveMcpServersState({ enabled, custom: customServers })
  }, [enabled, customServers])

  const toggleServer = useCallback((id: string) => {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }))
    // Reset status when toggling off
    setStatuses((prev) => {
      if (prev[id]) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return prev
    })
  }, [])

  const updateToken = useCallback((key: string, value: string) => {
    setTokens((prev) => ({ ...prev, [key]: value }))
  }, [])

  /** Test a single server connection via the sidecar transport's ping. */
  const handleTest = useCallback(async (id: string) => {
    setTestingId(id)
    setStatuses((prev) => ({ ...prev, [id]: 'testing' }))
    try {
      const started = await sidecarTransport.start()
      if (!started) {
        setStatuses((prev) => ({ ...prev, [id]: 'error' }))
        return
      }
      const result = await sidecarTransport.ping()
      if (result?.pong) {
        setStatuses((prev) => ({ ...prev, [id]: 'connected' }))
      } else {
        setStatuses((prev) => ({ ...prev, [id]: 'error' }))
      }
    } catch (err: any) {
      console.error('[McpSettings] ping failed for', id, err)
      setStatuses((prev) => ({ ...prev, [id]: 'error' }))
    } finally {
      setTestingId(null)
    }
  }, [])

  const handleAddCustom = useCallback(() => {
    const name = newName.trim()
    const command = newCommand.trim()
    if (!name || !command) return
    const server: McpCustomServer = {
      id: `custom-${Date.now()}`,
      name,
      command,
      args: newArgs.trim(),
      env: newEnv.trim(),
    }
    setCustomServers((prev) => [...prev, server])
    setEnabled((prev) => ({ ...prev, [server.id]: true }))
    setNewName('')
    setNewCommand('')
    setNewArgs('')
    setNewEnv('')
  }, [newName, newCommand, newArgs, newEnv])

  const handleRemoveCustom = useCallback((id: string) => {
    setCustomServers((prev) => prev.filter((s) => s.id !== id))
    setEnabled((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setStatuses((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const handleSaveAll = useCallback(() => {
    saveMcpTokens(tokens)
    saveMcpServersState({ enabled, custom: customServers })
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
  }, [tokens, enabled, customServers])

  /** Render a single status indicator badge. */
  const renderStatus = (id: string) => {
    const status = statuses[id]
    if (testingId === id || status === 'testing') {
      return (
        <span className="flex items-center space-x-1 text-xs text-cyan-300">
          <Loader className="w-3.5 h-3.5 animate-spin" />
          <span>Testing...</span>
        </span>
      )
    }
    if (status === 'connected') {
      return (
        <span className="flex items-center space-x-1 text-xs text-emerald-300">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Connected</span>
        </span>
      )
    }
    if (status === 'error') {
      return (
        <span className="flex items-center space-x-1 text-xs text-rose-300">
          <XCircle className="w-3.5 h-3.5" />
          <span>Error</span>
        </span>
      )
    }
    return (
      <span className="flex items-center space-x-1 text-xs text-slate-500">
        <XCircle className="w-3.5 h-3.5" />
        <span>Disconnected</span>
      </span>
    )
  }

  /** Render a built-in server row. */
  const renderServer = (server: McpServerDef) => {
    const Icon = server.icon
    const isEnabled = !!enabled[server.id]
    return (
      <div
        key={server.id}
        className={`rounded-xl border p-4 transition-colors ${
          isEnabled
            ? 'bg-slate-900/60 border-cyan-500/30'
            : 'bg-slate-900/60 border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-lg ${
                isEnabled
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{server.name}</div>
              <div className="text-[11px] font-mono text-slate-500 truncate">
                {server.command} {server.args}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {renderStatus(server.id)}
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={() => toggleServer(server.id)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer accent-cyan-500"
              />
            </label>
          </div>
        </div>

        {server.tokenKey && (
          <div className="mt-3">
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              <span className="font-mono text-cyan-400">{server.tokenKey}</span>
            </label>
            <input
              type="password"
              value={tokens[server.tokenKey] || ''}
              onChange={(e) => updateToken(server.tokenKey!, e.target.value)}
              placeholder={server.tokenPlaceholder || 'token...'}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <button
            onClick={() => handleTest(server.id)}
            disabled={testingId === server.id}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {testingId === server.id ? (
              <Loader className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plug className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>Test Connection</span>
          </button>
        </div>
      </div>
    )
  }

  /** Render a custom server row. */
  const renderCustomServer = (server: McpCustomServer) => {
    const isEnabled = !!enabled[server.id]
    return (
      <div
        key={server.id}
        className={`rounded-xl border p-4 transition-colors ${
          isEnabled
            ? 'bg-slate-900/60 border-purple-500/40'
            : 'bg-slate-900/60 border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-lg ${
                isEnabled
                  ? 'bg-purple-500/20 text-purple-300'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              <Server className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{server.name}</div>
              <div className="text-[11px] font-mono text-slate-500 truncate">
                {server.command} {server.args}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {renderStatus(server.id)}
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={() => toggleServer(server.id)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer accent-cyan-500"
              />
            </label>
            <button
              onClick={() => handleRemoveCustom(server.id)}
              className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              title="Remove server"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {server.env && (
          <div className="mt-2 text-[11px] font-mono text-slate-500 truncate">
            ENV: {server.env}
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <button
            onClick={() => handleTest(server.id)}
            disabled={testingId === server.id}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {testingId === server.id ? (
              <Loader className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plug className="w-3.5 h-3.5 text-purple-400" />
            )}
            <span>Test Connection</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Plug className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold text-sm text-white">
            MCP Servers
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          {DEFAULT_SERVERS.length + customServers.length} servers
        </span>
      </div>

      {/* Built-in servers */}
      <div className="space-y-3">
        {DEFAULT_SERVERS.map(renderServer)}
      </div>

      {/* Custom servers */}
      {customServers.length > 0 && (
        <div className="space-y-3">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Custom Servers
          </div>
          {customServers.map(renderCustomServer)}
        </div>
      )}

      {/* Add custom server form */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <div className="flex items-center space-x-2">
          <Plus className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Add Custom MCP Server
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (e.g. my-mcp)"
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
          />
          <input
            type="text"
            value={newCommand}
            onChange={(e) => setNewCommand(e.target.value)}
            placeholder="Command (e.g. npx)"
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
          />
        </div>
        <input
          type="text"
          value={newArgs}
          onChange={(e) => setNewArgs(e.target.value)}
          placeholder="Args (e.g. -y @modelcontextprotocol/server-sqlite)"
          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
        />
        <input
          type="text"
          value={newEnv}
          onChange={(e) => setNewEnv(e.target.value)}
          placeholder="Env vars (e.g. API_KEY=xxx, DEBUG=true)"
          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
        />
        <div className="flex justify-end">
          <button
            onClick={handleAddCustom}
            disabled={!newName.trim() || !newCommand.trim()}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Server</span>
          </button>
        </div>
      </div>

      {/* Footer save */}
      <div className="flex items-center justify-end pt-1">
        <button
          onClick={handleSaveAll}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-lg gradient-bg-accent text-xs font-medium text-white shadow-md shadow-cyan-500/20 hover:opacity-90 transition-opacity"
        >
          {saved ? <CheckCircle className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
          <span>{saved ? 'Saved!' : 'Save MCP Settings'}</span>
        </button>
      </div>
    </div>
  )
}

export default McpSettings
