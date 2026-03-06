-- 009_schema_salim_et.sql
-- Creates the 'salim_et' application schema with all tables, functions,
-- triggers, RLS policies, and indexes.
-- Also adds is_omittable to checklist_items and omitted to evaluation_items.
-- IDEMPOTENT: safe to run multiple times.

-- ============================================================
-- 0. Create schema
-- ============================================================
CREATE SCHEMA IF NOT EXISTS salim_et;

-- ============================================================
-- 1. Grant schema usage
-- ============================================================
GRANT USAGE ON SCHEMA salim_et TO anon, authenticated, service_role;

-- ============================================================
-- 2. Tables (all idempotent via CREATE TABLE IF NOT EXISTS)
-- ============================================================

-- profiles
CREATE TABLE IF NOT EXISTS salim_et.profiles (
    id          uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    full_name   text NOT NULL,
    avatar_url  text,
    role        text NOT NULL DEFAULT 'server'
                CHECK (role IN ('coordinator', 'server')),
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

-- groups
CREATE TABLE IF NOT EXISTS salim_et.groups (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name            text NOT NULL,
    description     text,
    coordinator_id  uuid NOT NULL REFERENCES salim_et.profiles ON DELETE CASCADE,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

-- group_members
CREATE TABLE IF NOT EXISTS salim_et.group_members (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id    uuid NOT NULL REFERENCES salim_et.groups ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES salim_et.profiles ON DELETE CASCADE,
    joined_at   timestamptz DEFAULT now(),
    UNIQUE (group_id, user_id)
);

-- checklist_templates
CREATE TABLE IF NOT EXISTS salim_et.checklist_templates (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id    uuid NOT NULL REFERENCES salim_et.groups ON DELETE CASCADE,
    name        text NOT NULL,
    description text,
    created_by  uuid REFERENCES salim_et.profiles ON DELETE SET NULL,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

-- checklist_sections
CREATE TABLE IF NOT EXISTS salim_et.checklist_sections (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id uuid NOT NULL REFERENCES salim_et.checklist_templates ON DELETE CASCADE,
    name        text NOT NULL,
    position    int NOT NULL DEFAULT 0,
    created_at  timestamptz DEFAULT now()
);

-- checklist_items (includes is_omittable)
CREATE TABLE IF NOT EXISTS salim_et.checklist_items (
    id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    section_id   uuid NOT NULL REFERENCES salim_et.checklist_sections ON DELETE CASCADE,
    description  text NOT NULL,
    weight       int NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 5),
    position     int NOT NULL DEFAULT 0,
    is_omittable boolean NOT NULL DEFAULT false,
    created_at   timestamptz DEFAULT now()
);

-- services
CREATE TABLE IF NOT EXISTS salim_et.services (
    id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id     uuid NOT NULL REFERENCES salim_et.groups ON DELETE CASCADE,
    date         date NOT NULL,
    name         text,
    notes        text,
    status       text NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled', 'in_progress', 'completed')),
    schedule_id  uuid,  -- FK added below after service_schedules exists
    is_recurring boolean NOT NULL DEFAULT false,
    created_by   uuid REFERENCES salim_et.profiles ON DELETE SET NULL,
    created_at   timestamptz DEFAULT now(),
    updated_at   timestamptz DEFAULT now()
);

-- service_assignments (includes template_id per-server)
CREATE TABLE IF NOT EXISTS salim_et.service_assignments (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id  uuid NOT NULL REFERENCES salim_et.services ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES salim_et.profiles ON DELETE CASCADE,
    template_id uuid REFERENCES salim_et.checklist_templates ON DELETE SET NULL,
    UNIQUE (service_id, user_id)
);

-- service_evaluations
CREATE TABLE IF NOT EXISTS salim_et.service_evaluations (
    id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id   uuid NOT NULL REFERENCES salim_et.services ON DELETE CASCADE,
    user_id      uuid NOT NULL REFERENCES salim_et.profiles ON DELETE CASCADE,
    total_score  numeric(5, 2),
    notes        text,
    evaluated_by uuid REFERENCES salim_et.profiles ON DELETE SET NULL,
    evaluated_at timestamptz DEFAULT now(),
    UNIQUE (service_id, user_id)
);

-- evaluation_items (includes omitted flag)
CREATE TABLE IF NOT EXISTS salim_et.evaluation_items (
    id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    evaluation_id     uuid NOT NULL REFERENCES salim_et.service_evaluations ON DELETE CASCADE,
    checklist_item_id uuid NOT NULL REFERENCES salim_et.checklist_items ON DELETE CASCADE,
    completed         boolean DEFAULT false,
    omitted           boolean NOT NULL DEFAULT false,
    notes             text,
    score             numeric(5, 2) DEFAULT 0,
    UNIQUE (evaluation_id, checklist_item_id)
);

-- service_schedules (uses default_server_assignments jsonb)
CREATE TABLE IF NOT EXISTS salim_et.service_schedules (
    id                          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id                    uuid NOT NULL REFERENCES salim_et.groups ON DELETE CASCADE,
    name                        text NOT NULL,
    day_of_week                 int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_date                  date NOT NULL DEFAULT CURRENT_DATE,
    end_date                    date,
    is_active                   boolean NOT NULL DEFAULT true,
    default_server_assignments  jsonb DEFAULT '[]'::jsonb,
    notes                       text,
    created_by                  uuid REFERENCES salim_et.profiles ON DELETE SET NULL,
    created_at                  timestamptz DEFAULT now(),
    updated_at                  timestamptz DEFAULT now()
);

-- Add FK from services to service_schedules (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'salim_et'
          AND table_name   = 'services'
          AND constraint_name = 'services_schedule_id_fkey'
    ) THEN
        ALTER TABLE salim_et.services
            ADD CONSTRAINT services_schedule_id_fkey
            FOREIGN KEY (schedule_id) REFERENCES salim_et.service_schedules ON DELETE SET NULL;
    END IF;
END $$;

-- invitations
CREATE TABLE IF NOT EXISTS salim_et.invitations (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id    uuid NOT NULL REFERENCES salim_et.groups ON DELETE CASCADE,
    email       text NOT NULL,
    invited_by  uuid NOT NULL REFERENCES salim_et.profiles ON DELETE CASCADE,
    status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'expired')),
    token       uuid DEFAULT gen_random_uuid(),
    created_at  timestamptz DEFAULT now(),
    expires_at  timestamptz DEFAULT (now() + interval '7 days'),
    UNIQUE (group_id, email)
);

