import React, { useState, useEffect, useMemo } from 'react'
import { Folder, FileText, Check, Copy, Terminal, Bug, Filter, FileCode2, FileJson, Info, Code2, FileType2 } from 'lucide-react'
import { subscribeDebugLogs } from '../services/sidecar-api'
import type { DebugLogEntry } from '../services/sidecar-api'

export interface VirtualFile {
  name: string
  type: 'html' | 'css' | 'js' | 'json'
  content: string
  size: number
  lines: number
}

export interface CodeViewerProps {
  generatedHtml?: string
  projectName?: string
  generationVersion?: number
}

/**
 * Parse HTML mentah menjadi virtual file terpisah (index.html, style.css, script.js).
 * Ekstrak tag <style> dan <script> inline agar mudah dibaca di code viewer.
 */
function parseHtmlToVirtualFiles(html: string): VirtualFile[] {
  const files: VirtualFile[] = []
  const trimmed = html.trim()
  if (!trimmed) return files

  // Ekstrak konten dari tag <style>...</style>
  const styleMatches = trimmed.match(/<style[^>]*>([\s\S]*?)<\/style>/gi)
  const cssContent = styleMatches
    ? styleMatches
        .map((s) => s.replace(/<style[^>]*>/i, '').replace(/<\/style>/i, '').trim())
        .join('\n\n/* ===== Style Block Tambahan ===== */\n\n')
    : ''

  // Ekstrak konten dari tag <script>...</script> (hanya yang inline, tanpa src=)
  const scriptMatches = trimmed.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)
  const jsContent = scriptMatches
    ? scriptMatches
        .map((s) => s.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim())
        .join('\n\n// ===== Script Block Tambahan =====\n\n')
    : ''

  // File index.html utama
  files.push({
    name: 'index.html',
    type: 'html',
    content: trimmed,
    size: trimmed.length,
    lines: trimmed.split('\n').length,
  })

  // File style.css jika ada CSS inline
  if (cssContent.trim()) {
    files.push({
      name: 'style.css',
      type: 'css',
      content: cssContent,
      size: cssContent.length,
      lines: cssContent.split('\n').length,
    })
  }

  // File script.js jika ada JS inline
  if (jsContent.trim()) {
    files.push({
      name: 'script.js',
      type: 'js',
      content: jsContent,
      size: jsContent.length,
      lines: jsContent.split('\n').length,
    })
  }

  return files
}

// Ikon untuk setiap tipe file
function getFileIcon(type: VirtualFile['type']) {
  switch (type) {
    case 'html':
      return <FileCode2 className="w-3.5 h-3.5 text-orange-400" />
    case 'css':
      return <FileType2 className="w-3.5 h-3.5 text-blue-400" />
    case 'js':
      return <Code2 className="w-3.5 h-3.5 text-yellow-400" />
    case 'json':
      return <FileJson className="w-3.5 h-3.5 text-emerald-400" />
    default:
      return <FileText className="w-3.5 h-3.5 text-indigo-400" />
  }
}

