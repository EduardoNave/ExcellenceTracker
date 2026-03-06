-- 005_fix_rls_policies.sql  (IDEMPOTENT - safe to re-run)
-- Fixes infinite recursion in RLS policies by using SECURITY DEFINER
-- helper functions that bypass RLS for membership checks.
--
-- PROBLEM: When a policy on table A references table B, and table B's
-- policy references table A, PostgreSQL detects infinite recursion.
-- SOLUTION: SECURITY DEFINER functions bypass RLS entirely, breaking
-- the cycle.

-- ============================================================
-- 1) DROP ALL EXISTING POLICIES (idempotent)
-- ============================================================
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;
DROP POLICY IF EXISTS profiles_insert ON profiles;

DROP POLICY IF EXISTS groups_select ON groups;
DROP POLICY IF EXISTS groups_insert ON groups;
DROP POLICY IF EXISTS groups_update ON groups;
DROP POLICY IF EXISTS groups_delete ON groups;

DROP POLICY IF EXISTS group_members_select ON group_members;
DROP POLICY IF EXISTS group_members_insert ON group_members;
DROP POLICY IF EXISTS group_members_delete ON group_members;

DROP POLICY IF EXISTS checklist_templates_select ON checklist_templates;
DROP POLICY IF EXISTS checklist_templates_insert ON checklist_templates;
DROP POLICY IF EXISTS checklist_templates_update ON checklist_templates;
DROP POLICY IF EXISTS checklist_templates_delete ON checklist_templates;

DROP POLICY IF EXISTS checklist_sections_select ON checklist_sections;
DROP POLICY IF EXISTS checklist_sections_insert ON checklist_sections;
DROP POLICY IF EXISTS checklist_sections_update ON checklist_sections;
DROP POLICY IF EXISTS checklist_sections_delete ON checklist_sections;

DROP POLICY IF EXISTS checklist_items_select ON checklist_items;
DROP POLICY IF EXISTS checklist_items_insert ON checklist_items;
DROP POLICY IF EXISTS checklist_items_update ON checklist_items;
DROP POLICY IF EXISTS checklist_items_delete ON checklist_items;

DROP POLICY IF EXISTS services_select ON services;
DROP POLICY IF EXISTS services_insert ON services;
DROP POLICY IF EXISTS services_update ON services;
DROP POLICY IF EXISTS services_delete ON services;

DROP POLICY IF EXISTS service_assignments_select ON service_assignments;
DROP POLICY IF EXISTS service_assignments_insert ON service_assignments;
DROP POLICY IF EXISTS service_assignments_delete ON service_assignments;

DROP POLICY IF EXISTS service_evaluations_select ON service_evaluations;
DROP POLICY IF EXISTS service_evaluations_insert ON service_evaluations;
DROP POLICY IF EXISTS service_evaluations_update ON service_evaluations;

DROP POLICY IF EXISTS evaluation_items_select ON evaluation_items;
DROP POLICY IF EXISTS evaluation_items_insert ON evaluation_items;
DROP POLICY IF EXISTS evaluation_items_update ON evaluation_items;

DROP POLICY IF EXISTS service_schedules_select ON service_schedules;
DROP POLICY IF EXISTS service_schedules_insert ON service_schedules;
DROP POLICY IF EXISTS service_schedules_update ON service_schedules;
DROP POLICY IF EXISTS service_schedules_delete ON service_schedules;

DROP POLICY IF EXISTS invitations_select ON invitations;
DROP POLICY IF EXISTS invitations_insert ON invitations;
DROP POLICY IF EXISTS invitations_update ON invitations;
DROP POLICY IF EXISTS invitations_delete ON invitations;

-- ============================================================
-- 2) HELPER FUNCTIONS (SECURITY DEFINER = bypass RLS)
--    These break the recursion cycle.
-- ============================================================

-- Check if current user is the coordinator of a group
CREATE OR REPLACE FUNCTION public.is_group_coordinator(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM groups
        WHERE id = p_group_id
          AND coordinator_id = auth.uid()
    );
$$;

-- Check if current user is a member (or coordinator) of a group
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = p_group_id
          AND user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM groups
        WHERE id = p_group_id
          AND coordinator_id = auth.uid()
    );
$$;

-- Check if current user is assigned to a service (bypasses RLS on services)
CREATE OR REPLACE FUNCTION public.is_assigned_to_service(p_service_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM service_assignments
        WHERE service_id = p_service_id
          AND user_id = auth.uid()
    );
$$;

