export const NEON_AUTH_CONFIG = {
  baseUrl: import.meta.env.VITE_NEON_AUTH_BASE_URL || '',
  jwksUrl: (import.meta.env.VITE_NEON_AUTH_BASE_URL || '').replace('/auth', '/.well-known/jwks.json'),
  projectId: import.meta.env.VITE_NEON_AUTH_PROJECT_ID || '',
}

export interface NeonUser {
  id: string
  email: string
  name?: string
  membershipTier: 'regular' | 'pro' | 'special' | 'vip'
  expiredAt?: string | null
}

const USER_SESSION_KEY = 'koncovibe_user_session'

export function saveUserSession(user: NeonUser): void {
  try {
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user))
  } catch (e) {
    console.error('Failed to save user session', e)
  }
}

export function getSavedUserSession(): NeonUser | null {
  try {
    const saved = localStorage.getItem(USER_SESSION_KEY)
    return saved ? JSON.parse(saved) : null
  } catch (e) {
    return null
  }
}

export function clearUserSession(): void {
  try {
    localStorage.removeItem(USER_SESSION_KEY)
  } catch (e) {
    console.error('Failed to clear user session', e)
  }
}

export async function signInWithEmail(email: string, password: string): Promise<NeonUser> {
  let res: Response
  try {
    res = await fetch(`${NEON_AUTH_CONFIG.baseUrl}/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  } catch {
    // Network error (offline, CORS, server unreachable) → demo fallback
    const fallbackUser: NeonUser = {
      id: `usr_demo_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
      email,
      name: email.split('@')[0] || 'Developer',
      membershipTier: 'regular',
      expiredAt: null,
    }
    saveUserSession(fallbackUser)
    return fallbackUser
  }

  if (!res.ok) {
    throw new Error('Email atau password salah. Periksa kembali.')
  }

  const data = await res.json()
  const user: NeonUser = {
    id: data.user?.id || `usr_neon_${Date.now()}`,
    email: data.user?.email || email,
    name: data.user?.name || email.split('@')[0],
    membershipTier: 'pro',
    expiredAt: null,
  }
  saveUserSession(user)
  return user
}

export async function signUpWithEmail(email: string, password: string, name: string): Promise<NeonUser> {
  let res: Response
  try {
    res = await fetch(`${NEON_AUTH_CONFIG.baseUrl}/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })
  } catch {
    // Network error (offline, CORS, server unreachable) → demo fallback
    const fallbackUser: NeonUser = {
      id: `usr_demo_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
      email,
      name: name || email.split('@')[0],
      membershipTier: 'regular',
      expiredAt: null,
    }
    saveUserSession(fallbackUser)
    return fallbackUser
  }

  if (!res.ok) {
    throw new Error('Pendaftaran gagal. Email mungkin sudah terdaftar.')
  }

  const data = await res.json()
  const user: NeonUser = {
    id: data.user?.id || `usr_neon_${Date.now()}`,
    email: data.user?.email || email,
    name: name || email.split('@')[0],
    membershipTier: 'regular',
    expiredAt: null,
  }
  saveUserSession(user)
  return user
}
