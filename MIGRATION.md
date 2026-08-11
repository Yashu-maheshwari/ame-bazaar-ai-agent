# AME Bazaar AI Agent Migration & Production Readiness Guide

This repository contains the production social-media automation engine for AME Bazaar. Follow these instructions to migrate or set up the project on a new machine.

## Read these files first

- `PROJECT_GUIDE.md` — non-technical explanation, daily operation, token renewal, migration and future changes.
- `TROUBLESHOOTING.md` — known migration failures and permanent lessons.
- `FUTURE_ROADMAP.md` — Threads, AI video and production-hardening plan.
- `n8n/workflows/social-media-automation.json` — actual workflow definition.

## Current verified production baseline

Successful n8n Execution ID: `119`

Verified:

- Meta token App match: PASS
- Meta permissions: PASS
- Meta token expiry: PASS
- Long-lived token: PASS
- Gemini: PASS
- Instagram Feed: PASS
- Instagram Story: PASS
- Facebook Page: PASS and verified through Graph API
- GitHub commit/push: PASS
- Threads: NOT TESTED

## Prerequisites

- Windows OS
- Node.js (v18+)
- Git
- n8n
- Access to the private GitHub repository

## Configuration Setup

1. Clone this repository.
2. Create a local `.env` file in the project root. Never commit it.
3. Use the variable names documented below; put real values only in the local environment.
4. Start n8n using the startup script after environment configuration.

### Required environment variable names

- `META_ACCESS_TOKEN`
- `META_APP_ID`
- `META_APP_SECRET`
- `GEMINI_API_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_UPLOAD_PRESET`
- `CLOUDINARY_LOGO_PUBLIC_ID`
- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- `GOOGLE_DRIVE_REFRESH_TOKEN`
- `GOOGLE_DRIVE_ACCESS_TOKEN` (when used by the local implementation)
- `AME_DRIVE_SOURCE_FOLDER_ID`
- `AME_DRIVE_DONE_FOLDER_ID`
- `IG_USER_ID`
- `FB_PAGE_ID`
- `THREADS_USER_ID`
- `THREADS_ACCESS_TOKEN`
- `GBP_ACCOUNT_ID`
- `GBP_LOCATION_ID`
- `GBP_ACCESS_TOKEN`

Never place values for these variables in GitHub documentation.

## Critical Meta App rule

There are two Meta Apps with the same display name `AME Bazaar Auto Marketing`.

Production app used by this project:

`1226695792750529`

Another same-name app encountered during migration:

`2066840514268683`

Always verify the numeric App ID before generating a token. The production App Secret belongs to App ID `1226695792750529`. A token issued for `2066840514268683` must not be paired with the production App Secret.

## n8n Workflow Path & Schedule

- **Workflow definition:** `n8n/workflows/social-media-automation.json`
- **Schedule:** 09:00, 14:00, 19:00 Asia/Kolkata
- **Cron:** `0 0 9,14,19 * * *`
- **Duplicate protection:** the workflow is designed to move successfully processed source images to the configured Done folder.

The workflow was verified as Active after production testing.

## Windows Auto-Start Setup

The current production setup uses the Windows Startup mechanism and the repository's n8n startup script.

Relevant files:

- `scripts/start_n8n.ps1`
- `n8n_AutoStart.bat` in the Windows user Startup folder

On a new laptop:

1. Clone the repository.
2. Create the local `.env`.
3. Update the startup script paths for the new Windows username/project location.
4. Put `n8n_AutoStart.bat` in the Windows Startup folder (`shell:startup`).
5. Start n8n and verify `http://localhost:5678`.
6. Verify the workflow is Active.
7. Verify the schedule.
8. Do not run a live publishing test unless intentionally required.

## Token renewal

Meta tokens are expiring credentials. Before expiry, generate a fresh token under the exact production App ID `1226695792750529`, validate its App ID/permissions/expiry, and update only `META_ACCESS_TOKEN` in the local `.env`.

Never commit the token.

## Safe migration principle

The GitHub repository contains the safe implementation and documentation. Secrets remain local.

Do not copy browser cookies, local n8n credential databases, or secret files into GitHub.

## Production change rule

For future changes:

`Inspect -> identify first real blocker -> smallest change -> targeted test -> production verification -> GitHub commit/push -> documentation update`

Do not repeatedly run the full publishing workflow to diagnose a single-node problem, and do not regenerate working credentials unnecessarily.
