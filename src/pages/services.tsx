import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useGroupContext } from '@/contexts/group-context'
import {
  useServices,
  useMyAssignedServices,
  useCreateService,
  useDeleteService,
  useAssignServers,
} from '@/hooks/use-services'
import {
  useSchedules,
  useCreateSchedule,
  useDeleteSchedule,
  useGenerateRecurringServices,
} from '@/hooks/use-schedules'
import { useChecklists } from '@/hooks/use-checklists'
import { useMembers } from '@/hooks/use-members'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { Modal } from '@/components/common/modal'
import { EmptyState } from '@/components/common/empty-state'
import { useConfirm, useToast } from '@/components/common/toast'
import {
  Calendar,
  Plus,
  Trash2,
  Users,
  ClipboardCheck,
  ChevronRight,
  Repeat,
  Play,
  X,
} from 'lucide-react'
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'

type StatusFilter = 'all' | 'scheduled' | 'in_progress' | 'completed'
type MainTab = 'services' | 'schedules'

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Próximos', value: 'scheduled' },
  { label: 'En curso', value: 'in_progress' },
  { label: 'Completados', value: 'completed' },
]

const STATUS_BADGE: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Programado',
  in_progress: 'En curso',
  completed: 'Completado',
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function ServicesPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { activeGroup } = useGroupContext()
  const isCoordinator = profile?.role === 'coordinator'
  const confirm = useConfirm()

  const [mainTab, setMainTab] = useState<MainTab>('services')
  const [activeTab, setActiveTab] = useState<StatusFilter>('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [showGenerateDialog, setShowGenerateDialog] = useState<string | null>(null)

  // For "Próximos" tab, we don't pass status filter to API; we filter client-side for current week
  const apiStatusFilter = activeTab === 'all' || activeTab === 'scheduled' ? undefined : activeTab

  const {
    data: coordinatorServices,
    isLoading: loadingCoordinator,
  } = useServices(isCoordinator ? activeGroup?.id : undefined, apiStatusFilter)

  const {
    data: serverServices,
    isLoading: loadingServer,
  } = useMyAssignedServices(!isCoordinator ? user?.id : undefined)

  const {
    data: schedules,
    isLoading: loadingSchedules,
  } = useSchedules(isCoordinator ? activeGroup?.id : undefined)

  const deleteMutation = useDeleteService()
  const deleteScheduleMutation = useDeleteSchedule()

  const rawServices = isCoordinator ? coordinatorServices : serverServices
  const isLoading = isCoordinator ? loadingCoordinator : loadingServer

  // Filter and sort services
  const services = useMemo(() => {
    if (!rawServices) return []

    let filtered = [...rawServices]

    // For "Próximos" tab: filter to current week only
    if (activeTab === 'scheduled' && isCoordinator) {
      const now = new Date()
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }) // Monday
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 }) // Sunday
      const weekStartStr = format(weekStart, 'yyyy-MM-dd')
      const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

      filtered = filtered.filter(
        (s) => s.status === 'scheduled' && s.date >= weekStartStr && s.date <= weekEndStr
      )
    }

    // Sort by date ascending (nearest first)
    filtered.sort((a, b) => a.date.localeCompare(b.date))

    return filtered
  }, [rawServices, activeTab, isCoordinator])

  const handleDelete = async (e: React.MouseEvent, serviceId: string) => {
    e.stopPropagation()
    const ok = await confirm({
      title: 'Eliminar servicio',
      message: '¿Estás seguro de que deseas eliminar este servicio?',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    })
    if (ok) deleteMutation.mutate(serviceId)
  }

  const handleDeleteSchedule = async (scheduleId: string) => {
    const ok = await confirm({
      title: 'Eliminar programación',
      message: '¿Estás seguro de que deseas eliminar esta programación? Los servicios ya creados no se eliminarán.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    })
    if (ok) deleteScheduleMutation.mutate(scheduleId)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Servicios</h1>
        {isCoordinator && (
          <div className="flex items-center gap-2">
            {mainTab === 'schedules' && (
              <button
                onClick={() => setShowScheduleDialog(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-primary-600 px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors"
              >
                <Repeat className="h-4 w-4" />
                Nueva recurrencia
              </button>
            )}
            <button
              onClick={() => setShowCreateDialog(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Servicio único
            </button>
          </div>
        )}
      </div>

      {/* Main tabs - only for coordinators */}
      {isCoordinator && (
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setMainTab('services')}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors inline-flex items-center justify-center gap-2 ${
              mainTab === 'services'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Calendar className="h-4 w-4" />
            Servicios
          </button>
          <button
            onClick={() => setMainTab('schedules')}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors inline-flex items-center justify-center gap-2 ${
              mainTab === 'schedules'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Repeat className="h-4 w-4" />
            Recurrencia
          </button>
        </div>
      )}

      {/* ============ SERVICES TAB ============ */}
      {mainTab === 'services' && (
        <>
          {/* Status filter - only for coordinators */}
          {isCoordinator && (
            <div className="flex gap-1 rounded-lg bg-gray-50 p-1">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === tab.value
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Services list */}
          {!services || services.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title={
                isCoordinator
                  ? activeTab === 'scheduled'
                    ? 'No hay servicios programados esta semana'
                    : 'No hay servicios'
                  : 'No tienes servicios asignados'
              }
              description={
                isCoordinator
                  ? 'Crea un nuevo servicio o configura una recurrencia semanal.'
                  : 'Tu coordinador te asignará servicios próximamente.'
              }
              action={
                isCoordinator ? (
                  <button
                    onClick={() => setShowCreateDialog(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Crear servicio
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-4">
              {services.map((service) => {
                const assignments = service.service_assignments ?? []
                const serverCount = assignments.length
                const totalAssignments = serverCount
                const evaluationsDone = service.service_evaluations?.length ?? 0

                // Collect unique template names from assignments
                const templateNames = [
                  ...new Set(
                    assignments
                      .map((a: any) => a.checklist_templates?.name)
                      .filter(Boolean)
                  ),
                ]

                return (
                  <div
                    key={service.id}
                    onClick={() => navigate(`/services/${service.id}`)}
                    className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Date */}
                        <p className="text-sm text-gray-500">
                          <Calendar className="mr-1.5 inline h-4 w-4" />
                          {format(new Date(service.date + 'T00:00:00'), "EEE, d MMM yyyy", {
                            locale: es,
                          })}
                        </p>

                        {/* Name */}
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {service.name || 'Servicio'}
                        </h3>

                        {/* Badges row */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Recurring badge */}
                          {service.is_recurring && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                              <Repeat className="h-3 w-3" />
                              Recurrente
                            </span>
                          )}

                          {/* Per-assignment checklist template badges */}
                          {templateNames.map((tName) => (
                            <span
                              key={tName as string}
                              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
                            >
                              <ClipboardCheck className="h-3 w-3" />
                              {tName as string}
                            </span>
                          ))}

                          {/* Status badge */}
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              STATUS_BADGE[service.status] ?? 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {STATUS_LABEL[service.status] ?? service.status}
                          </span>
                        </div>

                        {/* Stats row */}
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {serverCount} {serverCount === 1 ? 'servidor' : 'servidores'}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <ClipboardCheck className="h-4 w-4" />
                            {evaluationsDone}/{totalAssignments} evaluaciones
                          </span>
                        </div>
                      </div>

                      {/* Right side actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isCoordinator && (
                          <button
                            onClick={(e) => handleDelete(e, service.id)}
                            disabled={deleteMutation.isPending}
                            className="rounded-lg p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Eliminar servicio"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ============ SCHEDULES TAB ============ */}
      {mainTab === 'schedules' && isCoordinator && (
        <>
          {loadingSchedules ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner className="h-8 w-8" />
            </div>
          ) : !schedules || schedules.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title="Sin programaciones recurrentes"
              description="Configura servicios semanales que se repitan automáticamente."
              action={
                <button
                  onClick={() => setShowScheduleDialog(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Nueva recurrencia
                </button>
              }
            />
          ) : (
            <div className="grid gap-4">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {schedule.name}
                        </h3>
                        {!schedule.is_active && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                            Inactivo
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                          <Repeat className="h-3 w-3" />
                          Cada {DAY_NAMES[schedule.day_of_week]}
                        </span>
                        {schedule.default_server_assignments && (schedule.default_server_assignments as any[]).length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            <Users className="h-3 w-3" />
                            {(schedule.default_server_assignments as any[]).length} servidores
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-500">
                        Desde {format(new Date(schedule.start_date + 'T00:00:00'), "d MMM yyyy", { locale: es })}
                        {schedule.end_date
                          ? ` hasta ${format(new Date(schedule.end_date + 'T00:00:00'), "d MMM yyyy", { locale: es })}`
                          : ' (sin fecha fin)'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setShowGenerateDialog(schedule.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white px-3 py-2 text-sm font-medium transition-colors"
                        title="Generar servicios"
                      >
                        <Play className="h-4 w-4" />
                        Generar
                      </button>
                      <button
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        disabled={deleteScheduleMutation.isPending}
                        className="rounded-lg p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Eliminar programación"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Service Dialog */}
      {showCreateDialog && (
        <CreateServiceDialog
          groupId={activeGroup?.id}
          userId={user?.id}
          onClose={() => setShowCreateDialog(false)}
        />
      )}

      {/* Create Schedule Dialog */}
      {showScheduleDialog && (
        <CreateScheduleDialog
          groupId={activeGroup?.id}
          userId={user?.id}
          onClose={() => setShowScheduleDialog(false)}
        />
      )}

      {/* Generate Services Dialog */}
      {showGenerateDialog && (
        <GenerateServicesDialog
          scheduleId={showGenerateDialog}
          onClose={() => setShowGenerateDialog(null)}
        />
      )}
    </div>
  )
}

// ============================================================
// CreateServiceDialog - per-server template selection
// ============================================================
function CreateServiceDialog({
  groupId,
  userId,
  onClose,
}: {
  groupId: string | undefined
  userId: string | undefined
  onClose: () => void
}) {
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedServers, setSelectedServers] = useState<
    { userId: string; templateId: string }[]
  >([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()

  const { profile } = useAuth()
  const { activeGroup } = useGroupContext()
  const { data: checklists } = useChecklists(groupId)
  const { data: members } = useMembers(groupId)
  const createMutation = useCreateService()
  const assignMutation = useAssignServers()

  // Build assignable people: members + coordinator (if not already a member)
  const coordinatorEntry = activeGroup && profile?.role === 'coordinator' ? {
    id: 'coord-self',
    user_id: userId!,
    profiles: { full_name: profile.full_name ?? 'Coordinador', id: userId! },
    isCoordinator: true,
  } : null

  const assignableUsers = [
    ...(coordinatorEntry ? [coordinatorEntry] : []),
    ...(members ?? []).filter(m => m.user_id !== userId),
  ]

  const isServerSelected = (uid: string) =>
    selectedServers.some((s) => s.userId === uid)

  const getServerTemplate = (uid: string) =>
    selectedServers.find((s) => s.userId === uid)?.templateId ?? ''

  const toggleServer = (uid: string) => {
    setSelectedServers((prev) => {
      if (prev.some((s) => s.userId === uid)) {
        return prev.filter((s) => s.userId !== uid)
      }
      return [...prev, { userId: uid, templateId: '' }]
    })
  }

  const setServerTemplate = (uid: string, templateId: string) => {
    setSelectedServers((prev) =>
      prev.map((s) => (s.userId === uid ? { ...s, templateId } : s))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupId || !userId || !date) return

    setIsSubmitting(true)
    try {
      const service = await createMutation.mutateAsync({
        group_id: groupId,
        date,
        name: name.trim() || undefined,
        notes: notes.trim() || undefined,
        created_by: userId,
      })

      if (selectedServers.length > 0 && service?.id) {
        await assignMutation.mutateAsync({
          serviceId: service.id,
          assignments: selectedServers.map((s) => ({
            userId: s.userId,
            templateId: s.templateId || null,
          })),
        })
      }

      toast.success('Servicio creado correctamente')
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Error al crear servicio')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Crear servicio único
            </h2>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre (opcional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Servicio especial"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Asignar participantes y checklist
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Selecciona los participantes y asigna un checklist a cada uno según su función.
              </p>
              {assignableUsers.length === 0 ? (
                <p className="text-sm text-gray-500">No hay miembros en el grupo.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {assignableUsers.map((person: any) => {
                    const selected = isServerSelected(person.user_id)
                    return (
                      <div key={person.id} className="px-3 py-2.5 hover:bg-gray-50">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleServer(person.user_id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-900 flex-1">
                            {person.profiles?.full_name ?? 'Sin nombre'}
                          </span>
                          {person.isCoordinator && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                              Coordinador
                            </span>
                          )}
                        </label>
                        {/* Per-server template selector */}
                        {selected && (
                          <div className="mt-2 ml-7">
                            <select
                              value={getServerTemplate(person.user_id)}
                              onChange={(e) => setServerTemplate(person.user_id, e.target.value)}
                              className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none bg-white"
                            >
                              <option value="">Sin checklist</option>
                              {checklists?.map((cl) => (
                                <option key={cl.id} value={cl.id}>
                                  {cl.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Notas adicionales..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !date}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting && <LoadingSpinner className="h-4 w-4" />}
              Crear
            </button>
          </div>
        </form>
    </Modal>
  )
}

// ============================================================
// CreateScheduleDialog
// ============================================================
function CreateScheduleDialog({
  groupId,
  userId,
  onClose,
}: {
  groupId: string | undefined
  userId: string | undefined
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState(0)
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState('')
  const [selectedServers, setSelectedServers] = useState<
    { userId: string; templateId: string }[]
  >([])
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()

  const { profile } = useAuth()
  const { activeGroup } = useGroupContext()
  const { data: checklists } = useChecklists(groupId)
  const { data: members } = useMembers(groupId)
  const createMutation = useCreateSchedule()

  // Build assignable people: members + coordinator
  const coordinatorEntry = activeGroup && profile?.role === 'coordinator' ? {
    id: 'coord-self',
    user_id: userId!,
    profiles: { full_name: profile.full_name ?? 'Coordinador', id: userId! },
    isCoordinator: true,
  } : null

  const assignableUsers = [
    ...(coordinatorEntry ? [coordinatorEntry] : []),
    ...(members ?? []).filter(m => m.user_id !== userId),
  ]

  const isServerSelected = (uid: string) =>
    selectedServers.some((s) => s.userId === uid)

  const getServerTemplate = (uid: string) =>
    selectedServers.find((s) => s.userId === uid)?.templateId ?? ''

  const toggleServer = (uid: string) => {
    setSelectedServers((prev) => {
      if (prev.some((s) => s.userId === uid)) {
        return prev.filter((s) => s.userId !== uid)
      }
      return [...prev, { userId: uid, templateId: '' }]
    })
  }

  const setServerTemplate = (uid: string, templateId: string) => {
    setSelectedServers((prev) =>
      prev.map((s) => (s.userId === uid ? { ...s, templateId } : s))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupId || !userId) return
    setError('')
    setIsSubmitting(true)
    try {
      await createMutation.mutateAsync({
        group_id: groupId,
        name: name.trim(),
        day_of_week: dayOfWeek,
        start_date: startDate,
        end_date: endDate || undefined,
        default_server_assignments: selectedServers.map((s) => ({
          user_id: s.userId,
          template_id: s.templateId || null,
        })),
        notes: notes.trim() || undefined,
        created_by: userId,
      })
      toast.success('Programación creada correctamente')
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Error al crear programación')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Nueva programación recurrente
            </h2>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del servicio <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Servicio de miércoles"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Día de la semana <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-7 gap-1">
                {DAY_NAMES_SHORT.map((day, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setDayOfWeek(idx)}
                    className={`rounded-lg py-2 text-xs font-medium transition-colors ${
                      dayOfWeek === idx
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Desde <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hasta (opcional)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Servidores por defecto
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Selecciona los participantes y asigna un checklist a cada uno. Se asignarán automáticamente a cada servicio generado.
              </p>
              {assignableUsers.length === 0 ? (
                <p className="text-sm text-gray-500">No hay miembros en el grupo.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {assignableUsers.map((person: any) => {
                    const selected = isServerSelected(person.user_id)
                    return (
                      <div key={person.id} className="px-3 py-2.5 hover:bg-gray-50">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleServer(person.user_id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-900 flex-1">
                            {person.profiles?.full_name ?? 'Sin nombre'}
                          </span>
                          {person.isCoordinator && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                              Coordinador
                            </span>
                          )}
                        </label>
                        {/* Per-server template selector */}
                        {selected && (
                          <div className="mt-2 ml-7">
                            <select
                              value={getServerTemplate(person.user_id)}
                              onChange={(e) => setServerTemplate(person.user_id, e.target.value)}
                              className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none bg-white"
                            >
                              <option value="">Sin checklist</option>
                              {checklists?.map((cl) => (
                                <option key={cl.id} value={cl.id}>
                                  {cl.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Notas adicionales..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting && <LoadingSpinner className="h-4 w-4" />}
              <Repeat className="h-4 w-4" />
              Crear programación
            </button>
          </div>
        </form>
    </Modal>
  )
}

// ============================================================
// GenerateServicesDialog
// ============================================================
function GenerateServicesDialog({
  scheduleId,
  onClose,
}: {
  scheduleId: string
  onClose: () => void
}) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const fourWeeks = format(addDays(new Date(), 28), 'yyyy-MM-dd')

  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(fourWeeks)
  const [result, setResult] = useState<number | null>(null)
  const [error, setError] = useState('')

  const generateMutation = useGenerateRecurringServices()

  const handleGenerate = async () => {
    setError('')
    try {
      const count = await generateMutation.mutateAsync({
        scheduleId,
        fromDate,
        toDate,
      })
      setResult(count)
    } catch (err: any) {
      setError(err?.message ?? 'Error al generar servicios')
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Generar servicios
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {result === null ? (
          <>
            <p className="text-sm text-gray-500">
              Se crearán servicios para cada ocurrencia de la programación en el rango de fechas seleccionado.
              Los servicios que ya existan no se duplicarán.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !fromDate || !toDate}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {generateMutation.isPending && <LoadingSpinner className="h-4 w-4" />}
                <Play className="h-4 w-4" />
                Generar
              </button>
            </div>
          </>
        ) : (
          <div className="text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
              <Calendar className="h-7 w-7 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">
                {result === 0
                  ? 'No se crearon servicios nuevos'
                  : `${result} servicio${result === 1 ? '' : 's'} creado${result === 1 ? '' : 's'}`}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {result === 0
                  ? 'Todos los servicios para ese período ya existían.'
                  : 'Los servicios se crearon con los servidores asignados automáticamente.'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 text-sm font-medium transition-colors"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
