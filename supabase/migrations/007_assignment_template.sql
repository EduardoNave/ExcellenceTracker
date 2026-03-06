-- 007_assignment_template.sql
-- Move template_id from services to service_assignments
-- so each assigned server can have a different checklist.
-- This script is IDEMPOTENT: safe to run multiple times.

-- ============================================================
-- Step 1: Add template_id column to service_assignments
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'service_assignments'
          AND column_name  = 'template_id'
    ) THEN
        ALTER TABLE service_assignments
            ADD COLUMN template_id uuid REFERENCES checklist_templates(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================
-- Step 2: Migrate existing data from services.template_id
-- ============================================================
DO $$
BEGIN
    -- Only migrate if services still has template_id column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'services'
          AND column_name  = 'template_id'
    ) THEN
        UPDATE service_assignments sa
        SET template_id = s.template_id
        FROM services s
        WHERE sa.service_id = s.id
          AND sa.template_id IS NULL
          AND s.template_id IS NOT NULL;
    END IF;
END $$;

-- ============================================================
-- Step 3: Remove template_id from services table
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'services'
          AND column_name  = 'template_id'
    ) THEN
        ALTER TABLE services DROP COLUMN template_id;
    END IF;
END $$;

-- ============================================================
-- Step 4: Remove template_id from service_schedules table
-- (schedules will no longer hold a global template)
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'service_schedules'
          AND column_name  = 'template_id'
    ) THEN
        ALTER TABLE service_schedules DROP COLUMN template_id;
    END IF;
END $$;

-- ============================================================
-- Step 5: Create index on service_assignments.template_id
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_service_assignments_template
    ON service_assignments(template_id);

-- ============================================================
-- Step 6: Update generate_recurring_services function
-- No longer references template_id on services or schedules
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
                    -- Create the service (no template_id on services anymore)
                    INSERT INTO services (group_id, date, name, notes, created_by, schedule_id, is_recurring, status)
                    VALUES (sched.group_id, current_date_iter, sched.name, sched.notes, sched.created_by, p_schedule_id, true, 'scheduled')
                    RETURNING id INTO new_service_id;

                    -- Auto-assign default servers (no template_id per default server for now)
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
