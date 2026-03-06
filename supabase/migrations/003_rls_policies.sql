-- 003_rls_policies.sql
-- Row Level Security policies for ExcellenceTracker
-- FIXED: Simplified policies to avoid circular dependency issues

-- ============================================================
-- Enable RLS on every table
-- ============================================================
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups               ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_sections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE services             ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_evaluations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_items     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES
-- ============================================================
-- Any authenticated user can read any profile (needed for FK checks, member lists, etc.)
CREATE POLICY profiles_select ON profiles
    FOR SELECT TO authenticated
    USING (true);

-- Users can only update their own profile
CREATE POLICY profiles_update ON profiles
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Allow the trigger to insert profiles (SECURITY DEFINER handles this,
-- but adding a permissive policy for safety)
CREATE POLICY profiles_insert ON profiles
    FOR INSERT WITH CHECK (id = auth.uid());

-- ============================================================
-- GROUPS
-- ============================================================
-- Coordinators see their groups; members see groups they belong to
CREATE POLICY groups_select ON groups
    FOR SELECT USING (
        coordinator_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = groups.id
              AND group_members.user_id = auth.uid()
        )
    );

-- Any authenticated user can create a group (they become coordinator)
CREATE POLICY groups_insert ON groups
    FOR INSERT WITH CHECK (
        coordinator_id = auth.uid()
    );

-- Only the coordinator can update their group
CREATE POLICY groups_update ON groups
    FOR UPDATE USING (
        coordinator_id = auth.uid()
    ) WITH CHECK (
        coordinator_id = auth.uid()
    );

-- Only the coordinator can delete their group
CREATE POLICY groups_delete ON groups
    FOR DELETE USING (
        coordinator_id = auth.uid()
    );

-- ============================================================
-- GROUP_MEMBERS
-- ============================================================
-- Members can see who is in their group; coordinator can see all
CREATE POLICY group_members_select ON group_members
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = group_members.group_id
              AND groups.coordinator_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM group_members gm2
            WHERE gm2.group_id = group_members.group_id
              AND gm2.user_id = auth.uid()
        )
    );

-- Only coordinators can add members to their groups
CREATE POLICY group_members_insert ON group_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = group_members.group_id
              AND groups.coordinator_id = auth.uid()
        )
    );

-- Only coordinators can remove members from their groups
CREATE POLICY group_members_delete ON group_members
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = group_members.group_id
              AND groups.coordinator_id = auth.uid()
        )
    );

-- ============================================================
-- CHECKLIST_TEMPLATES
-- ============================================================
CREATE POLICY checklist_templates_select ON checklist_templates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = checklist_templates.group_id
              AND groups.coordinator_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = checklist_templates.group_id
              AND group_members.user_id = auth.uid()
        )
    );

CREATE POLICY checklist_templates_insert ON checklist_templates
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = checklist_templates.group_id
              AND groups.coordinator_id = auth.uid()
        )
    );

CREATE POLICY checklist_templates_update ON checklist_templates
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = checklist_templates.group_id
              AND groups.coordinator_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = checklist_templates.group_id
              AND groups.coordinator_id = auth.uid()
        )
    );

CREATE POLICY checklist_templates_delete ON checklist_templates
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = checklist_templates.group_id
              AND groups.coordinator_id = auth.uid()
        )
    );

-- ============================================================
-- CHECKLIST_SECTIONS
-- ============================================================
CREATE POLICY checklist_sections_select ON checklist_sections
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM checklist_templates ct
            JOIN groups g ON g.id = ct.group_id
            WHERE ct.id = checklist_sections.template_id
              AND (
                  g.coordinator_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM group_members gm
                      WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
                  )
              )
        )
    );

CREATE POLICY checklist_sections_insert ON checklist_sections
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM checklist_templates ct
            JOIN groups g ON g.id = ct.group_id
            WHERE ct.id = checklist_sections.template_id
              AND g.coordinator_id = auth.uid()
        )
    );

CREATE POLICY checklist_sections_update ON checklist_sections
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM checklist_templates ct
            JOIN groups g ON g.id = ct.group_id
            WHERE ct.id = checklist_sections.template_id
              AND g.coordinator_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM checklist_templates ct
            JOIN groups g ON g.id = ct.group_id
            WHERE ct.id = checklist_sections.template_id
              AND g.coordinator_id = auth.uid()
        )
    );

CREATE POLICY checklist_sections_delete ON checklist_sections
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM checklist_templates ct
            JOIN groups g ON g.id = ct.group_id
            WHERE ct.id = checklist_sections.template_id
              AND g.coordinator_id = auth.uid()
        )
    );

-- ============================================================
-- CHECKLIST_ITEMS
-- ============================================================
CREATE POLICY checklist_items_select ON checklist_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM checklist_sections cs
            JOIN checklist_templates ct ON ct.id = cs.template_id
            JOIN groups g ON g.id = ct.group_id
            WHERE cs.id = checklist_items.section_id
              AND (
                  g.coordinator_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM group_members gm
                      WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
                  )
              )
        )
    );

