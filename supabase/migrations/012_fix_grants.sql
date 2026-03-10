-- 012_fix_grants.sql
-- Root-cause fix: migration 001 ran GRANT ALL ON ALL TABLES before any
-- CREATE TABLE statements, so every table was created without permissions.
-- This migration re-applies all grants now that all tables exist.
-- Also adds DEFAULT PRIVILEGES so future migrations never need explicit GRANTs.
-- Safe to run multiple times (idempotent).

-- ============================================================
-- Re-apply grants on all existing tables/sequences/functions
-- ============================================================
GRANT USAGE ON SCHEMA salim_et TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA salim_et TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA salim_et TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA salim_et TO anon, authenticated, service_role;

-- ============================================================
-- Default privileges — future CREATE TABLE/SEQUENCE/FUNCTION in
-- this schema will automatically get the same grants without any
-- extra GRANT statement in the migration.
-- ============================================================
ALTER DEFAULT PRIVILEGES IN SCHEMA salim_et
    GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA salim_et
    GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA salim_et
    GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
