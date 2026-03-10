-- 003_rls_policies.sql
-- Row-Level Security policies for salim_et schema tables.
-- Fully idempotent: DROP POLICY IF EXISTS before every CREATE POLICY.

-- ============================================================
-- Enable RLS on all tables (idempotent — no error if already enabled)
-- ============================================================
ALTER TABLE salim_et.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE salim_et.groups              ENABLE ROW LEVEL SECURITY;
ALTER TABLE salim_et.group_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE salim_et.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE salim_et.checklist_sections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE salim_et.checklist_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE salim_et.services            ENABLE ROW LEVEL SECURITY;
ALTER TABLE salim_et.service_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE salim_et.service_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE salim_et.evaluation_items    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- profiles
-- ============================================================
DROP POLICY IF EXISTS "profiles: own row" ON salim_et.profiles;
CREATE POLICY "profiles: own row" ON salim_et.profiles
    FOR ALL USING (id = auth.uid());

-- ============================================================
-- groups
-- ============================================================
DROP POLICY IF EXISTS "groups: members can view" ON salim_et.groups;
CREATE POLICY "groups: members can view" ON salim_et.groups
    FOR SELECT USING (salim_et.is_group_member(id));

DROP POLICY IF EXISTS "groups: coordinators can insert" ON salim_et.groups;
CREATE POLICY "groups: coordinators can insert" ON salim_et.groups
    FOR INSERT WITH CHECK (coordinator_id = auth.uid());

DROP POLICY IF EXISTS "groups: coordinators can update" ON salim_et.groups;
CREATE POLICY "groups: coordinators can update" ON salim_et.groups
    FOR UPDATE USING (coordinator_id = auth.uid());

DROP POLICY IF EXISTS "groups: coordinators can delete" ON salim_et.groups;
CREATE POLICY "groups: coordinators can delete" ON salim_et.groups
    FOR DELETE USING (coordinator_id = auth.uid());

-- ============================================================
-- group_members
-- ============================================================
DROP POLICY IF EXISTS "group_members: members can view" ON salim_et.group_members;
CREATE POLICY "group_members: members can view" ON salim_et.group_members
    FOR SELECT USING (salim_et.is_group_member(group_id));

DROP POLICY IF EXISTS "group_members: coordinators can insert" ON salim_et.group_members;
CREATE POLICY "group_members: coordinators can insert" ON salim_et.group_members
    FOR INSERT WITH CHECK (salim_et.is_group_coordinator(group_id));

DROP POLICY IF EXISTS "group_members: coordinators can delete" ON salim_et.group_members;
CREATE POLICY "group_members: coordinators can delete" ON salim_et.group_members
    FOR DELETE USING (salim_et.is_group_coordinator(group_id));

-- ============================================================
-- checklist_templates
-- ============================================================
DROP POLICY IF EXISTS "checklist_templates: members can view" ON salim_et.checklist_templates;
CREATE POLICY "checklist_templates: members can view" ON salim_et.checklist_templates
    FOR SELECT USING (salim_et.is_group_member(group_id));

DROP POLICY IF EXISTS "checklist_templates: coordinators can insert" ON salim_et.checklist_templates;
CREATE POLICY "checklist_templates: coordinators can insert" ON salim_et.checklist_templates
    FOR INSERT WITH CHECK (salim_et.is_group_coordinator(group_id));

DROP POLICY IF EXISTS "checklist_templates: coordinators can update" ON salim_et.checklist_templates;
CREATE POLICY "checklist_templates: coordinators can update" ON salim_et.checklist_templates
    FOR UPDATE USING (salim_et.is_group_coordinator(group_id));

DROP POLICY IF EXISTS "checklist_templates: coordinators can delete" ON salim_et.checklist_templates;
CREATE POLICY "checklist_templates: coordinators can delete" ON salim_et.checklist_templates
    FOR DELETE USING (salim_et.is_group_coordinator(group_id));

-- ============================================================
-- checklist_sections
-- ============================================================
DROP POLICY IF EXISTS "checklist_sections: members can view" ON salim_et.checklist_sections;
CREATE POLICY "checklist_sections: members can view" ON salim_et.checklist_sections
    FOR SELECT USING (
        salim_et.is_group_member(
            (SELECT group_id FROM salim_et.checklist_templates WHERE id = template_id)
        )
    );