CREATE POLICY checklist_items_insert ON checklist_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM checklist_sections cs
            JOIN checklist_templates ct ON ct.id = cs.template_id
            JOIN groups g ON g.id = ct.group_id
            WHERE cs.id = checklist_items.section_id
              AND g.coordinator_id = auth.uid()
        )
    );

CREATE POLICY checklist_items_update ON checklist_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1
            FROM checklist_sections cs
            JOIN checklist_templates ct ON ct.id = cs.template_id
            JOIN groups g ON g.id = ct.group_id
            WHERE cs.id = checklist_items.section_id
              AND g.coordinator_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1
            FROM checklist_sections cs
            JOIN checklist_templates ct ON ct.id = cs.template_id
            JOIN groups g ON g.id = ct.group_id
            WHERE cs.id = checklist_items.section_id
              AND g.coordinator_id = auth.uid()
        )
    );

CREATE POLICY checklist_items_delete ON checklist_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1
            FROM checklist_sections cs
            JOIN checklist_templates ct ON ct.id = cs.template_id
            JOIN groups g ON g.id = ct.group_id
            WHERE cs.id = checklist_items.section_id
              AND g.coordinator_id = auth.uid()
        )
    );

-- ============================================================
-- SERVICES
-- ============================================================
CREATE POLICY services_select ON services
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = services.group_id
              AND groups.coordinator_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM service_assignments sa
            WHERE sa.service_id = services.id
              AND sa.user_id = auth.uid()
        )
    );

CREATE POLICY services_insert ON services
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = services.group_id
              AND groups.coordinator_id = auth.uid()
        )
    );

CREATE POLICY services_update ON services
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = services.group_id
              AND groups.coordinator_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = services.group_id
              AND groups.coordinator_id = auth.uid()
        )
    );

CREATE POLICY services_delete ON services
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = services.group_id
              AND groups.coordinator_id = auth.uid()
        )
    );

-- ============================================================
-- SERVICE_ASSIGNMENTS
-- ============================================================
CREATE POLICY service_assignments_select ON service_assignments
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM services s
            JOIN groups g ON g.id = s.group_id
            WHERE s.id = service_assignments.service_id
              AND g.coordinator_id = auth.uid()
        )
    );

CREATE POLICY service_assignments_insert ON service_assignments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM services s
            JOIN groups g ON g.id = s.group_id
            WHERE s.id = service_assignments.service_id
              AND g.coordinator_id = auth.uid()
        )
    );

CREATE POLICY service_assignments_delete ON service_assignments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM services s
            JOIN groups g ON g.id = s.group_id
            WHERE s.id = service_assignments.service_id
              AND g.coordinator_id = auth.uid()
        )
    );

-- ============================================================
-- SERVICE_EVALUATIONS
-- ============================================================
CREATE POLICY service_evaluations_select ON service_evaluations
    FOR SELECT USING (
        evaluated_by = auth.uid()
        OR user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM services s
            JOIN groups g ON g.id = s.group_id
            WHERE s.id = service_evaluations.service_id
              AND g.coordinator_id = auth.uid()
        )
    );

CREATE POLICY service_evaluations_insert ON service_evaluations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM services s
            JOIN groups g ON g.id = s.group_id
            WHERE s.id = service_evaluations.service_id
              AND g.coordinator_id = auth.uid()
        )
    );

CREATE POLICY service_evaluations_update ON service_evaluations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM services s
            JOIN groups g ON g.id = s.group_id
            WHERE s.id = service_evaluations.service_id
              AND g.coordinator_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM services s
            JOIN groups g ON g.id = s.group_id
            WHERE s.id = service_evaluations.service_id
              AND g.coordinator_id = auth.uid()
        )
    );

-- ============================================================
-- EVALUATION_ITEMS
-- ============================================================
CREATE POLICY evaluation_items_select ON evaluation_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM service_evaluations se
            WHERE se.id = evaluation_items.evaluation_id
              AND (
                  se.evaluated_by = auth.uid()
                  OR se.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM services s
                      JOIN groups g ON g.id = s.group_id
                      WHERE s.id = se.service_id
                        AND g.coordinator_id = auth.uid()
                  )
              )
        )
    );

CREATE POLICY evaluation_items_insert ON evaluation_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM service_evaluations se
            JOIN services s ON s.id = se.service_id
            JOIN groups g ON g.id = s.group_id
            WHERE se.id = evaluation_items.evaluation_id
              AND g.coordinator_id = auth.uid()
        )
    );

CREATE POLICY evaluation_items_update ON evaluation_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM service_evaluations se
            JOIN services s ON s.id = se.service_id
            JOIN groups g ON g.id = s.group_id
            WHERE se.id = evaluation_items.evaluation_id
              AND g.coordinator_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM service_evaluations se
            JOIN services s ON s.id = se.service_id
            JOIN groups g ON g.id = s.group_id
            WHERE se.id = evaluation_items.evaluation_id
              AND g.coordinator_id = auth.uid()
        )
    );
