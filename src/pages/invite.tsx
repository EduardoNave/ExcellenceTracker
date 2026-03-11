import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { CheckCircle, XCircle, Users, Loader2 } from 'lucide-react'

type PageStatus = 'loading' | 'form' | 'logged-in' | 'submitting' | 'success' | 'error'

interface InvitationData {
  email: string
  group_id: string
  group_name: string
  inviter_email: string | null
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, isLoading: authLoading, signUp } = useAuth()

  const [pageStatus, setPageStatus] = useState<PageStatus>('loading')
  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [formError, setFormError] = useState('')

  // Form fields
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')

  // ── Step 1: Fetch invitation details on mount ──────────────────────────
  useEffect(() => {
    if (!token) {
      setErrorMsg('Token de invitación inválido.')
      setPageStatus('error')
      return
    }

    let cancelled = false

    async function load() {
      const { data, error } = await (supabase as any)
        .from('invitations')
        .select('email, status, expires_at, group_id, groups(name), inviter_profile:profiles(email)')
        .eq('token', token)
        .single()

      if (cancelled) return

      if (error || !data) {
        setErrorMsg('Invitación no encontrada.')
        setPageStatus('error')
        return
      }

      if (data.status !== 'pending' || new Date(data.expires_at) < new Date()) {
        setErrorMsg('Esta invitación ya fue usada o expiró.')
        setPageStatus('error')
        return
      }

      setInvitation({
        email: data.email,
        group_id: data.group_id,
        group_name: data.groups?.name ?? 'Equipo',
        inviter_email: data.inviter_profile?.email ?? null,
      })
    }

    load()
    return () => { cancelled = true }
  }, [token])

  // ── Step 2: Once invitation + auth state are known, choose UI ──────────
  useEffect(() => {
    if (!invitation || authLoading) return
    setPageStatus(user ? 'logged-in' : 'form')
  }, [invitation, authLoading, user])

  // ── Shared: notify coordinator (best-effort) ───────────────────────────
  async function notifyCoordinator(memberName: string) {
    if (!invitation?.inviter_email) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: 'invitation_accepted',
          to_email: invitation.inviter_email,
          variables: {
            member_name: memberName,
            group_name: invitation.group_name,
            member_email: invitation.email,
          },
        }),
      })
    } catch (err) {
      console.warn('Coordinator notification failed (non-critical):', err)
    }
  }

  // ── Flow A: New user — register + accept ───────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!invitation || !token) return
    setFormError('')
    setPageStatus('submitting')

    try {
      // 1. Create account
      await signUp(invitation.email, password, fullName)

      // 2. Sign in (signUp may not auto-sign in when email confirm is enabled)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password,
      })
      if (signInError) throw signInError

      // 3. Accept invitation via RPC
      const { data: result, error: rpcError } = await supabase.rpc(
        'accept_invitation',
        { p_token: token }
      ) as any
      if (rpcError) throw rpcError
      if (!result?.success) throw new Error(result?.error ?? 'No se pudo aceptar la invitación')

      // 4. Notify coordinator (non-blocking)
      await notifyCoordinator(fullName)

      setPageStatus('success')
    } catch (err: any) {
      setFormError(err?.message ?? 'Error al procesar la invitación')
      setPageStatus('form')
    }
  }

  // ── Flow B: Existing logged-in user — just accept ─────────────────────
  async function handleAccept() {
    if (!invitation || !token) return
    setPageStatus('submitting')

    try {
      const { data: result, error: rpcError } = await supabase.rpc(
        'accept_invitation',
        { p_token: token }
      ) as any
      if (rpcError) throw rpcError
      if (!result?.success) throw new Error(result?.error ?? 'No se pudo aceptar la invitación')

      await notifyCoordinator(user?.email ?? 'Miembro')

      setPageStatus('success')
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Error al aceptar la invitación')
      setPageStatus('error')
    }
  }

  // ── Render: Loading / Submitting ───────────────────────────────────────
  if (pageStatus === 'loading' || pageStatus === 'submitting') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center space-y-4">
          <LoadingSpinner className="h-8 w-8 mx-auto" />
          <p className="text-gray-600">
            {pageStatus === 'loading' ? 'Cargando invitación...' : 'Procesando...'}
          </p>
        </div>
      </div>
    )
  }

  // ── Render: Success ────────────────────────────────────────────────────
  if (pageStatus === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center space-y-6">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">¡Te has unido al equipo!</h1>
              <p className="mt-2 text-sm text-gray-500">
                Ya formas parte del grupo{' '}
                <span className="font-medium text-gray-700">{invitation?.group_name}</span>.
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

  // ── Render: Error ──────────────────────────────────────────────────────
  if (pageStatus === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center space-y-6">
            <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Invitación inválida</h1>
              <p className="mt-2 text-sm text-gray-500">{errorMsg}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: Logged-in confirm ──────────────────────────────────────────
  if (pageStatus === 'logged-in') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-primary-600 px-6 py-8 text-center">
              <Users className="h-12 w-12 text-white mx-auto mb-3" />
              <h2 className="text-xl font-bold text-white">Invitación al equipo</h2>
              <p className="mt-1 text-primary-100 text-sm">{invitation?.group_name}</p>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 text-center">
                Estás por unirte al grupo{' '}
                <strong className="text-gray-800">{invitation?.group_name}</strong>.
              </p>
              <button
                onClick={handleAccept}
                className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
              >
                Aceptar invitación
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: Registration form (new user) ───────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary-900">ExcellenceTracker</h1>
          <p className="mt-2 text-gray-500">Sistema de evaluación de excelencia</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-primary-50 border-b border-primary-100 px-6 py-5 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center mb-3">
              <Users className="h-6 w-6 text-primary-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              Invitación al grupo{' '}
              <span className="text-primary-600">{invitation?.group_name}</span>
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Crea tu cuenta para aceptar la invitación.
            </p>
          </div>

          <div className="p-6">
            {formError && (
              <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={invitation?.email ?? ''}
                  readOnly
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Correo al que fue enviada la invitación.
                </p>
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
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
              >
                <Loader2 className="h-4 w-4 animate-spin hidden" aria-hidden />
                Registrarme y aceptar
              </button>
            </form>

            <p className="mt-3 text-center text-xs text-gray-400">
              Al registrarte aceptarás automáticamente la invitación.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
