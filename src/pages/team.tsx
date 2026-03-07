import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useGroupContext } from '@/contexts/group-context'
import {
  useGroups,
  useCreateGroup,
  useUpdateGroup,
} from '@/hooks/use-groups'
import {
  useMembers,
  useAddMember,
  useRemoveMember,
} from '@/hooks/use-members'
import {
  useInvitations,
  useInviteUser,
  useDeleteInvitation,
  useResendInvitation,
} from '@/hooks/use-invitations'
import { sendGroupInvitationEmail } from '@/api/coordinator-invitations'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { EmptyState } from '@/components/common/empty-state'
import { Modal } from '@/components/common/modal'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  X,
  Mail,
  Copy,
  Check,
  Clock,
  RefreshCw,
  Link as LinkIcon,
} from 'lucide-react'

export default function TeamPage() {
  const { user } = useAuth()
  const { activeGroup, setActiveGroup } = useGroupContext()
  const { data: groups, isLoading: groupsLoading } = useGroups()
  const { data: members, isLoading: membersLoading } = useMembers(activeGroup?.id)
  const { data: invitations, isLoading: invitationsLoading } = useInvitations(activeGroup?.id)
  const createGroup = useCreateGroup()
  const updateGroup = useUpdateGroup()
  const addMember = useAddMember()
  const removeMember = useRemoveMember()
  const inviteUser = useInviteUser()
  const deleteInvitation = useDeleteInvitation()
  const resendInvitation = useResendInvitation()

  const [showEditGroup, setShowEditGroup] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null)
  const [showGroupSelector, setShowGroupSelector] = useState(false)

  const [groupName, setGroupName] = useState('')
  const [groupDescription, setGroupDescription] = useState('')
  const [groupError, setGroupError] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)

  if (groupsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    )
  }

  if (!groups || groups.length === 0) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <div className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Crear tu primer grupo
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Los grupos te permiten organizar a tus servidores y asignarles
            checklists de evaluación.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setGroupError('')
              try {
                await createGroup.mutateAsync({
                  name: groupName,
                  description: groupDescription,
                  coordinator_id: user!.id,
                })
                setGroupName('')
                setGroupDescription('')
              } catch (err: any) {
                console.error('Error creating group:', err)
                setGroupError(err?.message ?? 'Error al crear el grupo. Verifica que las políticas RLS estén configuradas correctamente.')
              }
            }}
            className="space-y-4"
          >
            {groupError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {groupError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del grupo
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Ej: Equipo de cocina"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Descripción opcional del grupo"
              />
            </div>
            <button
              type="submit"
              disabled={createGroup.isPending || !groupName.trim()}
              className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {createGroup.isPending ? 'Creando...' : 'Crear grupo'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  function openEditGroup() {
    if (!activeGroup) return
    setGroupName(activeGroup.name)
    setGroupDescription(activeGroup.description ?? '')
    setShowEditGroup(true)
  }

  async function handleEditGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!activeGroup) return
    await updateGroup.mutateAsync({
      id: activeGroup.id,
      name: groupName,
      description: groupDescription,
    })
    setShowEditGroup(false)
    setGroupName('')
    setGroupDescription('')
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError('')
    setInviteLink('')
    if (!activeGroup || !user) return
    try {
      // Try to add directly first (if user already registered)
      try {
        await addMember.mutateAsync({
          groupId: activeGroup.id,
          email: inviteEmail,
        })
      } catch (_directErr: any) {
        // User not registered yet, that's OK - we'll just create the invitation
      }

      // Also create an invitation with a shareable link
      const siteUrl = window.location.origin
      const result = await inviteUser.mutateAsync({
        email: inviteEmail,
        groupId: activeGroup.id,
        invitedBy: user.id,
        siteUrl,
      })
      setInviteLink(result.inviteLink)

      // Send email notification via Brevo (non-blocking, best-effort)
      sendGroupInvitationEmail({
        toEmail: inviteEmail,
        inviteLink: result.inviteLink,
        groupName: activeGroup.name,
        invitedByName: user.user_metadata?.full_name ?? user.email ?? 'Un coordinador',
      }).catch(() => {/* silently ignore email failures */})
    } catch (err: any) {
      setInviteError(err?.message ?? 'Error al invitar servidor')
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRemoveMember(memberId: string) {
    if (!activeGroup) return
    await removeMember.mutateAsync(memberId)
    setShowRemoveConfirm(null)
  }

  const pendingInvitations = invitations?.filter((inv) => inv.status === 'pending') ?? []

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Selector de grupo */}
      {groups.length > 1 && (
        <div className="relative">
          <button
            onClick={() => setShowGroupSelector(!showGroupSelector)}
            className="flex items-center gap-2 bg-white rounded-lg shadow px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {activeGroup?.name ?? 'Seleccionar grupo'}
            <ChevronDown className="h-4 w-4" />
          </button>
          {showGroupSelector && (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-10 min-w-[200px]">
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => {
                    setActiveGroup(group)
                    setShowGroupSelector(false)
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg"
                >
                  {group.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tarjeta de información del grupo */}
      {activeGroup && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {activeGroup.name}
              </h2>
              {activeGroup.description && (
                <p className="text-sm text-gray-500 mt-1">
                  {activeGroup.description}
                </p>
              )}
            </div>
            <button
              onClick={openEditGroup}
              className="text-gray-400 hover:text-gray-600"
              title="Editar grupo"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Sección de miembros */}
      {activeGroup && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">
              Servidores
            </h3>
            <button
              onClick={() => {
                setInviteEmail('')
                setInviteError('')
                setInviteLink('')
                setCopied(false)
                setShowInviteDialog(true)
              }}
              className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 py-2 text-sm font-medium inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Invitar servidor
            </button>
          </div>

          {membersLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : !members || members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No hay servidores en este grupo"
              description="Invita servidores usando su correo electrónico."
            />
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="bg-white rounded-lg shadow px-5 py-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary-700">
                        {(member.profiles?.full_name ?? '?')
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {member.profiles?.full_name ?? 'Sin nombre'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          {member.profiles?.role === 'coordinator'
                            ? 'Coordinador'
                            : 'Servidor'}
                        </span>
                        {member.joined_at && (
                          <span className="text-xs text-gray-400">
                            Desde{' '}
                            {format(new Date(member.joined_at), "d 'de' MMM yyyy", {
                              locale: es,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowRemoveConfirm(member.id)}
                    className="text-gray-400 hover:text-red-500"
                    title="Eliminar servidor"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sección de invitaciones pendientes */}
      {activeGroup && !invitationsLoading && pendingInvitations.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Invitaciones pendientes
          </h3>
          <div className="space-y-3">
            {pendingInvitations.map((inv) => (
              <div
                key={inv.id}
                className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {inv.email}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Pendiente
                      </span>
                      {inv.expires_at && (
                        <span className="text-xs text-gray-400">
                          Expira{' '}
                          {format(new Date(inv.expires_at), "d 'de' MMM yyyy", {
                            locale: es,
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/invite/${inv.token}`
                      navigator.clipboard.writeText(link)
                    }}
                    className="rounded-lg p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                    title="Copiar enlace de invitación"
                  >
                    <LinkIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => resendInvitation.mutate(inv.id)}
                    className="rounded-lg p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Reenviar invitación"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteInvitation.mutate(inv.id)}
                    className="rounded-lg p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Cancelar invitación"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diálogo Editar Grupo */}
      {showEditGroup && (
        <Modal onClose={() => setShowEditGroup(false)} maxWidth="max-w-md">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Editar grupo
              </h3>
              <button
                onClick={() => setShowEditGroup(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEditGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del grupo
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditGroup(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updateGroup.isPending || !groupName.trim()}
                  className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {updateGroup.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Diálogo Invitar Servidor */}
      {showInviteDialog && (
        <Modal onClose={() => setShowInviteDialog(false)} maxWidth="max-w-md">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Invitar servidor
              </h3>
              <button
                onClick={() => setShowInviteDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!inviteLink ? (
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    placeholder="correo@ejemplo.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Se generará un enlace de invitación que puedes compartir con el servidor.
                  Si ya está registrado, se agregará directamente al grupo.
                </p>
                {inviteError && (
                  <p className="text-sm text-red-600">{inviteError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteDialog(false)}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={inviteUser.isPending || addMember.isPending || !inviteEmail.trim()}
                    className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {(inviteUser.isPending || addMember.isPending) && (
                      <LoadingSpinner className="h-4 w-4" />
                    )}
                    <Mail className="h-4 w-4" />
                    Invitar
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="h-5 w-5 text-green-600" />
                    <p className="text-sm font-medium text-green-800">
                      ¡Invitación creada!
                    </p>
                  </div>
                  <p className="text-xs text-green-700 mb-3">
                    Comparte este enlace con <strong>{inviteEmail}</strong> para que se una al grupo.
                    La invitación expira en 7 días.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={inviteLink}
                      className="flex-1 rounded-lg border border-green-300 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-green-600 hover:bg-green-700 text-white px-3 py-2 text-xs font-medium transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copiar
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setInviteEmail('')
                      setInviteLink('')
                      setInviteError('')
                    }}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Invitar otro
                  </button>
                  <button
                    onClick={() => setShowInviteDialog(false)}
                    className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
                  >
                    Listo
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Diálogo Confirmar Eliminación de Miembro */}
      {showRemoveConfirm && (
        <Modal onClose={() => setShowRemoveConfirm(null)} maxWidth="max-w-sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Confirmar eliminación
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              ¿Estás seguro de que deseas eliminar a este servidor del grupo? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRemoveConfirm(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleRemoveMember(showRemoveConfirm)}
                disabled={removeMember.isPending}
                className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {removeMember.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