// Badge warna untuk tipe file
function getFileBadge(type: VirtualFile['type']) {
  const colors: Record<string, string> = {
    html: 'bg-orange-950 text-orange-400 border-orange-800',
    css: 'bg-blue-950 text-blue-400 border-blue-800',
    js: 'bg-yellow-950 text-yellow-400 border-yellow-800',
    json: 'bg-emerald-950 text-emerald-400 border-emerald-800',
  }
  return colors[type] || 'bg-slate-800 text-slate-400 border-slate-700'
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ generatedHtml, projectName, generationVersion }) => {
  const [selectedFile, setSelectedFile] = useState('index.html')
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'code' | 'logs'>('code')
  const [logs, setLogs] = useState<DebugLogEntry[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')

  useEffect(() => {
    const unsubscribe = subscribeDebugLogs((updatedLogs) => {
      setLogs(updatedLogs)
    })
    return () => unsubscribe()
  }, [])

  // Parse generatedHtml menjadi virtual files (index.html, style.css, script.js)
  const virtualFiles: VirtualFile[] = useMemo(() => {
    const files = parseHtmlToVirtualFiles(generatedHtml || '')

    // Tambahkan project.json dengan metadata proyek
    if (projectName || generatedHtml) {
      const stats = generatedHtml
        ? {
            totalChars: generatedHtml.length,
            totalLines: generatedHtml.split('\n').length,
            sizeKb: (generatedHtml.length / 1024).toFixed(2),
            cssBlocks: (generatedHtml.match(/<style/gi) || []).length,
            jsBlocks: (generatedHtml.match(/<script/gi) || []).length,
          }
        : null

      files.push({
        name: 'project.json',
        type: 'json',
        content: JSON.stringify(
          {
            name: projectName || 'Untitled Project',
            generator: 'KoncoVibe AI',
            type: 'single-page-html',
            main: 'index.html',
            files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
            stats,
            generatedAt: new Date().toISOString(),
          },
          null,
          2
        ),
        size: 0,
        lines: 0,
      })
    }

    return files
  }, [generatedHtml, projectName])

  // Sinkronkan selectedFile saat daftar file berubah
  useEffect(() => {
    if (virtualFiles.length > 0 && !virtualFiles.find((f) => f.name === selectedFile)) {
      setSelectedFile(virtualFiles[0].name)
    }
  }, [virtualFiles, selectedFile])

  // Auto-select index.html saat HTML baru di-generate (generationVersion berubah)
  useEffect(() => {
    if (generationVersion && generationVersion > 0) {
      setSelectedFile('index.html')
    }
  }, [generationVersion])

  // Ambil konten file yang dipilih
  const currentFile = virtualFiles.find((f) => f.name === selectedFile)
  const currentContent = currentFile?.content || ''
  const hasContent = currentContent.trim().length > 0

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filteredLogs = categoryFilter === 'ALL' ? logs : logs.filter((l) => l.category === categoryFilter)

  return (
    <div className="flex-1 flex h-full bg-slate-950/90 overflow-hidden">
      {/* Sidebar Explorer */}
      <div className="w-64 border-r border-slate-800/80 bg-slate-900/60 p-3 select-none flex flex-col shrink-0">
        {/* Tab Switcher */}
        <div className="flex items-center space-x-1 p-1 bg-slate-950 rounded-lg border border-slate-800 mb-3">
          <button
            onClick={() => setActiveTab('code')}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all text-center flex items-center justify-center space-x-1 ${
              activeTab === 'code' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Berkas</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all text-center flex items-center justify-center space-x-1 ${
              activeTab === 'logs' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bug className="w-3.5 h-3.5" />
            <span>Debug Log ({logs.length})</span>
          </button>
        </div>

        {activeTab === 'code' ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
              <Folder className="w-4 h-4 text-cyan-400" />
              <span>Berkas Proyek</span>
              <span className="ml-auto text-[10px] text-slate-500 normal-case">{virtualFiles.length} file</span>
            </div>

            {virtualFiles.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-slate-500">
                <FileText className="w-8 h-8 text-slate-700 mb-2" />
                <p className="text-xs">Belum ada kode yang digenerate.</p>
                <p className="text-[11px] text-slate-600 mt-1">Kirim prompt di chat untuk membuat proyek.</p>
              </div>
            ) : (
              <div className="space-y-1 flex-1 overflow-y-auto">
                {virtualFiles.map((file) => (
                  <button
                    key={file.name}
                    onClick={() => setSelectedFile(file.name)}
                    className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                      selectedFile === file.name
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    {getFileIcon(file.type)}
                    <span className="truncate flex-1 text-left">{file.name}</span>
                    {file.size > 0 && (
                      <span className="text-[10px] text-slate-600">
                        {file.size > 1024 ? `${(file.size / 1024).toFixed(1)}KB` : `${file.size}B`}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Logs Filter Sidebar */
          <div className="space-y-2 text-xs">
            <div className="flex items-center space-x-2 font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span>Filter Kategori</span>
            </div>
            {['ALL', 'LLM_REQUEST', 'LLM_RESPONSE', 'PARSER', 'SANDBOX', 'AUTH'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg font-mono text-[11px] transition-colors ${
                  categoryFilter === cat ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {activeTab === 'code' ? (
          <>
            {/* Editor Top Toolbar */}
            <div className="h-10 px-4 border-b border-slate-800/80 bg-slate-900/80 flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center space-x-2">
                {currentFile && getFileIcon(currentFile.type)}
                <span className="font-mono text-xs text-slate-300">{selectedFile}</span>
                {currentFile && currentFile.size > 0 && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getFileBadge(currentFile.type)}`}>
                    {currentFile.lines} baris &bull; {currentFile.size > 1024 ? `${(currentFile.size / 1024).toFixed(1)}KB` : `${currentFile.size}B`}
                  </span>
                )}
              </div>

              <button
                onClick={handleCopy}
                disabled={!hasContent}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white border border-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin!' : 'Salin Kode'}</span>
              </button>
            </div>

            {/* Code Content */}
            <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs text-slate-200 leading-relaxed">
              {hasContent ? (
                <pre className="whitespace-pre-wrap break-words">{currentContent}</pre>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-600">
                  <Info className="w-8 h-8 text-slate-700 mb-2" />
                  <p className="text-xs">Belum ada kode yang digenerate untuk proyek ini.</p>
                  <p className="text-[11px] text-slate-700 mt-1">Gunakan panel chat di kiri untuk mulai vibe coding!</p>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Live Debug Logs Console */
          <>
            <div className="h-10 px-4 border-b border-slate-800/80 bg-slate-900/80 flex items-center justify-between shrink-0 select-none">
              <span className="font-mono text-xs text-slate-300 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                Live Sidecar &amp; Debug Console Log ({filteredLogs.length} Entri)
              </span>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs space-y-2 leading-relaxed">
              {filteredLogs.length === 0 ? (
                <div className="text-slate-500 text-center py-10">Belum ada log tercatat. Kirim prompt di chat untuk melihat log real-time.</div>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className="p-2.5 rounded bg-slate-900/60 border border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            log.level === 'error'
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : log.level === 'warn'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : log.level === 'success'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                          }`}
                        >
                          [{log.category}]
                        </span>
                        <span className="text-slate-200 font-medium">{log.message}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{log.timestamp}</span>
                    </div>

                    {log.details && (
                      <pre className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded border border-slate-800/50 overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
