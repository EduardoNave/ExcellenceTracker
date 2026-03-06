-- 008_schedule_server_templates.sql
-- Change default_servers (uuid[]) to default_server_assignments (jsonb)
-- so each default server in a schedule can have a template_id.
-- Format: [{"user_id": "...", "template_id": "..." | null}, ...]
-- Also updates generate_recurring_services() to insert template_id.
-- This script is IDEMPOTENT: safe to run multiple times.

-- ============================================================
-- Step 1: Add default_server_assignments jsonb column
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'service_schedules'
          AND column_name  = 'default_server_assignments'
    ) THEN
        ALTER TABLE service_schedules
            ADD COLUMN default_server_assignments jsonb DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- ============================================================
-- Step 2: Migrate data from default_servers (uuid[]) to jsonb
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'service_schedules'
          AND column_name  = 'default_servers'
    ) THEN
        UPDATE service_schedules
        SET default_server_assignments = (
            SELECT COALESCE(
                jsonb_agg(jsonb_build_object('user_id', uid::text, 'template_id', null)),
                '[]'::jsonb
            )
            FROM unnest(default_servers) AS uid
        )
        WHERE default_servers IS NOT NULL
          AND array_length(default_servers, 1) > 0
          AND (default_server_assignments IS NULL OR default_server_assignments = '[]'::jsonb);
    END IF;
END $$;

-- ============================================================
-- Step 3: Drop old default_servers column
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'service_schedules'
          AND column_name  = 'default_servers'
    ) THEN
        ALTER TABLE service_schedules DROP COLUMN default_servers;
    END IF;
END $$;

-- ============================================================
-- Step 4: Update generate_recurring_services function
-- Now reads default_server_assignments jsonb and inserts template_id
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
    server_assignment jsonb;
    server_user_id uuid;
    server_template_id uuid;
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
                    INSERT INTO services (group_id, date, name, notes, created_by, schedule_id, is_recurring, status)
                    VALUES (sched.group_id, current_date_iter, sched.name, sched.notes, sched.created_by, p_schedule_id, true, 'scheduled')
                    RETURNING id INTO new_service_id;

                    -- Auto-assign default servers with their template_id
                    IF sched.default_server_assignments IS NOT NULL
                       AND jsonb_array_length(sched.default_server_assignments) > 0 THEN
                        FOR server_assignment IN SELECT * FROM jsonb_array_elements(sched.default_server_assignments) LOOP
                            server_user_id := (server_assignment->>'user_id')::uuid;
                            server_template_id := NULLIF(server_assignment->>'template_id', '')::uuid;

                            INSERT INTO service_assignments (service_id, user_id, template_id)
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
