import React, { useState } from 'react'
import { X, Lock, Mail, User, ShieldCheck, LogIn, Loader2 } from 'lucide-react'
import { signInWithEmail, signUpWithEmail } from '../services/neon-auth'
import type { NeonUser } from '../services/neon-auth'

interface NeonAuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (user: NeonUser) => void
}

export const NeonAuthModal: React.FC<NeonAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')

    try {
      let user: NeonUser
      if (mode === 'signin') {
        user = await signInWithEmail(email, password)
      } else {
        user = await signUpWithEmail(email, password, name || email.split('@')[0])
      }
      onSuccess(user)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal autentikasi. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-md glass-panel rounded-2xl border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <h3 className="font-display font-semibold text-base text-white">
              Neon Auth Login &amp; Portal
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-center pb-2">
            <p className="text-xs text-slate-400">
              Terhubung ke Neon Auth Server (`koncowebportal`)
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-xs text-rose-300">
              {error}
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Nama Lengkap</label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-slate-500 absolute left-3" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mohamad Billy"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@koncoweb.id"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Kata Sandi</label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl gradient-bg-accent text-white font-medium text-xs shadow-lg shadow-cyan-500/20 hover:opacity-90 flex items-center justify-center space-x-2 transition-opacity"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            <span>{mode === 'signin' ? 'Masuk ke Akun' : 'Daftar Akun Baru'}</span>
          </button>

          <div className="pt-2 text-center text-xs text-slate-400">
            {mode === 'signin' ? (
              <span>
                Belum punya akun?{' '}
                <button type="button" onClick={() => setMode('signup')} className="text-cyan-400 underline">
                  Daftar Sekarang
                </button>
              </span>
            ) : (
              <span>
                Sudah punya akun?{' '}
                <button type="button" onClick={() => setMode('signin')} className="text-cyan-400 underline">
                  Masuk Sekarang
                </button>
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
