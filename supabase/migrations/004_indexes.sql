-- 004_indexes.sql
-- Indexes on foreign keys and commonly queried columns

-- groups
CREATE INDEX idx_groups_coordinator_id ON groups (coordinator_id);

-- group_members
CREATE INDEX idx_group_members_group_id ON group_members (group_id);
CREATE INDEX idx_group_members_user_id  ON group_members (user_id);

-- checklist_templates
CREATE INDEX idx_checklist_templates_group_id   ON checklist_templates (group_id);
CREATE INDEX idx_checklist_templates_created_by  ON checklist_templates (created_by);

-- checklist_sections
CREATE INDEX idx_checklist_sections_template_id ON checklist_sections (template_id);
CREATE INDEX idx_checklist_sections_position    ON checklist_sections (template_id, position);

-- checklist_items
CREATE INDEX idx_checklist_items_section_id ON checklist_items (section_id);
CREATE INDEX idx_checklist_items_position   ON checklist_items (section_id, position);

-- services
CREATE INDEX idx_services_group_id    ON services (group_id);
CREATE INDEX idx_services_template_id ON services (template_id);
CREATE INDEX idx_services_created_by  ON services (created_by);
CREATE INDEX idx_services_date        ON services (date);
CREATE INDEX idx_services_status      ON services (status);

-- service_assignments
CREATE INDEX idx_service_assignments_service_id ON service_assignments (service_id);
CREATE INDEX idx_service_assignments_user_id    ON service_assignments (user_id);

-- service_evaluations
CREATE INDEX idx_service_evaluations_service_id   ON service_evaluations (service_id);
CREATE INDEX idx_service_evaluations_user_id      ON service_evaluations (user_id);
CREATE INDEX idx_service_evaluations_evaluated_by ON service_evaluations (evaluated_by);

-- evaluation_items
CREATE INDEX idx_evaluation_items_evaluation_id     ON evaluation_items (evaluation_id);
CREATE INDEX idx_evaluation_items_checklist_item_id ON evaluation_items (checklist_item_id);
