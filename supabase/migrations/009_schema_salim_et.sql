-- 009_schema_salim_et.sql
-- Adds omittable support: is_omittable on checklist_items and
-- omitted on evaluation_items. Both columns use IF NOT EXISTS for idempotency.

ALTER TABLE salim_et.checklist_items
    ADD COLUMN IF NOT EXISTS is_omittable boolean NOT NULL DEFAULT false;

ALTER TABLE salim_et.evaluation_items
    ADD COLUMN IF NOT EXISTS omitted boolean NOT NULL DEFAULT false;