-- ============================================================
-- 3. Grant table permissions
-- ============================================================
GRANT ALL ON ALL TABLES IN SCHEMA salim_et TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA salim_et TO anon, authenticated, service_role;

-- ============================================================
-- 4. Functions (all SECURITY DEFINER, search_path = salim_et)
-- ============================================================

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION salim_et.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = salim_et
AS $$
BEGIN
    INSERT INTO salim_et.profiles (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'server')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Generic updated_at trigger
CREATE OR REPLACE FUNCTION salim_et.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Check if current user is coordinator of a group
CREATE OR REPLACE FUNCTION salim_et.is_group_coordinator(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = salim_et
AS $$
    SELECT EXISTS (
        SELECT 1 FROM salim_et.groups
        WHERE id = p_group_id
          AND coordinator_id = auth.uid()
    );
$$;

-- Check if current user is a member (or coordinator) of a group
CREATE OR REPLACE FUNCTION salim_et.is_group_member(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = salim_et
AS $$
    SELECT EXISTS (
        SELECT 1 FROM salim_et.group_members
        WHERE group_id = p_group_id
          AND user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM salim_et.groups
        WHERE id = p_group_id
          AND coordinator_id = auth.uid()
    );
$$;

-- Check if current user is assigned to a service
CREATE OR REPLACE FUNCTION salim_et.is_assigned_to_service(p_service_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = salim_et
AS $$
    SELECT EXISTS (
        SELECT 1 FROM salim_et.service_assignments
        WHERE service_id = p_service_id
          AND user_id = auth.uid()
    );
$$;

-- Get group_id for a service (bypasses RLS)
CREATE OR REPLACE FUNCTION salim_et.get_service_group_id(p_service_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = salim_et
AS $$
    SELECT group_id FROM salim_et.services WHERE id = p_service_id;
$$;

-- Check if current user is participant of an evaluation
CREATE OR REPLACE FUNCTION salim_et.is_evaluation_participant(p_evaluation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = salim_et
AS $$
    SELECT EXISTS (
        SELECT 1 FROM salim_et.service_evaluations
        WHERE id = p_evaluation_id
          AND (evaluated_by = auth.uid() OR user_id = auth.uid())
    );
$$;

-- Get group_id for an evaluation (bypasses RLS)
CREATE OR REPLACE FUNCTION salim_et.get_evaluation_group_id(p_evaluation_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = salim_et
AS $$
    SELECT s.group_id
    FROM salim_et.service_evaluations se
    JOIN salim_et.services s ON s.id = se.service_id
    WHERE se.id = p_evaluation_id;
$$;

-- Find user ID by email (for coordinator invite flow)
CREATE OR REPLACE FUNCTION salim_et.get_user_id_by_email(lookup_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = salim_et
AS $$
    SELECT id FROM auth.users WHERE email = lookup_email LIMIT 1;
$$;

-- Accept invitation
CREATE OR REPLACE FUNCTION salim_et.accept_invitation(invitation_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = salim_et
AS $$
DECLARE
    inv RECORD;
BEGIN
    SELECT * INTO inv
    FROM salim_et.invitations
    WHERE token = invitation_token
      AND status = 'pending'
      AND expires_at > now();

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Invitación no válida o expirada');
    END IF;

    INSERT INTO salim_et.group_members (group_id, user_id)
    VALUES (inv.group_id, auth.uid())
    ON CONFLICT (group_id, user_id) DO NOTHING;

    UPDATE salim_et.invitations
    SET status = 'accepted'
    WHERE id = inv.id;

    RETURN json_build_object('success', true, 'group_id', inv.group_id);
END;
$$;

-- Generate recurring services for a schedule
CREATE OR REPLACE FUNCTION salim_et.generate_recurring_services(
    p_schedule_id uuid,
    p_from_date date,
    p_to_date date
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = salim_et
AS $$
DECLARE
    sched RECORD;
    current_date_iter date;
    services_created int := 0;
    new_service_id uuid;
    server_assignment jsonb;
    server_user_id uuid;
    server_template_id uuid;
BEGIN
    SELECT * INTO sched
    FROM salim_et.service_schedules
    WHERE id = p_schedule_id AND is_active = true;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    current_date_iter := p_from_date;
    WHILE current_date_iter <= p_to_date LOOP
        IF EXTRACT(DOW FROM current_date_iter) = sched.day_of_week THEN
            IF current_date_iter >= sched.start_date
               AND (sched.end_date IS NULL OR current_date_iter <= sched.end_date) THEN
                IF NOT EXISTS (
                    SELECT 1 FROM salim_et.services
                    WHERE schedule_id = p_schedule_id
                      AND date = current_date_iter
                ) THEN
                    INSERT INTO salim_et.services (
                        group_id, date, name, notes, created_by,
                        schedule_id, is_recurring, status
                    )
                    VALUES (
                        sched.group_id, current_date_iter, sched.name,
                        sched.notes, sched.created_by,
                        p_schedule_id, true, 'scheduled'
                    )
                    RETURNING id INTO new_service_id;

                    IF sched.default_server_assignments IS NOT NULL
                       AND jsonb_array_length(sched.default_server_assignments) > 0 THEN
                        FOR server_assignment IN
                            SELECT * FROM jsonb_array_elements(sched.default_server_assignments)
                        LOOP
                            server_user_id     := (server_assignment->>'user_id')::uuid;
                            server_template_id := NULLIF(server_assignment->>'template_id', '')::uuid;

                            INSERT INTO salim_et.service_assignments (service_id, user_id, template_id)
                            VALUES (new_service_id, server_user_id, server_template_id)
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
-- 5. Triggers (drop-if-exists then create, for idempotency)
-- ============================================================

-- handle_new_user trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_salim_et ON auth.users;
CREATE TRIGGER on_auth_user_created_salim_et
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION salim_et.handle_new_user();

-- updated_at triggers
DROP TRIGGER IF EXISTS set_updated_at_profiles ON salim_et.profiles;
CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON salim_et.profiles
    FOR EACH ROW EXECUTE FUNCTION salim_et.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_groups ON salim_et.groups;
CREATE TRIGGER set_updated_at_groups
    BEFORE UPDATE ON salim_et.groups
    FOR EACH ROW EXECUTE FUNCTION salim_et.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_checklist_templates ON salim_et.checklist_templates;
CREATE TRIGGER set_updated_at_checklist_templates
    BEFORE UPDATE ON salim_et.checklist_templates
    FOR EACH ROW EXECUTE FUNCTION salim_et.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_services ON salim_et.services;
CREATE TRIGGER set_updated_at_services
    BEFORE UPDATE ON salim_et.services
    FOR EACH ROW EXECUTE FUNCTION salim_et.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_service_schedules ON salim_et.service_schedules;
CREATE TRIGGER set_updated_at_service_schedules
    BEFORE UPDATE ON salim_et.service_schedules
    FOR EACH ROW EXECUTE FUNCTION salim_et.update_updated_at();

-- ============================================================
-- 6. Enable RLS on all tables
-- ============================================================
ALTER TABLE salim_et.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE salim_et.groups               ENABLE ROW LEVEL SECURITY;
ALTER TABLE salim_et.group_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE salim_et.checklist_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE salim_et.checklist_sections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE salim_et.checklist_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE salim_et.services             ENABLE ROW LEVEL SECURITY;
ALTER TABLE salim_et.service_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE salim_et.service_evaluations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE salim_et.evaluation_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE salim_et.service_schedules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE salim_et.invitations          ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS Policies (DROP IF EXISTS + CREATE for idempotency)
-- ============================================================

-- PROFILES
DROP POLICY IF EXISTS profiles_select ON salim_et.profiles;
DROP POLICY IF EXISTS profiles_insert ON salim_et.profiles;
DROP POLICY IF EXISTS profiles_update ON salim_et.profiles;

CREATE POLICY profiles_select ON salim_et.profiles
    FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_insert ON salim_et.profiles
    FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update ON salim_et.profiles
    FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- GROUPS
DROP POLICY IF EXISTS groups_select ON salim_et.groups;
DROP POLICY IF EXISTS groups_insert ON salim_et.groups;
DROP POLICY IF EXISTS groups_update ON salim_et.groups;
DROP POLICY IF EXISTS groups_delete ON salim_et.groups;

CREATE POLICY groups_select ON salim_et.groups
    FOR SELECT USING (
        coordinator_id = auth.uid() OR salim_et.is_group_member(id)
    );
CREATE POLICY groups_insert ON salim_et.groups
    FOR INSERT WITH CHECK (coordinator_id = auth.uid());
CREATE POLICY groups_update ON salim_et.groups
    FOR UPDATE USING (coordinator_id = auth.uid())
    WITH CHECK (coordinator_id = auth.uid());
CREATE POLICY groups_delete ON salim_et.groups
    FOR DELETE USING (coordinator_id = auth.uid());

-- GROUP_MEMBERS
DROP POLICY IF EXISTS group_members_select ON salim_et.group_members;
DROP POLICY IF EXISTS group_members_insert ON salim_et.group_members;
DROP POLICY IF EXISTS group_members_delete ON salim_et.group_members;

CREATE POLICY group_members_select ON salim_et.group_members
    FOR SELECT USING (
        user_id = auth.uid() OR salim_et.is_group_coordinator(group_id)
    );
CREATE POLICY group_members_insert ON salim_et.group_members
    FOR INSERT WITH CHECK (salim_et.is_group_coordinator(group_id));
CREATE POLICY group_members_delete ON salim_et.group_members
    FOR DELETE USING (salim_et.is_group_coordinator(group_id));

-- CHECKLIST_TEMPLATES
DROP POLICY IF EXISTS checklist_templates_select ON salim_et.checklist_templates;
DROP POLICY IF EXISTS checklist_templates_insert ON salim_et.checklist_templates;
DROP POLICY IF EXISTS checklist_templates_update ON salim_et.checklist_templates;
DROP POLICY IF EXISTS checklist_templates_delete ON salim_et.checklist_templates;

CREATE POLICY checklist_templates_select ON salim_et.checklist_templates
    FOR SELECT USING (salim_et.is_group_member(group_id));
CREATE POLICY checklist_templates_insert ON salim_et.checklist_templates
    FOR INSERT WITH CHECK (salim_et.is_group_coordinator(group_id));
CREATE POLICY checklist_templates_update ON salim_et.checklist_templates
    FOR UPDATE USING (salim_et.is_group_coordinator(group_id))
    WITH CHECK (salim_et.is_group_coordinator(group_id));
CREATE POLICY checklist_templates_delete ON salim_et.checklist_templates
    FOR DELETE USING (salim_et.is_group_coordinator(group_id));

-- CHECKLIST_SECTIONS
DROP POLICY IF EXISTS checklist_sections_select ON salim_et.checklist_sections;
DROP POLICY IF EXISTS checklist_sections_insert ON salim_et.checklist_sections;
DROP POLICY IF EXISTS checklist_sections_update ON salim_et.checklist_sections;
DROP POLICY IF EXISTS checklist_sections_delete ON salim_et.checklist_sections;

CREATE POLICY checklist_sections_select ON salim_et.checklist_sections
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM salim_et.checklist_templates ct
            WHERE ct.id = checklist_sections.template_id
              AND salim_et.is_group_member(ct.group_id)
        )
    );
CREATE POLICY checklist_sections_insert ON salim_et.checklist_sections
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM salim_et.checklist_templates ct
            WHERE ct.id = checklist_sections.template_id
              AND salim_et.is_group_coordinator(ct.group_id)
        )
    );
CREATE POLICY checklist_sections_update ON salim_et.checklist_sections
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM salim_et.checklist_templates ct
            WHERE ct.id = checklist_sections.template_id
              AND salim_et.is_group_coordinator(ct.group_id)
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM salim_et.checklist_templates ct
            WHERE ct.id = checklist_sections.template_id
              AND salim_et.is_group_coordinator(ct.group_id)
        )
    );
CREATE POLICY checklist_sections_delete ON salim_et.checklist_sections
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM salim_et.checklist_templates ct
            WHERE ct.id = checklist_sections.template_id
              AND salim_et.is_group_coordinator(ct.group_id)
        )
    );

-- CHECKLIST_ITEMS
DROP POLICY IF EXISTS checklist_items_select ON salim_et.checklist_items;
DROP POLICY IF EXISTS checklist_items_insert ON salim_et.checklist_items;
DROP POLICY IF EXISTS checklist_items_update ON salim_et.checklist_items;
DROP POLICY IF EXISTS checklist_items_delete ON salim_et.checklist_items;

CREATE POLICY checklist_items_select ON salim_et.checklist_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM salim_et.checklist_sections cs
            JOIN salim_et.checklist_templates ct ON ct.id = cs.template_id
            WHERE cs.id = checklist_items.section_id
              AND salim_et.is_group_member(ct.group_id)
        )
    );
