# AME Bazaar AI Agent Migration & Production Readiness Guide

This repository contains the production social-media automation engine for AME Bazaar. Follow these instructions to migrate or set up the project on a new machine.

## Prerequisites
- Node.js (v18+)
- Git
- Windows OS (for the automatic startup folder integration)

## Configuration Setup
1. Clone this repository.
2. Create a `.env` file in the root directory with the following variables (values should never be committed to Git):
   - `META_ACCESS_TOKEN`: Long-lived Meta Page Access Token (exchanged from User Token).
   - `META_APP_SECRET`: App Secret of the Meta Developer App.
   - `GEMINI_API_KEY`: Google Gemini API Key.
   - `CLOUDINARY_CLOUD_NAME`: Cloudinary Cloud Name.
   - `CLOUDINARY_UPLOAD_PRESET`: Cloudinary Upload Preset.
   - `CLOUDINARY_LOGO_PUBLIC_ID`: Logo overlay ID.
   - `GOOGLE_DRIVE_CLIENT_ID`: Google Drive Client ID.
   - `GOOGLE_DRIVE_CLIENT_SECRET`: Google Drive Client Secret.
   - `GOOGLE_DRIVE_REFRESH_TOKEN`: Google Drive Refresh Token.
   - `AME_DRIVE_SOURCE_FOLDER_ID`: Source image Google Drive Folder ID.
   - `AME_DRIVE_DONE_FOLDER_ID`: Destination folder ID for processed images.
   - `IG_USER_ID`: Instagram Business Account ID.
   - `FB_PAGE_ID`: Facebook Page ID.
   - `THREADS_USER_ID`: Threads Account ID.
   - `THREADS_ACCESS_TOKEN`: Threads Access Token.
   - `GBP_ACCOUNT_ID`: Google Business Profile Account ID.
   - `GBP_LOCATION_ID`: Google Business Profile Location ID.
   - `GBP_ACCESS_TOKEN`: Google Business Profile Access Token.

## N8N Workflow Path & Schedule
- **Workflow definition file**: `n8n/workflows/social-media-automation.json`
- **Schedule**: Automatically runs 3 times daily at **09:00, 14:00, 19:00 Asia/Kolkata** (Cron: `0 0 9,14,19 * * *`).
- **Duplicate Protection**: Handled automatically; successfully processed images are moved to the Google Drive Done folder at the end of each execution.

## Windows Auto-Start Setup
1. Copy the portable startup script `scripts/start_n8n.ps1` to a permanent location (e.g. `C:\Users\user\.gemini\antigravity\scratch\start_n8n.ps1`).
2. Open the Windows user Startup folder:
   - Press `Win + R`, type `shell:startup`, and press Enter.
3. Create a batch file named `n8n_AutoStart.bat` in this folder with the following contents:
   ```cmd
   @echo off
   start /min powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\path\to\your\start_n8n.ps1"
   ```
4. n8n will now start automatically in the background on port `5678` with the correct environment variables loaded whenever you log into Windows.