DROP POLICY IF EXISTS "checklist_sections: coordinators can insert" ON salim_et.checklist_sections;
CREATE POLICY "checklist_sections: coordinators can insert" ON salim_et.checklist_sections
    FOR INSERT WITH CHECK (
        salim_et.is_group_coordinator(
            (SELECT group_id FROM salim_et.checklist_templates WHERE id = template_id)
        )
    );

DROP POLICY IF EXISTS "checklist_sections: coordinators can update" ON salim_et.checklist_sections;
CREATE POLICY "checklist_sections: coordinators can update" ON salim_et.checklist_sections
    FOR UPDATE USING (
        salim_et.is_group_coordinator(
            (SELECT group_id FROM salim_et.checklist_templates WHERE id = template_id)
        )
    );

DROP POLICY IF EXISTS "checklist_sections: coordinators can delete" ON salim_et.checklist_sections;
CREATE POLICY "checklist_sections: coordinators can delete" ON salim_et.checklist_sections
    FOR DELETE USING (
        salim_et.is_group_coordinator(
            (SELECT group_id FROM salim_et.checklist_templates WHERE id = template_id)
        )
    );

-- ============================================================
-- checklist_items
-- ============================================================
DROP POLICY IF EXISTS "checklist_items: members can view" ON salim_et.checklist_items;
CREATE POLICY "checklist_items: members can view" ON salim_et.checklist_items
    FOR SELECT USING (
        salim_et.is_group_member(
            (SELECT ct.group_id
             FROM salim_et.checklist_sections cs
             JOIN salim_et.checklist_templates ct ON ct.id = cs.template_id
             WHERE cs.id = section_id)
        )
    );

DROP POLICY IF EXISTS "checklist_items: coordinators can insert" ON salim_et.checklist_items;
CREATE POLICY "checklist_items: coordinators can insert" ON salim_et.checklist_items
    FOR INSERT WITH CHECK (
        salim_et.is_group_coordinator(
            (SELECT ct.group_id
             FROM salim_et.checklist_sections cs
             JOIN salim_et.checklist_templates ct ON ct.id = cs.template_id
             WHERE cs.id = section_id)
        )
    );

DROP POLICY IF EXISTS "checklist_items: coordinators can update" ON salim_et.checklist_items;
CREATE POLICY "checklist_items: coordinators can update" ON salim_et.checklist_items
    FOR UPDATE USING (
        salim_et.is_group_coordinator(
            (SELECT ct.group_id
             FROM salim_et.checklist_sections cs
             JOIN salim_et.checklist_templates ct ON ct.id = cs.template_id
             WHERE cs.id = section_id)
        )
    );

DROP POLICY IF EXISTS "checklist_items: coordinators can delete" ON salim_et.checklist_items;
CREATE POLICY "checklist_items: coordinators can delete" ON salim_et.checklist_items
    FOR DELETE USING (
        salim_et.is_group_coordinator(
            (SELECT ct.group_id
             FROM salim_et.checklist_sections cs
             JOIN salim_et.checklist_templates ct ON ct.id = cs.template_id
             WHERE cs.id = section_id)
        )
    );

-- ============================================================
-- services
-- ============================================================
DROP POLICY IF EXISTS "services: members can view" ON salim_et.services;
CREATE POLICY "services: members can view" ON salim_et.services
    FOR SELECT USING (salim_et.is_group_member(group_id));

DROP POLICY IF EXISTS "services: coordinators can insert" ON salim_et.services;
CREATE POLICY "services: coordinators can insert" ON salim_et.services
    FOR INSERT WITH CHECK (salim_et.is_group_coordinator(group_id));

DROP POLICY IF EXISTS "services: coordinators can update" ON salim_et.services;
CREATE POLICY "services: coordinators can update" ON salim_et.services
    FOR UPDATE USING (salim_et.is_group_coordinator(group_id));

