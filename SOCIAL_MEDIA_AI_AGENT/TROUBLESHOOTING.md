# Troubleshooting Guide

Common issues and remediation procedures for the social media AI agent.

## Rollback Procedure
If the upgraded workflow needs to be rolled back to the stable baseline:
1. Locate the backup file `n8n/workflows/social-media-automation-backup.json`.
2. Import this JSON back into n8n via the UI or by running:
   ```bash
   node scratch/import_workflow_to_db.js
   ```

## Malformed Tokens
- Error: `OAuthException 190 — Malformed access token`.
- Fix: Ensure the token copied from Graph API Explorer belongs to App ID `1226695792750529` and is pasted without trailing quotes, spaces, or backslashes in `.env`.
