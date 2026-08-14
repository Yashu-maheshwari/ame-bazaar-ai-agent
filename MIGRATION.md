# AME Bazaar AI Agent Migration & Production Readiness Guide

This repository contains the production social-media automation engine for AME Bazaar. Follow these instructions to migrate or set up the project on a new machine.

## Prerequisites
- Node.js (v18+)
- Git
- Windows OS (for the automatic startup folder integration)

## Configuration Setup
1. Clone this repository.
2. Create a `.env` file in the root directory with the required variables.
3. Configure Google Drive with subfolders under the main Source/Done directories:
   - `SOURCE/BOYS/`, `SOURCE/WOMEN/`, `SOURCE/MEN/`
   - `DONE/BOYS/`, `DONE/WOMEN/`, `DONE/MEN/`

## N8N Workflow Path & Schedule
- **Workflow definition file**: `n8n/workflows/social-media-automation.json`
- **Schedule**: Automatically runs 3 times daily at **11:00, 14:00, 19:00 Asia/Kolkata** (Cron: `0 0 11,14,19 * * *`).
- **Startup Recovery / Catch-up**: n8n runs catch-up recovery logic at boot time to publish any missed slots.

## Windows Auto-Start Setup
1. Copy the portable startup script `scripts/start_n8n.ps1` to a permanent location.
2. Open the Windows user Startup folder:
   - Press `Win + R`, type `shell:startup`, and press Enter.
3. Create a batch file named `n8n_AutoStart.bat` in this folder:
```cmd
   @echo off
   start /min powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\path\to\your\start_n8n.ps1"
   ```

## Cloud Migration Audit (2026-08-14)

### Objective
Migrate from local Windows n8n daemon to cloud orchestrator using Supabase PostgreSQL state and automated cloud execution.

### Verification Audit Summary
- **Stable Checkpoint `production-stable-2026-08-13`**: Verified present in Git history (`8f56d27`).
- **n8n Workflow JSON**: Present at `n8n/workflows/social-media-automation.json`. Local working copy contains 10m interval catch-up trigger enhancements over `HEAD` (`9474f77`).
- **Render Deployment Config**: Present at `render.yaml` (Docker web service + Render Postgres blueprint).
- **Supabase Schemas/Migrations**: **MISSING**. No PostgreSQL DDL / migration scripts currently exist in the repo.
- **Central Orchestrator**: **MISSING**. Scheduling and state persistence currently rely on n8n internal trigger state and local process uptime.

### Gaps & Needed Cloud Infrastructure
1. **Database Layer**: Supabase PostgreSQL schema with tables: `agents`, `schedules`, `executions`, `content_items`, `idempotency_keys`, `platform_publish_results`, `recovery_events`.
2. **Central Orchestrator & Idempotency Lock**: Time-based slot evaluator to check due agents, acquire locks, prevent duplicate posts, and handle missed slots.
3. **Cloud Runtime Triggering**: Webhook or cron mechanism triggering central orchestration on Supabase DB without depending on local laptop daemon.

## Cloud Architecture Implementation Log (2026-08-14)

### Phase 3 - Supabase DB Adapter & Cloud Webhook Entrypoint (2026-08-14)

#### Implementation Summary
- Created `scripts/db.js` providing production-ready connection handling for Supabase PostgreSQL (`DATABASE_URL` with SSL support) and mock mode (`MOCK_DB=true`) for offline validation without live credentials.
- Created `scripts/webhook.js` zero-dependency HTTP entrypoint providing `/health` connection status check and `/webhook/trigger` endpoint for time-based agent dispatching.
- Expanded automated test suite in `tests/orchestrator.test.js` to 16 test cases.

#### Expanded Automated Test Results (16/16 PASSED)
1. PostgreSQL DDL syntax & schema structure: **PASS**
2. DB connection configuration validation (Mock Mode): **PASS**
3. Agents table access and active status query: **PASS**
4. Schedules table access (11:00 / 14:00 / 19:00 IST): **PASS**
5. Basic Orchestrator lock acquisition: **PASS**
6. Asia/Kolkata timezone context evaluation: **PASS**
7. 11:00 / 14:00 / 19:00 slot schedule detection: **PASS**
8. Content selection & shuffling helper: **PASS**
9. Missed-slot recovery window enforcement (>4h skipped): **PASS**
10. Future-slot protection (never execute early): **PASS**
11. Idempotency lock & duplicate execution rejection: **PASS**
12. Multi-agent independent schedule lock: **PASS**
13. Process crash/restart recovery handling: **PASS**
14. Failure tracking & retry count increment: **PASS**
15. Graceful DB connection failure handling: **PASS**
16. Cloud Webhook Entrypoint `/health` endpoint processing: **PASS**

All 16 tests passed cleanly offline. Production workflows and credentials remain untouched.

### Phase 4 - Live Supabase Setup & Migration Verification (2026-08-14)
- **Database Connection**: Successfully connected to live Supabase PostgreSQL (`aws-0-ap-northeast-1.pooler.supabase.com`).
- **DDL Execution**: Applied `database/migrations/001_initial_schema.sql`. Verified all 7 core tables (`agents`, `schedules`, `executions`, `idempotency_keys`, `content_items`, `platform_publish_results`, `recovery_events`).
- **Seeded Configuration**: Verified Social Media Agent seeding & default schedules (`11:00:00`, `14:00:00`, `19:00:00` IST).
- **Live DB Lock & Idempotency Test**: Executed live lock acquisition and confirmed unique constraint `(agent_id, scheduled_slot, business_date)` rejection of duplicate keys on live Supabase DB. Cleaned up test records.
- **Full Test Suite**: 16/16 automated test cases passed.
- **Production Safety**: Zero social posts published, zero production workflows modified, zero secrets committed to Git.
