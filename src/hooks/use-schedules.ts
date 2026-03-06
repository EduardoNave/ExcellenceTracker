import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  generateRecurringServices,
} from '@/api/schedules'

export function useSchedules(groupId: string | undefined) {
  return useQuery({
    queryKey: ['schedules', groupId],
    queryFn: () => getSchedules(groupId!),
    enabled: !!groupId,
  })
}

export function useCreateSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createSchedule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  })
}

export function useUpdateSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string
      name?: string
      day_of_week?: number
      start_date?: string
      end_date?: string | null
      is_active?: boolean
      default_server_assignments?: { user_id: string; template_id: string | null }[]
      notes?: string
    }) => updateSchedule(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  })
}

export function useDeleteSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteSchedule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  })
}

export function useGenerateRecurringServices() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      scheduleId,
      fromDate,
      toDate,
    }: {
      scheduleId: string
      fromDate: string
      toDate: string
    }) => generateRecurringServices(scheduleId, fromDate, toDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] })
      qc.invalidateQueries({ queryKey: ['schedules'] })
    },
  })
}
