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
  FileText,
  Edit2,
  Eye,
  Send,
  Save,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import {
  useCoordinatorInvitations,
  useCreateCoordinatorInvitation,
  useDeleteCoordinatorInvitation,
} from '@/hooks/use-coordinator-invitations'
import {
  useEmailTemplates,
  useUpdateEmailTemplate,
  useSendTestEmail,
} from '@/hooks/use-email-templates'
import { useAuth } from '@/hooks/use-auth'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import type { EmailTemplate } from '@/api/email-templates'

// ── Coordinadores tab constants ────────────────────────────────────────────
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

// ── Email template editor component ───────────────────────────────────────
function TemplateEditor({ template }: { template: EmailTemplate }) {
  const { user } = useAuth()
  const updateMutation = useUpdateEmailTemplate()
  const testMutation = useSendTestEmail()

  const [expanded, setExpanded] = useState(false)
  const [subject, setSubject] = useState(template.subject)
  const [htmlBody, setHtmlBody] = useState(template.html_body)
  const [showPreview, setShowPreview] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [testSuccess, setTestSuccess] = useState(false)
  const [error, setError] = useState('')

  const isDirty = subject !== template.subject || htmlBody !== template.html_body

  async function handleSave() {
    setError('')
    try {
      await updateMutation.mutateAsync({ id: template.id, patch: { subject, html_body: htmlBody } })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (err: any) {
      setError(err?.message ?? 'Error al guardar')
    }
  }

  async function handleTestSend() {
    if (!user?.email) return
    setError('')
    try {
      await testMutation.mutateAsync({ template_id: template.id, to_email: user.email })
      setTestSuccess(true)
      setTimeout(() => setTestSuccess(false), 2500)
    } catch (err: any) {
      setError(err?.message ?? 'Error al enviar prueba')
    }
  }

  function handleDiscard() {
    setSubject(template.subject)
    setHtmlBody(template.html_body)
    setExpanded(false)
    setShowPreview(false)
    setError('')
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Row header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{template.name}</p>
            {template.variables.map((v) => (
              <span
                key={v}
                className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-mono text-indigo-600"
              >
                {`{{${v}}}`}
              </span>
            ))}
          </div>
          <p className="mt-0.5 text-xs text-gray-400 truncate">
            Asunto: {template.subject}
          </p>
          <p className="text-xs text-gray-300 mt-0.5">
            Actualizado {format(new Date(template.updated_at), "d MMM yyyy HH:mm", { locale: es })}
          </p>
        </div>
        <div className="ml-4 flex items-center gap-2 shrink-0">
          {isDirty && (
            <span className="text-xs text-amber-600 font-medium">Sin guardar</span>
          )}
          <button
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
          >
            <Edit2 className="h-3.5 w-3.5" />
            {expanded ? 'Cerrar' : 'Editar'}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Inline editor */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Asunto
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* HTML body */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Cuerpo HTML
            </label>
            <textarea
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              rows={20}
              spellCheck={false}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
            />
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between bg-gray-100 px-4 py-2">
                <span className="text-xs font-semibold text-gray-600">Vista previa</span>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <iframe
                srcDoc={htmlBody}
                title="Vista previa del correo"
                className="w-full h-96 border-0"
                sandbox="allow-same-origin"
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending || !isDirty}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saveSuccess ? (
                <Check className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saveSuccess ? 'Guardado' : 'Guardar'}
            </button>

            <button
              onClick={() => setShowPreview(!showPreview)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Eye className="h-4 w-4" />
              {showPreview ? 'Ocultar vista previa' : 'Vista previa'}
            </button>

            <button
              onClick={handleTestSend}
              disabled={testMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              title={`Enviar prueba a ${user?.email}`}
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : testSuccess ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {testSuccess ? '¡Enviado!' : 'Enviar prueba'}
            </button>

            {isDirty && (
              <button
                onClick={handleDiscard}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <X className="h-4 w-4" />
                Descartar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main admin page ────────────────────────────────────────────────────────
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'coordinadores' | 'correos'>('coordinadores')

  // Coordinator invitations
  const { data, isLoading, error } = useCoordinatorInvitations()
  const createInv = useCreateCoordinatorInvitation()
  const deleteInv = useDeleteCoordinatorInvitation()

  const [email, setEmail] = useState('')
  const [formError, setFormError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Email templates
  const { data: templates, isLoading: templatesLoading, error: templatesError } = useEmailTemplates()

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
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
          <ShieldCheck className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Panel de Administración</h1>
          <p className="text-sm text-gray-500">Gestiona coordinadores y plantillas de correo</p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        <button
          onClick={() => setActiveTab('coordinadores')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'coordinadores'
              ? 'bg-white shadow text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="h-4 w-4" />
          Coordinadores
        </button>
        <button
          onClick={() => setActiveTab('correos')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'correos'
              ? 'bg-white shadow text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          Plantillas de correo
        </button>
      </div>

      {/* ── Tab: Coordinadores ── */}
      {activeTab === 'coordinadores' && (
        <div className="space-y-6">
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
      )}

      {/* ── Tab: Correos ── */}
      {activeTab === 'correos' && (
        <div className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-4">
            <p className="text-sm text-indigo-700">
              <strong>Plantillas de correo</strong> — Edita el asunto y el cuerpo HTML de cada correo
              que envía la plataforma. Usa <code className="bg-indigo-100 rounded px-1">{'{{variable}}'}</code> para
              insertar datos dinámicos. Los cambios se aplican de inmediato sin redeploys.
            </p>
          </div>

          {templatesLoading && (
            <div className="flex justify-center py-12">
              <LoadingSpinner className="h-8 w-8" />
            </div>
          )}

          {templatesError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              Error al cargar las plantillas: {(templatesError as Error).message}
            </div>
          )}

          {templates && templates.length > 0 && (
            <div className="space-y-3">
              {templates.map((template) => (
                <TemplateEditor key={template.id} template={template} />
              ))}
            </div>
          )}

          {templates && templates.length === 0 && (
            <div className="text-center py-12 text-sm text-gray-400">
              No hay plantillas de correo. Asegúrate de haber aplicado la migración 013.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
