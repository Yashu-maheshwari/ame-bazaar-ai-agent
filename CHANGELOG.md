# Changelog

All notable changes to the AME Bazaar AI Agent project will be documented in this file.

## [2.1.0] - 2026-08-14
### Added
- Created production-safe Supabase database adapter (`scripts/db.js`) supporting SSL connection strings and offline mock fallback (`MOCK_DB=true`).
- Created cloud orchestrator HTTP webhook entrypoint (`scripts/webhook.js`) for `/health` checks and `/webhook/trigger` agent slot dispatches.
- Expanded automated test suite (`tests/orchestrator.test.js`) to 16 test cases covering DB adapter validation, query access, transaction rollbacks, failure handling, and webhook endpoint processing (16/16 PASSED).
- Created `PROJECT_STATUS.md` documenting cloud architecture status and deployment readiness.

## [2.0.0] - 2026-08-14
### Added
- Created Supabase PostgreSQL schema DDL migration script (`database/migrations/001_initial_schema.sql`) covering `agents`, `schedules`, `executions`, `idempotency_keys`, `content_items`, `platform_publish_results`, and `recovery_events`.
- Created Central Orchestrator module (`scripts/orchestrator.js`) enforcing slot evaluation, deterministic idempotency locks `(agent_id, scheduled_slot, business_date)`, missed slot recovery, and future slot protection.
- Created automated offline test suite (`tests/orchestrator.test.js`) covering 11 validation requirements (DDL, lock acquisition, Asia/Kolkata timezone, 11/14/19 IST slots, shuffling, recovery, future protection, idempotency, multi-agent, restart, failure tracking). Passed 11/11 tests.
- Updated `MIGRATION.md` and `implementation_plan.md`.

## [1.2.0] - 2026-07-31
### Added
- Configured local `.env` with the new valid `GOOGLE_DRIVE_REFRESH_TOKEN` provided by the user.
- Verified successful Google OAuth refresh flow via token exchange endpoint returning a fresh access token.
- Tested workflow execution with the new refresh token node, successfully authenticating Google credentials and requesting folder listing.

## [1.1.0] - 2026-07-30
### Added
- Implemented automatic Google OAuth access token refresh node (`Google - Refresh Token`) inside the n8n social media workflow.
- Replaced manually managed `GOOGLE_DRIVE_ACCESS_TOKEN` with automatic environment-driven refresh via `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, and `GOOGLE_DRIVE_REFRESH_TOKEN`.
- Mapped all Google Drive nodes to dynamically query the refreshed access token from the new refresh node.
- Updated `.env.example` template to reflect Google OAuth refresh parameters.

## [1.0.0] - 2026-07-30
### Added
- Reorganized repository structure to support multiple sub-agents under `/agents/`.
- Integrated `knowledge/` folder with templates for brand guidelines and strategy.
- Integrated `memory/` folder for agent logs and execution history.
- Imported production-ready `social-media-automation` workflow in `/n8n/workflows/`.
- Added standard `.env.example` and `.gitignore`.
- Preserved Render blueprints and Dockerfile setups.
