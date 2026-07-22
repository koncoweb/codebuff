import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Monitor, Tablet, Smartphone, RotateCw, ExternalLink, Eye, Code, EyeOff, Sparkles } from 'lucide-react'

interface LivePreviewProps {
  activeTab: 'preview' | 'code'
  setActiveTab: (tab: 'preview' | 'code') => void
  generatedHtml?: string
  onInspectElement?: (elementInfo: InspectedElement) => void
}

export interface InspectedElement {
  tag: string
  id: string
  classes: string
  text: string
  selector: string
}

export const LivePreview: React.FC<LivePreviewProps> = ({
  activeTab,
  setActiveTab,
  generatedHtml,
  onInspectElement,
}) => {
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [inspectorActive, setInspectorActive] = useState(false)
  const [useFallback, setUseFallback] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const previewUrl = 'http://localhost:3000'

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const getContainerWidth = () => {
    if (deviceMode === 'mobile') return 'max-w-[375px]'
    if (deviceMode === 'tablet') return 'max-w-[768px]'
    return 'w-full'
  }

  const defaultHtmlDoc = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Warung Kopi KoncoVibe - Live Preview</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background-color: #0b0f17;
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    h1, h2 { font-family: 'Outfit', sans-serif; }
    .card {
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 1.25rem;
      padding: 2.5rem;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px -15px rgba(6, 182, 212, 0.25);
    }
    .icon {
      width: 60px; height: 60px;
      background: linear-gradient(135deg, #06b6d4, #9333ea);
      border-radius: 1rem;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 1.5rem auto;
      font-size: 1.75rem;
      box-shadow: 0 10px 20px rgba(6, 182, 212, 0.3);
    }
    .gradient-text {
      background: linear-gradient(135deg, #38bdf8, #c084fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .btn {
      width: 100%;
      padding: 0.85rem 1.5rem;
      border-radius: 0.75rem;
      border: none;
      background: linear-gradient(135deg, #06b6d4, #4f46e5, #9333ea);
      color: white;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      margin-top: 1.5rem;
      box-shadow: 0 10px 20px -5px rgba(6, 182, 212, 0.4);
      transition: transform 0.2s, opacity 0.2s;
    }
    .btn:hover { transform: translateY(-2px); opacity: 0.95; }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: rgba(6, 182, 212, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(6, 182, 212, 0.3);
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    .menu-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin-top: 1.5rem;
      text-align: left;
    }
    .menu-item {
      background: rgba(15, 23, 42, 0.6);
      padding: 0.75rem;
      border-radius: 0.75rem;
      border: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 0.8rem;
    }
    .menu-title { font-weight: 600; color: #fff; }
    .menu-price { color: #38bdf8; font-size: 0.75rem; font-weight: bold; margin-top: 0.2rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">✨ Live Vibe Coding Generated</div>
    <div class="icon">☕</div>
    <h1>Warung Kopi <span class="gradient-text">KoncoVibe</span></h1>
    <p style="color: #94a3b8; font-size: 0.85rem; margin-top: 0.5rem; line-height: 1.5;">
      Aplikasi web modern dengan mode gelap elegan &amp; tombol animasi gradient yang di-generate langsung oleh KoncoVibe AI.
    </p>

    <div class="menu-grid">
      <div class="menu-item">
        <div class="menu-title">Espresso Vibe</div>
        <div class="menu-price">Rp 18.000</div>
      </div>
      <div class="menu-item">
        <div class="menu-title">Kopi Susu AI</div>
        <div class="menu-price">Rp 22.000</div>
      </div>
      <div class="menu-item">
        <div class="menu-title">Matcha Glass</div>
        <div class="menu-price">Rp 25.000</div>
      </div>
      <div class="menu-item">
        <div class="menu-title">Americano Dark</div>
        <div class="menu-price">Rp 20.000</div>
      </div>
    </div>

    <button class="btn" onclick="alert('Pesanan berhasil dibuat!')">Pesan Sekarang &rarr;</button>
  </div>
</body>
</html>`

  const activeHtmlContent = generatedHtml && generatedHtml.trim() ? generatedHtml : defaultHtmlDoc

  // Inspector script yang diinjeksi ke iframe saat inspector mode aktif
  const inspectorScript = `<script>
(function() {
  var highlightEl = null;
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #a855f7;background:rgba(168,85,247,0.1);z-index:999999;transition:all 0.1s ease;display:none;border-radius:4px;';
  document.addEventListener('DOMContentLoaded', function() {
    document.body.appendChild(overlay);
    document.body.style.cursor = 'crosshair';
    document.addEventListener('mouseover', function(e) {
      if (e.target === overlay) return;
      var rect = e.target.getBoundingClientRect();
      overlay.style.display = 'block';
      overlay.style.top = rect.top + 'px';
      overlay.style.left = rect.left + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';
    });
    document.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var el = e.target;
      var tag = el.tagName.toLowerCase();
      var id = el.id ? '#' + el.id : '';
      var cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '';
      var text = (el.innerText || el.textContent || '').trim().substring(0, 120);
      var selector = tag + id + cls;
      window.parent.postMessage({ type: 'koncovibe-inspect', tag: tag, id: el.id || '', classes: typeof el.className === 'string' ? el.className : '', text: text, selector: selector }, '*');
    }, true);
  });
})();
</script>`

  // Konten HTML final: inject inspector script jika inspector mode aktif
  const finalHtmlContent = inspectorActive && useFallback
    ? activeHtmlContent.replace('</body>', inspectorScript + '\n</body>')
    : activeHtmlContent

  // Listen untuk postMessage dari iframe (inspector clicks)
  const handleMessage = useCallback((e: MessageEvent) => {
    if (e.data && e.data.type === 'koncovibe-inspect') {
      onInspectElement?.({
        tag: e.data.tag,
        id: e.data.id,
        classes: e.data.classes,
        text: e.data.text,
        selector: e.data.selector,
      })
    }
  }, [onInspectElement])

  useEffect(() => {
    if (!inspectorActive) return
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [inspectorActive, onInspectElement])

  // Blob URL approach: most reliable cross-browser iframe injection
  // srcDoc+sandbox causes silent JS failures; blob URL gives the iframe a real URL without restrictions
  const blobUrlRef = useRef<string | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!useFallback) return // server mode: don't create blob URL

    // Revoke previous blob URL to prevent memory leak
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
    }

    const blob = new Blob([finalHtmlContent], { type: 'text/html; charset=utf-8' })
    const url = URL.createObjectURL(blob)
    blobUrlRef.current = url
    setBlobUrl(url)
    console.log('[LivePreview] Blob URL created, length:', finalHtmlContent.length, 'inspector:', inspectorActive)

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [finalHtmlContent, useFallback, refreshKey, inspectorActive])

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950/80 overflow-hidden min-w-0">
      {/* Top Bar for View Switcher & Devices */}
      <div className="h-11 px-4 border-b border-slate-800/80 bg-slate-900/80 flex items-center justify-between shrink-0 select-none">
        {/* Left: Tab Switcher (Preview vs Code) */}
        <div className="flex items-center space-x-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeTab === 'preview'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Live Web Preview</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeTab === 'code'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Code Editor</span>
          </button>
        </div>

        {/* Center: Device Responsive Controls */}
        {activeTab === 'preview' && (
          <div className="hidden sm:flex items-center space-x-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-slate-400">
            <button
              onClick={() => setDeviceMode('desktop')}
              className={`p-1.5 rounded ${deviceMode === 'desktop' ? 'bg-slate-800 text-cyan-400' : 'hover:text-white'}`}
              title="Desktop View"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDeviceMode('tablet')}
              className={`p-1.5 rounded ${deviceMode === 'tablet' ? 'bg-slate-800 text-cyan-400' : 'hover:text-white'}`}
              title="Tablet View"
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDeviceMode('mobile')}
              className={`p-1.5 rounded ${deviceMode === 'mobile' ? 'bg-slate-800 text-cyan-400' : 'hover:text-white'}`}
              title="Mobile View"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center space-x-2">
          {activeTab === 'preview' && (
            <>
              {/* Toggle Localhost vs In-Memory Preview */}
              <button
                onClick={() => setUseFallback(!useFallback)}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                  useFallback
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700/80'
                }`}
                title="Beralih Mode Pratinjau Server / Live Render"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{useFallback ? 'Live Render AI' : 'Server Port 3000'}</span>
              </button>

              {/* Visual Inspector Toggle */}
              <button
                onClick={() => setInspectorActive(!inspectorActive)}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                  inspectorActive
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-500/20'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white border-slate-700/80'
                }`}
                title="Click-to-Edit Visual Inspector"
              >
                {inspectorActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="hidden lg:inline">{inspectorActive ? 'Inspector Active' : 'Click to Edit'}</span>
              </button>

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80"
                title="Refresh Preview"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80"
            title="Buka di Browser Eksternal"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Main iFrame Container */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto bg-slate-900/40 relative">
        <div
          className={`h-full ${getContainerWidth()} bg-slate-950 rounded-xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 relative`}
        >
          {/* Mock Browser URL Address Bar */}
          <div className="h-8 bg-slate-900 px-3 flex items-center space-x-2 border-b border-slate-800 select-none shrink-0">
            <div className="flex space-x-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            </div>
            <div className="flex-1 max-w-sm mx-auto bg-slate-950 rounded-md px-2.5 py-0.5 border border-slate-800/80 text-[11px] font-mono text-slate-400 flex items-center justify-between">
              <span className="truncate">{useFallback ? 'http://localhost:3000 (KoncoVibe AI Live Generated)' : previewUrl}</span>
              <span className="text-[10px] text-emerald-400">HTTP 200</span>
            </div>
          </div>

          {/* iFrame: Blob URL approach — real URL, no sandbox, scripts & CDN work */}
          <iframe
            key={blobUrl || 'server-mode'}
            src={useFallback ? (blobUrl || undefined) : previewUrl}
            title="KoncoVibe Live App Preview"
            className="w-full flex-1 bg-white border-0"
          />

          {/* Inspector Overlay indicator */}
          {inspectorActive && (
            <div className="absolute inset-x-0 bottom-4 mx-auto w-fit px-4 py-2 rounded-full glass-card border border-purple-500/40 text-purple-200 text-xs font-medium shadow-lg shadow-purple-500/20 flex items-center space-x-2 animate-bounce pointer-events-none">
              <Eye className="w-4 h-4 text-purple-400" />
              <span>Modus Inspector: Klik elemen apa pun di layar untuk meminta AI mengubahnya</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
