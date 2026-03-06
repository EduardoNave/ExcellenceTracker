import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data as Profile
}

export async function updateProfile(userId: string, data: { full_name?: string; avatar_url?: string }) {
  const { error } = await supabase.from('profiles').update(data).eq('id', userId)
  if (error) throw error
}
