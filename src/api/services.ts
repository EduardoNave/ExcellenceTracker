import { supabase } from '@/lib/supabase'
import type { Service, ServiceWithDetails } from '@/types'

export async function getServices(groupId: string, status?: string) {
  let query = (supabase
    .from('services') as any)
    .select(`
      *,
      service_assignments(*, profiles(*), checklist_templates(id, name)),
      service_evaluations(id, user_id, total_score)
    `)
    .eq('group_id', groupId)
    .order('date', { ascending: true })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error
  return data as ServiceWithDetails[]
}

export async function getMyAssignedServices(userId: string) {
  const { data, error } = await (supabase
    .from('service_assignments') as any)
    .select(`
      service_id,
      services(
        *,
        service_assignments(*, profiles(*), checklist_templates(id, name)),
        service_evaluations(id, user_id, total_score)
      )
    `)
    .eq('user_id', userId)
    .order('service_id', { ascending: false })
  if (error) throw error
  return (data ?? []).map((d: any) => d.services).filter(Boolean) as ServiceWithDetails[]
}

export async function getServiceDetail(id: string) {
  const { data, error } = await (supabase
    .from('services') as any)
    .select(`
      *,
      service_assignments(
        *,
        profiles(*),
        checklist_templates(
          *,
          checklist_sections(
            *,
            checklist_items(*)
          )
        )
      ),
      service_evaluations(*)
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createService(data: { group_id: string; date: string; name?: string; notes?: string; created_by: string }) {
  const { data: service, error } = await supabase
    .from('services')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return service as Service
}

export async function updateService(id: string, data: { name?: string; date?: string; notes?: string; status?: string }) {
  const { error } = await supabase.from('services').update(data).eq('id', id)
  if (error) throw error
}

export async function deleteService(id: string) {
  const { error } = await supabase.from('services').delete().eq('id', id)
  if (error) throw error
}
