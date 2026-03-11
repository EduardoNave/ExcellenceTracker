-- 015_schedule_date_columns.sql
-- Adds start_date, end_date, notes to service_schedules to match what the
-- application code expects (the original migration 006 was missing these).
-- Also relaxes the recurrence NOT NULL constraint since the current UI no
-- longer exposes it (the column stays for backward compat with existing rows).
-- Updates generate_recurring_services to honour start_date / end_date.
-- Fully idempotent.

-- ============================================================
-- 1. Add missing columns
-- ============================================================
ALTER TABLE salim_et.service_schedules
    ADD COLUMN IF NOT EXISTS start_date date NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS end_date   date,
    ADD COLUMN IF NOT EXISTS notes      text;

-- ============================================================
-- 2. Relax recurrence column
--    The current form no longer sends recurrence; existing rows keep their
--    value, new rows default to 'weekly'. The CHECK constraint already
--    allows NULL values in PostgreSQL (NULL IN (...) = NULL ≠ FALSE).
-- ============================================================
ALTER TABLE salim_et.service_schedules
    ALTER COLUMN recurrence DROP NOT NULL,
    ALTER COLUMN recurrence SET DEFAULT 'weekly';

-- ============================================================
-- 3. Update generate_recurring_services
--    - Handle NULL recurrence (defaults to weekly / 7-day step)
--    - Respect the schedule's own start_date / end_date when they are
--      more restrictive than the caller-supplied p_from / p_to range.
-- ============================================================
-- Drop the old function signature (p_from / p_to) so we can recreate with
-- the correct names (p_from_date / p_to_date) that the JS client sends.
DROP FUNCTION IF EXISTS salim_et.generate_recurring_services(uuid, date, date);

CREATE OR REPLACE FUNCTION salim_et.generate_recurring_services(
    p_schedule_id uuid,
    p_from_date   date,
    p_to_date     date
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = salim_et
AS $$
DECLARE
    v_sched        service_schedules%ROWTYPE;
    v_date         date;
    v_effective_to date;
    v_count        int := 0;
    v_step         int;
BEGIN
    SELECT * INTO v_sched FROM service_schedules WHERE id = p_schedule_id;
    IF NOT FOUND THEN RETURN 0; END IF;

    -- Step in days based on recurrence (default weekly)
    v_step := CASE COALESCE(v_sched.recurrence, 'weekly')
        WHEN 'weekly'   THEN 7
        WHEN 'biweekly' THEN 14
        WHEN 'monthly'  THEN 28
        ELSE 7
    END;

    -- The effective window is the intersection of:
    --   - the schedule's own start_date / end_date
    --   - the caller-supplied p_from_date / p_to_date
    v_date         := GREATEST(p_from_date, COALESCE(v_sched.start_date, p_from_date));
    v_effective_to := LEAST(p_to_date,      COALESCE(v_sched.end_date,   p_to_date));

    -- Advance v_date to the first occurrence of the schedule's day_of_week
    IF v_sched.day_of_week IS NOT NULL THEN
        WHILE EXTRACT(DOW FROM v_date)::int <> v_sched.day_of_week LOOP
            v_date := v_date + 1;
        END LOOP;
    END IF;

    WHILE v_date <= v_effective_to LOOP
        INSERT INTO services (group_id, date, name, template_id, status, created_by)
        VALUES (
            v_sched.group_id,
            v_date,
            v_sched.name,
            v_sched.template_id,   -- NULL for schedules created via the new UI
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
