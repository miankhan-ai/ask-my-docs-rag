import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthContext'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const { setUserFromToken } = useAuthContext()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      window.history.replaceState({}, '', '/auth/callback')
      setUserFromToken(token)
        .then(() => navigate('/app', { replace: true }))
        .catch(() => navigate('/login', { replace: true }))
    } else {
      navigate('/login', { replace: true })
    }
  }, [navigate, setUserFromToken])

  return (
    <div className="flex h-screen items-center justify-center text-gray-400 text-sm">
      Signing you in…
    </div>
  )
}
