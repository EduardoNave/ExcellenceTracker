import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getGroupInvitations,
  createInvitation,
  deleteInvitation,
  resendInvitation,
  acceptInvitation,
  inviteUserViaSupabase,
} from '@/api/invitations'

export function useInvitations(groupId: string | undefined) {
  return useQuery({
    queryKey: ['invitations', groupId],
    queryFn: () => getGroupInvitations(groupId!),
    enabled: !!groupId,
  })
}

export function useCreateInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createInvitation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations'] }),
  })
}

export function useInviteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      email,
      groupId,
      invitedBy,
      siteUrl,
    }: {
      email: string
      groupId: string
      invitedBy: string
      siteUrl: string
    }) => inviteUserViaSupabase(email, groupId, invitedBy, siteUrl),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations'] })
      qc.invalidateQueries({ queryKey: ['members'] })
    },
  })
}

export function useDeleteInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteInvitation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations'] }),
  })
}

export function useResendInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: resendInvitation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations'] }),
  })
}

export function useAcceptInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: acceptInvitation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
      qc.invalidateQueries({ queryKey: ['members'] })
    },
  })
}
