-- 006_recurrence_and_invitations.sql
-- Adds service recurrence support and invitation tracking

-- ============================================================
-- SERVICE_SCHEDULES: Recurrence rules for services
-- ============================================================
CREATE TABLE service_schedules (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id        uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
    name            text NOT NULL,
    template_id     uuid REFERENCES checklist_templates ON DELETE SET NULL,
    day_of_week     int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    -- 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado
    start_date      date NOT NULL DEFAULT CURRENT_DATE,
    end_date        date,  -- NULL = no end date (indefinite)
    is_active       boolean NOT NULL DEFAULT true,
    default_servers uuid[] DEFAULT '{}',  -- array of user IDs to auto-assign
    notes           text,
    created_by      uuid REFERENCES profiles ON DELETE SET NULL,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

-- Add recurrence link to services table
ALTER TABLE services
    ADD COLUMN schedule_id uuid REFERENCES service_schedules ON DELETE SET NULL,
    ADD COLUMN is_recurring boolean NOT NULL DEFAULT false;

-- ============================================================
-- INVITATIONS: Track pending invitations
-- ============================================================
CREATE TABLE invitations (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id        uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
    email           text NOT NULL,
    invited_by      uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'expired')),
    token           uuid DEFAULT gen_random_uuid(),
    created_at      timestamptz DEFAULT now(),
    expires_at      timestamptz DEFAULT (now() + interval '7 days'),
    UNIQUE (group_id, email)
);

-- ============================================================
-- Triggers for updated_at
-- ============================================================
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON service_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- Enable RLS
-- ============================================================
ALTER TABLE service_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations       ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS for service_schedules
-- ============================================================
CREATE POLICY service_schedules_select ON service_schedules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = service_schedules.group_id
              AND groups.coordinator_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = service_schedules.group_id
              AND group_members.user_id = auth.uid()
        )
    );

CREATE POLICY service_schedules_insert ON service_schedules
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = service_schedules.group_id
              AND groups.coordinator_id = auth.uid()
        )
    );

CREATE POLICY service_schedules_update ON service_schedules
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = service_schedules.group_id
              AND groups.coordinator_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = service_schedules.group_id
              AND groups.coordinator_id = auth.uid()
        )
    );

CREATE POLICY service_schedules_delete ON service_schedules
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = service_schedules.group_id
              AND groups.coordinator_id = auth.uid()
        )
    );

-- ============================================================
-- RLS for invitations
-- ============================================================
CREATE POLICY invitations_select ON invitations
    FOR SELECT USING (
        invited_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = invitations.group_id
              AND groups.coordinator_id = auth.uid()
        )
    );

CREATE POLICY invitations_insert ON invitations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = invitations.group_id
              AND groups.coordinator_id = auth.uid()
        )
    );

CREATE POLICY invitations_update ON invitations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = invitations.group_id
              AND groups.coordinator_id = auth.uid()
        )
    );

CREATE POLICY invitations_delete ON invitations
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = invitations.group_id
              AND groups.coordinator_id = auth.uid()
        )
    );

-- ============================================================
-- Function: accept_invitation
-- Called when a user signs up via invitation link
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_invitation(invitation_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    inv RECORD;
BEGIN
    -- Find the invitation
    SELECT * INTO inv
    FROM invitations
    WHERE token = invitation_token
      AND status = 'pending'
      AND expires_at > now();

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Invitación no válida o expirada');
    END IF;

    -- Add user to group_members
    INSERT INTO group_members (group_id, user_id)
    VALUES (inv.group_id, auth.uid())
    ON CONFLICT (group_id, user_id) DO NOTHING;

    -- Mark invitation as accepted
    UPDATE invitations
    SET status = 'accepted'
    WHERE id = inv.id;

    RETURN json_build_object('success', true, 'group_id', inv.group_id);
END;
$$;

-- ============================================================
-- Function: generate_recurring_services
-- Generates services for a schedule within a date range
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_recurring_services(
    p_schedule_id uuid,
    p_from_date date,
    p_to_date date
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    sched RECORD;
    current_date_iter date;
    services_created int := 0;
    new_service_id uuid;
    server_id uuid;
BEGIN
    -- Get schedule details
    SELECT * INTO sched
    FROM service_schedules
    WHERE id = p_schedule_id AND is_active = true;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- Iterate through dates
    current_date_iter := p_from_date;
    WHILE current_date_iter <= p_to_date LOOP
        -- Check if this date matches the day_of_week
        IF EXTRACT(DOW FROM current_date_iter) = sched.day_of_week THEN
            -- Check date is within schedule bounds
            IF current_date_iter >= sched.start_date
               AND (sched.end_date IS NULL OR current_date_iter <= sched.end_date) THEN
                -- Check no service already exists for this schedule+date
                IF NOT EXISTS (
                    SELECT 1 FROM services
                    WHERE schedule_id = p_schedule_id
                      AND date = current_date_iter
                ) THEN
                    -- Create the service
                    INSERT INTO services (group_id, date, name, template_id, notes, created_by, schedule_id, is_recurring, status)
                    VALUES (sched.group_id, current_date_iter, sched.name, sched.template_id, sched.notes, sched.created_by, p_schedule_id, true, 'scheduled')
                    RETURNING id INTO new_service_id;

                    -- Auto-assign default servers
                    IF sched.default_servers IS NOT NULL AND array_length(sched.default_servers, 1) > 0 THEN
                        FOREACH server_id IN ARRAY sched.default_servers LOOP
                            INSERT INTO service_assignments (service_id, user_id)
                            VALUES (new_service_id, server_id)
                            ON CONFLICT (service_id, user_id) DO NOTHING;
                        END LOOP;
                    END IF;

                    services_created := services_created + 1;
                END IF;
            END IF;
        END IF;

        current_date_iter := current_date_iter + 1;
    END LOOP;

    RETURN services_created;
END;
$$;

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_service_schedules_group ON service_schedules(group_id);
CREATE INDEX idx_service_schedules_day ON service_schedules(day_of_week);
CREATE INDEX idx_services_schedule ON services(schedule_id);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_group ON invitations(group_id);
CREATE INDEX idx_invitations_email ON invitations(email);
