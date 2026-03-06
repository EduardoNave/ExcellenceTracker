-- 007_assignment_template.sql
-- Adds template_id to service_assignments for per-assignment checklist overrides.
-- Uses a DO block so it is idempotent.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'salim_et'
          AND table_name   = 'service_assignments'
          AND column_name  = 'template_id'
    ) THEN
        ALTER TABLE salim_et.service_assignments
            ADD COLUMN template_id uuid
                REFERENCES salim_et.checklist_templates ON DELETE SET NULL;
    END IF;
END;
$$;
