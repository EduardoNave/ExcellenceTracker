import type { Tables } from './database.types'

export type Profile = Tables<'profiles'>
export type Group = Tables<'groups'>
export type GroupMember = Tables<'group_members'>
export type ChecklistTemplate = Tables<'checklist_templates'>
export type ChecklistSection = Tables<'checklist_sections'>
export type ChecklistItem = Tables<'checklist_items'>
export type Service = Tables<'services'>
export type ServiceAssignment = Tables<'service_assignments'>
export type ServiceEvaluation = Tables<'service_evaluations'>
export type EvaluationItem = Tables<'evaluation_items'>
export type ServiceSchedule = Tables<'service_schedules'>
export type Invitation = Tables<'invitations'>

export type Role = 'coordinator' | 'server'
export type ServiceStatus = 'scheduled' | 'in_progress' | 'completed'

export interface MemberWithProfile extends GroupMember {
  profiles: Profile
}

export interface ChecklistSectionWithItems extends ChecklistSection {
  checklist_items: ChecklistItem[]
}

export interface ChecklistTemplateWithSections extends ChecklistTemplate {
  checklist_sections: ChecklistSectionWithItems[]
}

export interface AssignmentWithProfile extends ServiceAssignment {
  profiles: Profile
  checklist_templates?: ChecklistTemplate | null
}

export interface AssignmentWithTemplate extends ServiceAssignment {
  profiles: Profile
  checklist_templates: ChecklistTemplateWithSections | null
}

export interface ServiceWithDetails extends Service {
  service_assignments: AssignmentWithProfile[]
  service_evaluations: ServiceEvaluation[]
  service_schedules?: ServiceSchedule | null
}

export interface EvaluationWithItems extends ServiceEvaluation {
  evaluation_items: (EvaluationItem & { checklist_items: ChecklistItem })[]
}
