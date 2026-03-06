import { useReducer, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useServiceDetail, useAssignmentWithTemplate } from '@/hooks/use-services'
import { useEvaluation, useSaveEvaluation } from '@/hooks/use-evaluations'
import { useMembers } from '@/hooks/use-members'
import { useGroupContext } from '@/contexts/group-context'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { useToast } from '@/components/common/toast'
import {
  calculateScore,
  getScoreColor,
  getScoreBgColor,
  getScoreLabel,
} from '@/lib/scoring'
import {
  ArrowLeft,
  Save,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  RefreshCw,
  SkipForward,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// ──────────────────────────────────────────────
// State management
// ──────────────────────────────────────────────

interface EvaluationState {
  items: Record<string, { completed: boolean; omitted: boolean; notes: string }>
  overallNotes: string
}

type EvaluationAction =
  | { type: 'TOGGLE_ITEM'; itemId: string }
  | { type: 'TOGGLE_OMIT'; itemId: string }
  | { type: 'SET_ITEM_NOTES'; itemId: string; notes: string }
  | { type: 'SET_OVERALL_NOTES'; notes: string }
  | {
      type: 'LOAD_EXISTING'
      items: Record<string, { completed: boolean; omitted: boolean; notes: string }>
      overallNotes: string
    }
  | { type: 'INIT_ITEMS'; itemIds: string[] }

function evaluationReducer(
  state: EvaluationState,
  action: EvaluationAction
): EvaluationState {
  switch (action.type) {
    case 'TOGGLE_ITEM': {
      const current = state.items[action.itemId]
      if (current?.omitted) return state // cannot toggle when omitted
      return {
        ...state,
        items: {
          ...state.items,
          [action.itemId]: {
            completed: !(current?.completed ?? false),
            omitted: false,
            notes: current?.notes ?? '',
          },
        },
      }
    }
    case 'TOGGLE_OMIT': {
      const current = state.items[action.itemId]
      const nowOmitted = !(current?.omitted ?? false)
      return {
        ...state,
        items: {
          ...state.items,
          [action.itemId]: {
            completed: nowOmitted ? false : (current?.completed ?? false),
            omitted: nowOmitted,
            notes: current?.notes ?? '',
          },
        },
      }
    }
    case 'SET_ITEM_NOTES':
      return {
        ...state,
        items: {
          ...state.items,
          [action.itemId]: {
            completed: state.items[action.itemId]?.completed ?? false,
            omitted: state.items[action.itemId]?.omitted ?? false,
            notes: action.notes,
          },
        },
      }
    case 'SET_OVERALL_NOTES':
      return { ...state, overallNotes: action.notes }
    case 'LOAD_EXISTING':
      return {
        items: action.items,
        overallNotes: action.overallNotes,
      }
    case 'INIT_ITEMS': {
      const items: Record<string, { completed: boolean; omitted: boolean; notes: string }> = {
        ...state.items,
      }
      for (const id of action.itemIds) {
        if (!items[id]) {
          items[id] = { completed: false, omitted: false, notes: '' }
        }
      }
      return { ...state, items }
    }
    default:
      return state
  }
}

const initialState: EvaluationState = {
  items: {},
  overallNotes: '',
}

// ──────────────────────────────────────────────
// Weight badge colors
// ──────────────────────────────────────────────

const weightColorMap: Record<number, string> = {
  1: 'bg-gray-400',
  2: 'bg-blue-500',
  3: 'bg-green-500',
  4: 'bg-orange-500',
  5: 'bg-red-500',
}

function getWeightColor(weight: number): string {
  return weightColorMap[weight] ?? 'bg-gray-400'
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function EvaluationPage() {
  const { id: serviceId, userId } = useParams<{
    id: string
    userId: string
  }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { activeGroup } = useGroupContext()
  const toast = useToast()

  const { data: service, isLoading: serviceLoading } =
    useServiceDetail(serviceId)
  const { data: assignment, isLoading: assignmentLoading } =
    useAssignmentWithTemplate(serviceId, userId)
  const { data: existingEvaluation, isLoading: evalLoading } = useEvaluation(
    serviceId,
    userId
  )
  const saveEvaluation = useSaveEvaluation()

  // Members for substitution
  const { data: members } = useMembers(activeGroup?.id)

  const [state, dispatch] = useReducer(evaluationReducer, initialState)
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({})
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({})
  const [existingLoaded, setExistingLoaded] = useState(false)
  const [itemsInitialized, setItemsInitialized] = useState(false)

  // Substitution state
  const [substituteId, setSubstituteId] = useState<string | null>(null)
  const [showSubstituteSelector, setShowSubstituteSelector] = useState(false)

  // ── Derived data ──

  // Load sections from the assignment's own template (not from the service)
  const sections: any[] = useMemo(
    () =>
      ((assignment as any)?.checklist_templates?.checklist_sections ?? []).sort(
        (a: any, b: any) => a.position - b.position
      ),
    [assignment]
  )

  const assignments: any[] =
    (service as any)?.service_assignments ?? []
  const serverName: string =
    (assignment as any)?.profiles?.full_name ?? 'Servidor'

  // Build substitute options: all members + coordinator (minus the original assigned user)
  const substituteOptions = useMemo(() => {
    const options: { id: string; name: string; isCoordinator?: boolean }[] = []
    const addedIds = new Set<string>()

    // Add coordinator
    if (profile?.role === 'coordinator' && user?.id && user.id !== userId) {
      options.push({
        id: user.id,
        name: profile.full_name ?? 'Coordinador',
        isCoordinator: true,
      })
      addedIds.add(user.id)
    }

    // Add other members (not the original assigned user)
    for (const m of members ?? []) {
      if (m.user_id !== userId && !addedIds.has(m.user_id)) {
        options.push({
          id: m.user_id,
          name: (m as any).profiles?.full_name ?? 'Sin nombre',
        })
        addedIds.add(m.user_id)
      }
    }

    // Add other assigned servers (not the current one)
    for (const a of assignments) {
      if (a.user_id !== userId && !addedIds.has(a.user_id)) {
        options.push({
          id: a.user_id,
          name: a.profiles?.full_name ?? 'Sin nombre',
        })
        addedIds.add(a.user_id)
      }
    }

    return options
  }, [members, assignments, userId, user, profile])

  const substituteName = useMemo(() => {
    if (!substituteId) return null
    return substituteOptions.find(o => o.id === substituteId)?.name ?? 'Sustituto'
  }, [substituteId, substituteOptions])

  // ── Init items when assignment template loads ──

  useEffect(() => {
    if (!assignment || itemsInitialized) return
    const itemIds = sections.flatMap((s: any) =>
      (s.checklist_items ?? []).map((item: any) => item.id)
    )
    if (itemIds.length > 0) {
      dispatch({ type: 'INIT_ITEMS', itemIds })
      setItemsInitialized(true)
    }
  }, [assignment, sections, itemsInitialized])

  // ── Load existing evaluation ──

  useEffect(() => {
    if (!existingEvaluation || existingLoaded) return

    const items: Record<string, { completed: boolean; omitted: boolean; notes: string }> = {}
    for (const ei of existingEvaluation.evaluation_items ?? []) {
      items[ei.checklist_item_id] = {
        completed: ei.completed,
        omitted: ei.omitted ?? false,
        notes: ei.notes ?? '',
      }
    }

    dispatch({
      type: 'LOAD_EXISTING',
      items,
      overallNotes: existingEvaluation.notes ?? '',
    })
    setExistingLoaded(true)
  }, [existingEvaluation, existingLoaded])

  // ── Live score calculation ──

  // All items including omitted (used for save payload)
  const allItemsFull = useMemo(() => {
    return sections.flatMap((s: any) =>
      (s.checklist_items ?? []).map((item: any) => ({
        id: item.id as string,
        weight: item.weight as number,
        completed: state.items[item.id]?.completed ?? false,
        omitted: state.items[item.id]?.omitted ?? false,
      }))
    )
  }, [sections, state.items])

  // Active items excluding omitted (used for score calculation)
  const allItems = useMemo(
    () => allItemsFull.filter((i) => !i.omitted),
    [allItemsFull]
  )

  const score = calculateScore(allItems)

  // ── Section stats ──

  const getSectionStats = (section: any) => {
    const items: any[] = section.checklist_items ?? []
    const omitted = items.filter((item: any) => state.items[item.id]?.omitted).length
    const total = items.length - omitted
    const completed = items.filter(
      (item: any) => state.items[item.id]?.completed && !state.items[item.id]?.omitted
    ).length
    return { total, completed, omitted }
  }

  // ── Save ──

  const handleSave = async () => {
    if (!serviceId || !userId || !user) return

    // The evaluation target: substitute or original
    const evaluationTargetId = substituteId ?? userId

    const evaluationItems = allItemsFull.map((item) => ({
      checklist_item_id: item.id,
      completed: item.completed,
      omitted: item.omitted,
      score: item.completed ? item.weight : 0,
      notes: state.items[item.id]?.notes ?? '',
    }))

    try {
      await saveEvaluation.mutateAsync({
        service_id: serviceId,
        user_id: evaluationTargetId,
        evaluated_by: user.id,
        total_score: score,
        notes: state.overallNotes + (substituteId
          ? `\n[Sustituto de ${serverName}]`
          : ''),
        items: evaluationItems,
      })
      toast.success('Evaluación guardada correctamente')
      navigate(`/services/${serviceId}`)
    } catch (err) {
      console.error('Error al guardar evaluación:', err)
      toast.error('Error al guardar la evaluación. Por favor intenta de nuevo.')
    }
  }

  // ── Toggle helpers ──

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }))
  }

  const toggleItemNotes = (itemId: string) => {
    setOpenNotes((prev) => ({ ...prev, [itemId]: !prev[itemId] }))
  }

  // ── Loading ──

  if (serviceLoading || assignmentLoading || evalLoading) {
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
      </div>
    )
  }

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto px-4 pt-8 pb-28 space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate(`/services/${serviceId}`)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al servicio
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">
          Evaluación de {substituteId ? substituteName : serverName}
        </h1>
        {substituteId && (
          <p className="text-sm text-orange-600 font-medium flex items-center gap-1.5">
            <RefreshCw className="h-4 w-4" />
            Sustituyendo a {serverName}
          </p>
        )}
        <p className="text-sm text-gray-500">
          {format(new Date(service.date), "EEEE, d 'de' MMMM 'de' yyyy", {
            locale: es,
          })}
        </p>
      </div>

      {/* Substitution section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-gray-400" />
              Reemplazo de servidor
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Si otro servidor o el coordinador cubrió a {serverName}, selecciónalo aquí.
              La evaluación se registrará para el sustituto.
            </p>
          </div>
          {substituteId ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-orange-700 bg-orange-50 px-2.5 py-1 rounded-full">
                {substituteName}
              </span>
              <button
                onClick={() => {
                  setSubstituteId(null)
                  setShowSubstituteSelector(false)
                }}
                className="text-xs text-gray-500 hover:text-red-600 font-medium"
              >
                Quitar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSubstituteSelector(!showSubstituteSelector)}
              className="text-sm font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              {showSubstituteSelector ? 'Cerrar' : 'Seleccionar sustituto'}
            </button>
          )}
        </div>

        {showSubstituteSelector && !substituteId && (
          <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
            {substituteOptions.length === 0 ? (
              <p className="px-3 py-3 text-sm text-gray-500 text-center">
                No hay personas disponibles para sustituir.
              </p>
            ) : (
              substituteOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    setSubstituteId(option.id)
                    setShowSubstituteSelector(false)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors"
                >
                  <span className="text-sm text-gray-900">{option.name}</span>
                  {option.isCoordinator && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                      Coordinador
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Live Score Display */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="text-center space-y-2">
          <p className={`text-5xl font-extrabold ${getScoreColor(score)}`}>
            {Math.round(score)}%
          </p>
          <p className={`text-lg font-semibold ${getScoreColor(score)}`}>
            {getScoreLabel(score)}
          </p>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${getScoreBgColor(score)}`}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 text-center">
          {allItems.filter((i) => i.completed).length} de {allItems.length}{' '}
          items completados
          {allItemsFull.filter((i) => i.omitted).length > 0 && (
            <span className="ml-2 text-amber-500">
              · {allItemsFull.filter((i) => i.omitted).length} omitidos
            </span>
          )}
        </p>
      </div>

      {/* Sections */}
      {sections.map((section: any) => {
        const { total, completed, omitted } = getSectionStats(section)
        const isCollapsed = collapsedSections[section.id] ?? false
        const sectionItems: any[] = (section.checklist_items ?? []).sort(
          (a: any, b: any) => a.position - b.position
        )

        return (
          <div
            key={section.id}
            className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
          >
            {/* Section header */}
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">
                  {section.name}
                </h3>
                <span className="shrink-0 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {completed}/{total} completados
                </span>
                {omitted > 0 && (
                  <span className="shrink-0 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    {omitted} omitido{omitted !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {isCollapsed ? (
                <ChevronDown className="h-5 w-5 text-gray-400 shrink-0" />
              ) : (
                <ChevronUp className="h-5 w-5 text-gray-400 shrink-0" />
              )}
            </button>

            {/* Section items */}
            {!isCollapsed && (
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                {sectionItems.map((item: any) => {
                  const itemState = state.items[item.id]
                  const isCompleted = itemState?.completed ?? false
                  const isOmitted = itemState?.omitted ?? false
                  const isOmittable = item.is_omittable ?? false
                  const showNotes = openNotes[item.id] ?? false
                  const itemNotes = itemState?.notes ?? ''

                  return (
                    <div
                      key={item.id}
                      className={`transition-colors ${
                        isOmitted
                          ? 'bg-amber-50'
                          : isCompleted
                          ? 'bg-green-50'
                          : ''
                      }`}
                    >
                      <div className="flex items-start gap-3 px-5 py-3">
                        {/* Toggle */}
                        <button
                          type="button"
                          onClick={() =>
                            dispatch({ type: 'TOGGLE_ITEM', itemId: item.id })
                          }
                          className={`mt-0.5 shrink-0 ${isOmitted ? 'opacity-30 cursor-not-allowed' : ''}`}
                          disabled={isOmitted}
                          aria-label={isCompleted ? 'Desmarcar item' : 'Marcar item'}
                        >
                          {isCompleted ? (
                            <CheckSquare className="h-5 w-5 text-green-600" />
                          ) : (
                            <Square className="h-5 w-5 text-gray-400" />
                          )}
                        </button>

                        {/* Description */}
                        <button
                          type="button"
                          onClick={() => {
                            if (!isOmitted)
                              dispatch({ type: 'TOGGLE_ITEM', itemId: item.id })
                          }}
                          className={`flex-1 text-left text-sm ${
                            isOmitted
                              ? 'line-through text-gray-400 cursor-default'
                              : 'text-gray-800'
                          }`}
                        >
                          {item.description}
                        </button>

                        {/* Omitted badge */}
                        {isOmitted && (
                          <span className="shrink-0 text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            Omitido
                          </span>
                        )}

                        {/* Weight badge */}
                        <span
                          className={`shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold text-white ${
                            isOmitted ? 'opacity-30' : ''
                          } ${getWeightColor(item.weight)}`}
                          title={`Peso: ${item.weight}`}
                        >
                          {item.weight}
                        </span>

                        {/* Omit toggle (only for is_omittable items) */}
                        {isOmittable && (
                          <button
                            type="button"
                            onClick={() =>
                              dispatch({ type: 'TOGGLE_OMIT', itemId: item.id })
                            }
                            className={`shrink-0 p-1 rounded transition-colors ${
                              isOmitted
                                ? 'text-amber-600 hover:text-amber-800'
                                : 'text-gray-300 hover:text-amber-500'
                            }`}
                            aria-label={isOmitted ? 'Restaurar item' : 'Omitir item'}
                            title={isOmitted ? 'Restaurar (incluir en evaluación)' : 'Omitir (no aplica este servicio)'}
                          >
                            <SkipForward className="h-4 w-4" />
                          </button>
                        )}

                        {/* Notes toggle */}
                        <button
                          type="button"
                          onClick={() => toggleItemNotes(item.id)}
                          className={`shrink-0 p-1 rounded transition-colors ${
                            showNotes || itemNotes
                              ? 'text-primary-600'
                              : 'text-gray-400 hover:text-gray-600'
                          }`}
                          aria-label="Notas del item"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Item notes textarea */}
                      {showNotes && (
                        <div className="px-5 pb-3 pl-13">
                          <textarea
                            value={itemNotes}
                            onChange={(e) =>
                              dispatch({
                                type: 'SET_ITEM_NOTES',
                                itemId: item.id,
                                notes: e.target.value,
                              })
                            }
                            placeholder="Agregar notas para este item..."
                            rows={2}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-y"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Overall notes */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-3">
        <label
          htmlFor="overall-notes"
          className="text-lg font-semibold text-gray-900"
        >
          Notas generales
        </label>
        <textarea
          id="overall-notes"
          value={state.overallNotes}
          onChange={(e) =>
            dispatch({ type: 'SET_OVERALL_NOTES', notes: e.target.value })
          }
          rows={4}
          placeholder="Notas generales sobre el desempeño del servidor..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-y"
        />
      </div>

      {/* Fixed bottom save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 px-4 py-4 z-50">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`text-2xl font-bold ${getScoreColor(score)}`}
            >
              {Math.round(score)}%
            </span>
            <span
              className={`text-sm font-medium ${getScoreColor(score)}`}
            >
              {getScoreLabel(score)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveEvaluation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saveEvaluation.isPending ? (
              <LoadingSpinner className="h-4 w-4 border-white border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar evaluación
          </button>
        </div>
      </div>
    </div>
  )
}
