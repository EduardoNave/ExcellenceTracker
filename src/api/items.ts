import { supabase } from '@/lib/supabase'
import type { ChecklistItem } from '@/types'

export async function createItem(data: { section_id: string; description: string; weight?: number; position: number; is_omittable?: boolean }) {
  const { data: item, error } = await supabase
    .from('checklist_items')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return item as ChecklistItem
}

export async function updateItem(id: string, data: { description?: string; weight?: number; section_id?: string; position?: number; is_omittable?: boolean }) {
  const { error } = await supabase.from('checklist_items').update(data).eq('id', id)
  if (error) throw error
}

export async function deleteItem(id: string) {
  const { error } = await supabase.from('checklist_items').delete().eq('id', id)
  if (error) throw error
}

export async function reorderItems(items: { id: string; position: number; section_id?: string }[]) {
  const promises = items.map(item =>
    supabase.from('checklist_items').update({
      position: item.position,
      ...(item.section_id ? { section_id: item.section_id } : {})
    }).eq('id', item.id)
  )
  const results = await Promise.all(promises)
  const failed = results.find(r => r.error)
  if (failed?.error) throw failed.error
}