CREATE POLICY checklist_items_insert ON salim_et.checklist_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM salim_et.checklist_sections cs
            JOIN salim_et.checklist_templates ct ON ct.id = cs.template_id
            WHERE cs.id = checklist_items.section_id
              AND salim_et.is_group_coordinator(ct.group_id)
        )
    );
CREATE POLICY checklist_items_update ON salim_et.checklist_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM salim_et.checklist_sections cs
            JOIN salim_et.checklist_templates ct ON ct.id = cs.template_id
            WHERE cs.id = checklist_items.section_id
              AND salim_et.is_group_coordinator(ct.group_id)
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM salim_et.checklist_sections cs
            JOIN salim_et.checklist_templates ct ON ct.id = cs.template_id
            WHERE cs.id = checklist_items.section_id
              AND salim_et.is_group_coordinator(ct.group_id)
        )
    );
CREATE POLICY checklist_items_delete ON salim_et.checklist_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM salim_et.checklist_sections cs
            JOIN salim_et.checklist_templates ct ON ct.id = cs.template_id
            WHERE cs.id = checklist_items.section_id
              AND salim_et.is_group_coordinator(ct.group_id)
        )
    );

-- SERVICES
DROP POLICY IF EXISTS services_select ON salim_et.services;
DROP POLICY IF EXISTS services_insert ON salim_et.services;
DROP POLICY IF EXISTS services_update ON salim_et.services;
DROP POLICY IF EXISTS services_delete ON salim_et.services;

