import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setAccessToken, apiMe } from '../api'

export function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      setAccessToken(token)
      apiMe().then(() => {
        window.history.replaceState({}, '', '/app')
        navigate('/app', { replace: true })
      }).catch(() => navigate('/login', { replace: true }))
    } else {
      navigate('/login', { replace: true })
    }
  }, [navigate])

  return (
    <div className="flex h-screen items-center justify-center text-gray-400 text-sm">
      Signing you in…
    </div>
  )
}
