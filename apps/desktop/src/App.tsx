import React, { useState, useEffect, useRef } from 'react'
import { Header } from './components/Header'
import { ChatPanel } from './components/ChatPanel'
import { LivePreview } from './components/LivePreview'
import type { InspectedElement } from './components/LivePreview'
import { CodeViewer } from './components/CodeViewer'
import { SettingsModal } from './components/SettingsModal'
import { NeonAuthModal } from './components/NeonAuthModal'
import { sendVibeCodingPrompt } from './services/codebuff-integration'
import { getSavedProjects, saveUserProjects, addDebugLog, clearDebugLogs } from './services/sidecar-api'
import type { VibeAgentStep, UserProject, ChatMessage } from './services/sidecar-api'
import type { NeonUser } from './services/neon-auth'
import { getSavedUserSession, saveUserSession, clearUserSession } from './services/neon-auth'

export function App() {
  // Persistent Auth Session
  const [user, setUser] = useState<NeonUser | null>(() => {
    return (
      getSavedUserSession() || {
        id: 'usr_konco_demo',
        email: 'billy@koncoweb.id',
        name: 'Mohamad Billy',
        membershipTier: 'pro',
        expiredAt: null,
      }
    )
  })

  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview')
  const [activeProvider, setActiveProvider] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('koncovibe_provider_config')
      return saved ? JSON.parse(saved).provider : 'sumopod'
    } catch { return 'sumopod' }
  })
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('koncovibe_provider_config')
      return saved ? JSON.parse(saved).selectedModel : (import.meta.env.VITE_SUMOPOD_DEFAULT_MODEL || 'MiniMax-M2.7-highspeed')
    } catch { return import.meta.env.VITE_SUMOPOD_DEFAULT_MODEL || 'MiniMax-M2.7-highspeed' }
  })

  const [providerConfig, setProviderConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('koncovibe_provider_config')
      if (saved) return JSON.parse(saved)
    } catch {}
    return {
      provider: 'sumopod',
      apiKey: import.meta.env.VITE_SUMOPOD_API_KEY || '',
      baseUrl: import.meta.env.VITE_SUMOPOD_BASE_URL || 'https://ai.sumopod.com/v1',
      selectedModel: import.meta.env.VITE_SUMOPOD_DEFAULT_MODEL || 'MiniMax-M2.7-highspeed',
    }
  })

  // Persist provider config to localStorage
  useEffect(() => {
    localStorage.setItem('koncovibe_provider_config', JSON.stringify(providerConfig))
  }, [providerConfig])

  // Multi-Project SaaS State
  const userId = user?.id || 'guest'
  const [projects, setProjects] = useState<UserProject[]>(() => getSavedProjects(userId))
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    const initial = getSavedProjects(userId)
    return initial[0]?.id || `proj-default`
  })

  // Active Project Direct State
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0]
  const [generatedHtml, setGeneratedHtml] = useState<string | undefined>(activeProject?.generatedHtml)
  const [steps, setSteps] = useState<VibeAgentStep[]>(activeProject?.steps || [])

  const [isRunning, setIsRunning] = useState(false)
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [generationVersion, setGenerationVersion] = useState(0)
  const [inspectedElement, setInspectedElement] = useState<InspectedElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Sync projects list whenever user changes
  useEffect(() => {
    const loadedProjects = getSavedProjects(userId)
    setProjects(loadedProjects)
    if (loadedProjects.length > 0) {
      setActiveProjectId(loadedProjects[0].id)
      setGeneratedHtml(loadedProjects[0].generatedHtml)
      setSteps(loadedProjects[0].steps || [])
    }
  }, [user?.id])

  // Sync active project HTML & steps when activeProjectId changes
  useEffect(() => {
    const target = projects.find((p) => p.id === activeProjectId) || projects[0]
    if (target) {
      clearDebugLogs()
      setGeneratedHtml(target.generatedHtml)
      setSteps(target.steps || [])
    }
  }, [activeProjectId])

  // Save projects to localStorage whenever generatedHtml or steps update
  // Uses a ref to avoid race condition: when activeProjectId changes, the
  // switch effect sets new html/steps, which triggers this save effect.
  // Without the ref, activeProjectId in the closure would be stale.
  const activeProjectIdRef = useRef(activeProjectId)
  activeProjectIdRef.current = activeProjectId

  useEffect(() => {
    const projId = activeProjectIdRef.current
    if (!projId || !user) return
    setProjects((prevProjects) => {
      const updated = prevProjects.map((p) => {
        if (p.id === projId) {
          return { ...p, generatedHtml, steps, updatedAt: new Date().toLocaleTimeString() }
        }
        return p
      })
      saveUserProjects(userId, updated)
      return updated
    })
  }, [generatedHtml, steps])

  // Create New Project Handler
  const handleCreateProject = () => {
    const name = window.prompt('Masukkan nama proyek baru:', `Proyek Vibe ${projects.length + 1}`)
    if (!name || !name.trim()) return

    const newProject: UserProject = {
      id: `proj-${Date.now()}`,
      userId,
      name: name.trim(),
      steps: [],
      createdAt: new Date().toLocaleTimeString(),
      updatedAt: new Date().toLocaleTimeString(),
    }

    const updated = [newProject, ...projects]
    setProjects(updated)
    setActiveProjectId(newProject.id)
    setGeneratedHtml(undefined)
    setSteps([])
    saveUserProjects(userId, updated)
  }

  // Delete Active Project Handler
  const handleDeleteProject = (projId: string) => {
    if (projects.length <= 1) {
      alert('Anda harus memiliki setidaknya 1 proyek aktif.')
      return
    }
    if (window.confirm('Apakah Anda yakin ingin menghapus proyek ini beserta riwayat kodenya?')) {
      const updated = projects.filter((p) => p.id !== projId)
      setProjects(updated)
      setActiveProjectId(updated[0].id)
      setGeneratedHtml(updated[0].generatedHtml)
      setSteps(updated[0].steps || [])
      saveUserProjects(userId, updated)
    }
  }

  // Logout Handler
  const handleLogout = () => {
    if (window.confirm('Apakah Anda yakin ingin keluar dari akun Neon Auth?')) {
      clearUserSession()
      setUser(null)
    }
  }

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId)
    setProviderConfig((prev: typeof providerConfig) => ({ ...prev, selectedModel: modelId }))
  }

  // Send Vibe Coding Prompt for Active Project
  const handleSendPrompt = async (prompt: string) => {
    setIsRunning(true)
    addDebugLog('info', 'LLM_REQUEST', `[App] Memulai handleSendPrompt untuk project: ${activeProjectId}`)

    // Bangun chat history dari steps sebelumnya (multi-turn context)
    const chatHistory: ChatMessage[] = []
    for (const s of steps) {
      if (s.type === 'user_message' && s.content) {
        chatHistory.push({ role: 'user', content: s.content })
      } else if (s.type === 'assistant_message' && s.agentGroup === 'reviewer' && s.content) {
        chatHistory.push({ role: 'assistant', content: s.content })
      }
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    await sendVibeCodingPrompt({
      prompt,
      providerConfig: { ...providerConfig, selectedModel },
      onStep: (newStep) => {
        setSteps((prevSteps) => {
          const existingIdx = prevSteps.findIndex((s) => s.id === newStep.id)
          const updated = [...prevSteps]
          if (existingIdx >= 0) {
            updated[existingIdx] = newStep
          } else {
            updated.push(newStep)
          }
          return updated
        })
      },
      onGeneratedHtml: (newHtml) => {
        addDebugLog('success', 'PARSER', `[App] setGeneratedHtml dipanggil secara langsung! Length: ${newHtml.length}`)
        setGeneratedHtml(newHtml)
        setGenerationVersion((v) => v + 1)
      },
      currentHtml: generatedHtml,
      signal: controller.signal,
      chatHistory,
    })

    abortControllerRef.current = null
    setIsRunning(false)
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsRunning(false)
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header with Project & Model Selector & Persistent Auth Session */}
      <Header
        user={user}
        activeProvider={activeProvider}
        selectedModel={selectedModel}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={(projId) => setActiveProjectId(projId)}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onSelectModel={handleSelectModel}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Studio Body: Split-Screen Vibe Layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Side: Vibe Coding Chat & Steps Panel */}
        <ChatPanel
          steps={steps}
          isRunning={isRunning}
          onSendPrompt={handleSendPrompt}
          onStop={handleStop}
          onSwitchToCode={() => setActiveTab('code')}
          inspectedElement={inspectedElement}
          onClearInspected={() => setInspectedElement(null)}
        />

        {/* Right Side: Live iFrame Web Preview or Code Viewer */}
        {activeTab === 'preview' ? (
          <LivePreview activeTab={activeTab} setActiveTab={setActiveTab} generatedHtml={generatedHtml} onInspectElement={setInspectedElement} />
        ) : (
          <CodeViewer generatedHtml={generatedHtml} projectName={activeProject?.name} generationVersion={generationVersion} />
        )}
      </main>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeProvider={activeProvider}
        setActiveProvider={setActiveProvider}
        providerConfig={providerConfig}
        setProviderConfig={setProviderConfig}
      />

      <NeonAuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(loggedUser) => {
          saveUserSession(loggedUser)
          setUser(loggedUser)
        }}
      />
    </div>
  )
}
