import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  useChecklist,
  useUpdateChecklist,
  useCreateSection,
  useDeleteSection,
  useUpdateSection,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
  useReorderSections,
  useReorderItems,
} from '@/hooks/use-checklists'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import {
  ArrowLeft,
  GripVertical,
  Plus,
  Trash2,
  X,
  SkipForward,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChecklistItem {
  id: string
  description: string
  weight: number
  position: number
  section_id: string
  is_omittable: boolean
}

interface ChecklistSection {
  id: string
  name: string
  position: number
  checklist_items: ChecklistItem[]
}

// ---------------------------------------------------------------------------
// Colores de peso
// ---------------------------------------------------------------------------

const WEIGHT_COLORS: Record<number, string> = {
  1: 'bg-gray-400',
  2: 'bg-blue-500',
  3: 'bg-green-500',
  4: 'bg-orange-500',
  5: 'bg-red-500',
}

// ---------------------------------------------------------------------------
// Edición en línea
// ---------------------------------------------------------------------------

function InlineEdit({
  value,
  onSave,
  className = '',
  inputClassName = '',
  placeholder = '',
}: {
  value: string
  onSave: (v: string) => void
  className?: string
  inputClassName?: string
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  useEffect(() => {
    setDraft(value)
  }, [value])

  function commit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
    else setDraft(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        className={`border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${inputClassName}`}
        placeholder={placeholder}
      />
    )
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 ${className}`}
      title="Clic para editar"
    >
      {value || <span className="text-gray-400">{placeholder}</span>}
    </span>
  )
}

// ---------------------------------------------------------------------------
// SortableItemRow
// ---------------------------------------------------------------------------

function SortableItemRow({
  item,
  templateId,
}: {
  item: ChecklistItem
  templateId: string
}) {
  const updateItem = useUpdateItem()
  const deleteItem = useDeleteItem()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { type: 'item', sectionId: item.section_id },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 group"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-gray-400 hover:text-gray-600 touch-none"
        aria-label="Arrastrar tarea"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex-1 min-w-0">
        <InlineEdit
          value={item.description}
          onSave={(v) =>
            updateItem.mutate({
              id: item.id,
              templateId,
              description: v,
            })
          }
          className="text-sm text-gray-700"
          placeholder="Descripción de la tarea"
        />
      </div>

      {/* Selector de peso */}
      <select
        value={item.weight}
        onChange={(e) =>
          updateItem.mutate({
            id: item.id,
            templateId,
            weight: Number(e.target.value),
          })
        }
        className="text-xs rounded border border-gray-300 px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
        title="Peso"
      >
        {[1, 2, 3, 4, 5].map((w) => (
          <option key={w} value={w}>
            {w}
          </option>
        ))}
      </select>

      <span
        className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold text-white ${WEIGHT_COLORS[item.weight] ?? 'bg-gray-400'}`}
        title={`Peso: ${item.weight}`}
      >
        {item.weight}
      </span>

      {/* Omittable toggle */}
      <button
        onClick={() =>
          updateItem.mutate({
            id: item.id,
            templateId,
            is_omittable: !item.is_omittable,
          })
        }
        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
          item.is_omittable
            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
            : 'text-gray-300 hover:text-amber-500 opacity-0 group-hover:opacity-100'
        }`}
        title={item.is_omittable ? 'Marcado como omitible — clic para quitar' : 'Marcar como omitible'}
      >
        <SkipForward className="h-3 w-3" />
        {item.is_omittable && <span>Omitible</span>}
      </button>

      <button
        onClick={() => deleteItem.mutate({ id: item.id, templateId })}
        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Eliminar tarea"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ItemOverlay (se muestra al arrastrar una tarea)
// ---------------------------------------------------------------------------

function ItemOverlay({ item }: { item: ChecklistItem }) {
  return (
    <div className="flex items-center gap-2 bg-white rounded-lg shadow-lg border border-primary-300 px-3 py-2">
      <GripVertical className="h-4 w-4 text-gray-400" />
      <span className="flex-1 text-sm text-gray-700">{item.description}</span>
      <span
        className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold text-white ${WEIGHT_COLORS[item.weight] ?? 'bg-gray-400'}`}
      >
        {item.weight}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SectionCard
// ---------------------------------------------------------------------------

