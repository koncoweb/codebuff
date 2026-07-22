import React, { useState } from 'react'
import { Sparkles, Cpu, UserCheck, Settings, ShieldCheck, Zap, Lock, Bot, RotateCcw, FolderGit2, Plus, Trash2, LogOut, ChevronDown, User } from 'lucide-react'
import type { NeonUser } from '../services/neon-auth'
import { clearUserSession } from '../services/neon-auth'
import { CURATED_LLM_MODELS } from '../services/sidecar-api'
import type { UserProject } from '../services/sidecar-api'

interface HeaderProps {
  user: NeonUser | null
  activeProvider: string
  selectedModel: string
  projects: UserProject[]
  activeProjectId: string
  onSelectProject: (projectId: string) => void
  onCreateProject: () => void
  onDeleteProject: (projectId: string) => void
  onSelectModel: (modelId: string) => void
  onOpenAuth: () => void
  onLogout: () => void
  onOpenSettings: () => void
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeProvider,
  selectedModel,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onSelectModel,
  onOpenAuth,
  onLogout,
  onOpenSettings,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const isPremium = user?.membershipTier === 'pro' || user?.membershipTier === 'vip' || user?.membershipTier === 'special'

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0]

  return (
    <header className="h-14 border-b border-slate-800/80 glass-panel px-4 flex items-center justify-between shrink-0 select-none z-20">
      {/* Brand & Logo */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-xl gradient-bg-accent flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Sparkles className="w-5 h-5 text-white animate-pulse" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-display font-bold text-base tracking-wide text-white">
              Konco<span className="gradient-text">Vibe</span>
            </h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              Desktop v1.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-sans">
            AI Vibe Coding Studio &bull; Sandbox <ShieldCheck className="w-3 h-3 inline text-emerald-400 mb-0.5" />
          </p>
        </div>
      </div>

      {/* Center Project Selector & LLM Model Selector */}
      <div className="flex items-center space-x-2">
        {/* Multi-Project Dropdown */}
        <div className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-200">
          <FolderGit2 className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="hidden lg:inline text-slate-400">Proyek:</span>
          <select
            value={activeProjectId}
            onChange={(e) => onSelectProject(e.target.value)}
            className="bg-transparent text-white font-medium focus:outline-none cursor-pointer text-xs max-w-[150px] truncate"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                {p.name}
              </option>
            ))}
          </select>

          {/* Create New Project Button */}
          <button
            onClick={onCreateProject}
            className="p-1 hover:bg-slate-800 rounded text-cyan-400 hover:text-cyan-300"
            title="Tambah Proyek Baru"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* LLM Model Selector */}
        <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-cyan-500/40 text-xs text-slate-200 shadow-md shadow-cyan-500/10 hover:border-cyan-400 transition-colors">
          <Bot className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="hidden md:inline text-slate-400">Model:</span>
          
          <select
            value={selectedModel}
            onChange={(e) => onSelectModel(e.target.value)}
            className="bg-transparent text-white font-medium focus:outline-none cursor-pointer pr-4 text-xs"
          >
            <optgroup label="⚡ Super Fast & Murah (Free Tier)">
              {CURATED_LLM_MODELS.filter((m) => m.tier === 'FREE').map((m) => (
                <option key={m.id} value={m.id} className="bg-slate-900 text-slate-200 py-1">
                  {m.name} ({m.badge})
                </option>
              ))}
            </optgroup>

            <optgroup label="⭐ Flagship & Pro Tier">
              {CURATED_LLM_MODELS.filter((m) => m.tier === 'PREMIUM').map((m) => (
                <option key={m.id} value={m.id} className="bg-slate-900 text-amber-300 py-1">
                  👑 {m.name} ({m.badge})
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {/* Right Actions & Account Status */}
      <div className="flex items-center space-x-3">
        {/* Tier Badge */}
        {user && (
          <div
            className={`hidden xl:flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              isPremium
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 shadow-sm shadow-amber-500/20'
                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
            }`}
          >
            {isPremium ? <Zap className="w-3.5 h-3.5 text-amber-400" /> : <Lock className="w-3.5 h-3.5 text-cyan-400" />}
            <span className="uppercase tracking-wider text-[11px]">
              {isPremium ? `PREMIUM (${user.membershipTier})` : 'FREE TIER'}
            </span>
          </div>
        )}

        {/* User Account / Neon Auth Persistent Session Dropdown */}
        <div className="relative">
          {user ? (
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-xs font-medium text-slate-200 transition-colors"
            >
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span className="hidden md:inline max-w-[120px] truncate">{user.name || user.email}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-xs font-medium text-slate-200 transition-colors"
            >
              <User className="w-4 h-4 text-cyan-400" />
              <span>Masuk (Neon Auth)</span>
            </button>
          )}

          {/* User Session Dropdown Menu */}
          {showUserMenu && user && (
            <div className="absolute right-0 mt-2 w-56 glass-panel rounded-xl border border-slate-800 shadow-2xl p-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
              <div className="p-2 border-b border-slate-800/80 mb-1">
                <p className="font-semibold text-white truncate">{user.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  Neon Auth Session Active
                </span>
              </div>

              <button
                onClick={() => {
                  setShowUserMenu(false)
                  onOpenSettings()
                }}
                className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
              >
                <Settings className="w-3.5 h-3.5 text-cyan-400" />
                <span>Pengaturan API &amp; Model</span>
              </button>

              <button
                onClick={() => {
                  setShowUserMenu(false)
                  onLogout()
                }}
                className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded hover:bg-rose-950/60 text-rose-300 hover:text-rose-200 mt-1"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>Keluar Akun (Sign Out)</span>
              </button>
            </div>
          )}
        </div>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-slate-300 hover:text-white transition-colors"
          title="Pengaturan Provider & Key"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
