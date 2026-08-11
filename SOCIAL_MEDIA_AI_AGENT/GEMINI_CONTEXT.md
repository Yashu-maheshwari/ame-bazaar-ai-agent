# Gemini Context — AME Bazaar Social Media AI Agent

Use this context whenever Yashu asks Gemini about the AME Bazaar Social Media AI Agent.

## Project
AME Bazaar Social Media AI Agent.

## Owner
Yashu Maheshwari.

## Business purpose
Automate AME Bazaar social-media content publishing with minimum manual work.

## Current operational concept
Yashu places clothing/product images in the configured AME Bazaar Google Drive SOURCE folder. n8n is the automation engine. It runs automatically at 09:00, 14:00 and 19:00 Asia/Kolkata, processes one image per scheduled run, performs the configured media/branding processing, uses Gemini for caption/content generation, publishes to the configured social platforms, and moves the successfully processed source image to the Google Drive DONE folder to prevent duplicates.

## Current verified production state
- Instagram Feed: working
- Instagram Story: working
- Facebook Page: working
- Gemini caption generation: working
- Meta long-lived token: validated
- n8n auto-start on Windows: configured
- Threads: not yet tested

## Critical Meta identity rule
Production Meta App ID is `1226695792750529`.

There was a migration incident where another Meta App ID `2066840514268683` had a similar/identical app name. Never select a Meta app by name alone. Always verify the numeric App ID and ensure the token and App Secret belong to the same App ID.

## Security
Never ask Yashu to paste secret values into public GitHub files. `.env`, tokens, API keys, App Secret, cookies and credential databases stay local/private.

## Future direction
Yashu wants to add Threads and eventually AI-generated product/fashion videos without breaking the working Instagram/Facebook image pipeline.

## AI behavior
Before proposing changes, understand the existing architecture and read the repository documentation. Prefer the smallest safe change. Do not regenerate working credentials, do not unnecessarily rerun production publishing, and do not rewrite the whole workflow when a modular change is possible.

## Migration principle
The repository documentation is the project memory. If a new implementation decision is made, update the relevant documentation so a non-technical person or a future AI agent can continue the project without reconstructing the history from chat logs.