CREATE POLICY services_select ON salim_et.services
    FOR SELECT USING (
        salim_et.is_group_coordinator(group_id) OR salim_et.is_group_member(group_id)
    );
CREATE POLICY services_insert ON salim_et.services
    FOR INSERT WITH CHECK (salim_et.is_group_coordinator(group_id));
CREATE POLICY services_update ON salim_et.services
    FOR UPDATE USING (salim_et.is_group_coordinator(group_id))
    WITH CHECK (salim_et.is_group_coordinator(group_id));
CREATE POLICY services_delete ON salim_et.services
    FOR DELETE USING (salim_et.is_group_coordinator(group_id));

-- SERVICE_ASSIGNMENTS
DROP POLICY IF EXISTS service_assignments_select ON salim_et.service_assignments;
DROP POLICY IF EXISTS service_assignments_insert ON salim_et.service_assignments;
DROP POLICY IF EXISTS service_assignments_delete ON salim_et.service_assignments;

CREATE POLICY service_assignments_select ON salim_et.service_assignments
    FOR SELECT USING (
        user_id = auth.uid()
        OR salim_et.is_group_coordinator(salim_et.get_service_group_id(service_id))
    );
CREATE POLICY service_assignments_insert ON salim_et.service_assignments
    FOR INSERT WITH CHECK (
        salim_et.is_group_coordinator(salim_et.get_service_group_id(service_id))
    );
