import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMyGroups, getMyMemberGroups, createGroup, updateGroup, deleteGroup } from '@/api/groups'
import { useAuth } from '@/hooks/use-auth'

export function useGroups() {
  const { user, profile } = useAuth()
  return useQuery({
    queryKey: ['groups', profile?.role, user?.id],
    queryFn: () =>
      profile?.role === 'coordinator'
        ? getMyGroups(user!.id)
        : getMyMemberGroups(user!.id),
    enabled: !!user && !!profile,
  })
}

export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })
}

export function useUpdateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string }) => updateGroup(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })
}

export function useDeleteGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })
}
