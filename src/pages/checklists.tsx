import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useGroupContext } from '@/contexts/group-context'
import {
  useChecklists,
  useCreateChecklist,
  useDeleteChecklist,
  useDuplicateChecklist,
} from '@/hooks/use-checklists'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { EmptyState } from '@/components/common/empty-state'
import { Modal } from '@/components/common/modal'
import { useConfirm, useToast } from '@/components/common/toast'
import { ClipboardList, Plus, Trash2, Copy, X } from 'lucide-react'

export default function ChecklistsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeGroup } = useGroupContext()
  const { data: checklists, isLoading } = useChecklists(activeGroup?.id)
  const createChecklist = useCreateChecklist()
  const deleteChecklist = useDeleteChecklist()
  const duplicateChecklist = useDuplicateChecklist()
  const confirm = useConfirm()
  const toast = useToast()

  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!activeGroup) return
    await createChecklist.mutateAsync({
      group_id: activeGroup.id,
      name,
      description,
      created_by: user!.id,
    })
    toast.success('Checklist creado correctamente')
    setName('')
    setDescription('')
    setShowCreate(false)
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'Eliminar checklist',
      message: '¿Estás seguro de que deseas eliminar este checklist? Se eliminarán todas sus secciones y tareas. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deleteChecklist.mutateAsync(id)
      toast.success('Checklist eliminado')
    } catch {
      toast.error('Error al eliminar el checklist')
    }
  }

  async function handleDuplicate(e: React.MouseEvent, checklistId: string) {
    e.stopPropagation()
    if (!user) return
    try {
      const newChecklist = await duplicateChecklist.mutateAsync({
        sourceId: checklistId,
        userId: user.id,
      })
      toast.success('Checklist duplicado correctamente')
      navigate(`/checklists/${newChecklist.id}`)
    } catch {
      toast.error('Error al duplicar el checklist')
    }
  }

  if (!activeGroup) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Sin grupo activo"
        description="Selecciona o crea un grupo para ver sus checklists."
      />
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Checklists</h1>
        <button
          onClick={() => {
            setName('')
            setDescription('')
            setShowCreate(true)
          }}
          className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 py-2 text-sm font-medium inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Crear checklist
        </button>
      </div>

      {!checklists || checklists.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No hay checklists"
          description="Crea tu primer checklist para comenzar a evaluar."
          action={
            <button
              onClick={() => setShowCreate(true)}
              className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 py-2 text-sm font-medium inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Crear checklist
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {checklists.map((checklist) => (
            <div
              key={checklist.id}
              className="bg-white rounded-xl shadow-md p-5 hover:shadow-lg transition-shadow cursor-pointer relative group"
              onClick={() => navigate(`/checklists/${checklist.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-gray-900 truncate">
                    {checklist.name}
                  </h3>
                  {checklist.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {checklist.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    {checklist.checklist_sections?.[0]?.count ?? 0}{' '}
                    {(checklist.checklist_sections?.[0]?.count ?? 0) === 1
                      ? 'sección'
                      : 'secciones'}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                  <button
                    onClick={(e) => handleDuplicate(e, checklist.id)}
                    disabled={duplicateChecklist.isPending}
                    className="text-gray-400 hover:text-primary-600 p-1 rounded-lg hover:bg-primary-50 transition-colors"
                    title="Duplicar checklist"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(checklist.id)
                    }}
                    className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors"
                    title="Eliminar checklist"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Diálogo Crear Checklist */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Crear checklist
              </h3>
              <button
                onClick={() => setShowCreate(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  placeholder="Ej: Checklist de apertura"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Descripción opcional"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createChecklist.isPending || !name.trim()}
                  className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {createChecklist.isPending ? 'Creando...' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  )
}
