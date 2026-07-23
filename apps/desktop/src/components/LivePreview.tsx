import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Monitor, Tablet, Smartphone, RotateCw, ExternalLink, Eye, Code, EyeOff, Sparkles, Pencil } from 'lucide-react'

interface LivePreviewProps {
  activeTab: 'preview' | 'code'
  setActiveTab: (tab: 'preview' | 'code') => void
  generatedHtml?: string
  onInspectElement?: (elementInfo: InspectedElement) => void
  onInlineEdit?: (instruction: string, element: InspectedElement) => void
  clearHighlightKey?: number
}

export interface InspectedElement {
  tag: string
  id: string
  classes: string
  text: string
  selector: string
  outerHtml?: string
  computedStyles?: {
    display: string
    position: string
    width: string
    height: string
    color: string
    background: string
    fontSize: string
    margin: string
    padding: string
  }
  boundingRect?: {
    top: number
    left: number
    width: number
    height: number
  }
}

export const LivePreview: React.FC<LivePreviewProps> = ({
  activeTab,
  setActiveTab,
  generatedHtml,
  onInspectElement,
  onInlineEdit,
  clearHighlightKey,
}) => {
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [inspectorActive, setInspectorActive] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [useFallback, setUseFallback] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)

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

  // Inspector/Edit script yang diinjeksi ke iframe saat inspector atau edit mode aktif.
  // EDIT_MODE menentukan apakah klik elemen membuka floating input (edit) atau
  // langsung mengirim context inspect ke parent.
  const inspectorScript = `<script>
(function() {
  var EDIT_MODE = ${editMode ? 'true' : 'false'};

  var styleEl = document.createElement('style');
  styleEl.textContent = '@keyframes koncovibe-pulse { 0%,100% { box-shadow: 0 0 0 2px #06b6d4; } 50% { box-shadow: 0 0 0 5px rgba(6,182,212,0.45); } } .koncovibe-editing { animation: koncovibe-pulse 1s ease-in-out infinite; }';

  // Hover overlay (ungu) — perilaku hover yang sudah ada
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #a855f7;background:rgba(168,85,247,0.1);z-index:999999;transition:all 0.1s ease;display:none;border-radius:4px;';

  // Persistent highlight (ring cyan) — tampil saat elemen diklik
  var persistentOverlay = document.createElement('div');
  persistentOverlay.style.cssText = 'position:fixed;pointer-events:none;box-shadow:0 0 0 2px #06b6d4;z-index:999998;transition:all 0.15s ease;display:none;border-radius:2px;';

  // Floating label berisi selector path
  var labelEl = document.createElement('div');
  labelEl.style.cssText = 'position:fixed;z-index:1000000;background:#06b6d4;color:#0b0f17;font-size:11px;font-family:monospace;padding:2px 6px;border-radius:4px;pointer-events:none;display:none;white-space:nowrap;max-width:320px;overflow:hidden;text-overflow:ellipsis;font-weight:600;';

  // Floating edit box (hanya di inline edit mode)
  var editBox = null, input = null, sendBtn = null, lastContext = null;
  if (EDIT_MODE) {
    editBox = document.createElement('div');
    editBox.style.cssText = 'position:fixed;z-index:1000001;width:280px;background:#0f172a;border:1px solid #06b6d4;border-radius:8px;padding:8px;display:none;box-shadow:0 8px 24px rgba(0,0,0,0.5);font-family:Inter,system-ui,sans-serif;';
    var title = document.createElement('div');
    title.textContent = 'Inline Edit';
    title.style.cssText = 'font-size:10px;color:#67e8f9;font-weight:600;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;';
    input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'mis. "buat jadi merah", "tambah padding"...';
    input.style.cssText = 'width:100%;box-sizing:border-box;background:#020617;border:1px solid #334155;border-radius:6px;padding:6px 8px;color:#f1f5f9;font-size:12px;outline:none;';
    sendBtn = document.createElement('button');
    sendBtn.textContent = 'Kirim';
    sendBtn.style.cssText = 'margin-top:6px;width:100%;background:linear-gradient(135deg,#06b6d4,#4f46e5);color:#fff;border:none;border-radius:6px;padding:6px 0;font-size:11px;font-weight:600;cursor:pointer;';
    editBox.appendChild(title);
    editBox.appendChild(input);
    editBox.appendChild(sendBtn);
  }

  function isOurEl(t) {
    return t === overlay || t === persistentOverlay || t === labelEl || (editBox && editBox.contains(t));
  }

  function buildSelectorPath(el) {
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1) {
      var part = node.tagName.toLowerCase();
      if (node.id) { part += '#' + node.id; parts.unshift(part); break; }
      if (node.className && typeof node.className === 'string') {
        var cls = node.className.trim().split(/\\s+/).filter(function(c) { return c.length; });
        if (cls.length) part += '.' + cls.join('.');
      }
      parts.unshift(part);
      if (node === document.body) break;
      node = node.parentNode;
    }
    return parts.join(' > ');
  }

  function captureContext(el) {
    var rect = el.getBoundingClientRect();
    var cs = window.getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      classes: (el.className && typeof el.className === 'string') ? el.className : '',
      text: (el.innerText || el.textContent || '').trim().substring(0, 200),
      selector: buildSelectorPath(el),
      outerHtml: el.outerHTML ? el.outerHTML.substring(0, 500) : '',
      computedStyles: { display: cs.display, position: cs.position, width: cs.width, height: cs.height, color: cs.color, background: cs.backgroundColor, fontSize: cs.fontSize, margin: cs.margin, padding: cs.padding },
      boundingRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
    };
  }

  function showHighlight(el, selectorPath) {
    var rect = el.getBoundingClientRect();
    persistentOverlay.classList.remove('koncovibe-editing');
    persistentOverlay.style.display = 'block';
    persistentOverlay.style.top = rect.top + 'px';
    persistentOverlay.style.left = rect.left + 'px';
    persistentOverlay.style.width = rect.width + 'px';
    persistentOverlay.style.height = rect.height + 'px';
    labelEl.textContent = selectorPath;
    labelEl.style.display = 'block';
    var top = rect.top - 22;
    if (top < 4) top = rect.bottom + 4;
    labelEl.style.top = top + 'px';
    labelEl.style.left = (rect.left < 4 ? 4 : rect.left) + 'px';
  }

  function showEditBox(el) {
    if (!editBox) return;
    var rect = el.getBoundingClientRect();
    var left = rect.right + 8;
    if (left + 280 > window.innerWidth) left = rect.left - 288;
    if (left < 8) left = 8;
    var top = rect.top;
    if (top + 90 > window.innerHeight) top = window.innerHeight - 98;
    if (top < 8) top = 8;
    editBox.style.left = left + 'px';
    editBox.style.top = top + 'px';
    editBox.style.display = 'block';
    input.value = '';
    setTimeout(function() { if (input) input.focus(); }, 0);
  }

  function clearAll() {
    overlay.style.display = 'none';
    persistentOverlay.style.display = 'none';
    labelEl.style.display = 'none';
    if (editBox) editBox.style.display = 'none';
    persistentOverlay.classList.remove('koncovibe-editing');
  }

  function init() {
    document.body.appendChild(styleEl);
    document.body.appendChild(overlay);
    document.body.appendChild(persistentOverlay);
    document.body.appendChild(labelEl);
    if (editBox) document.body.appendChild(editBox);
    document.body.style.cursor = 'crosshair';

    document.addEventListener('mouseover', function(e) {
      if (isOurEl(e.target)) return;
      var rect = e.target.getBoundingClientRect();
      overlay.style.display = 'block';
      overlay.style.top = rect.top + 'px';
      overlay.style.left = rect.left + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';
    });

    document.addEventListener('click', function(e) {
      if (isOurEl(e.target)) {
        if (!(editBox && editBox.contains(e.target))) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      var el = e.target;
      var ctx = captureContext(el);
      showHighlight(el, ctx.selector);
      if (EDIT_MODE) {
        lastContext = ctx;
        showEditBox(el);
      } else {
        window.parent.postMessage(Object.assign({ type: 'koncovibe-inspect' }, ctx), '*');
      }
    }, true);

    if (EDIT_MODE && sendBtn && input) {
      function submitEdit() {
        var instruction = (input.value || '').trim();
        if (!instruction || !lastContext) return;
        window.parent.postMessage(Object.assign({ type: 'koncovibe-inline-edit', instruction: instruction }, lastContext), '*');
        if (editBox) editBox.style.display = 'none';
        persistentOverlay.classList.add('koncovibe-editing');
      }
      sendBtn.addEventListener('click', function(ev) { ev.preventDefault(); submitEdit(); });
      input.addEventListener('keydown', function(ev) { if (ev.key === 'Enter') { ev.preventDefault(); submitEdit(); } });
    }

    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'koncovibe-clear-highlight') clearAll();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>`

  // Konten HTML final: inject script jika inspector atau edit mode aktif
  const finalHtmlContent = (inspectorActive || editMode) && useFallback
    ? activeHtmlContent.replace('</body>', inspectorScript + '\n</body>')
    : activeHtmlContent

  // Listen untuk postMessage dari iframe (inspector clicks & inline edit)
  const handleMessage = useCallback((e: MessageEvent) => {
    const data = e.data
    if (!data) return
    const elementFromData = (): InspectedElement => ({
      tag: data.tag,
      id: data.id,
      classes: data.classes,
      text: data.text,
      selector: data.selector,
      outerHtml: data.outerHtml,
      computedStyles: data.computedStyles,
      boundingRect: data.boundingRect,
    })
    if (data.type === 'koncovibe-inspect') {
      onInspectElement?.(elementFromData())
    } else if (data.type === 'koncovibe-inline-edit') {
      onInlineEdit?.(data.instruction, elementFromData())
    }
  }, [onInspectElement, onInlineEdit])

  useEffect(() => {
    if (!inspectorActive && !editMode) return
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [inspectorActive, editMode, handleMessage])

  // Kirim perintah clear-highlight ke iframe saat parent memberi sinyal
  // (mis. saat user mengirim prompt dari sidebar chat)
  useEffect(() => {
    if (!clearHighlightKey) return
    const win = iframeRef.current?.contentWindow
    if (win) win.postMessage({ type: 'koncovibe-clear-highlight' }, '*')
  }, [clearHighlightKey])

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
    console.log('[LivePreview] Blob URL created, length:', finalHtmlContent.length, 'inspector:', inspectorActive, 'editMode:', editMode)

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [finalHtmlContent, useFallback, refreshKey, inspectorActive, editMode])

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
                title="Click-to-Inspect: kirim info elemen ke chat"
              >
                {inspectorActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="hidden lg:inline">{inspectorActive ? 'Inspector Active' : 'Inspect'}</span>
              </button>

              {/* Inline Edit Mode Toggle */}
              <button
                onClick={() => setEditMode(!editMode)}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                  editMode
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm glow-cyan'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white border-slate-700/80'
                }`}
                title="Inline Edit Mode: klik elemen lalu tulis instruksi natural language"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">{editMode ? 'Edit Mode On' : 'Edit Mode'}</span>
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
            ref={iframeRef}
            key={blobUrl || 'server-mode'}
            src={useFallback ? (blobUrl || undefined) : previewUrl}
            title="KoncoVibe Live App Preview"
            className="w-full flex-1 bg-white border-0"
          />

          {/* Inspector / Edit Mode Overlay indicator */}
          {(inspectorActive || editMode) && (
            <div
              className={`absolute inset-x-0 bottom-4 mx-auto w-fit px-4 py-2 rounded-full glass-card border text-xs font-medium shadow-lg flex items-center space-x-2 animate-bounce pointer-events-none ${
                editMode
                  ? 'border-cyan-500/40 text-cyan-200 shadow-cyan-500/20'
                  : 'border-purple-500/40 text-purple-200 shadow-purple-500/20'
              }`}
            >
              {editMode ? <Pencil className="w-4 h-4 text-cyan-400" /> : <Eye className="w-4 h-4 text-purple-400" />}
              <span>
                {editMode
                  ? 'Edit Mode: Klik elemen lalu tulis perubahan (mis. "buat jadi merah")'
                  : 'Modus Inspector: Klik elemen apa pun di layar untuk meminta AI mengubahnya'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
