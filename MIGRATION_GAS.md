# AME Bazaar Social Media AI Agent — Google Apps Script (GAS) Migration Guide

## 1. Executive Summary & Architectural Overview

We have migrated the AME Bazaar Social Media AI Agent from a multi-node laptop/cloud infrastructure (**Node.js + n8n + Render + Supabase PostgreSQL**) to a **100% serverless, zero-cost Google Apps Script (GAS)** native cloud setup.

### Target Architecture
```
Google Drive (INPUT_FOLDER_ID)
  ↓
GAS Scheduler (Time-driven triggers: 11:00, 14:00, 19:00 IST)
  ↓
LockService (Prevents simultaneous trigger runs)
  ↓
DriveService (Finds unprocessed images)
  ↓
SheetService (Queries Google Sheet `SocialMediaLog` by File ID for duplicate check)
  ↓
Gemini 2.5 Flash API via UrlFetchApp (Generates Hinglish brand caption)
  ↓
CloudinaryService (Generates public HTTPS image URL for Instagram Graph API)
  ↓
Meta Graph API via UrlFetchApp (Publishes to Facebook Page & Instagram Feed)
  ↓
SheetService (Appends execution record with Timestamp, File ID, Status, Post ID, URLs)
  ↓
DriveService (Moves posted image to POSTED_FOLDER_ID on full success)
```

---

## 2. Component Mapping: Old System vs New GAS System

| Old Component | New GAS Replacement | Preserved Functionality | Intentionally Removed / Obsolete Component | Configuration Required |
|---|---|---|---|---|
| **n8n / Render Web Service** | `gas/Code.gs` & `gas/Config.gs` | Scheduled execution, orchestrator logic, test mode | Docker container, Node.js server, Render web service, n8n daemon | `TEST_MODE`, Script Properties |
| **Supabase PostgreSQL / SQL Tables** | Google Sheets (`SocialMediaLog` via `gas/SheetService.gs`) | Execution history, duplicate prevention by `File ID`, status tracking per platform | PostgreSQL connection string (`DATABASE_URL`), `pg` npm module, SQL DDL migrations | `SPREADSHEET_ID` |
| **Node.js Gemini SDK / n8n HTTP node** | `gas/GeminiService.gs` via `UrlFetchApp` | Exact Hinglish AME Bazaar brand prompt, multimodal base64 image parsing, hashtag generation | `@google/generative-ai` npm module, n8n HTTP node | `GEMINI_API_KEY` |
| **Cloudinary n8n Node** | `gas/CloudinaryService.gs` via `UrlFetchApp` | Unsigned image upload to Cloudinary for public HTTPS image URL required by Instagram Graph API | n8n binary transform node | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_UPLOAD_PRESET` |
| **Meta Graph API HTTP Nodes** | `gas/MetaService.gs` via `UrlFetchApp` | Instagram Feed Container & Publish, Facebook Page Photo Publish, retry safety | n8n Facebook/Instagram HTTP nodes | `META_PAGE_ACCESS_TOKEN`, `META_PAGE_ID`, `INSTAGRAM_ACCOUNT_ID` |
| **n8n Cron Schedule (3x daily)** | GAS Time-Driven Triggers (`setupTriggers()`) | Daily scheduling at 11:00, 14:00, 19:00 IST | n8n internal trigger state, local Windows auto-start script | GAS Trigger permissions |

---

## 3. Obsolete / Replaced Components List

The following files and systems are now obsolete in the new GAS architecture and can be safely archived:
- `scripts/orchestrator.js` & `scripts/webhook.js` (Replaced by `gas/Code.gs`)
- `scripts/db.js` & `database/migrations/001_initial_schema.sql` (Replaced by `gas/SheetService.gs`)
- `n8n/workflows/social-media-automation.json` (Replaced by modular `.gs` services)
- `render.yaml` & `Dockerfile` (No longer needed)
- `scripts/start_n8n.ps1` & `n8n_AutoStart.bat` (No local daemon required)

---

## 4. Required Script Properties Configuration

Configure the following parameters in Google Apps Script under **Project Settings > Script Properties**:

| Property Key | Description | Example Value |
|---|---|---|
| `INPUT_FOLDER_ID` | Google Drive folder ID containing new images to post | `1A2b3C4d5E6f7G...` |
| `POSTED_FOLDER_ID` | Google Drive folder ID where posted images are moved | `9Z8y7X6w5V4u3T...` |
| `ERROR_FOLDER_ID` | Google Drive folder ID for failed images (optional) | `3M2N1P0Q...` |
| `SPREADSHEET_ID` | Google Sheet ID for execution log (auto-created if empty) | `1S2p3R4e5A6d7S...` |
| `GEMINI_API_KEY` | Google Gemini API Key | `AIzaSy...` |
| `META_PAGE_ACCESS_TOKEN` | Meta Graph API Page Access Token | `EAAG...` |
| `META_PAGE_ID` | Facebook Page ID | `1234567890` |
| `INSTAGRAM_ACCOUNT_ID` | Instagram Business Account ID | `1784140000000` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary Cloud Name (for Instagram Public Image URL) | `demo` |
| `CLOUDINARY_UPLOAD_PRESET` | Cloudinary Unsigned Upload Preset | `ame_bazaar_preset` |
| `TEST_MODE` | Set `true` for safe testing without real social posts | `true` |

---

## 5. Step-by-Step Google Apps Script Deployment Instructions

1. **Create Apps Script Project**:
   - Open [script.google.com](https://script.google.com) -> Click **New project**.
   - Rename project to: `AME Bazaar Social Media AI Agent`.

2. **Add Code Files**:
   - Create the following files in the editor and paste their respective code from the `gas/` directory:
     - `appsscript.json`
     - `Config.gs`
     - `SheetService.gs`
     - `DriveService.gs`
     - `CloudinaryService.gs`
     - `GeminiService.gs`
     - `MetaService.gs`
     - `Code.gs`
     - `Tests.gs`

3. **Configure Script Properties**:
   - In GAS Editor, click **Project Settings** (gear icon) on the left sidebar.
   - Scroll down to **Script Properties** -> Click **Add script property**.
   - Add all 11 required key-value pairs listed in Section 4 above.

4. **Initialize Configuration & Triggers**:
   - In the top dropdown, select function `setupConfig` -> Click **Run**. Grant required Google permissions.
   - Select function `setupTriggers` -> Click **Run**. This schedules automatic 11:00, 14:00, and 19:00 IST executions daily.

---

## 6. First Test Procedure (Safe Validation)

1. **Upload Test Image**:
   - Upload a test product photo (`test_garment.jpg`) to your Google Drive `INPUT_FOLDER_ID`.
2. **Execute Safe Test Mode**:
   - In GAS Editor, select function `runTest` from the dropdown -> Click **Run**.
3. **Verify Output Logs**:
   - Check the **Execution log** window at the bottom:
     - Confirm Drive image discovery.
     - Confirm Gemini Hinglish caption generation.
     - Confirm `[TEST_MODE]` simulation of Facebook & Instagram Graph API.
4. **Verify Google Sheet**:
   - Open your Google Sheet (`SocialMediaLog`).
   - Confirm a new log row with `Timestamp`, `File ID`, `Caption`, `Status: SUCCESS`, `Execution ID`, and `[TEST_MODE]` indicator.
5. **Switch to Live Mode**:
   - Once testing is verified, update Script Property `TEST_MODE` = `false`.
