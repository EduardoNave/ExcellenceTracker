-- 002_functions_triggers.sql
-- Functions and triggers for ExcellenceTracker

-- ============================================================
-- handle_new_user(): auto-create a profile when a user signs up
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'server')
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- update_updated_at(): generic trigger to keep updated_at current
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON groups
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON checklist_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- is_group_coordinator(p_group_id): true when the caller is the
-- coordinator of the given group
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_group_coordinator(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM groups
        WHERE id = p_group_id
          AND coordinator_id = auth.uid()
    );
$$;

-- ============================================================
-- is_group_member(p_group_id): true when the caller is either a
-- member or the coordinator of the given group
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM group_members
        WHERE group_id = p_group_id
          AND user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1
        FROM groups
        WHERE id = p_group_id
          AND coordinator_id = auth.uid()
    );
$$;

-- ============================================================
-- get_user_id_by_email(lookup_email): find a user's ID by their
-- email address. Used by coordinators to add members by email.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(lookup_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id
    FROM auth.users
    WHERE email = lookup_email
    LIMIT 1;
$$;