CREATE POLICY service_assignments_delete ON salim_et.service_assignments
    FOR DELETE USING (
        salim_et.is_group_coordinator(salim_et.get_service_group_id(service_id))
    );

-- SERVICE_EVALUATIONS
DROP POLICY IF EXISTS service_evaluations_select ON salim_et.service_evaluations;
DROP POLICY IF EXISTS service_evaluations_insert ON salim_et.service_evaluations;
DROP POLICY IF EXISTS service_evaluations_update ON salim_et.service_evaluations;

CREATE POLICY service_evaluations_select ON salim_et.service_evaluations
    FOR SELECT USING (
        evaluated_by = auth.uid()
        OR user_id = auth.uid()
        OR salim_et.is_group_coordinator(salim_et.get_service_group_id(service_id))
    );
CREATE POLICY service_evaluations_insert ON salim_et.service_evaluations
    FOR INSERT WITH CHECK (
        salim_et.is_group_coordinator(salim_et.get_service_group_id(service_id))
    );
CREATE POLICY service_evaluations_update ON salim_et.service_evaluations
    FOR UPDATE USING (
        salim_et.is_group_coordinator(salim_et.get_service_group_id(service_id))
    ) WITH CHECK (
        salim_et.is_group_coordinator(salim_et.get_service_group_id(service_id))
    );