DROP POLICY IF EXISTS "services: coordinators can delete" ON salim_et.services;
CREATE POLICY "services: coordinators can delete" ON salim_et.services
    FOR DELETE USING (salim_et.is_group_coordinator(group_id));

-- ============================================================
-- service_assignments
-- ============================================================
DROP POLICY IF EXISTS "service_assignments: members can view" ON salim_et.service_assignments;
CREATE POLICY "service_assignments: members can view" ON salim_et.service_assignments
    FOR SELECT USING (
        salim_et.is_group_member(salim_et.get_service_group_id(service_id))
    );

DROP POLICY IF EXISTS "service_assignments: coordinators can insert" ON salim_et.service_assignments;
CREATE POLICY "service_assignments: coordinators can insert" ON salim_et.service_assignments
    FOR INSERT WITH CHECK (
        salim_et.is_group_coordinator(salim_et.get_service_group_id(service_id))
    );

DROP POLICY IF EXISTS "service_assignments: coordinators can delete" ON salim_et.service_assignments;
CREATE POLICY "service_assignments: coordinators can delete" ON salim_et.service_assignments
    FOR DELETE USING (
        salim_et.is_group_coordinator(salim_et.get_service_group_id(service_id))
    );

-- ============================================================
-- service_evaluations  (also recreated by 005_fix_rls_policies.sql)
-- ============================================================
DROP POLICY IF EXISTS "service_evaluations: members can view"       ON salim_et.service_evaluations;
DROP POLICY IF EXISTS "service_evaluations: coordinators can insert" ON salim_et.service_evaluations;
DROP POLICY IF EXISTS "service_evaluations: coordinators can update" ON salim_et.service_evaluations;
DROP POLICY IF EXISTS "service_evaluations: coordinators can delete" ON salim_et.service_evaluations;

CREATE POLICY "service_evaluations: members can view" ON salim_et.service_evaluations
    FOR SELECT USING (
        salim_et.is_group_member(salim_et.get_service_group_id(service_id))
    );

CREATE POLICY "service_evaluations: coordinators can insert" ON salim_et.service_evaluations
    FOR INSERT WITH CHECK (
        salim_et.is_group_coordinator(salim_et.get_service_group_id(service_id))
    );

CREATE POLICY "service_evaluations: coordinators can update" ON salim_et.service_evaluations
    FOR UPDATE USING (
        salim_et.is_group_coordinator(salim_et.get_service_group_id(service_id))
    );

CREATE POLICY "service_evaluations: coordinators can delete" ON salim_et.service_evaluations
    FOR DELETE USING (
        salim_et.is_group_coordinator(salim_et.get_service_group_id(service_id))
    );

-- ============================================================
-- evaluation_items  (also recreated by 005_fix_rls_policies.sql)
-- ============================================================
DROP POLICY IF EXISTS "evaluation_items: members can view"       ON salim_et.evaluation_items;
DROP POLICY IF EXISTS "evaluation_items: coordinators can insert" ON salim_et.evaluation_items;
DROP POLICY IF EXISTS "evaluation_items: coordinators can update" ON salim_et.evaluation_items;
DROP POLICY IF EXISTS "evaluation_items: coordinators can delete" ON salim_et.evaluation_items;

CREATE POLICY "evaluation_items: members can view" ON salim_et.evaluation_items
    FOR SELECT USING (
        salim_et.is_group_member(
            salim_et.get_evaluation_group_id(evaluation_id)
        )
    );

CREATE POLICY "evaluation_items: coordinators can insert" ON salim_et.evaluation_items
    FOR INSERT WITH CHECK (
        salim_et.is_group_coordinator(
            salim_et.get_evaluation_group_id(evaluation_id)
        )
    );

CREATE POLICY "evaluation_items: coordinators can update" ON salim_et.evaluation_items
    FOR UPDATE USING (
        salim_et.is_group_coordinator(
            salim_et.get_evaluation_group_id(evaluation_id)
        )
    );

CREATE POLICY "evaluation_items: coordinators can delete" ON salim_et.evaluation_items
    FOR DELETE USING (
        salim_et.is_group_coordinator(
            salim_et.get_evaluation_group_id(evaluation_id)
        )
    );
