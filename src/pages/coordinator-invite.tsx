import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useAcceptCoordinatorInvitation } from '@/hooks/use-coordinator-invitations'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { ShieldCheck, CheckCircle, XCircle, Loader2 } from 'lucide-react'

type PageStatus = 'loading' | 'needs_auth' | 'accepting' | 'success' | 'error'
type AuthMode = 'login' | 'register'

export default function CoordinatorInvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, isLoading: authLoading, signIn, signUp, refreshProfile } = useAuth()
  const acceptMutation = useAcceptCoordinatorInvitation()

  const [status, setStatus] = useState<PageStatus>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  // Auth form state
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading2, setAuthLoading2] = useState(false)

  // Once authenticated, accept the invitation
  useEffect(() => {
    if (authLoading) return

    if (!user) {
      if (token) localStorage.setItem('pending_coordinator_invitation_token', token)
      setStatus('needs_auth')
      return
    }

    if (token && status === 'loading') {
      setStatus('accepting')
      acceptMutation.mutate(token, {
        onSuccess: async (result) => {
          if (result.success) {
            localStorage.removeItem('pending_coordinator_invitation_token')
            await refreshProfile()
            setStatus('success')
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

  // After login (triggered by auth state change via handlePendingCoordinatorInvitation),
  // if user is now set but we haven't started accepting, kick it off
  useEffect(() => {
    if (user && status === 'needs_auth' && token) {
      setStatus('loading')
    }
  }, [user, status, token])

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    setAuthLoading2(true)
    try {
      if (authMode === 'login') {
        await signIn(email, password)
      } else {
        await signUp(email, password, fullName, 'server') // role will be upgraded by accept_coordinator_invitation
      }
      // After sign-in/up, useEffect will fire and accept the invitation
    } catch (err: any) {
      setAuthError(err?.message ?? 'Error de autenticación')
    } finally {
      setAuthLoading2(false)
    }
  }

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

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">¡Ya eres coordinador!</h1>
            <p className="mt-2 text-sm text-gray-500">
              Tu cuenta fue configurada como coordinador. Ahora puedes crear tu grupo e invitar a tus servidores.
            </p>
          </div>
          <button
            onClick={() => navigate('/team')}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Crear mi grupo
          </button>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Invitación inválida</h1>
            <p className="mt-2 text-sm text-gray-500">{errorMsg}</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full rounded-lg bg-gray-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            Ir al inicio
          </button>
        </div>
      </div>
    )
  }

  // needs_auth — show inline login/register form
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">ExcellenceTracker</h1>
          <p className="mt-2 text-gray-500">Sistema de evaluación de excelencia</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-5 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center mb-3">
              <ShieldCheck className="h-6 w-6 text-indigo-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              Invitación de coordinador
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {authMode === 'login'
                ? 'Inicia sesión para aceptar tu invitación como coordinador.'
                : 'Crea tu cuenta para aceptar la invitación como coordinador.'}
            </p>
          </div>

          {/* Auth mode toggle */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => { setAuthMode('login'); setAuthError('') }}
              className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
                authMode === 'login'
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => { setAuthMode('register'); setAuthError('') }}
              className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
                authMode === 'register'
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Crear cuenta
            </button>
          </div>

          <div className="p-6">
            {authError && (
              <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'register' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Juan Pérez"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="correo@ejemplo.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={authMode === 'register' ? 6 : undefined}
                  placeholder={authMode === 'register' ? 'Mínimo 6 caracteres' : 'Tu contraseña'}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading2}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {authLoading2 && <Loader2 className="h-4 w-4 animate-spin" />}
                {authMode === 'login' ? 'Iniciar sesión y aceptar' : 'Registrarme y aceptar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
