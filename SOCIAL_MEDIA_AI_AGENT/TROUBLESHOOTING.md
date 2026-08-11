# Social Media AI Agent — Troubleshooting Memory

## Why this file exists
This file records the migration problems that already happened so future AI agents do not repeat them.

## 1. Meta App-name collision — CRITICAL
Two Meta apps appeared with similar/identical names during migration.

Production App ID: `1226695792750529`

A different App ID was encountered: `2066840514268683`

### Rule
**Never identify the production Meta app by name alone. Always verify the numeric App ID.**

The production `META_APP_SECRET` must belong to the same Meta App ID as the User Access Token. If token App ID and secret App ID differ, token exchange/validation fails.

## 2. Short-lived vs long-lived Meta token
The Graph API Explorer can generate a short-lived User Access Token. The production environment requires the validated long-lived token flow already established for this project.

When replacing the token:
1. Select the production Meta App by numeric App ID `1226695792750529`.
2. Grant the required permissions for the active publishing features.
3. Save the fresh token only in the local `.env` as `META_ACCESS_TOKEN`.
4. Never commit the token or App Secret to GitHub.
5. Validate token App ID, permissions, validity and expiry before restarting n8n.
6. Do not change App ID/Secret just because a token from another Meta app appears to work.

## 3. n8n environment issue
n8n must start with the project's `.env` values loaded. The Windows auto-start setup uses the startup script and must preserve environment loading.

Do not assume an interactive terminal's environment is available to unattended n8n.

## 4. Gemini HTTP 429
A previous test failed at `Gemini - Generate Caption` with HTTP 429 rate limiting.

Do not respond by repeatedly running the whole production workflow. Check the API quota/rate-limit condition first. Avoid creating duplicate social posts during debugging.

## 5. Token expiry
A previous execution failed at `Instagram - Create Feed Container` because the Meta token had expired.

Future maintenance should check token validity/expiry before production testing and document the replacement date when known.

## 6. Duplicate-post protection
The workflow uses the Google Drive SOURCE/DONE pattern. A successfully processed source image should be moved to the DONE folder. Do not manually rerun a production execution against the same source unless duplicate behavior is explicitly understood.

## 7. Git safety
`.env` and all secret values must remain outside Git. Documentation may contain variable names, IDs that are safe to document, architecture, schedules and troubleshooting history, but never secret values.

## 8. Debugging rule
When something fails:
1. Find the **first failed node**.
2. Read its exact HTTP/API error.
3. Fix only that blocker.
4. Do not regenerate unrelated credentials.
5. Do not modify working nodes.
6. Do not publish test content unnecessarily.
7. Validate again with the smallest safe test.

## Known successful baseline
Execution 119:
- Instagram Feed: PASS
- Instagram Story: PASS
- Facebook Page: PASS
- Meta token validation: PASS
- Long-lived token: PASS
- Gemini: PASS

Treat this as the production baseline unless a documented change supersedes it.