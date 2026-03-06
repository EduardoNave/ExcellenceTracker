import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getServices,
  getMyAssignedServices,
  getServiceDetail,
  createService,
  updateService,
  deleteService,
} from '@/api/services'
import { assignServers, removeAssignment, updateAssignmentTemplate, getAssignmentWithTemplate } from '@/api/assignments'
import type { AssignmentInput } from '@/api/assignments'

export function useServices(groupId: string | undefined, status?: string) {
  return useQuery({
    queryKey: ['services', groupId, status],
    queryFn: () => getServices(groupId!, status),
    enabled: !!groupId,
  })
}

export function useMyAssignedServices(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-services', userId],
    queryFn: () => getMyAssignedServices(userId!),
    enabled: !!userId,
  })
}

export function useServiceDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['service', id],
    queryFn: () => getServiceDetail(id!),
    enabled: !!id,
  })
}

export function useAssignmentWithTemplate(serviceId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['assignment', serviceId, userId],
    queryFn: () => getAssignmentWithTemplate(serviceId!, userId!),
    enabled: !!serviceId && !!userId,
  })
}

export function useCreateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createService,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
}

export function useUpdateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string
      name?: string
      date?: string
      notes?: string
      status?: string
    }) => updateService(id, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['services'] })
      qc.invalidateQueries({ queryKey: ['service', vars.id] })
    },
  })
}

export function useDeleteService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteService,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
}

export function useAssignServers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      serviceId,
      assignments,
    }: {
      serviceId: string
      assignments: AssignmentInput[]
    }) => assignServers(serviceId, assignments),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] })
      qc.invalidateQueries({ queryKey: ['service'] })
    },
  })
}

export function useUpdateAssignmentTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      assignmentId,
      templateId,
    }: {
      assignmentId: string
      templateId: string | null
    }) => updateAssignmentTemplate(assignmentId, templateId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] })
      qc.invalidateQueries({ queryKey: ['service'] })
      qc.invalidateQueries({ queryKey: ['assignment'] })
    },
  })
}

export function useRemoveAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      serviceId,
      userId,
    }: {
      serviceId: string
      userId: string
    }) => removeAssignment(serviceId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] })
      qc.invalidateQueries({ queryKey: ['service'] })
    },
  })
}
