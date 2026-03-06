import { useState, useMemo } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useGroupContext } from '@/contexts/group-context'
import { useServices } from '@/hooks/use-services'
import { useServerEvaluations } from '@/hooks/use-evaluations'
import { useMembers } from '@/hooks/use-members'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { EmptyState } from '@/components/common/empty-state'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getScoreColor, getScoreLabel } from '@/lib/scoring'

type CoordinatorTab = 'team' | 'history'

export default function ReportsPage() {
  const { profile } = useAuth()
  const isCoordinator = profile?.role === 'coordinator'

  if (isCoordinator) {
    return <CoordinatorReports />
  }

  return <ServerReports />
}

// ---------------------------------------------------------------------------
// Coordinator View
// ---------------------------------------------------------------------------

function CoordinatorReports() {
  const [tab, setTab] = useState<CoordinatorTab>('team')
  const { activeGroup } = useGroupContext()
  const { data: services, isLoading: loadingServices } = useServices(activeGroup?.id)
  const { data: members, isLoading: loadingMembers } = useMembers(activeGroup?.id)

  const isLoading = loadingServices || loadingMembers

  // Compute per-member average scores from services + evaluations
  const memberStats = useMemo(() => {
    if (!members || !services) return []

    return members.map((member) => {
      const memberEvals: number[] = []

      for (const service of services) {
        const eval_ = service.service_evaluations?.find(
          (e) => e.user_id === member.user_id
        )
        if (eval_ && eval_.total_score != null) {
          memberEvals.push(eval_.total_score)
        }
      }

      const avg =
        memberEvals.length > 0
          ? Math.round(
              memberEvals.reduce((s, v) => s + v, 0) / memberEvals.length
            )
          : null

      return {
        name: member.profiles.full_name,
        userId: member.user_id,
        score: avg,
        totalServices: memberEvals.length,
      }
    })
  }, [members, services])

  const barData = useMemo(
    () =>
      memberStats
        .filter((m) => m.score !== null)
        .map((m) => ({ name: m.name, score: m.score })),
    [memberStats]
  )

  // Services table data
  const serviceRows = useMemo(() => {
    if (!services) return []

    return services
      .map((s) => {
        const scores = s.service_evaluations
          ?.map((e) => e.total_score)
          .filter((v): v is number => v != null) ?? []
        const avg =
          scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : null

        const statusLabels: Record<string, string> = {
          scheduled: 'Programado',
          in_progress: 'En progreso',
          completed: 'Completado',
        }

        // Derive unique template names from per-assignment templates
        const templateNames = [
          ...new Set(
            (s.service_assignments ?? [])
              .map((a: any) => a.checklist_templates?.name)
              .filter(Boolean) as string[]
          ),
        ]

        return {
          id: s.id,
          date: s.date,
          name: s.name ?? 'Sin nombre',
          templateName: templateNames.length > 0 ? templateNames.join(', ') : '-',
          status: statusLabels[s.status] ?? s.status,
          avgScore: avg,
        }
      })
      .sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
  }, [services])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    )
  }

  const hasData = barData.length > 0 || serviceRows.length > 0

  if (!hasData) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sin datos disponibles"
        description="No hay datos suficientes para generar reportes."
      />
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setTab('team')}
            className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium ${
              tab === 'team'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Rendimiento del equipo
          </button>
          <button
            onClick={() => setTab('history')}
            className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium ${
              tab === 'history'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Historial de servicios
          </button>
        </nav>
      </div>

      {tab === 'team' && (
        <TeamPerformanceTab barData={barData} memberStats={memberStats} />
      )}

      {tab === 'history' && <ServiceHistoryTab rows={serviceRows} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Team Performance Tab
// ---------------------------------------------------------------------------

function TeamPerformanceTab({
  barData,
  memberStats,
}: {
  barData: { name: string; score: number | null }[]
  memberStats: {
    name: string
    userId: string
    score: number | null
    totalServices: number
  }[]
}) {
  if (barData.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sin evaluaciones"
        description="No hay datos suficientes para generar reportes."
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Bar Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Puntaje promedio por servidor
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 100]} />
            <Tooltip
              formatter={(value: any) => [`${value}%`, 'Puntaje']}
            />
            <Bar dataKey="score" fill="#4f46e5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Member list */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Resumen por servidor
        </h2>
        <ul className="divide-y divide-gray-100">
          {memberStats.map((m) => (
            <li
              key={m.userId}
              className="flex items-center justify-between py-3"
            >
              <div>
                <p className="font-medium text-gray-900">{m.name}</p>
                <p className="text-sm text-gray-500">
                  {m.totalServices}{' '}
                  {m.totalServices === 1 ? 'servicio evaluado' : 'servicios evaluados'}
                </p>
              </div>
              {m.score !== null ? (
                <span
                  className={`text-lg font-bold ${getScoreColor(m.score)}`}
                >
                  {m.score}%
                </span>
              ) : (
                <span className="text-sm text-gray-400">Sin datos</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Service History Tab
// ---------------------------------------------------------------------------

function ServiceHistoryTab({
  rows,
}: {
  rows: {
    id: string
    date: string
    name: string
    templateName: string
    status: string
    avgScore: number | null
  }[]
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sin servicios"
        description="No hay datos suficientes para generar reportes."
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Fecha
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Nombre
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Plantilla
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Estado
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Puntaje promedio
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                {format(new Date(row.date), "d 'de' MMM yyyy", { locale: es })}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                {row.name}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                {row.templateName}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                {row.status}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold">
                {row.avgScore !== null ? (
                  <span className={getScoreColor(row.avgScore)}>
                    {row.avgScore}%
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Server View
// ---------------------------------------------------------------------------

function ServerReports() {
  const { user } = useAuth()
  const { data: evaluations, isLoading } = useServerEvaluations(user?.id)

  const chartData = useMemo(() => {
    if (!evaluations) return []

    return [...evaluations]
      .filter((e) => e.total_score != null)
      .sort(
        (a, b) =>
          new Date(a.evaluated_at).getTime() -
          new Date(b.evaluated_at).getTime()
      )
      .map((e) => ({
        date: format(new Date(e.evaluated_at), "d MMM", { locale: es }),
        score: Math.round(e.total_score!),
      }))
  }, [evaluations])

  const stats = useMemo(() => {
    if (!evaluations || evaluations.length === 0)
      return { avg: 0, total: 0, best: 0, worst: 0 }

    const scores = evaluations
      .map((e: any) => e.total_score)
      .filter((v: any): v is number => v != null)

    if (scores.length === 0) return { avg: 0, total: 0, best: 0, worst: 0 }

    const avg = Math.round(scores.reduce((s: number, v: number) => s + v, 0) / scores.length)
    const best = Math.round(Math.max(...scores))
    const worst = Math.round(Math.min(...scores))

    return { avg, total: scores.length, best, worst }
  }, [evaluations])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    )
  }

  if (!evaluations || evaluations.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sin datos disponibles"
        description="No hay datos suficientes para generar reportes."
      />
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>

      {/* Mi rendimiento */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Mi rendimiento</h2>

        {/* Line Chart */}
        {chartData.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-sm font-medium text-gray-500">
              Puntaje a lo largo del tiempo
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip
                  formatter={(value: any) => [`${value}%`, 'Puntaje']}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <p className="text-sm text-gray-500">Promedio</p>
            <p className={`text-3xl font-bold ${getScoreColor(stats.avg)}`}>
              {stats.avg}%
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <p className="text-sm text-gray-500">Total evaluaciones</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <p className="text-sm text-gray-500">Mejor puntaje</p>
            <p className={`text-3xl font-bold ${getScoreColor(stats.best)}`}>
              {stats.best}%
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <p className="text-sm text-gray-500">Peor puntaje</p>
            <p className={`text-3xl font-bold ${getScoreColor(stats.worst)}`}>
              {stats.worst}%
            </p>
          </div>
        </div>
      </section>

      {/* Historial */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Historial</h2>
        <div className="space-y-3">
          {evaluations.map((ev: any) => {
            const score = ev.total_score != null ? Math.round(ev.total_score) : null
            const serviceName =
              ev.services?.name ?? 'Servicio'
            const serviceDate = ev.services?.date
              ? format(new Date(ev.services.date), "d 'de' MMM yyyy", {
                  locale: es,
                })
              : format(new Date(ev.evaluated_at), "d 'de' MMM yyyy", {
                  locale: es,
                })

            return (
              <div
                key={ev.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
              >
                <div>
                  <p className="font-medium text-gray-900">{serviceName}</p>
                  <p className="text-sm text-gray-500">{serviceDate}</p>
                </div>
                {score !== null ? (
                  <div className="text-right">
                    <p className={`text-xl font-bold ${getScoreColor(score)}`}>
                      {score}%
                    </p>
                    <p
                      className={`text-xs font-medium ${getScoreColor(score)}`}
                    >
                      {getScoreLabel(score)}
                    </p>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">Sin puntaje</span>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
