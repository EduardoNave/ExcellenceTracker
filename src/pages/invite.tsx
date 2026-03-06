import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useAcceptInvitation } from '@/hooks/use-invitations'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { CheckCircle, XCircle, LogIn } from 'lucide-react'

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, isLoading: authLoading } = useAuth()
  const acceptMutation = useAcceptInvitation()

  const [status, setStatus] = useState<'loading' | 'needs_auth' | 'accepting' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [, setAcceptedGroupId] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      // Save token in localStorage so we can accept after login/signup
      if (token) {
        localStorage.setItem('pending_invitation_token', token)
      }
      setStatus('needs_auth')
      return
    }

    // User is authenticated, try to accept
    if (token) {
      setStatus('accepting')
      acceptMutation.mutate(token, {
        onSuccess: (result) => {
          if (result.success) {
            setAcceptedGroupId(result.group_id ?? null)
            setStatus('success')
            localStorage.removeItem('pending_invitation_token')
          } else {
            setErrorMsg(result.error ?? 'Error desconocido')
            setStatus('error')
          }
        },
        onError: (err: any) => {
          setErrorMsg(err?.message ?? 'Error al aceptar la invitación')
          setStatus('error')
        },
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, token])

  if (status === 'loading' || status === 'accepting') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center space-y-4">
          <LoadingSpinner className="h-8 w-8 mx-auto" />
          <p className="text-gray-600">
            {status === 'loading' ? 'Cargando...' : 'Aceptando invitación...'}
          </p>
        </div>
      </div>
    )
  }

  if (status === 'needs_auth') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center space-y-6">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center">
              <LogIn className="h-8 w-8 text-primary-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Invitación a ExcellenceTracker
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Has sido invitado a unirte a un equipo. Inicia sesión o regístrate para aceptar la invitación.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                to="/login"
                className="block w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
              >
                Iniciar sesión / Registrarse
              </Link>
            </div>
            <p className="text-xs text-gray-400">
              Tu invitación se aceptará automáticamente después de iniciar sesión.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center space-y-6">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                ¡Te has unido al equipo!
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Tu invitación fue aceptada exitosamente. Ya puedes ver los servicios y evaluaciones asignados.
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
            >
              Ir al panel principal
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Error en la invitación
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              {errorMsg}
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
          >
            Ir al panel principal
          </button>
        </div>
      </div>
    </div>
  )
}
