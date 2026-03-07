import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ShieldCheck,
  Mail,
  Trash2,
  Copy,
  Check,
  Loader2,
  Users,
  Clock,
  UserCheck,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import {
  useCoordinatorInvitations,
  useCreateCoordinatorInvitation,
  useDeleteCoordinatorInvitation,
} from '@/hooks/use-coordinator-invitations'
import { LoadingSpinner } from '@/components/common/loading-spinner'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  expired: 'Expirada',
}

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  expired: 'bg-gray-100 text-gray-500',
}

export default function AdminPage() {
  const { data, isLoading, error } = useCoordinatorInvitations()
  const createInv = useCreateCoordinatorInvitation()
  const deleteInv = useDeleteCoordinatorInvitation()

  const [email, setEmail] = useState('')
  const [formError, setFormError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const siteUrl = window.location.origin

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setSuccessMsg('')
    try {
      const result = await createInv.mutateAsync(email.trim())
      setEmail('')
      setSuccessMsg(
        result.emailSent
          ? `Invitación enviada a ${result.invitation.email} por correo.`
          : `Invitación creada para ${result.invitation.email}. El correo no pudo enviarse — copia el enlace manualmente.`
      )
    } catch (err: any) {
      setFormError(err?.message ?? 'Error al crear la invitación')
    }
  }

  function handleCopy(token: string, id: string) {
    const link = `${siteUrl}/coordinator-invite/${token}`
    navigator.clipboard.writeText(link)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
          <ShieldCheck className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Panel de Administración</h1>
          <p className="text-sm text-gray-500">Gestiona los coordinadores de la plataforma</p>
        </div>
      </div>

      {/* Invite form */}
      <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Mail className="h-4 w-4 text-indigo-500" />
          Invitar coordinador
        </h2>

        <form onSubmit={handleInvite} className="flex gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setFormError(''); setSuccessMsg('') }}
            required
            placeholder="coordinador@ejemplo.com"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={createInv.isPending || !email.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {createInv.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Enviar invitación
          </button>
        </form>

        {formError && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {formError}
          </div>
        )}
        {successMsg && (
          <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            {successMsg}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner className="h-8 w-8" />
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Error al cargar las invitaciones: {(error as Error).message}
        </div>
      )}

      {data && (
        <>
          {/* Invitations table */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Invitaciones de coordinadores
              </h2>
              <span className="text-xs text-gray-400">{data.invitations.length} total</span>
            </div>

            {data.invitations.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-gray-400">
                No hay invitaciones aún. Envía la primera arriba.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{inv.email}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[inv.status] ?? STATUS_CLASS.expired}`}>
                          {STATUS_LABEL[inv.status] ?? inv.status}
                        </span>
                        <span className="text-xs text-gray-400">
                          Enviada {format(new Date(inv.created_at), "d MMM yyyy", { locale: es })}
                        </span>
                        {inv.status === 'pending' && (
                          <span className="text-xs text-gray-400">
                            · Expira {format(new Date(inv.expires_at), "d MMM yyyy", { locale: es })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-4 shrink-0">
                      {inv.status === 'pending' && (
                        <button
                          onClick={() => handleCopy(inv.token, inv.id)}
                          className="rounded-lg p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Copiar enlace de invitación"
                        >
                          {copiedId === inv.id ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => deleteInv.mutate(inv.id)}
                        disabled={deleteInv.isPending}
                        className="rounded-lg p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                        title="Eliminar invitación"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active coordinators */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-500" />
                Coordinadores activos
              </h2>
              <span className="text-xs text-gray-400">{data.coordinators.length} total</span>
            </div>

            {data.coordinators.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-gray-400">
                Ningún coordinador ha aceptado una invitación aún.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.coordinators.map((coord) => (
                  <div
                    key={coord.id}
                    className="flex items-center justify-between px-6 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-indigo-700">
                          {(coord.full_name ?? '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{coord.full_name}</p>
                        <p className="text-xs text-gray-400">{coord.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {coord.group_count} {coord.group_count === 1 ? 'grupo' : 'grupos'}
                      </span>
                      <span className="text-gray-300">·</span>
                      <span>
                        Desde {format(new Date(coord.created_at), "MMM yyyy", { locale: es })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
