-- 014_member_deactivation.sql
-- Adds is_active to profiles, SECURITY DEFINER function for invitation details,
-- SECURITY DEFINER function for member removal with deactivation,
-- and updates accept_invitation to reactivate profiles.
-- Fully idempotent.

-- ============================================================
-- 1. Add is_active column to profiles
-- ============================================================
ALTER TABLE salim_et.profiles
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ============================================================
-- 2. Update handle_new_user trigger to keep is_active on upsert
-- (Previously only set email on conflict; now also ensures is_active)
-- ============================================================
CREATE OR REPLACE FUNCTION salim_et.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = salim_et
AS $$
BEGIN
    INSERT INTO profiles (id, full_name, role, email, is_active)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'server'),
        NEW.email,
        true
    )
    ON CONFLICT (id) DO UPDATE SET
        email     = EXCLUDED.email,
        is_active = true;          -- re-activating at auth level if re-registered
    RETURN NEW;
END;
$$;

-- ============================================================
-- 3. get_invitation_details — public SECURITY DEFINER RPC
--    Called by invite.tsx BEFORE the user is authenticated.
--    Bypasses RLS on groups and profiles.
-- ============================================================
CREATE OR REPLACE FUNCTION salim_et.get_invitation_details(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = salim_et
AS $$
DECLARE
    v_inv            invitations%ROWTYPE;
    v_group_name     text;
    v_inviter_email  text;
    v_existing_id    uuid;
    v_existing_active boolean;
BEGIN
    SELECT * INTO v_inv
    FROM invitations
    WHERE token = p_token;

    IF NOT FOUND THEN
        RETURN json_build_object('found', false);
    END IF;

    -- Fetch group name (bypasses RLS because function is SECURITY DEFINER)
    SELECT name INTO v_group_name
    FROM groups
    WHERE id = v_inv.group_id;

    -- Fetch inviter email
    SELECT email INTO v_inviter_email
    FROM profiles
    WHERE id = v_inv.invited_by;

    -- Check if the invited email already has an account
    SELECT id, is_active INTO v_existing_id, v_existing_active
    FROM profiles
    WHERE email = v_inv.email
    LIMIT 1;

    RETURN json_build_object(
        'found',              true,
        'email',              v_inv.email,
        'status',             v_inv.status,
        'expires_at',         v_inv.expires_at,
        'group_name',         COALESCE(v_group_name, 'Equipo'),
        'inviter_email',      v_inviter_email,
        'account_exists',     (v_existing_id IS NOT NULL),
        'account_is_active',  v_existing_active
    );
END;
$$;

-- Grant to anon (unauthenticated visitors) and authenticated users
REVOKE ALL ON FUNCTION salim_et.get_invitation_details(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION salim_et.get_invitation_details(text) TO anon, authenticated;

-- ============================================================
-- 4. Update accept_invitation to reactivate profile
-- ============================================================
CREATE OR REPLACE FUNCTION salim_et.accept_invitation(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = salim_et
AS $$
DECLARE
    v_inv     invitations%ROWTYPE;
    v_uid     uuid := auth.uid();
BEGIN
    SELECT * INTO v_inv
    FROM invitations
    WHERE token = p_token
      AND status = 'pending'
      AND expires_at > now();

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Invalid or expired invitation');
    END IF;

    IF v_uid IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Must be authenticated');
    END IF;

    -- Add member (ignore if already in the group)
    INSERT INTO group_members (group_id, user_id)
    VALUES (v_inv.group_id, v_uid)
    ON CONFLICT (group_id, user_id) DO NOTHING;

    -- Reactivate profile (handles re-invite of deactivated members)
    UPDATE profiles SET is_active = true WHERE id = v_uid;

    -- Mark invitation accepted
    UPDATE invitations SET status = 'accepted' WHERE id = v_inv.id;

    RETURN json_build_object('success', true, 'group_id', v_inv.group_id);
END;
$$;

-- ============================================================
-- 5. remove_member — SECURITY DEFINER RPC
--    Removes a member from a group AND deactivates their profile
--    if they have no other group memberships remaining.
--    Replaces the direct DELETE in src/api/members.ts.
-- ============================================================
CREATE OR REPLACE FUNCTION salim_et.remove_member(p_group_member_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = salim_et
AS $$
DECLARE
    v_gm          group_members%ROWTYPE;
    v_caller      uuid := auth.uid();
    v_is_coord    boolean;
    v_remaining   int;
BEGIN
    -- Fetch the group_member record
    SELECT * INTO v_gm
    FROM group_members
    WHERE id = p_group_member_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Membership not found');
    END IF;

    -- Verify caller is coordinator of that group
    SELECT EXISTS (
        SELECT 1 FROM groups
        WHERE id = v_gm.group_id AND coordinator_id = v_caller
    ) INTO v_is_coord;

    IF NOT v_is_coord THEN
        RETURN json_build_object('success', false, 'error', 'Forbidden: only the group coordinator can remove members');
    END IF;

    -- Delete the membership
    DELETE FROM group_members WHERE id = p_group_member_id;

    -- Count remaining memberships for this user
    SELECT COUNT(*) INTO v_remaining
    FROM group_members
    WHERE user_id = v_gm.user_id;

    -- Deactivate if no remaining memberships
    IF v_remaining = 0 THEN
        UPDATE profiles SET is_active = false WHERE id = v_gm.user_id;
    END IF;

    RETURN json_build_object('success', true);
END;
$$;
