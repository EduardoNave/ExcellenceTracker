-- 004_indexes.sql
-- Performance indexes for salim_et schema tables.

CREATE INDEX IF NOT EXISTS idx_groups_coordinator
    ON salim_et.groups (coordinator_id);

CREATE INDEX IF NOT EXISTS idx_group_members_group
    ON salim_et.group_members (group_id);

CREATE INDEX IF NOT EXISTS idx_group_members_user
    ON salim_et.group_members (user_id);

CREATE INDEX IF NOT EXISTS idx_checklist_templates_group
    ON salim_et.checklist_templates (group_id);

CREATE INDEX IF NOT EXISTS idx_checklist_sections_template
    ON salim_et.checklist_sections (template_id);

CREATE INDEX IF NOT EXISTS idx_checklist_items_section
    ON salim_et.checklist_items (section_id);

CREATE INDEX IF NOT EXISTS idx_services_group
    ON salim_et.services (group_id);

CREATE INDEX IF NOT EXISTS idx_services_date
    ON salim_et.services (date);

CREATE INDEX IF NOT EXISTS idx_service_assignments_service
    ON salim_et.service_assignments (service_id);

CREATE INDEX IF NOT EXISTS idx_service_assignments_user
    ON salim_et.service_assignments (user_id);

CREATE INDEX IF NOT EXISTS idx_service_evaluations_service
    ON salim_et.service_evaluations (service_id);

CREATE INDEX IF NOT EXISTS idx_service_evaluations_user
    ON salim_et.service_evaluations (user_id);

CREATE INDEX IF NOT EXISTS idx_evaluation_items_evaluation
    ON salim_et.evaluation_items (evaluation_id);