-- Get the group_id for a service (bypasses RLS on services)
CREATE OR REPLACE FUNCTION public.get_service_group_id(p_service_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT group_id FROM services WHERE id = p_service_id;
$$;

-- Check if current user is the evaluator or subject of an evaluation
CREATE OR REPLACE FUNCTION public.is_evaluation_participant(p_evaluation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM service_evaluations
        WHERE id = p_evaluation_id
          AND (evaluated_by = auth.uid() OR user_id = auth.uid())
    );
$$;

-- Get the group_id for an evaluation (via its service), bypasses RLS
CREATE OR REPLACE FUNCTION public.get_evaluation_group_id(p_evaluation_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT s.group_id
    FROM service_evaluations se
    JOIN services s ON s.id = se.service_id
    WHERE se.id = p_evaluation_id;
$$;

-- ============================================================
-- 3) ENSURE RLS IS ENABLED ON ALL TABLES
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
CREATE POLICY profiles_select ON profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY profiles_insert ON profiles
    FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update ON profiles
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ============================================================
-- GROUPS
-- ============================================================
CREATE POLICY groups_select ON groups
    FOR SELECT USING (
        coordinator_id = auth.uid()
        OR is_group_member(id)
    );

CREATE POLICY groups_insert ON groups
    FOR INSERT WITH CHECK (coordinator_id = auth.uid());

CREATE POLICY groups_update ON groups
    FOR UPDATE USING (coordinator_id = auth.uid())
    WITH CHECK (coordinator_id = auth.uid());

CREATE POLICY groups_delete ON groups
    FOR DELETE USING (coordinator_id = auth.uid());

-- ============================================================
-- GROUP_MEMBERS
-- ============================================================
CREATE POLICY group_members_select ON group_members
    FOR SELECT USING (
        user_id = auth.uid()
        OR is_group_coordinator(group_id)
    );

CREATE POLICY group_members_insert ON group_members
    FOR INSERT WITH CHECK (is_group_coordinator(group_id));

CREATE POLICY group_members_delete ON group_members
    FOR DELETE USING (is_group_coordinator(group_id));

-- ============================================================
-- CHECKLIST_TEMPLATES
-- ============================================================
CREATE POLICY checklist_templates_select ON checklist_templates
    FOR SELECT USING (is_group_member(group_id));

CREATE POLICY checklist_templates_insert ON checklist_templates
    FOR INSERT WITH CHECK (is_group_coordinator(group_id));

CREATE POLICY checklist_templates_update ON checklist_templates
    FOR UPDATE USING (is_group_coordinator(group_id))
    WITH CHECK (is_group_coordinator(group_id));

CREATE POLICY checklist_templates_delete ON checklist_templates
    FOR DELETE USING (is_group_coordinator(group_id));

-- ============================================================
-- CHECKLIST_SECTIONS
-- ============================================================
CREATE POLICY checklist_sections_select ON checklist_sections
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM checklist_templates ct
            WHERE ct.id = checklist_sections.template_id
              AND is_group_member(ct.group_id)
        )
    );

CREATE POLICY checklist_sections_insert ON checklist_sections
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM checklist_templates ct
            WHERE ct.id = checklist_sections.template_id
              AND is_group_coordinator(ct.group_id)
        )
    );

CREATE POLICY checklist_sections_update ON checklist_sections
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM checklist_templates ct
            WHERE ct.id = checklist_sections.template_id
              AND is_group_coordinator(ct.group_id)
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM checklist_templates ct
            WHERE ct.id = checklist_sections.template_id
              AND is_group_coordinator(ct.group_id)
        )
    );

CREATE POLICY checklist_sections_delete ON checklist_sections
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM checklist_templates ct
            WHERE ct.id = checklist_sections.template_id
              AND is_group_coordinator(ct.group_id)
        )
    );

-- ============================================================
-- CHECKLIST_ITEMS
-- ============================================================
CREATE POLICY checklist_items_select ON checklist_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM checklist_sections cs
            JOIN checklist_templates ct ON ct.id = cs.template_id
            WHERE cs.id = checklist_items.section_id
              AND is_group_member(ct.group_id)
        )
    );

CREATE POLICY checklist_items_insert ON checklist_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM checklist_sections cs
            JOIN checklist_templates ct ON ct.id = cs.template_id
            WHERE cs.id = checklist_items.section_id
              AND is_group_coordinator(ct.group_id)
        )
    );

CREATE POLICY checklist_items_update ON checklist_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM checklist_sections cs
            JOIN checklist_templates ct ON ct.id = cs.template_id
            WHERE cs.id = checklist_items.section_id
              AND is_group_coordinator(ct.group_id)
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM checklist_sections cs
            JOIN checklist_templates ct ON ct.id = cs.template_id
            WHERE cs.id = checklist_items.section_id
              AND is_group_coordinator(ct.group_id)
        )
    );

