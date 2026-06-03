import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import {
  apiLogin,
  apiLogout,
  apiMe,
  apiRegister,
  apiSilentRefresh,
  setAccessToken,
  type UserInfo,
} from '../api'

interface AuthState {
  user: UserInfo | null
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setUserFromToken: (token: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, isLoading: true })

  useEffect(() => {
    ;(async () => {
      try {
        const token = await apiSilentRefresh()
        if (token) {
          setAccessToken(token)
          const user = await apiMe()
          setState({ user, isLoading: false })
        } else {
          setState({ user: null, isLoading: false })
        }
      } catch {
        setState({ user: null, isLoading: false })
      }
    })()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await apiLogin(email, password)
    setAccessToken(access_token)
    const user = await apiMe()
    setState({ user, isLoading: false })
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const { access_token } = await apiRegister(email, password)
    setAccessToken(access_token)
    const user = await apiMe()
    setState({ user, isLoading: false })
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setState({ user: null, isLoading: false })
  }, [])

  const setUserFromToken = useCallback(async (token: string) => {
    setAccessToken(token)
    const user = await apiMe()
    setState({ user, isLoading: false })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, setUserFromToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider')
  return ctx
}
