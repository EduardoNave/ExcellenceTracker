-- 001_initial_schema.sql
-- Creates all application tables for ExcellenceTracker

-- profiles
CREATE TABLE profiles (
    id          uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    full_name   text NOT NULL,
    avatar_url  text,
    role        text NOT NULL DEFAULT 'server'
                CHECK (role IN ('coordinator', 'server')),
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

-- groups
CREATE TABLE groups (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name            text NOT NULL,
    description     text,
    coordinator_id  uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

-- group_members
CREATE TABLE group_members (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id    uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
    joined_at   timestamptz DEFAULT now(),
    UNIQUE (group_id, user_id)
);

-- checklist_templates
CREATE TABLE checklist_templates (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id    uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
    name        text NOT NULL,
    description text,
    created_by  uuid REFERENCES profiles ON DELETE SET NULL,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

-- checklist_sections
CREATE TABLE checklist_sections (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id uuid NOT NULL REFERENCES checklist_templates ON DELETE CASCADE,
    name        text NOT NULL,
    position    int NOT NULL DEFAULT 0,
    created_at  timestamptz DEFAULT now()
);

-- checklist_items
CREATE TABLE checklist_items (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    section_id  uuid NOT NULL REFERENCES checklist_sections ON DELETE CASCADE,
    description text NOT NULL,
    weight      int NOT NULL DEFAULT 1
                CHECK (weight BETWEEN 1 AND 5),
    position    int NOT NULL DEFAULT 0,
    created_at  timestamptz DEFAULT now()
);

-- services
CREATE TABLE services (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id    uuid NOT NULL REFERENCES groups ON DELETE CASCADE,
    date        date NOT NULL,
    name        text,
    template_id uuid REFERENCES checklist_templates ON DELETE SET NULL,
    notes       text,
    status      text NOT NULL DEFAULT 'scheduled'
                CHECK (status IN ('scheduled', 'in_progress', 'completed')),
    created_by  uuid REFERENCES profiles ON DELETE SET NULL,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

-- service_assignments
CREATE TABLE service_assignments (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id  uuid NOT NULL REFERENCES services ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
    UNIQUE (service_id, user_id)
);

-- service_evaluations
CREATE TABLE service_evaluations (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id  uuid NOT NULL REFERENCES services ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
    total_score numeric(5, 2),
    notes       text,
    evaluated_by uuid REFERENCES profiles ON DELETE SET NULL,
    evaluated_at timestamptz DEFAULT now(),
    UNIQUE (service_id, user_id)
);

-- evaluation_items
CREATE TABLE evaluation_items (
    id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    evaluation_id     uuid NOT NULL REFERENCES service_evaluations ON DELETE CASCADE,
    checklist_item_id uuid NOT NULL REFERENCES checklist_items ON DELETE CASCADE,
    completed         boolean DEFAULT false,
    notes             text,
    score             numeric(5, 2) DEFAULT 0,
    UNIQUE (evaluation_id, checklist_item_id)
);
