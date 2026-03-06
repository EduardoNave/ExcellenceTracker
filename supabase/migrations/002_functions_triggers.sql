-- 002_functions_triggers.sql
-- Helper functions and triggers for ExcellenceTracker.
-- All objects are created in the salim_et schema.
-- Function bodies use unqualified table names because SET search_path = salim_et.

-- ============================================================
-- handle_new_user(): auto-create a profile when a user signs up
-- ============================================================
CREATE OR REPLACE FUNCTION salim_et.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = salim_et
AS $$
BEGIN
    INSERT INTO profiles (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'server')
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION salim_et.handle_new_user();

-- ============================================================
-- update_updated_at(): keeps updated_at current on every UPDATE
-- ============================================================
CREATE OR REPLACE FUNCTION salim_et.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = salim_et
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON salim_et.profiles
    FOR EACH ROW
    EXECUTE FUNCTION salim_et.update_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON salim_et.groups
    FOR EACH ROW
    EXECUTE FUNCTION salim_et.update_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON salim_et.checklist_templates
    FOR EACH ROW
    EXECUTE FUNCTION salim_et.update_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON salim_et.services
    FOR EACH ROW
    EXECUTE FUNCTION salim_et.update_updated_at();

-- ============================================================
-- is_group_coordinator(p_group_id)
-- Returns true when the calling user is the coordinator of a group.
-- SECURITY DEFINER bypasses RLS to avoid recursion in policies.
-- ============================================================
CREATE OR REPLACE FUNCTION salim_et.is_group_coordinator(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = salim_et
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM groups
        WHERE id = p_group_id
          AND coordinator_id = auth.uid()
    );
$$;

-- ============================================================
-- is_group_member(p_group_id)
-- Returns true when the calling user is a member OR coordinator.
-- ============================================================
CREATE OR REPLACE FUNCTION salim_et.is_group_member(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = salim_et
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

-- ============================================================
-- is_assigned_to_service(p_service_id)
-- Returns true when the calling user is assigned to a service.
-- ============================================================
CREATE OR REPLACE FUNCTION salim_et.is_assigned_to_service(p_service_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = salim_et
AS $$
    SELECT EXISTS (
        SELECT 1 FROM service_assignments
        WHERE service_id = p_service_id
          AND user_id = auth.uid()
    );
$$;

-- ============================================================
-- get_service_group_id(p_service_id)
-- Returns the group_id for a service, bypassing RLS.
-- ============================================================
CREATE OR REPLACE FUNCTION salim_et.get_service_group_id(p_service_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = salim_et
AS $$
    SELECT group_id FROM services WHERE id = p_service_id;
$$;

-- ============================================================
-- is_evaluation_participant(p_evaluation_id)
-- Returns true when the calling user is the evaluator or subject.
-- ============================================================
CREATE OR REPLACE FUNCTION salim_et.is_evaluation_participant(p_evaluation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = salim_et
AS $$
    SELECT EXISTS (
        SELECT 1 FROM service_evaluations
        WHERE id = p_evaluation_id
          AND (evaluated_by = auth.uid() OR user_id = auth.uid())
    );
$$;

-- ============================================================
-- get_evaluation_group_id(p_evaluation_id)
-- Returns the group_id for an evaluation via its service.
-- ============================================================
CREATE OR REPLACE FUNCTION salim_et.get_evaluation_group_id(p_evaluation_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = salim_et
AS $$
    SELECT s.group_id
    FROM service_evaluations se
    JOIN services s ON s.id = se.service_id
    WHERE se.id = p_evaluation_id;
$$;

-- ============================================================
-- get_user_id_by_email(lookup_email)
-- Used by coordinators to invite members by email.
-- ============================================================
CREATE OR REPLACE FUNCTION salim_et.get_user_id_by_email(lookup_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = salim_et
AS $$
    SELECT id
    FROM auth.users
    WHERE email = lookup_email
    LIMIT 1;
$$;
