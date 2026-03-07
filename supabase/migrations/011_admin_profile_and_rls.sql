-- 011_admin_profile_and_rls.sql
-- Adds email + is_admin columns to profiles.
-- Adds is_admin() helper function used by RLS policies.
-- Adds direct-client INSERT/DELETE policies for coordinator_invitations.
-- Adds admin SELECT ALL policies for profiles and groups.
-- Adds accepted_by column to coordinator_invitations.

-- ============================================================
-- 1. Add email + is_admin columns to profiles
-- ============================================================
ALTER TABLE salim_et.profiles
    ADD COLUMN IF NOT EXISTS email    text,
    ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Backfill email for users who already have a profile row
UPDATE salim_et.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND p.email IS NULL;

-- ============================================================
-- 2. Update handle_new_user() to also persist email
-- ============================================================
CREATE OR REPLACE FUNCTION salim_et.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = salim_et
AS $$
BEGIN
    INSERT INTO profiles (id, full_name, role, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'server'),
        NEW.email
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email;
    RETURN NEW;
END;
$$;

-- ============================================================
-- 3. is_admin() — reads is_admin flag from own profile row.
-- SECURITY DEFINER so it runs as the owner (postgres) and
-- bypasses RLS when querying profiles.
-- ============================================================
CREATE OR REPLACE FUNCTION salim_et.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = salim_et
AS $$
    SELECT COALESCE(
        (SELECT is_admin FROM profiles WHERE id = auth.uid()),
        false
    )
$$;

-- ============================================================
-- 4. Add accepted_by column to coordinator_invitations
-- ============================================================
ALTER TABLE salim_et.coordinator_invitations
    ADD COLUMN IF NOT EXISTS accepted_by uuid
    REFERENCES salim_et.profiles ON DELETE SET NULL;

-- ============================================================
-- 5. Update accept_coordinator_invitation to record accepted_by
-- ============================================================
CREATE OR REPLACE FUNCTION salim_et.accept_coordinator_invitation(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = salim_et
AS $$
DECLARE
    v_inv coordinator_invitations%ROWTYPE;
    v_uid uuid := auth.uid();
BEGIN
    SELECT * INTO v_inv
    FROM coordinator_invitations
    WHERE token = p_token
      AND status = 'pending'
      AND expires_at > now();

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invitación inválida o expirada'
        );
    END IF;

    IF v_uid IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Debes iniciar sesión primero'
        );
    END IF;

    -- Promote profile to coordinator
    UPDATE profiles SET role = 'coordinator' WHERE id = v_uid;

    -- Mark invitation accepted and record who accepted
    UPDATE coordinator_invitations
    SET status = 'accepted', accepted_by = v_uid
    WHERE id = v_inv.id;

    RETURN json_build_object('success', true);
END;
$$;

-- ============================================================
-- 6. coordinator_invitations: admin can INSERT and DELETE
--    (SELECT policy already exists from migration 010)
-- ============================================================
CREATE POLICY "coordinator_invitations: admin insert"
    ON salim_et.coordinator_invitations
    FOR INSERT
    TO authenticated
    WITH CHECK (salim_et.is_admin());

CREATE POLICY "coordinator_invitations: admin delete"
    ON salim_et.coordinator_invitations
    FOR DELETE
    TO authenticated
    USING (salim_et.is_admin());

-- ============================================================
-- 7. profiles: admin can SELECT all rows
--    (existing "profiles: own row" policy covers own profile;
--     this policy additionally lets the admin see everyone)
-- ============================================================
CREATE POLICY "profiles: admin select all"
    ON salim_et.profiles
    FOR SELECT
    TO authenticated
    USING (salim_et.is_admin());

-- ============================================================
-- 8. groups: admin can SELECT all rows
--    (needed so the admin panel can count groups per coordinator)
-- ============================================================
CREATE POLICY "groups: admin select all"
    ON salim_et.groups
    FOR SELECT
    TO authenticated
    USING (salim_et.is_admin());
