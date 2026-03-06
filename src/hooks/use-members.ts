import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGroupMembers, addMemberByEmail, removeMember } from '@/api/members'

export function useMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: ['members', groupId],
    queryFn: () => getGroupMembers(groupId!),
    enabled: !!groupId,
  })
}

export function useAddMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, email }: { groupId: string; email: string }) => addMemberByEmail(groupId, email),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  })
}

export function useRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: removeMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  })
}
