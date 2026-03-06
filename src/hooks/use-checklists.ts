import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getChecklists, getChecklistWithSections, createChecklist, updateChecklist, deleteChecklist, duplicateChecklist } from '@/api/checklists'
import { createSection, updateSection, deleteSection, reorderSections } from '@/api/sections'
import { createItem, updateItem, deleteItem, reorderItems } from '@/api/items'

export function useChecklists(groupId: string | undefined) {
  return useQuery({
    queryKey: ['checklists', groupId],
    queryFn: () => getChecklists(groupId!),
    enabled: !!groupId,
  })
}

export function useChecklist(id: string | undefined) {
  return useQuery({
    queryKey: ['checklist', id],
    queryFn: () => getChecklistWithSections(id!),
    enabled: !!id,
  })
}

export function useCreateChecklist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createChecklist,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklists'] }),
  })
}

export function useUpdateChecklist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string }) =>
      updateChecklist(id, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['checklists'] })
      qc.invalidateQueries({ queryKey: ['checklist', vars.id] })
    },
  })
}

export function useDeleteChecklist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteChecklist,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklists'] }),
  })
}

export function useCreateSection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createSection,
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['checklist', vars.template_id] }),
  })
}

export function useUpdateSection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      templateId,
      ...data
    }: {
      id: string
      templateId: string
      name?: string
    }) => updateSection(id, data),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['checklist', vars.templateId] }),
  })
}

export function useDeleteSection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; templateId: string }) =>
      deleteSection(id),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['checklist', vars.templateId] }),
  })
}

export function useReorderSections() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      sections,
    }: {
      sections: { id: string; position: number }[]
      templateId: string
    }) => reorderSections(sections),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['checklist', vars.templateId] }),
  })
}

export function useCreateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      templateId: _t,
      ...data
    }: {
      templateId: string
      section_id: string
      description: string
      weight?: number
      position: number
      is_omittable?: boolean
    }) => createItem(data),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['checklist', vars.templateId] }),
  })
}

export function useUpdateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      templateId: _t,
      ...data
    }: {
      id: string
      templateId: string
      description?: string
      weight?: number
      is_omittable?: boolean
    }) => updateItem(id, data),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['checklist', vars.templateId] }),
  })
}

export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; templateId: string }) =>
      deleteItem(id),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['checklist', vars.templateId] }),
  })
}

export function useReorderItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      items,
    }: {
      items: { id: string; position: number; section_id?: string }[]
      templateId: string
    }) => reorderItems(items),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['checklist', vars.templateId] }),
  })
}

export function useDuplicateChecklist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sourceId, userId }: { sourceId: string; userId: string }) =>
      duplicateChecklist(sourceId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklists'] }),
  })
}
