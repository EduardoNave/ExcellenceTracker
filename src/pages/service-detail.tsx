import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useServiceDetail, useUpdateService } from '@/hooks/use-services'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import {
  ArrowLeft,
  Calendar,
  ClipboardList,
  Users,
  Star,
  FileText,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getScoreColor, getScoreLabel } from '@/lib/scoring'

const statusConfig: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  scheduled: {
    label: 'Programado',
    bg: 'bg-blue-100',
    text: 'text-blue-700',
  },
  in_progress: {
    label: 'En progreso',
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
  },
  completed: {
    label: 'Completado',
    bg: 'bg-green-100',
    text: 'text-green-700',
  },
}

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { data: service, isLoading } = useServiceDetail(id)
  const updateService = useUpdateService()

  const [notes, setNotes] = useState<string | null>(null)

  const isCoordinator = profile?.role === 'coordinator'

  // Get sections from the server's own assignment template
  // NOTE: All hooks must be called before any early return
  const assignments: any[] = (service as any)?.service_assignments ?? []
  const evaluations: any[] = (service as any)?.service_evaluations ?? []

  const myAssignment =
    user && !isCoordinator
      ? assignments.find((a: any) => a.user_id === user.id)
      : null

  const sections: any[] = useMemo(() => {
    if (!myAssignment) return []
    return (myAssignment as any).checklist_templates?.checklist_sections ?? []
  }, [myAssignment])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner className="h-10 w-10" />
      </div>
    )
  }

  if (!service) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-gray-500 text-center">Servicio no encontrado.</p>
        <div className="mt-4 text-center">
          <Link
            to="/services"
            className="text-primary-600 hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a servicios
          </Link>
        </div>
      </div>
    )
  }

  const currentNotes = notes ?? service.notes ?? ''
  const status = statusConfig[service.status] ?? statusConfig.scheduled

  const getEvaluationForUser = (userId: string) =>
    evaluations.find((e: any) => e.user_id === userId)

  const handleSaveNotes = () => {
    if (!id) return
    updateService.mutate({ id, notes: currentNotes })
  }

  const handleChangeStatus = (newStatus: string) => {
    if (!id) return
    updateService.mutate({ id, status: newStatus })
  }

  // ---------- Server view helpers ----------
  const myEvaluation =
    user && !isCoordinator
      ? evaluations.find((e: any) => e.user_id === user.id)
      : null

  const myFullEvaluation = myEvaluation as any | null

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/services')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a servicios
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="h-4 w-4" />
              {format(new Date(service.date), "EEEE, d 'de' MMMM 'de' yyyy", {
                locale: es,
              })}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {service.name || 'Servicio'}
            </h1>
          </div>

          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.text}`}
          >
            {status.label}
          </span>
        </div>
      </div>

      {/* ===================== COORDINATOR VIEW ===================== */}
      {isCoordinator && (
        <>
          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-400" />
              Notas del servicio
            </h2>
            <textarea
              value={currentNotes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Agregar notas sobre este servicio..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-y"
            />
            <button
              onClick={handleSaveNotes}
              disabled={updateService.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {updateService.isPending ? (
                <LoadingSpinner className="h-4 w-4 border-white border-t-transparent" />
              ) : null}
              Guardar notas
            </button>
          </div>

          {/* Status controls */}
          {service.status !== 'completed' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Control de estado
              </h2>
              <div className="flex flex-wrap gap-3">
                {service.status === 'scheduled' && (
                  <button
                    onClick={() => handleChangeStatus('in_progress')}
                    disabled={updateService.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50 transition-colors"
                  >
                    Iniciar servicio
                  </button>
                )}
                {service.status === 'in_progress' && (
                  <button
                    onClick={() => handleChangeStatus('completed')}
                    disabled={updateService.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    Completar servicio
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Assigned Servers */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-400" />
              Servidores asignados
            </h2>

            {assignments.length === 0 ? (
              <p className="text-sm text-gray-500">
                No hay servidores asignados a este servicio.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {assignments.map((assignment: any) => {
                  const serverProfile = assignment.profiles
                  const assignmentTemplateName = assignment.checklist_templates?.name
                  const evaluation = getEvaluationForUser(assignment.user_id)
                  const hasEvaluation = !!evaluation
                  const score = evaluation?.total_score ?? 0

                  return (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">
                          {serverProfile?.full_name ?? 'Servidor'}
                        </p>
                        {assignmentTemplateName && (
                          <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
                            <ClipboardList className="h-3 w-3" />
                            {assignmentTemplateName}
                          </p>
                        )}
                        {hasEvaluation ? (
                          <div className="flex items-center gap-2 mt-1">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span
                              className={`text-sm font-semibold ${getScoreColor(score)}`}
                            >
                              {Math.round(score)}%
                            </span>
                            <span
                              className={`text-xs font-medium ${getScoreColor(score)}`}
                            >
                              {getScoreLabel(score)}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <Circle className="h-3 w-3" />
                            Sin evaluar
                          </p>
                        )}
                      </div>

                      <Link
                        to={`/services/${id}/evaluate/${assignment.user_id}`}
                        className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          hasEvaluation
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-primary-600 text-white hover:bg-primary-700'
                        }`}
                      >
                        {hasEvaluation ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Ver evaluación
                          </>
                        ) : (
                          <>
                            <ClipboardList className="h-3.5 w-3.5" />
                            Evaluar
                          </>
                        )}
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ===================== SERVER VIEW ===================== */}
      {!isCoordinator && (
        <>
          {myFullEvaluation ? (
            <>
              {/* Score display */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center space-y-3">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center justify-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Tu puntuación
                </h2>
                <p
                  className={`text-5xl font-extrabold ${getScoreColor(myFullEvaluation.total_score ?? 0)}`}
                >
                  {Math.round(myFullEvaluation.total_score ?? 0)}%
                </p>
                <p
                  className={`text-lg font-semibold ${getScoreColor(myFullEvaluation.total_score ?? 0)}`}
                >
                  {getScoreLabel(myFullEvaluation.total_score ?? 0)}
                </p>
              </div>

              {/* Item breakdown by section */}
              {sections.length > 0 && (
                <div className="space-y-4">
                  {sections
                    .sort((a: any, b: any) => a.position - b.position)
                    .map((section: any) => {
                      const sectionItems: any[] =
                        section.checklist_items ?? []

                      return (
                        <div
                          key={section.id}
                          className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3"
                        >
                          <h3 className="font-semibold text-gray-800">
                            {section.name}
                          </h3>
                          <ul className="space-y-2">
                            {sectionItems
                              .sort(
                                (a: any, b: any) => a.position - b.position
                              )
                              .map((item: any) => {
                                const evalItem =
                                  myFullEvaluation.evaluation_items?.find(
                                    (ei: any) =>
                                      ei.checklist_item_id === item.id
                                  )
                                const completed = evalItem?.completed ?? false

                                return (
                                  <li
                                    key={item.id}
                                    className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                                      completed
                                        ? 'bg-green-50'
                                        : 'bg-gray-50'
                                    }`}
                                  >
                                    {completed ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                                    ) : (
                                      <Circle className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                                    )}
                                    <span
                                      className={
                                        completed
                                          ? 'text-gray-900'
                                          : 'text-gray-500'
                                      }
                                    >
                                      {item.description}
                                    </span>
                                  </li>
                                )
                              })}
                          </ul>
                        </div>
                      )
                    })}
                </div>
              )}

              {/* Coordinator notes */}
              {myFullEvaluation.notes && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-2">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-400" />
                    Notas del coordinador
                  </h2>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {myFullEvaluation.notes}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
              <Circle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                Aún no has sido evaluado en este servicio.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
