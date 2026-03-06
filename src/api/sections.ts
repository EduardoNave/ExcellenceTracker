import { supabase } from '@/lib/supabase'
import type { ChecklistSection } from '@/types'

export async function createSection(data: { template_id: string; name: string; position: number }) {
  const { data: section, error } = await supabase
    .from('checklist_sections')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return section as ChecklistSection
}

export async function updateSection(id: string, data: { name?: string }) {
  const { error } = await supabase.from('checklist_sections').update(data).eq('id', id)
  if (error) throw error
}

export async function deleteSection(id: string) {
  const { error } = await supabase.from('checklist_sections').delete().eq('id', id)
  if (error) throw error
}

export async function reorderSections(sections: { id: string; position: number }[]) {
  // Update each section's position
  const promises = sections.map(s =>
    supabase.from('checklist_sections').update({ position: s.position }).eq('id', s.id)
  )
  const results = await Promise.all(promises)
  const failed = results.find(r => r.error)
  if (failed?.error) throw failed.error
}