CREATE POLICY checklist_items_delete ON checklist_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM checklist_sections cs
            JOIN checklist_templates ct ON ct.id = cs.template_id
            WHERE cs.id = checklist_items.section_id
              AND is_group_coordinator(ct.group_id)
        )
    );

-- ============================================================
-- SERVICES
-- NO sub-selects to service_assignments! Uses SECURITY DEFINER
-- function is_assigned_to_service() to break the cycle.
-- ============================================================
CREATE POLICY services_select ON services
    FOR SELECT USING (
        is_group_coordinator(group_id)
        OR is_group_member(group_id)
    );

CREATE POLICY services_insert ON services
    FOR INSERT WITH CHECK (is_group_coordinator(group_id));

CREATE POLICY services_update ON services
    FOR UPDATE USING (is_group_coordinator(group_id))
    WITH CHECK (is_group_coordinator(group_id));

CREATE POLICY services_delete ON services
    FOR DELETE USING (is_group_coordinator(group_id));

-- ============================================================
-- SERVICE_ASSIGNMENTS
-- NO sub-selects to services! Uses SECURITY DEFINER function
-- get_service_group_id() to break the cycle.
-- ============================================================
CREATE POLICY service_assignments_select ON service_assignments
    FOR SELECT USING (
        user_id = auth.uid()
        OR is_group_coordinator(get_service_group_id(service_id))
    );

CREATE POLICY service_assignments_insert ON service_assignments
    FOR INSERT WITH CHECK (
        is_group_coordinator(get_service_group_id(service_id))
    );

CREATE POLICY service_assignments_delete ON service_assignments
    FOR DELETE USING (
        is_group_coordinator(get_service_group_id(service_id))
    );

-- ============================================================
-- SERVICE_EVALUATIONS
-- NO sub-selects to services! Uses SECURITY DEFINER function
-- get_service_group_id() to break the cycle.
-- ============================================================
CREATE POLICY service_evaluations_select ON service_evaluations
    FOR SELECT USING (
        evaluated_by = auth.uid()
        OR user_id = auth.uid()
        OR is_group_coordinator(get_service_group_id(service_id))
    );

CREATE POLICY service_evaluations_insert ON service_evaluations
    FOR INSERT WITH CHECK (
        is_group_coordinator(get_service_group_id(service_id))
    );

CREATE POLICY service_evaluations_update ON service_evaluations
    FOR UPDATE USING (
        is_group_coordinator(get_service_group_id(service_id))
    ) WITH CHECK (
        is_group_coordinator(get_service_group_id(service_id))
    );

-- ============================================================
-- EVALUATION_ITEMS
-- NO sub-selects to services or service_evaluations!
-- Uses SECURITY DEFINER functions to break cycles.
-- ============================================================
CREATE POLICY evaluation_items_select ON evaluation_items
    FOR SELECT USING (
        is_evaluation_participant(evaluation_id)
        OR is_group_coordinator(get_evaluation_group_id(evaluation_id))
    );

CREATE POLICY evaluation_items_insert ON evaluation_items
    FOR INSERT WITH CHECK (
        is_group_coordinator(get_evaluation_group_id(evaluation_id))
    );

CREATE POLICY evaluation_items_update ON evaluation_items
    FOR UPDATE USING (
        is_group_coordinator(get_evaluation_group_id(evaluation_id))
    ) WITH CHECK (
        is_group_coordinator(get_evaluation_group_id(evaluation_id))
    );

-- ============================================================
-- SERVICE_SCHEDULES (if table exists)
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_schedules') THEN
        ALTER TABLE service_schedules ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

CREATE POLICY service_schedules_select ON service_schedules
    FOR SELECT USING (is_group_member(group_id));

CREATE POLICY service_schedules_insert ON service_schedules
    FOR INSERT WITH CHECK (is_group_coordinator(group_id));

CREATE POLICY service_schedules_update ON service_schedules
    FOR UPDATE USING (is_group_coordinator(group_id))
    WITH CHECK (is_group_coordinator(group_id));

CREATE POLICY service_schedules_delete ON service_schedules
    FOR DELETE USING (is_group_coordinator(group_id));

-- ============================================================
-- INVITATIONS (if table exists)
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invitations') THEN
        ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

CREATE POLICY invitations_select ON invitations
    FOR SELECT USING (
        invited_by = auth.uid()
        OR is_group_coordinator(group_id)
    );

CREATE POLICY invitations_insert ON invitations
    FOR INSERT WITH CHECK (is_group_coordinator(group_id));

CREATE POLICY invitations_update ON invitations
    FOR UPDATE USING (is_group_coordinator(group_id));

CREATE POLICY invitations_delete ON invitations
    FOR DELETE USING (is_group_coordinator(group_id));
