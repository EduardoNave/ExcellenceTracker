import { supabase } from '@/lib/supabase'
import type { ChecklistTemplate, ChecklistTemplateWithSections } from '@/types'

export async function getChecklists(groupId: string) {
  const { data, error } = await supabase
    .from('checklist_templates')
    .select('*, checklist_sections(count)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as (ChecklistTemplate & { checklist_sections: { count: number }[] })[]
}

export async function getChecklistWithSections(id: string) {
  const { data, error } = await supabase
    .from('checklist_templates')
    .select(`
      *,
      checklist_sections(
        *,
        checklist_items(*)
      )
    `)
    .eq('id', id)
    .order('position', { referencedTable: 'checklist_sections', ascending: true })
    .single()
  if (error) throw error
  // Sort items within each section by position
  if (data?.checklist_sections) {
    for (const section of data.checklist_sections) {
      section.checklist_items?.sort((a: any, b: any) => a.position - b.position)
    }
  }
  return data as ChecklistTemplateWithSections
}

export async function createChecklist(data: { group_id: string; name: string; description?: string; created_by: string }) {
  const { data: template, error } = await supabase
    .from('checklist_templates')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return template as ChecklistTemplate
}

export async function updateChecklist(id: string, data: { name?: string; description?: string }) {
  const { error } = await supabase.from('checklist_templates').update(data).eq('id', id)
  if (error) throw error
}

export async function deleteChecklist(id: string) {
  const { error } = await supabase.from('checklist_templates').delete().eq('id', id)
  if (error) throw error
}

/**
 * Duplicates a checklist with all its sections and items.
 * The new checklist gets a "(Copia)" suffix in its name.
 */
export async function duplicateChecklist(sourceId: string, userId: string) {
  // 1. Fetch the full checklist with sections and items
  const source = await getChecklistWithSections(sourceId)
  if (!source) throw new Error('Checklist no encontrado')

  // 2. Create the new checklist template
  const { data: newTemplate, error: createError } = await supabase
    .from('checklist_templates')
    .insert({
      group_id: source.group_id,
      name: `${source.name} (Copia)`,
      description: source.description,
      created_by: userId,
    })
    .select()
    .single()
  if (createError) throw createError

  // 3. Clone each section and its items
  for (const section of source.checklist_sections ?? []) {
    const { data: newSection, error: sectionError } = await supabase
      .from('checklist_sections')
      .insert({
        template_id: newTemplate.id,
        name: section.name,
        position: section.position,
      })
      .select()
      .single()
    if (sectionError) throw sectionError

    // Clone items for this section
    const items = (section.checklist_items ?? []).map((item: any) => ({
      section_id: newSection.id,
      description: item.description,
      weight: item.weight,
      position: item.position,
    }))

    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from('checklist_items')
        .insert(items)
      if (itemsError) throw itemsError
    }
  }

  return newTemplate as ChecklistTemplate
}
