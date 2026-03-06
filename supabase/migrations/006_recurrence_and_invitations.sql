-- 006_recurrence_and_invitations.sql
-- Adds service_schedules (recurring services) and invitations tables,
-- plus the accept_invitation and generate_recurring_services functions.
-- All objects are created in the salim_et schema.

-- ============================================================
-- service_schedules
-- ============================================================
CREATE TABLE IF NOT EXISTS salim_et.service_schedules (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id        uuid NOT NULL REFERENCES salim_et.groups ON DELETE CASCADE,
    name            text NOT NULL,
    recurrence      text NOT NULL CHECK (recurrence IN ('weekly', 'biweekly', 'monthly')),
    day_of_week     int  CHECK (day_of_week BETWEEN 0 AND 6),
    template_id     uuid REFERENCES salim_et.checklist_templates ON DELETE SET NULL,
    is_active       boolean NOT NULL DEFAULT true,
    created_by      uuid REFERENCES salim_et.profiles ON DELETE SET NULL,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS set_updated_at ON salim_et.service_schedules;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON salim_et.service_schedules
    FOR EACH ROW EXECUTE FUNCTION salim_et.update_updated_at();

-- ============================================================
-- invitations
-- ============================================================
CREATE TABLE IF NOT EXISTS salim_et.invitations (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id    uuid NOT NULL REFERENCES salim_et.groups ON DELETE CASCADE,
    email       text NOT NULL,
    token       text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
    invited_by  uuid REFERENCES salim_et.profiles ON DELETE SET NULL,
    status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'expired')),
    expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
    created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- RLS: service_schedules
-- ============================================================
ALTER TABLE salim_et.service_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_schedules: members can view" ON salim_et.service_schedules
    FOR SELECT USING (salim_et.is_group_member(group_id));

CREATE POLICY "service_schedules: coordinators can insert" ON salim_et.service_schedules
    FOR INSERT WITH CHECK (salim_et.is_group_coordinator(group_id));

CREATE POLICY "service_schedules: coordinators can update" ON salim_et.service_schedules
    FOR UPDATE USING (salim_et.is_group_coordinator(group_id));

CREATE POLICY "service_schedules: coordinators can delete" ON salim_et.service_schedules
    FOR DELETE USING (salim_et.is_group_coordinator(group_id));

-- ============================================================
-- RLS: invitations
-- ============================================================
ALTER TABLE salim_et.invitations ENABLE ROW LEVEL SECURITY;

-- Coordinators manage invitations for their groups
CREATE POLICY "invitations: coordinators can manage" ON salim_et.invitations
    FOR ALL USING (salim_et.is_group_coordinator(group_id));

-- Anyone with a valid token can look up their invitation (unauthenticated accept flow)
CREATE POLICY "invitations: public token lookup" ON salim_et.invitations
    FOR SELECT USING (true);

-- ============================================================
-- accept_invitation(p_token)
-- Called by the client after the user signs in via the invite link.
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

    -- Mark invitation accepted
    UPDATE invitations SET status = 'accepted' WHERE id = v_inv.id;

    RETURN json_build_object('success', true, 'group_id', v_inv.group_id);
END;
$$;

-- ============================================================
-- generate_recurring_services(p_schedule_id, p_from, p_to)
-- Creates service rows for each occurrence in the date range.
-- Returns the number of rows inserted.
-- ============================================================
CREATE OR REPLACE FUNCTION salim_et.generate_recurring_services(
    p_schedule_id uuid,
    p_from        date,
    p_to          date
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = salim_et
AS $$
DECLARE
    v_sched   service_schedules%ROWTYPE;
    v_date    date;
    v_count   int := 0;
    v_step    int;
BEGIN
    SELECT * INTO v_sched FROM service_schedules WHERE id = p_schedule_id;
    IF NOT FOUND THEN RETURN 0; END IF;

    v_step := CASE v_sched.recurrence
        WHEN 'weekly'   THEN 7
        WHEN 'biweekly' THEN 14
        WHEN 'monthly'  THEN 28
        ELSE 7
    END;

    v_date := p_from;

    -- Advance to first matching day-of-week on or after p_from
    IF v_sched.day_of_week IS NOT NULL THEN
        WHILE EXTRACT(DOW FROM v_date)::int <> v_sched.day_of_week LOOP
            v_date := v_date + 1;
        END LOOP;
    END IF;

    WHILE v_date <= p_to LOOP
        INSERT INTO services (group_id, date, name, template_id, status, created_by)
        VALUES (
            v_sched.group_id,
            v_date,
            v_sched.name,
            v_sched.template_id,
            'scheduled',
            auth.uid()
        )
        ON CONFLICT DO NOTHING;

        v_count := v_count + 1;
        v_date  := v_date + v_step;
    END LOOP;

    RETURN v_count;
END;
$$;
