import { supabase } from '@/lib/supabase'
import type { MemberWithProfile } from '@/types'

export async function getGroupMembers(groupId: string) {
  const { data, error } = await supabase
    .from('group_members')
    .select('*, profiles(*)')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return data as MemberWithProfile[]
}

export async function addMemberByEmail(groupId: string, email: string) {
  // First find the user by email in profiles - we need to query auth users
  // Since we can't query auth.users directly from client, we look up via a workaround
  // The coordinator must know the user's email who has already registered
  // Use RPC to look up user by email (must be created in Supabase)
  const { data: userId, error: rpcError } = await supabase
    .rpc('get_user_id_by_email', { lookup_email: email })

  if (rpcError || !userId) throw new Error('No se encontró un usuario con ese correo. Asegúrate de que se haya registrado primero.')

  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: userId })
  if (error) {
    if (error.code === '23505') throw new Error('Este servidor ya es miembro del grupo.')
    throw error
  }
}

export async function removeMember(memberId: string) {
  const { data, error } = await supabase.rpc('remove_member', {
    p_group_member_id: memberId,
  }) as any
  if (error) throw new Error(error.message)
  if (!data?.success) throw new Error(data?.error ?? 'No se pudo eliminar al miembro')
}
