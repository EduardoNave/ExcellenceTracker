import { supabase } from '@/lib/supabase'

export interface AssignmentInput {
  userId: string
  templateId: string | null
}

export async function assignServers(serviceId: string, assignments: AssignmentInput[]) {
  const rows = assignments.map(a => ({
    service_id: serviceId,
    user_id: a.userId,
    template_id: a.templateId,
  }))
  const { error } = await supabase.from('service_assignments').insert(rows)
  if (error) throw error
}

export async function updateAssignmentTemplate(assignmentId: string, templateId: string | null) {
  const { error } = await supabase
    .from('service_assignments')
    .update({ template_id: templateId })
    .eq('id', assignmentId)
  if (error) throw error
}

export async function getAssignmentWithTemplate(serviceId: string, userId: string) {
  const { data, error } = await (supabase
    .from('service_assignments') as any)
    .select(`
      *,
      profiles(*),
      checklist_templates(
        *,
        checklist_sections(
          *,
          checklist_items(*)
        )
      )
    `)
    .eq('service_id', serviceId)
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data
}

export async function removeAssignment(serviceId: string, userId: string) {
  const { error } = await supabase
    .from('service_assignments')
    .delete()
    .eq('service_id', serviceId)
    .eq('user_id', userId)
  if (error) throw error
}
