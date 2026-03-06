import { supabase } from '@/lib/supabase'
import type { Group } from '@/types'

export async function getMyGroups(userId: string) {
  // Fetch groups where coordinator_id = userId
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('coordinator_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Group[]
}

export async function getMyMemberGroups(userId: string) {
  // For servers: fetch groups they belong to via group_members
  const { data, error } = await supabase
    .from('group_members')
    .select('group_id, groups(*)')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map((d: any) => d.groups).filter(Boolean) as Group[]
}

export async function createGroup(data: { name: string; description?: string; coordinator_id: string }) {
  const { data: group, error } = await supabase
    .from('groups')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return group as Group
}

export async function updateGroup(id: string, data: { name?: string; description?: string }) {
  const { error } = await supabase.from('groups').update(data).eq('id', id)
  if (error) throw error
}

export async function deleteGroup(id: string) {
  const { error } = await supabase.from('groups').delete().eq('id', id)
  if (error) throw error
}
