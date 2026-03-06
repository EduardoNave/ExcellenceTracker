import { supabase } from '@/lib/supabase'
import type { Invitation } from '@/types'

export async function getGroupInvitations(groupId: string) {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Invitation[]
}

export async function createInvitation(data: {
  group_id: string
  email: string
  invited_by: string
}) {
  const { data: invitation, error } = await supabase
    .from('invitations')
    .insert(data)
    .select()
    .single()
  if (error) {
    if (error.code === '23505') {
      throw new Error('Ya existe una invitación pendiente para este correo en este grupo.')
    }
    throw error
  }
  return invitation as Invitation
}

export async function deleteInvitation(id: string) {
  const { error } = await supabase
    .from('invitations')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function resendInvitation(id: string) {
  // Reset expiration date
  const { error } = await supabase
    .from('invitations')
    .update({
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

export async function acceptInvitation(token: string) {
  const { data, error } = await supabase.rpc('accept_invitation', {
    invitation_token: token,
  })
  if (error) throw error
  return data as { success: boolean; error?: string; group_id?: string }
}

export async function inviteUserViaSupabase(email: string, groupId: string, invitedBy: string, siteUrl: string) {
  // Step 1: Create invitation record
  const invitation = await createInvitation({
    group_id: groupId,
    email,
    invited_by: invitedBy,
  })

  // Step 2: Use Supabase Auth admin invite (via edge function or direct)
  // Since we can't call admin API from client, we use the magic link approach
  // The coordinator shares the invite link, and the user signs up normally
  // then accepts the invitation via the token
  const inviteLink = `${siteUrl}/invite/${invitation.token}`

  return { invitation, inviteLink }
}
