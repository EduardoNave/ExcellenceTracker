import { Link } from 'react-router-dom'
import { Calendar, ClipboardList, Users, TrendingUp, Star, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

import { useAuth } from '@/hooks/use-auth'
import { useGroupContext } from '@/contexts/group-context'
import { useServices, useMyAssignedServices } from '@/hooks/use-services'
import { useMembers } from '@/hooks/use-members'
import { useServerEvaluations } from '@/hooks/use-evaluations'
import { getScoreColor, getScoreLabel } from '@/lib/scoring'
import { LoadingSpinner } from '@/components/common/loading-spinner'

// ---------------------------------------------------------------------------
// Coordinator Dashboard
// ---------------------------------------------------------------------------
function CoordinatorDashboard() {
  const { profile } = useAuth()
  const { activeGroup } = useGroupContext()

  const { data: services = [], isLoading: servicesLoading } = useServices(
    activeGroup?.id,
  )
  const { data: members = [], isLoading: membersLoading } = useMembers(
    activeGroup?.id,
  )

  const scheduledServices = services
    .filter((s) => s.status === 'scheduled')
    .slice(0, 5)

  // Collect recent evaluations across all services
  const recentEvaluations = services
    .flatMap((service) =>
      service.service_evaluations.map((evaluation) => {
        // Find the server profile from assignments
        const assignment = service.service_assignments.find(
          (a) => a.user_id === evaluation.user_id,
        )
        return {
          id: evaluation.id,
          serverName: assignment?.profiles?.full_name ?? 'Servidor',
          score: evaluation.total_score ?? 0,
          date: service.date,
        }
      }),
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  const isLoading = servicesLoading || membersLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {profile?.full_name}
        </h1>
        {activeGroup && (
          <p className="mt-1 text-sm text-gray-500">
            Grupo activo: {activeGroup.name}
          </p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/services"
          className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Servicios</h3>
            <p className="text-sm text-gray-500">Gestionar servicios</p>
          </div>
        </Link>

        <Link
          to="/checklists"
          className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Checklists</h3>
            <p className="text-sm text-gray-500">Plantillas de evaluación</p>
          </div>
        </Link>

        <Link
          to="/team"
          className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Equipo</h3>
            <p className="text-sm text-gray-500">Administrar servidores</p>
          </div>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming Services */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Próximos servicios
            </h2>
            <Link
              to="/services"
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {scheduledServices.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">
              No hay servicios programados.
            </p>
          ) : (
            <ul className="space-y-3">
              {scheduledServices.map((service) => (
                <li
                  key={service.id}
                  className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {service.name ?? 'Servicio'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(service.date), "d 'de' MMMM, yyyy", {
                        locale: es,
                      })}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {service.service_assignments.length}{' '}
                    {service.service_assignments.length === 1
                      ? 'servidor'
                      : 'servidores'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Evaluations */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Evaluaciones recientes
          </h2>

          {recentEvaluations.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">
              No hay evaluaciones aún.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentEvaluations.map((evaluation) => (
                <li
                  key={evaluation.id}
                  className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {evaluation.serverName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(evaluation.date), "d 'de' MMMM, yyyy", {
                        locale: es,
                      })}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${getScoreColor(evaluation.score)}`}
                  >
                    {Math.round(evaluation.score)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Team Summary */}
        <div className="bg-white rounded-xl shadow-sm p-6 md:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Resumen del equipo
          </h2>

          <div className="grid grid-cols-2 gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {members.length}
                </p>
                <p className="text-sm text-gray-500">Miembros del equipo</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {services.length}
                </p>
                <p className="text-sm text-gray-500">Total de servicios</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Server Dashboard
// ---------------------------------------------------------------------------
function ServerDashboard() {
  const { user, profile } = useAuth()

  const { data: myServices = [], isLoading: servicesLoading } =
    useMyAssignedServices(user?.id)
  const { data: evaluations = [], isLoading: evaluationsLoading } =
    useServerEvaluations(user?.id)

  const isLoading = servicesLoading || evaluationsLoading

  // Find the next upcoming assigned service
  const nextService = myServices
    .filter((s) => s.status === 'scheduled')
    .sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )[0] ?? null

  // Last 5 evaluations
  const recentEvaluations = evaluations.slice(0, 5)

  // Overall performance
  const totalEvaluations = evaluations.length
  const avgScore =
    totalEvaluations > 0
      ? evaluations.reduce(
          (sum: number, ev: any) => sum + (ev.total_score ?? 0),
          0,
        ) / totalEvaluations
      : 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {profile?.full_name}
        </h1>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Next Assignment */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Próxima asignación
          </h2>

          {nextService ? (
            <div className="space-y-2">
              <p className="font-medium text-gray-900">
                {nextService.name ?? 'Servicio'}
              </p>
              <p className="text-sm text-gray-500">
                {format(new Date(nextService.date), "EEEE, d 'de' MMMM yyyy", {
                  locale: es,
                })}
              </p>
              {(() => {
                const tplNames = [
                  ...new Set(
                    (nextService.service_assignments ?? [])
                      .map((a) => a.checklist_templates?.name)
                      .filter(Boolean) as string[]
                  ),
                ]
                return tplNames.length > 0 ? (
                  <p className="text-xs text-gray-400">
                    Checklist: {tplNames.join(', ')}
                  </p>
                ) : null
              })()}
              <div className="pt-2">
                <Link
                  to={`/services/${nextService.id}`}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  Ver detalles
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-4">
              No tienes servicios programados.
            </p>
          )}
        </div>

        {/* Recent Scores */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Mis calificaciones recientes
          </h2>

          {recentEvaluations.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">
              Aún no tienes calificaciones.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentEvaluations.map((evaluation: any) => {
                const score = evaluation.total_score ?? 0
                return (
                  <li
                    key={evaluation.id}
                    className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {evaluation.services?.name ?? 'Servicio'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {format(
                          new Date(evaluation.evaluated_at),
                          "d 'de' MMMM, yyyy",
                          { locale: es },
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-sm font-semibold ${getScoreColor(score)}`}
                      >
                        {Math.round(score)}%
                      </span>
                      <p className={`text-xs ${getScoreColor(score)}`}>
                        {getScoreLabel(score)}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Overall Performance */}
        <div className="bg-white rounded-xl shadow-sm p-6 md:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Rendimiento general
          </h2>

          <div className="grid grid-cols-2 gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Star className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {totalEvaluations > 0 ? `${Math.round(avgScore)}%` : '---'}
                </p>
                <p className="text-sm text-gray-500">Promedio general</p>
                {totalEvaluations > 0 && (
                  <p className={`text-xs font-medium ${getScoreColor(avgScore)}`}>
                    {getScoreLabel(avgScore)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {totalEvaluations}
                </p>
                <p className="text-sm text-gray-500">Evaluaciones totales</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Dashboard Page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const { profile, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    )
  }

  if (!profile) {
    return null
  }

  if (profile.role === 'coordinator') {
    return <CoordinatorDashboard />
  }

  return <ServerDashboard />
}
