import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getEvaluation,
  saveEvaluation,
  getServerEvaluations,
} from '@/api/evaluations'

export function useEvaluation(
  serviceId: string | undefined,
  userId: string | undefined
) {
  return useQuery({
    queryKey: ['evaluation', serviceId, userId],
    queryFn: () => getEvaluation(serviceId!, userId!),
    enabled: !!serviceId && !!userId,
  })
}

export function useSaveEvaluation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveEvaluation,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: ['evaluation', vars.service_id, vars.user_id],
      })
      qc.invalidateQueries({ queryKey: ['services'] })
      qc.invalidateQueries({ queryKey: ['service', vars.service_id] })
    },
  })
}

export function useServerEvaluations(userId: string | undefined) {
  return useQuery({
    queryKey: ['server-evaluations', userId],
    queryFn: () => getServerEvaluations(userId!),
    enabled: !!userId,
  })
}
