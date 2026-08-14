-- =========================================================================
-- AME Bazaar AI Agent System - Central Database Schema (Supabase PostgreSQL)
-- Migration: 001_initial_schema.sql
-- =========================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Agents Table
CREATE TABLE IF NOT EXISTS agents (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed core agents
INSERT INTO agents (id, name, description) VALUES
    ('social-media', 'Social Media Agent', 'Automates multi-platform social media posts (Instagram, FB, Threads, GBP)'),
    ('blogger', 'Blogger Agent', 'Generates and publishes blog posts'),
    ('threads', 'Threads Agent', 'Standalone Threads engagement agent'),
    ('video', 'Video Content Agent', 'Creates AI video marketing content'),
    ('website', 'Website Content Agent', 'Manages website content updates'),
    ('seo', 'SEO Agent', 'Monitors and optimizes search engine presence'),
    ('marketing-customer', 'Marketing & Customer Agent', 'Manages customer engagement campaigns')
ON CONFLICT (id) DO NOTHING;

-- 2. Agent Schedules Table
CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(50) REFERENCES agents(id) ON DELETE CASCADE,
    slot_time TIME NOT NULL, -- e.g. '11:00:00', '14:00:00', '19:00:00'
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_agent_slot UNIQUE (agent_id, slot_time)
);

-- Seed initial schedule for social media agent (11:00, 14:00, 19:00 IST)
INSERT INTO schedules (agent_id, slot_time) VALUES
    ('social-media', '11:00:00'),
    ('social-media', '14:00:00'),
    ('social-media', '19:00:00')
ON CONFLICT ON CONSTRAINT unique_agent_slot DO NOTHING;

-- 3. Executions Table
CREATE TABLE IF NOT EXISTS executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(50) NOT NULL REFERENCES agents(id),
    scheduled_slot TIMESTAMPTZ NOT NULL,
    business_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED')),
    error_message TEXT,
    retry_count INT DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Idempotency Keys Table (Prevents duplicate execution across process restarts/cloud wakes)
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    agent_id VARCHAR(50) NOT NULL REFERENCES agents(id),
    scheduled_slot TIMESTAMPTZ NOT NULL,
    business_date DATE NOT NULL,
    idempotency_key VARCHAR(150) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_agent_slot_date UNIQUE (agent_id, scheduled_slot, business_date)
);

-- 5. Content Items Table (Stores source media, drive files, captions, generated media)
CREATE TABLE IF NOT EXISTS content_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID REFERENCES executions(id) ON DELETE SET NULL,
    agent_id VARCHAR(50) NOT NULL REFERENCES agents(id),
    source_drive_file_id VARCHAR(255),
    source_file_name VARCHAR(255),
    cloudinary_public_id VARCHAR(255),
    cloudinary_url TEXT,
    caption TEXT,
    category VARCHAR(100),
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PROCESSING', 'PUBLISHED', 'FAILED', 'ARCHIVED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Platform Publish Results Table (Per-platform publish tracking)
CREATE TABLE IF NOT EXISTS platform_publish_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('INSTAGRAM_FEED', 'INSTAGRAM_STORY', 'FACEBOOK_PAGE', 'THREADS', 'GBP', 'BLOG')),
    platform_post_id VARCHAR(255),
    status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'SKIPPED')),
    response_data JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_execution_platform UNIQUE (execution_id, platform)
);

-- 7. Recovery Events Table (Tracks restart recoveries, missed slots, catch-up actions)
CREATE TABLE IF NOT EXISTS recovery_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID REFERENCES executions(id) ON DELETE SET NULL,
    agent_id VARCHAR(50) NOT NULL REFERENCES agents(id),
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('MISSED_SLOT_RECOVERED', 'MISSED_SLOT_SKIPPED', 'PROCESS_RESTART_RECONCILED', 'DUPLICATE_PREVENTED')),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for rapid lookup
CREATE INDEX IF NOT EXISTS idx_executions_agent_status ON executions(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_executions_business_date ON executions(business_date);
CREATE INDEX IF NOT EXISTS idx_idempotency_key ON idempotency_keys(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_platform_results_exec ON platform_publish_results(execution_id);
