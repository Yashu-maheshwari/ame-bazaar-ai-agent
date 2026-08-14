# Changelog

All notable changes to the AME Bazaar AI Agent project will be documented in this file.

## [4.5.1] - 2026-08-14
### Added
- Added `.claspignore` to restrict Clasp synchronization exclusively to master `gas/Code.gs` and `gas/appsscript.json`, ignoring legacy modular `.gs` files and preventing duplicate symbol definitions on Google Apps Script.

## [4.5.0] - 2026-08-14
### Added
- Configured `.clasp.json` linking `rootDir: "gas"` to existing Google Apps Script project (`1PERF3o5OMpYfbH8ePPC0HDNQEHEnWFfF7hE1ZPEQ6e84UAeYlSl1S_q7`).
- Added `@google/clasp` devDependency and `npm run push:gas` script for 1-command GitHub/local code synchronization to Google Apps Script.

## [4.4.0] - 2026-08-14
### Changed
- Enhanced Gemini social media caption prompt in `gas/Code.gs` for SEO/AEO/GEO & AI assistant discovery: naturally maps `AME Bazaar` = `family garments and clothing store` = `Kirari, Delhi`, uses non-stuffed intent terms (family clothing, kids wear, women's wear, men's wear), explicitly forbids unverified superlative claims ("best", "No.1", "top", "largest"), and preserves all approved conversion CTA rules.

## [4.3.1] - 2026-08-14
### Fixed
- Strengthened Gemini caption prompt in `gas/Code.gs` to explicitly forbid unverified product claims (quality, comfort, fabric type, fitting, durability, affordability, price, or availability) unless visually supported by the image.

## [4.3.0] - 2026-08-14
### Changed
- Improved Gemini social media caption prompt in `gas/Code.gs` for local conversion focus: natural casual Hinglish, 120-word limit, Kirari (Delhi) location integration, strong CTA for store visits & WhatsApp (9953569533), 4-5 hashtags, and strict visual accuracy rules (no hallucinated fabrics, prices, or cheap blanket discounts).

## [4.2.0] - 2026-08-14
### Security
- Masked all secret keys and tokens in `setupConfig()` output in `gas/Code.gs` to display only `CONFIGURED` or `MISSING` status, preventing credential exposure in GAS execution logs.

## [4.0.0] - 2026-08-14
### Added
- Completed 100% serverless Google Apps Script (GAS) migration replacing Node.js, n8n, Render, and SQL database infrastructure.
- Created `gas/appsscript.json`, `gas/Config.gs`, `gas/SheetService.gs`, `gas/DriveService.gs`, `gas/CloudinaryService.gs`, `gas/GeminiService.gs`, `gas/MetaService.gs`, `gas/Code.gs`, and `gas/Tests.gs`.
- Implemented `LockService` execution lock, `PropertiesService` secret management, `TEST_MODE` safety switch, `SocialMediaLog` Google Sheets execution history, and `setupTriggers()` for 11:00, 14:00, 19:00 IST daily schedules.
- Created `MIGRATION_GAS.md` documenting component mapping, obsolete components, required script properties, and first test procedure.

## [3.4.0] - 2026-08-14
### Added
- Created `docker-entrypoint.sh` container startup wrapper that dynamically extracts `DB_TYPE=postgresdb`, `DB_POSTGRESDB_HOST`, `DB_POSTGRESDB_PORT`, `DB_POSTGRESDB_DATABASE`, `DB_POSTGRESDB_USER`, `DB_POSTGRESDB_PASSWORD`, and `DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false` from `DATABASE_URL` at runtime for n8n.

## [3.3.0] - 2026-08-14
### Fixed
- Resolved n8n `"Database ping failed (1): Database connection timed out"` by adding `DB_TYPE=postgresdb`, `DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false`, and `DB_POSTGRESDB_CONNECTION_TIMEOUT_MS=30000` in `render.yaml` (v3.3) for n8n's TypeORM pool on Supabase Transaction Pooler (port 6543).

## [3.2.0] - 2026-08-14
### Fixed
- Fixed HTTP 502 Bad Gateway on `ame-bazaar-ai-agent` Render Docker web service by adding `N8N_LISTEN_ADDRESS=0.0.0.0`, `N8N_PORT=5678`, `PORT=5678`, and `EXPOSE 5678` in `Dockerfile` and `render.yaml` (v3.2).

## [3.1.0] - 2026-08-14
### Changed
- Updated `render.yaml` blueprint (v3.1) from `plan: starter` (paid) to `plan: free` (100% free $0/mo tier) for both services (`ame-bazaar-ai-agent` and `ame-bazaar-orchestrator`) to prevent Render payment prompt during Blueprint creation.

## [3.0.0] - 2026-08-14
### Added
- Executed `database/migrations/001_initial_schema.sql` against live Supabase PostgreSQL DB (`aws-0-ap-northeast-1.pooler.supabase.com`).
- Verified core tables, indices, and seeded Social Media Agent schedules (`11:00`, `14:00`, `19:00` IST).
- Completed live DB lock acquisition and idempotency duplicate key rejection tests on Supabase PostgreSQL.
- Verified 16/16 automated unit & integration test cases.

## [2.2.0] - 2026-08-14
### Added
- Updated Render blueprint (`render.yaml` v3.0) to configure Cloud Orchestrator service and external Supabase PostgreSQL connection.
- Prepared database migration and live orchestrator test pipeline awaiting user `DATABASE_URL`.

## [2.1.0] - 2026-08-14
### Added
- Created production-safe Supabase database adapter (`scripts/db.js`) supporting SSL connection strings and offline mock fallback (`MOCK_DB=true`).
- Created cloud orchestrator HTTP webhook entrypoint (`scripts/webhook.js`) for `/health` checks and `/webhook/trigger` agent slot dispatches.
- Expanded automated test suite (`tests/orchestrator.test.js`) to 16 test cases covering DB adapter validation, query access, transaction rollbacks, failure handling, and webhook endpoint processing (16/16 PASSED).
- Created `PROJECT_STATUS.md` documenting cloud architecture status and readiness.

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
