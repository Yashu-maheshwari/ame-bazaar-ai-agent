# AME Bazaar AI Agent — Troubleshooting & Known Lessons

This file records problems already encountered during migration so future AI agents do not repeat the same investigation loops.

## Meta / OAuth — critical

### Two Meta Apps have the same display name

There are two Meta Apps named:

`AME Bazaar Auto Marketing`

Known App IDs:

- `1226695792750529` — the production app used by this project
- `2066840514268683` — a different app with the same display name

### What went wrong

During migration, a token generated in Graph API Explorer was detected as belonging to `2066840514268683`, while the project's App Secret belonged to `1226695792750529`.

This produced App/signature mismatch and OAuth error 190 failures.

### Permanent prevention rule

Never identify the Meta App by display name alone.

Always verify the numeric App ID before generating or replacing a token.

Required production pair:

`App ID 1226695792750529 + its matching App Secret + token issued for App ID 1226695792750529`

Do not switch the project to `2066840514268683` unless the entire Meta application configuration is intentionally migrated and separately documented.

## Meta token lifecycle

The project uses a Meta token that must be validated for:

- App ID match
- validity
- required permissions
- expiry

The successful production validation reported:

- TOKEN APP MATCH: PASS
- TOKEN PERMISSIONS: PASS
- TOKEN EXPIRY: PASS
- LONG-LIVED TOKEN: PASS

If a future token expires, replace only the token value in the local `.env` after generating it under the correct production App.

Never store token values in GitHub documentation.

## Gemini image format issue

An earlier Gemini failure was traced to an image-format mismatch:

- Unsplash returned WebP/AVIF because of `auto=format`.
- The workflow declared the MIME type as `image/jpeg`.
- Gemini rejected the mismatch.

Minimum fix used during debugging: force JPEG (`fm=jpg`) or correctly propagate the actual content type.

Do not reintroduce `auto=format` when the downstream node requires a declared JPEG payload.

## Gemini rate limiting

HTTP 429 was encountered during testing at `Gemini - Generate Caption`.

Do not interpret HTTP 429 as an invalid API key automatically.

Future production hardening should add:

- controlled retry/backoff
- rate-limit-aware execution
- failure logging/notification

Avoid repeatedly hammering the API with rapid manual executions.

## Instagram / Facebook publishing

The final verified execution was n8n Execution ID 119.

Verified:

- Instagram Feed: PASS
- Instagram Story: PASS
- Facebook Page: PASS

Facebook previously failed with HTTP 403 when the workflow used deprecated `publish_actions` behavior. The working implementation was subsequently verified successfully.

Do not reintroduce deprecated Facebook permissions or APIs.

## n8n startup issue

During migration, n8n was initially not starting automatically with Windows.

Final working approach:

- Windows Startup mechanism
- `n8n_AutoStart.bat`
- `start_n8n.ps1`
- environment loaded before n8n starts

The production audit later reported:

`N8N AUTO-START: YES`

Do not assume n8n is running merely because the workflow is Active. On a new laptop, verify startup behavior.

## Environment file confusion

The project `.env` is local and Git-ignored.

Known working project path on the current laptop:

`C:\Users\user\.gemini\antigravity\scratch\ame-bazaar-ai-agent\.env`

The `.env` must never be committed.

When a future agent says a token is missing, first verify:

1. exact project root
2. exact `.env` path
3. file modification time
4. variable presence (without printing secret values)
5. which environment n8n actually loads

Do not create a second competing `.env` without a clear reason.

## Repeated testing problem

A major migration inefficiency was repeatedly starting n8n, waiting, executing the full workflow and creating numbered debug scripts even when the blocker was a single credential mismatch.

Future rule:

`FIRST FAILED NODE -> exact error -> minimum fix -> targeted test`

Do not rerun the entire production publishing workflow for a problem that can be validated independently.

## GitHub safety

Repository:

`Yashu-maheshwari/ame-bazaar-ai-agent`

Repository is private.

Safe files should be committed and pushed.

Never commit:

- `.env`
- access tokens
- App Secrets
- API keys
- browser cookies
- local credential databases

## Migration rule

The repository is the implementation source of truth. If chat history and repository documentation differ, inspect the current repository implementation first and verify before changing anything.
