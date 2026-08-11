# AME Bazaar Social Media AI Agent

## Purpose
This is the dedicated documentation area for AME Bazaar's social-media automation engine. It is intentionally written so a non-technical person, a new developer, Antigravity, ChatGPT, or Gemini can understand the project before changing anything.

## Simple business workflow
1. Yashu adds AME Bazaar clothing/product images to the configured Google Drive SOURCE folder.
2. n8n runs automatically on the configured schedule: **09:00, 14:00, 19:00 Asia/Kolkata**.
3. The automation processes **one source image at a time**.
4. The image is processed through Cloudinary and the AME Bazaar branding/logo layer.
5. Gemini generates the social-media caption/content.
6. The configured social publishing nodes publish to Instagram and Facebook. Threads is planned but was not part of the successful production test.
7. After successful processing, the source image is moved to the Google Drive DONE folder so it is not processed again.

## Important clarification
The production run that was verified successfully was Execution 119: Instagram Feed PASS, Instagram Story PASS, Facebook PASS. Threads was NOT TESTED.

If an AI-model-wearing/product-try-on stage is added or already exists in a later workflow revision, it must be documented here and in the workflow map before changing production. Do not assume a new AI generation stage exists merely from the business goal.

## What Yashu has to do
Normally: keep the laptop powered/on and allow n8n to auto-start, and put new source images in the correct Google Drive SOURCE folder. Do not manually execute the n8n workflow for routine posting.

## Golden rule
**One image per scheduled run.** If three new images are available, the automation should process them across separate scheduled runs rather than publishing three images in one run, unless the workflow is deliberately redesigned and documented.

## Production schedule
- 09:00 IST
- 14:00 IST
- 19:00 IST
- Cron: `0 0 9,14,19 * * *`

## Current production validation
- Meta token: PASS
- Long-lived token: PASS
- Instagram Feed: PASS
- Instagram Story: PASS
- Facebook Page: PASS and verified
- Gemini: PASS
- GitHub protection: PASS
- n8n auto-start: PASS
- Threads: NOT TESTED

## Source of truth
Before making changes, read:
1. this file
2. `MIGRATION.md`
3. `SOCIAL_MEDIA_AI_AGENT/TROUBLESHOOTING.md`
4. `SOCIAL_MEDIA_AI_AGENT/FUTURE_ROADMAP.md`
5. the actual n8n workflow at `n8n/workflows/social-media-automation.json`

Never infer credentials or app identity from names alone. Always verify numeric IDs.