function SectionCard({
  section,
  templateId,
}: {
  section: ChecklistSection
  templateId: string
}) {
  const updateSection = useUpdateSection()
  const deleteSection = useDeleteSection()
  const createItem = useCreateItem()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `section-${section.id}`,
    data: { type: 'section' },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [newDesc, setNewDesc] = useState('')
  const [newWeight, setNewWeight] = useState(1)
  const [newOmittable, setNewOmittable] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const sortedItems = [...(section.checklist_items ?? [])].sort(
    (a, b) => a.position - b.position
  )
  const itemIds = sortedItems.map((i) => i.id)

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newDesc.trim()) return
    await createItem.mutateAsync({
      templateId,
      section_id: section.id,
      description: newDesc.trim(),
      weight: newWeight,
      is_omittable: newOmittable,
      position: sortedItems.length,
    })
    setNewDesc('')
    setNewWeight(1)
    setNewOmittable(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-xl shadow-md"
    >
      {/* Encabezado de sección */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-gray-400 hover:text-gray-600 touch-none"
          aria-label="Arrastrar sección"
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="flex-1 font-medium text-gray-900">
          <InlineEdit
            value={section.name}
            onSave={(v) =>
              updateSection.mutate({
                id: section.id,
                templateId,
                name: v,
              })
            }
            placeholder="Nombre de la sección"
          />
        </div>
        {showDeleteConfirm ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">{'¿Eliminar?'}</span>
            <button
              onClick={() =>
                deleteSection.mutate({ id: section.id, templateId })
              }
              className="text-xs text-red-600 hover:text-red-700 font-medium"
            >
              Sí
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-gray-400 hover:text-red-500"
            title="Eliminar sección"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Tareas */}
      <div className="px-4 py-3 space-y-2">
        <SortableContext
          items={itemIds}
          strategy={verticalListSortingStrategy}
        >
          {sortedItems.map((item) => (
            <SortableItemRow
              key={item.id}
              item={item}
              templateId={templateId}
            />
          ))}
        </SortableContext>

        {sortedItems.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-2">
            Sin tareas aún. Agrega una abajo.
          </p>
        )}

        {/* Formulario agregar tarea */}
        <form
          onSubmit={handleAddItem}
          className="flex items-center gap-2 pt-2 border-t border-gray-100"
        >
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Nueva tarea..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <select
            value={newWeight}
            onChange={(e) => setNewWeight(Number(e.target.value))}
            className="text-xs rounded border border-gray-300 px-1 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
            title="Peso"
          >
            {[1, 2, 3, 4, 5].map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setNewOmittable((v) => !v)}
            className={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-medium transition-colors ${
              newOmittable
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                : 'text-gray-400 hover:text-amber-500 border border-gray-200 hover:border-amber-300'
            }`}
            title={newOmittable ? 'Omitible — clic para quitar' : 'Marcar como omitible'}
          >
            <SkipForward className="h-3 w-3" />
            {newOmittable ? 'Omitible' : ''}
          </button>
          <button
            type="submit"
            disabled={createItem.isPending || !newDesc.trim()}
            className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </button>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SectionOverlay (se muestra al arrastrar una sección)
// ---------------------------------------------------------------------------

function SectionOverlay({ section }: { section: ChecklistSection }) {
  return (
    <div className="bg-white rounded-xl shadow-xl border border-primary-300 px-4 py-3">
      <div className="flex items-center gap-2">
        <GripVertical className="h-5 w-5 text-gray-400" />
        <span className="font-medium text-gray-900">{section.name}</span>
        <span className="text-xs text-gray-400 ml-auto">
          {section.checklist_items?.length ?? 0} tareas
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ChecklistEditorPage
// ---------------------------------------------------------------------------

export default function ChecklistEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: checklist, isLoading } = useChecklist(id!)
  const updateChecklist = useUpdateChecklist()
  const createSection = useCreateSection()
  const reorderSections = useReorderSections()
  const reorderItems = useReorderItems()

  const [showAddSection, setShowAddSection] = useState(false)
  const [sectionName, setSectionName] = useState('')

  // Estado de arrastre activo
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [activeDragType, setActiveDragType] = useState<
    'section' | 'item' | null
  >(null)

  // Optimistic local state for items during drag
  const [localSections, setLocalSections] = useState<ChecklistSection[] | null>(null)

  // Sensores
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Secciones ordenadas (use local state during drag, otherwise server data)
  const rawSections: ChecklistSection[] = checklist?.checklist_sections
    ? [...checklist.checklist_sections].sort(
        (a: ChecklistSection, b: ChecklistSection) => a.position - b.position
      )
    : []

  const sections = localSections ?? rawSections

  // Clear local state when server data changes and we're not dragging
  useEffect(() => {
    if (!activeDragId) {
      setLocalSections(null)
    }
  }, [checklist, activeDragId])

  const sectionSortableIds = sections.map((s) => `section-${s.id}`)

  // Funciones auxiliares para encontrar tareas/secciones --------------------

  const findItemById = useCallback(
    (itemId: string): ChecklistItem | undefined => {
      for (const s of sections) {
        const found = s.checklist_items?.find((i) => i.id === itemId)
        if (found) return found
      }
      return undefined
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(sections.map((s) => s.id))]
  )

  // Manejadores de arrastre -------------------------------------------------

  function handleDragStart(event: DragStartEvent) {
    const idStr = String(event.active.id)
    const data = event.active.data.current as { type?: string } | undefined
    if (data?.type === 'section' || idStr.startsWith('section-')) {
      setActiveDragType('section')
      setActiveDragId(idStr.replace('section-', ''))
    } else {
      setActiveDragType('item')
      setActiveDragId(idStr)
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over || !active) return

    const activeData = active.data.current as { type?: string; sectionId?: string } | undefined
    const overData = over.data.current as { type?: string; sectionId?: string } | undefined

    // Only handle item-over-item or item-over-section for cross-section moves
    if (activeData?.type !== 'item') return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId === overId) return

    const activeSectionId = activeData?.sectionId
    let overSectionId: string | undefined

    if (overData?.type === 'section') {
      overSectionId = overId.replace('section-', '')
    } else if (overData?.type === 'item') {
      overSectionId = overData.sectionId
    }

    // Only handle cross-section moves in dragOver
    if (!activeSectionId || !overSectionId || activeSectionId === overSectionId) return

    // Move item between sections optimistically in local state
    setLocalSections((prev) => {
      const currentSections = prev ?? rawSections
      const sourceSection = currentSections.find(s => s.id === activeSectionId)
      const targetSection = currentSections.find(s => s.id === overSectionId)
      if (!sourceSection || !targetSection) return prev

      const activeItem = sourceSection.checklist_items.find(i => i.id === activeId)
      if (!activeItem) return prev

      const newSourceItems = sourceSection.checklist_items.filter(i => i.id !== activeId)
      const targetItems = [...targetSection.checklist_items]

      // Find insert index
      let insertIndex = targetItems.length
      if (overData?.type === 'item') {
        const overIndex = targetItems.findIndex(i => i.id === overId)
        if (overIndex !== -1) insertIndex = overIndex
      }

      targetItems.splice(insertIndex, 0, { ...activeItem, section_id: overSectionId! })

      return currentSections.map(s => {
        if (s.id === activeSectionId) return { ...s, checklist_items: newSourceItems }
        if (s.id === overSectionId) return { ...s, checklist_items: targetItems }
        return s
      })
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    setActiveDragId(null)
    setActiveDragType(null)

    if (!active || !over || active.id === over.id) {
      setLocalSections(null)
      return
    }

    const activeId = String(active.id)
    const overId = String(over.id)
    const activeData = active.data.current as { type?: string; sectionId?: string } | undefined
    const overData = over.data.current as { type?: string; sectionId?: string } | undefined

    // --- Reordenar secciones ---
    if (activeData?.type === 'section' && overData?.type === 'section') {
      const oldIndex = sectionSortableIds.indexOf(activeId)
      const newIndex = sectionSortableIds.indexOf(overId)
      if (oldIndex === -1 || newIndex === -1) {
        setLocalSections(null)
        return
      }
      const reordered = arrayMove(sections, oldIndex, newIndex)
      reorderSections.mutate({
        templateId: id!,
        sections: reordered.map((s, i) => ({ id: s.id, position: i })),
      })
      setLocalSections(null)
      return
    }

    // --- Reordenar tareas ---
    if (activeData?.type === 'item') {
      const currentSections = localSections ?? sections

      // Determine which section the active item is currently in
      const sourceSection = currentSections.find(s =>
        s.checklist_items?.some(i => i.id === activeId)
      )
      if (!sourceSection) {
        setLocalSections(null)
        return
      }

      // Determine target section
      let targetSection: ChecklistSection | undefined
      if (overData?.type === 'section') {
        const sectionId = overId.replace('section-', '')
        targetSection = currentSections.find(s => s.id === sectionId)
      } else if (overData?.type === 'item') {
        targetSection = currentSections.find(s =>
          s.checklist_items?.some(i => i.id === overId)
        )
      }

      if (!targetSection) {
        setLocalSections(null)
        return
      }

      if (sourceSection.id === targetSection.id) {
        // Reorder within same section
        const items = [...sourceSection.checklist_items].sort(
          (a, b) => a.position - b.position
        )
        const oldIndex = items.findIndex((i) => i.id === activeId)
        const newIndex = items.findIndex((i) => i.id === overId)
        if (oldIndex === -1 || newIndex === -1) {
          setLocalSections(null)
          return
        }
        const reordered = arrayMove(items, oldIndex, newIndex)
        reorderItems.mutate({
          templateId: id!,
          items: reordered.map((i, idx) => ({ id: i.id, position: idx })),
        })
      } else {
        // Cross-section move (localSections already has the optimistic state)
        const sourceItems = sourceSection.checklist_items
          .filter(i => i.id !== activeId)
          .sort((a, b) => a.position - b.position)
        const targetItems = targetSection.checklist_items
          .sort((a, b) => a.position - b.position)

        // Persist source section reorder
        if (sourceItems.length > 0) {
          reorderItems.mutate({
            templateId: id!,
            items: sourceItems.map((i, idx) => ({ id: i.id, position: idx })),
          })
        }
        // Persist target section reorder (with section_id to move the item)
        reorderItems.mutate({
          templateId: id!,
          items: targetItems.map((i, idx) => ({
            id: i.id,
            position: idx,
            section_id: targetSection!.id,
          })),
        })
      }

      setLocalSections(null)
    }
  }

  // Manejador agregar sección -----------------------------------------------

  async function handleAddSection(e: React.FormEvent) {
    e.preventDefault()
    if (!sectionName.trim()) return
    await createSection.mutateAsync({
      template_id: id!,
      name: sectionName.trim(),
      position: sections.length,
    })
    setSectionName('')
    setShowAddSection(false)
  }

  // Contenido del overlay activo
  const activeDragSection =
    activeDragType === 'section'
      ? sections.find((s) => s.id === activeDragId)
      : undefined

  const activeDragItem =
    activeDragType === 'item' ? findItemById(activeDragId!) : undefined

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    )
  }

  if (!checklist) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-lg font-medium text-gray-900">
          Checklist no encontrado
        </h2>
        <button
          onClick={() => navigate('/checklists')}
          className="mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          Volver a checklists
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/checklists')}
          className="text-gray-400 hover:text-gray-600"
          title="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900 flex-1">
          <InlineEdit
            value={checklist.name}
            onSave={(v) =>
              updateChecklist.mutate({ id: id!, name: v })
            }
            className="text-xl font-semibold"
            placeholder="Nombre del checklist"
          />
        </h1>
        <button
          onClick={() => {
            setSectionName('')
            setShowAddSection(true)
          }}
          className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 py-2 text-sm font-medium inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Agregar sección
        </button>
      </div>

      {/* Formulario en línea para agregar sección */}
      {showAddSection && (
        <div className="bg-white rounded-xl shadow-md p-4">
          <form onSubmit={handleAddSection} className="flex items-center gap-3">
            <input
              type="text"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              autoFocus
              placeholder="Nombre de la sección"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="submit"
              disabled={createSection.isPending || !sectionName.trim()}
              className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {createSection.isPending ? 'Creando...' : 'Crear'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddSection(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </form>
        </div>
      )}

      {/* Secciones con arrastrar y soltar */}
      {sections.length === 0 && !showAddSection ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h3 className="text-base font-medium text-gray-900">
            Sin secciones
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Agrega una sección para comenzar a definir las tareas del
            checklist.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sectionSortableIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {sections.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  templateId={id!}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeDragSection && (
              <SectionOverlay section={activeDragSection} />
            )}
            {activeDragItem && <ItemOverlay item={activeDragItem} />}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
