# AME Bazaar AI Agent Migration & Production Readiness Guide

This repository contains the production social-media automation engine for AME Bazaar. Follow these instructions to migrate or set up the project on a new machine.

## Prerequisites
- Node.js (v18+)
- Git
- Windows OS (for the automatic startup folder integration)

## Configuration Setup
1. Clone this repository.
2. Create a `.env` file in the root directory with the required variables.
3. Configure Google Drive with subfolders under the main Source/Done directories:
   - `SOURCE/BOYS/`, `SOURCE/WOMEN/`, `SOURCE/MEN/`
   - `DONE/BOYS/`, `DONE/WOMEN/`, `DONE/MEN/`

## N8N Workflow Path & Schedule
- **Workflow definition file**: `n8n/workflows/social-media-automation.json`
- **Schedule**: Automatically runs 3 times daily at **11:00, 14:00, 19:00 Asia/Kolkata** (Cron: `0 0 11,14,19 * * *`).
- **Startup Recovery / Catch-up**: n8n runs catch-up recovery logic at boot time to publish any missed slots.

## Windows Auto-Start Setup
1. Copy the portable startup script `scripts/start_n8n.ps1` to a permanent location.
2. Open the Windows user Startup folder:
   - Press `Win + R`, type `shell:startup`, and press Enter.
3. Create a batch file named `n8n_AutoStart.bat` in this folder:
   ```cmd
   @echo off
   start /min powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\path\to\your\start_n8n.ps1"
   ```
