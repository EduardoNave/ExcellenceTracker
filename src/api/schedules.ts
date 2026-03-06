import { supabase } from '@/lib/supabase'
import type { ServiceSchedule } from '@/types'

export async function getSchedules(groupId: string) {
  const { data, error } = await supabase
    .from('service_schedules')
    .select('*')
    .eq('group_id', groupId)
    .order('day_of_week', { ascending: true })
  if (error) throw error
  return data as ServiceSchedule[]
}

export async function createSchedule(data: {
  group_id: string
  name: string
  day_of_week: number
  start_date: string
  end_date?: string | null
  default_server_assignments?: { user_id: string; template_id: string | null }[]
  notes?: string
  created_by: string
}) {
  const { data: schedule, error } = await supabase
    .from('service_schedules')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return schedule as ServiceSchedule
}

export async function updateSchedule(
  id: string,
  data: {
    name?: string
    day_of_week?: number
    start_date?: string
    end_date?: string | null
    is_active?: boolean
    default_server_assignments?: { user_id: string; template_id: string | null }[]
    notes?: string
  }
) {
  const { error } = await supabase
    .from('service_schedules')
    .update(data)
    .eq('id', id)
  if (error) throw error
}

export async function deleteSchedule(id: string) {
  const { error } = await supabase
    .from('service_schedules')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function generateRecurringServices(
  scheduleId: string,
  fromDate: string,
  toDate: string
) {
  const { data, error } = await supabase.rpc('generate_recurring_services', {
    p_schedule_id: scheduleId,
    p_from_date: fromDate,
    p_to_date: toDate,
  })
  if (error) throw error
  return data as number
}