-- EVALUATION_ITEMS
DROP POLICY IF EXISTS evaluation_items_select ON salim_et.evaluation_items;
DROP POLICY IF EXISTS evaluation_items_insert ON salim_et.evaluation_items;
DROP POLICY IF EXISTS evaluation_items_update ON salim_et.evaluation_items;

CREATE POLICY evaluation_items_select ON salim_et.evaluation_items
    FOR SELECT USING (
        salim_et.is_evaluation_participant(evaluation_id)
        OR salim_et.is_group_coordinator(salim_et.get_evaluation_group_id(evaluation_id))
    );
CREATE POLICY evaluation_items_insert ON salim_et.evaluation_items
    FOR INSERT WITH CHECK (
        salim_et.is_group_coordinator(salim_et.get_evaluation_group_id(evaluation_id))
    );
CREATE POLICY evaluation_items_update ON salim_et.evaluation_items
    FOR UPDATE USING (
        salim_et.is_group_coordinator(salim_et.get_evaluation_group_id(evaluation_id))
    ) WITH CHECK (
        salim_et.is_group_coordinator(salim_et.get_evaluation_group_id(evaluation_id))
    );

-- SERVICE_SCHEDULES
DROP POLICY IF EXISTS service_schedules_select ON salim_et.service_schedules;
DROP POLICY IF EXISTS service_schedules_insert ON salim_et.service_schedules;
DROP POLICY IF EXISTS service_schedules_update ON salim_et.service_schedules;
DROP POLICY IF EXISTS service_schedules_delete ON salim_et.service_schedules;

