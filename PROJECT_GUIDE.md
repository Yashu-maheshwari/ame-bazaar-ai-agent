# AME Bazaar AI Agent — Non-Technical Project Guide

## 1. What this project does

This is AME Bazaar's automated social-media content publishing engine.

The intended daily flow is:

1. n8n starts automatically with Windows.
2. At 09:00, 14:00 and 19:00 Asia/Kolkata, the scheduled workflow starts.
3. The workflow selects an image from the configured Google Drive source folder.
4. The image is sent through the media-processing pipeline; Cloudinary is used for image hosting/processing and the AME Bazaar logo overlay.
5. Gemini generates the social caption.
6. The publishing pipeline sends the content to the configured social platforms.
7. The processed source is moved to the configured Done folder so the same source is not reused.
8. Execution history in n8n is the primary place to check whether a run succeeded or failed.

## 2. Current verified production state

The successful end-to-end test was Execution ID 119.

Verified on that run:

- Meta token App match: PASS
- Meta permissions: PASS
- Meta token expiry validation: PASS
- Long-lived Meta token: PASS
- Gemini: PASS
- Instagram Feed publishing: PASS
- Instagram Story publishing: PASS
- Facebook Page publishing: PASS and verified through Graph API
- GitHub commit: PASS
- GitHub push: PASS
- No first real blocker remained

Threads was NOT tested in the successful run.

## 3. Current schedule

The workflow is active and configured for:

- 09:00 IST
- 14:00 IST
- 19:00 IST

Cron used by the workflow: `0 0 9,14,19 * * *`

Do not change this schedule unless the business requirement changes.

## 4. How to use it day-to-day

Normally, the owner does nothing.

Keep the Windows machine logged in and allow the n8n auto-start setup to run. n8n is configured to start automatically through the Windows Startup mechanism, with the project environment loaded by the startup script.

For a normal day:

- Put the next intended source image into the configured Google Drive source folder.
- Do not manually run the workflow unless testing is intentionally required.
- Check n8n execution history if you want to confirm a scheduled run.
- Check Instagram/Facebook only when a published result needs confirmation.

## 5. What the owner should NOT change casually

Do not casually change:

- Meta App ID
- Meta App Secret
- Meta Access Token
- Instagram User ID
- Facebook Page ID
- Gemini API key
- Cloudinary credentials/settings
- Google Drive IDs/tokens
- n8n workflow node connections
- the workflow schedule

A working credential should be reused instead of regenerated.

## 6. Meta token renewal — future procedure

Meta credentials must be treated as expiring credentials, not permanent credentials.

When the token approaches expiry or validation starts reporting an expired token:

1. Open Meta Graph API Explorer.
2. Select the EXACT AME Bazaar Meta App used by this project.
3. IMPORTANT: there are TWO apps with the same display name. The production app used by this project is App ID `1226695792750529`.
4. Never select the same-name App ID `2066840514268683` for this project.
5. Generate a fresh User Access Token with the permissions required by the working workflow.
6. Save ONLY the new token value into the local `.env` as `META_ACCESS_TOKEN`.
7. Never put the token in GitHub or in this documentation.
8. Validate the token's App ID, permissions and expiry before running the workflow.
9. If long-lived exchange is required and the App credentials match, perform the exchange and validate the resulting token.
10. Restart n8n so the new environment is loaded.
11. Run one controlled validation/test only when necessary.

### Critical lesson from the migration

A token can look correct in Graph API Explorer but still belong to the wrong app when two Meta Apps have the same name. Always verify the numeric App ID, not just the app name.

Known mismatch that caused repeated failures during migration:

- Correct production App ID: `1226695792750529`
- Wrong token App ID encountered: `2066840514268683`

The App Secret in the working project belongs to `1226695792750529`. Do not pair it with a token from `2066840514268683`.

## 7. Moving the project to another laptop

The GitHub repository is the source of truth for safe project files:

`Yashu-maheshwari/ame-bazaar-ai-agent`

On a new Windows laptop:

1. Install Node.js and Git.
2. Clone the private repository.
3. Install/run the required n8n version used by the project.
4. Create a local `.env` file from the variable-name list in `MIGRATION.md`.
5. Put the real secret values into the new local `.env` only.
6. Never commit `.env`.
7. Configure the Windows n8n auto-start script using the repository's migration instructions.
8. Import/use `n8n/workflows/social-media-automation.json`.
9. Validate credentials before activating the workflow.
10. Confirm the workflow is Active and the schedule is correct.

The new laptop must never inherit secrets by copying them into GitHub.

## 8. What is saved in GitHub

Safe project information is stored in the repository, including:

- n8n workflow definition
- startup configuration/scripts
- migration instructions
- project documentation
- helper scripts

Secrets are intentionally excluded.

## 9. How to extend the project later

### Add Threads

First inspect whether the Threads nodes are currently active/configured. The successful production run did not test Threads. Add/enable Threads only after its credentials, account ID and publishing API flow are separately validated.

### Replace images with AI-generated videos

Do not redesign the entire workflow. Replace the media-generation portion with a video-generation step while keeping the existing scheduling, caption generation, publishing, duplicate protection and GitHub-safe configuration structure.

The preferred architecture is:

`Source/Input -> Media Generation -> Media Hosting -> Gemini Caption -> Platform Publishing -> Done/History`

The media-generation component should be replaceable without breaking the publishing components.

### Add another social platform

Follow the same pattern:

`Credential -> platform account ID -> content preparation -> platform API -> success verification -> error handling`

Test the new platform independently before enabling it in the scheduled production workflow.

## 10. Safety rule for future AI/Antigravity work

Before changing anything, the AI agent should:

1. Inspect the existing working state.
2. Reuse valid credentials.
3. Identify the FIRST real blocker.
4. Make the smallest possible change.
5. Test only the affected component.
6. Avoid duplicate live posts.
7. Save safe changes to GitHub.
8. Never expose or commit secrets.

Do not repeatedly regenerate credentials or repeatedly run the full workflow just to test one node.

## 11. Quick troubleshooting

### Nothing posts

Check in this order:

1. Is n8n running on `localhost:5678`?
2. Is the workflow Active?
3. Is the Windows auto-start setup running?
4. Is the source image available in the configured Drive source folder?
5. Is the first failed node shown in n8n execution history?

### Instagram says token expired

Do NOT change the workflow. Follow the Meta token renewal procedure above and verify the App ID first.

### Meta says App mismatch

Stop. Check these three values:

- `.env` App ID / expected project App ID: `1226695792750529`
- App ID embedded in the current token
- App ID associated with the App Secret

All three must belong to the same Meta App.

### Gemini rate limit (HTTP 429)

Do not regenerate the Gemini key automatically. First check request frequency and retry/backoff behavior. The project should eventually add explicit rate-limit handling before increasing execution frequency.

## 12. Future improvements

Priority order:

1. Add robust Gemini rate-limit/backoff handling.
2. Add proactive Meta token-expiry detection/alerting.
3. Validate and enable Threads.
4. Improve operational failure notifications.
5. Add a replaceable AI-video media-generation module.
6. Improve migration automation so a new Windows laptop can be configured with fewer manual steps.

## 13. Source of truth

When future work begins, an AI agent should read this file first, then `MIGRATION.md`, then the actual n8n workflow JSON and relevant scripts. Do not rely on old chat history when the repository contains a newer implementation state.
