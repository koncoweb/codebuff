import React, { useState, useEffect } from 'react'
import { X, Cpu, Key, Globe, Shield, Save, Check, Bot, Server } from 'lucide-react'
import { CURATED_LLM_MODELS } from '../services/sidecar-api'
import { McpSettings } from './McpSettings'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  activeProvider: string
  setActiveProvider: (provider: string) => void
  providerConfig: { provider: string; apiKey: string; baseUrl: string; selectedModel: string }
  setProviderConfig: (config: { provider: string; apiKey: string; baseUrl: string; selectedModel: string }) => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  activeProvider,
  setActiveProvider,
  providerConfig,
  setProviderConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'provider' | 'mcp'>('provider')
  const [sumopodKey, setSumopodKey] = useState(providerConfig.apiKey || import.meta.env.VITE_SUMOPOD_API_KEY || '')
  const [sumopodBaseUrl, setSumopodBaseUrl] = useState(providerConfig.baseUrl || import.meta.env.VITE_SUMOPOD_BASE_URL || 'https://ai.sumopod.com/v1')
  const [selectedModel, setSelectedModel] = useState(providerConfig.selectedModel || import.meta.env.VITE_SUMOPOD_DEFAULT_MODEL || 'MiniMax-M2.7-highspeed')
  const [saved, setSaved] = useState(false)

  // Sync local state with props whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setSumopodKey(providerConfig.apiKey || import.meta.env.VITE_SUMOPOD_API_KEY || '')
      setSumopodBaseUrl(providerConfig.baseUrl || import.meta.env.VITE_SUMOPOD_BASE_URL || 'https://ai.sumopod.com/v1')
      setSelectedModel(providerConfig.selectedModel || import.meta.env.VITE_SUMOPOD_DEFAULT_MODEL || 'MiniMax-M2.7-highspeed')
    }
  }, [isOpen, providerConfig])

  // Auto-update baseUrl saat provider diganti
  const handleProviderChange = (provider: string) => {
    setActiveProvider(provider)
    const providerUrls: Record<string, string> = {
      sumopod: import.meta.env.VITE_SUMOPOD_BASE_URL || 'https://ai.sumopod.com/v1',
      openai: 'https://api.openai.com/v1',
      openrouter: 'https://openrouter.ai/api/v1',
    }
    setSumopodBaseUrl(providerUrls[provider] || providerUrls.sumopod)
  }

  if (!isOpen) return null

  const handleSave = () => {
    setProviderConfig({
      provider: activeProvider,
      apiKey: sumopodKey,
      baseUrl: sumopodBaseUrl,
      selectedModel,
    })
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      onClose()
    }, 1000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg glass-panel rounded-2xl border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h3 className="font-display font-semibold text-base text-white">
              Pengaturan Provider &amp; Model LLM
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/80">
          <button
            onClick={() => setActiveTab('provider')}
            className={`flex items-center space-x-2 px-5 py-3 text-xs font-medium transition-colors border-b-2 ${
              activeTab === 'provider'
                ? 'border-cyan-500 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Provider &amp; Model</span>
          </button>
          <button
            onClick={() => setActiveTab('mcp')}
            className={`flex items-center space-x-2 px-5 py-3 text-xs font-medium transition-colors border-b-2 ${
              activeTab === 'mcp'
                ? 'border-cyan-500 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>MCP Servers</span>
          </button>
        </div>

        {/* Content */}
        {activeTab === 'mcp' ? (
          <div className="p-5 max-h-[75vh] overflow-y-auto">
            <McpSettings />
          </div>
        ) : (
        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Pilih Provider AI
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleProviderChange('sumopod')}
                className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center justify-center space-y-1 transition-all ${
                  activeProvider === 'sumopod'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span className="font-bold text-white">SumoPod AI</span>
                <span className="text-[10px] text-cyan-400 font-mono">OpenAI-Like</span>
              </button>

              <button
                onClick={() => handleProviderChange('openai')}
                className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center justify-center space-y-1 transition-all ${
                  activeProvider === 'openai'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span className="font-bold text-white">OpenAI Direct</span>
                <span className="text-[10px] text-slate-500 font-mono">gpt-4o</span>
              </button>

              <button
                onClick={() => handleProviderChange('openrouter')}
                className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center justify-center space-y-1 transition-all ${
                  activeProvider === 'openrouter'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span className="font-bold text-white">OpenRouter</span>
                <span className="text-[10px] text-slate-500 font-mono">Multi-Model</span>
              </button>
            </div>
          </div>

          {/* Model Selection Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider flex items-center justify-between">
              <span>Pilih Model LLM Utamanya</span>
              <span className="text-[10px] font-normal text-cyan-400 font-mono">{CURATED_LLM_MODELS.length} Model Tersedia</span>
            </label>

            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-white focus:border-cyan-500 focus:outline-none cursor-pointer"
              >
                <optgroup label="⚡ Super Fast & Murah (Free Tier)">
                  {CURATED_LLM_MODELS.filter((m) => m.tier === 'FREE').map((m) => (
                    <option key={m.id} value={m.id} className="bg-slate-900 text-slate-200 py-1">
                      {m.name} ({m.badge}) - [{m.id}]
                    </option>
                  ))}
                </optgroup>

                <optgroup label="⭐ Flagship & Pro Tier">
                  {CURATED_LLM_MODELS.filter((m) => m.tier === 'PREMIUM').map((m) => (
                    <option key={m.id} value={m.id} className="bg-slate-900 text-amber-300 py-1">
                      👑 {m.name} ({m.badge}) - [{m.id}]
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Endpoint Credentials */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                Base URL Endpoint
              </label>
              <input
                type="text"
                value={sumopodBaseUrl}
                onChange={(e) => setSumopodBaseUrl(e.target.value)}
                placeholder="https://ai.sumopod.com/v1"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-cyan-400" />
                API Key Kredensial (BYOK)
              </label>
              <input
                type="password"
                value={sumopodKey}
                onChange={(e) => setSumopodKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
        )}

        {/* Footer */}
        {activeTab === 'provider' && (
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300">
            Batal
          </button>
          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg gradient-bg-accent text-xs font-medium text-white shadow-md shadow-cyan-500/20 hover:opacity-90 transition-opacity"
          >
            {saved ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
            <span>{saved ? 'Tersimpan!' : 'Simpan Pengaturan'}</span>
          </button>
        </div>
        )}
      </div>
    </div>
  )
}
