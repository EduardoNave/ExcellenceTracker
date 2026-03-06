-- 005_fix_rls_policies.sql
-- Corrects RLS policies that had recursion or logic issues.
-- Drops and recreates the affected policies using SECURITY DEFINER helper functions.

-- ============================================================
-- Fix service_evaluations: rename to "members can view" and
-- ensure all policies call the SECURITY DEFINER helpers.
-- ============================================================
DROP POLICY IF EXISTS "service_evaluations: participants can view" ON salim_et.service_evaluations;
DROP POLICY IF EXISTS "service_evaluations: members can view"      ON salim_et.service_evaluations;
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
-- Fix evaluation_items: use get_evaluation_group_id helper
-- to avoid subquery + RLS recursion.
-- ============================================================
DROP POLICY IF EXISTS "evaluation_items: participants can view" ON salim_et.evaluation_items;
DROP POLICY IF EXISTS "evaluation_items: members can view"      ON salim_et.evaluation_items;
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