CREATE POLICY service_schedules_select ON salim_et.service_schedules
    FOR SELECT USING (salim_et.is_group_member(group_id));
CREATE POLICY service_schedules_insert ON salim_et.service_schedules
    FOR INSERT WITH CHECK (salim_et.is_group_coordinator(group_id));
CREATE POLICY service_schedules_update ON salim_et.service_schedules
    FOR UPDATE USING (salim_et.is_group_coordinator(group_id))
    WITH CHECK (salim_et.is_group_coordinator(group_id));
CREATE POLICY service_schedules_delete ON salim_et.service_schedules
    FOR DELETE USING (salim_et.is_group_coordinator(group_id));

-- INVITATIONS
DROP POLICY IF EXISTS invitations_select ON salim_et.invitations;
DROP POLICY IF EXISTS invitations_insert ON salim_et.invitations;
DROP POLICY IF EXISTS invitations_update ON salim_et.invitations;
DROP POLICY IF EXISTS invitations_delete ON salim_et.invitations;

CREATE POLICY invitations_select ON salim_et.invitations
    FOR SELECT USING (
        invited_by = auth.uid() OR salim_et.is_group_coordinator(group_id)
    );
CREATE POLICY invitations_insert ON salim_et.invitations
    FOR INSERT WITH CHECK (salim_et.is_group_coordinator(group_id));
CREATE POLICY invitations_update ON salim_et.invitations
    FOR UPDATE USING (salim_et.is_group_coordinator(group_id));
CREATE POLICY invitations_delete ON salim_et.invitations
    FOR DELETE USING (salim_et.is_group_coordinator(group_id));

-- ============================================================
-- 8. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_se_groups_coordinator     ON salim_et.groups (coordinator_id);
CREATE INDEX IF NOT EXISTS idx_se_group_members_group    ON salim_et.group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_se_group_members_user     ON salim_et.group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_se_checklist_tmpl_group   ON salim_et.checklist_templates (group_id);
CREATE INDEX IF NOT EXISTS idx_se_checklist_sect_tmpl    ON salim_et.checklist_sections (template_id);
CREATE INDEX IF NOT EXISTS idx_se_checklist_sect_pos     ON salim_et.checklist_sections (template_id, position);
CREATE INDEX IF NOT EXISTS idx_se_checklist_items_sect   ON salim_et.checklist_items (section_id);
CREATE INDEX IF NOT EXISTS idx_se_checklist_items_pos    ON salim_et.checklist_items (section_id, position);
CREATE INDEX IF NOT EXISTS idx_se_services_group         ON salim_et.services (group_id);
CREATE INDEX IF NOT EXISTS idx_se_services_date          ON salim_et.services (date);
CREATE INDEX IF NOT EXISTS idx_se_services_status        ON salim_et.services (status);
CREATE INDEX IF NOT EXISTS idx_se_services_schedule      ON salim_et.services (schedule_id);
CREATE INDEX IF NOT EXISTS idx_se_svc_assign_service     ON salim_et.service_assignments (service_id);
CREATE INDEX IF NOT EXISTS idx_se_svc_assign_user        ON salim_et.service_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_se_svc_assign_template    ON salim_et.service_assignments (template_id);
CREATE INDEX IF NOT EXISTS idx_se_svc_eval_service       ON salim_et.service_evaluations (service_id);
CREATE INDEX IF NOT EXISTS idx_se_svc_eval_user          ON salim_et.service_evaluations (user_id);
CREATE INDEX IF NOT EXISTS idx_se_eval_items_eval        ON salim_et.evaluation_items (evaluation_id);
CREATE INDEX IF NOT EXISTS idx_se_eval_items_item        ON salim_et.evaluation_items (checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_se_schedules_group        ON salim_et.service_schedules (group_id);
CREATE INDEX IF NOT EXISTS idx_se_schedules_day          ON salim_et.service_schedules (day_of_week);
CREATE INDEX IF NOT EXISTS idx_se_invitations_token      ON salim_et.invitations (token);
CREATE INDEX IF NOT EXISTS idx_se_invitations_group      ON salim_et.invitations (group_id);
CREATE INDEX IF NOT EXISTS idx_se_invitations_email      ON salim_et.invitations (email);
