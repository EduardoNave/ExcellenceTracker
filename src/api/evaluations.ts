import { supabase } from '@/lib/supabase'
import type { EvaluationWithItems, ServiceEvaluation } from '@/types'

export async function getEvaluation(serviceId: string, userId: string) {
  const { data, error } = await supabase
    .from('service_evaluations')
    .select(`
      *,
      evaluation_items(
        *,
        checklist_items(*)
      )
    `)
    .eq('service_id', serviceId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data as EvaluationWithItems | null
}

export async function saveEvaluation(data: {
  service_id: string
  user_id: string
  evaluated_by: string
  total_score: number
  notes: string
  items: { checklist_item_id: string; completed: boolean; omitted: boolean; score: number; notes: string }[]
}) {
  // Upsert the evaluation
  const { data: evaluation, error: evalError } = await supabase
    .from('service_evaluations')
    .upsert({
      service_id: data.service_id,
      user_id: data.user_id,
      evaluated_by: data.evaluated_by,
      total_score: data.total_score,
      notes: data.notes,
      evaluated_at: new Date().toISOString(),
    }, { onConflict: 'service_id,user_id' })
    .select()
    .single()
  if (evalError) throw evalError

  // Delete existing evaluation items and re-insert
  await supabase
    .from('evaluation_items')
    .delete()
    .eq('evaluation_id', evaluation.id)

  const itemRows = data.items.map(item => ({
    evaluation_id: evaluation.id,
    checklist_item_id: item.checklist_item_id,
    completed: item.completed,
    omitted: item.omitted,
    score: item.score,
    notes: item.notes || null,
  }))

  if (itemRows.length > 0) {
    const { error: itemsError } = await supabase
      .from('evaluation_items')
      .insert(itemRows)
    if (itemsError) throw itemsError
  }

  return evaluation as ServiceEvaluation
}

export async function getServerEvaluations(userId: string) {
  const { data, error } = await supabase
    .from('service_evaluations')
    .select(`
      *,
      services(id, date, name, group_id, groups(name)),
      evaluation_items(*, checklist_items(*))
    `)
    .eq('user_id', userId)
    .order('evaluated_at', { ascending: false })
  if (error) throw error
  return data
}
