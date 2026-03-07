import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listCoordinatorInvitations,
  createCoordinatorInvitation,
  deleteCoordinatorInvitation,
  acceptCoordinatorInvitation,
} from '@/api/coordinator-invitations'

const QUERY_KEY = ['coordinator-invitations']

export function useCoordinatorInvitations() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: listCoordinatorInvitations,
    staleTime: 30_000,
  })
}

export function useCreateCoordinatorInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => createCoordinatorInvitation(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

export function useDeleteCoordinatorInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCoordinatorInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

export function useAcceptCoordinatorInvitation() {
  return useMutation({
    mutationFn: (token: string) => acceptCoordinatorInvitation(token),
  })
}
