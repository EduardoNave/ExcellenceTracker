-- 008_schedule_server_templates.sql
-- Adds default_server_assignments jsonb column to service_schedules.
-- Stores an array of { user_id, template_id } objects used when generating
-- recurring services so each assigned server gets their own template.
-- Uses a DO block so it is idempotent.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'salim_et'
          AND table_name   = 'service_schedules'
          AND column_name  = 'default_server_assignments'
    ) THEN
        ALTER TABLE salim_et.service_schedules
            ADD COLUMN default_server_assignments jsonb;
    END IF;
END;
$$;
