-- 010_coordinator_invitations.sql
-- Adds coordinator_invitations table so the admin can invite coordinators
-- without using the public sign-up form.
-- Fully idempotent: DROP POLICY IF EXISTS before every CREATE POLICY.

-- ============================================================
-- coordinator_invitations
-- ============================================================
CREATE TABLE IF NOT EXISTS salim_et.coordinator_invitations (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    email       text NOT NULL,
    token       text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
    invited_by  uuid REFERENCES salim_et.profiles ON DELETE SET NULL,
    status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'expired')),
    expires_at  timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
    created_at  timestamptz DEFAULT now()
);

ALTER TABLE salim_et.coordinator_invitations ENABLE ROW LEVEL SECURITY;

-- Anyone can look up an invitation by its token (needed for the accept flow
-- before the user is authenticated).
DROP POLICY IF EXISTS "coordinator_invitations: public token lookup" ON salim_et.coordinator_invitations;
CREATE POLICY "coordinator_invitations: public token lookup"
    ON salim_et.coordinator_invitations
    FOR SELECT USING (true);

-- ============================================================
-- accept_coordinator_invitation(p_token)
-- Called client-side once the invited coordinator is authenticated.
-- Sets their profile role to 'coordinator' and marks the invitation accepted.
-- Updated by migration 011 to also set accepted_by.
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

    -- Mark invitation accepted
    UPDATE coordinator_invitations SET status = 'accepted' WHERE id = v_inv.id;

    RETURN json_build_object('success', true);
END;
$$;
