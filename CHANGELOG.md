# Changelog

All notable changes to the AME Bazaar AI Agent project will be documented in this file.

## [1.2.0] - 2026-07-31
### Added
- Configured local `.env` with the new valid `GOOGLE_DRIVE_REFRESH_TOKEN` provided by the user.
- Verified successful Google OAuth refresh flow via token exchange endpoint returning a fresh access token.
- Tested workflow execution with the new refresh token node, successfully authenticating Google credentials and requesting folder listing.

## [1.1.0] - 2026-07-30
### Added
- Implemented automatic Google OAuth access token refresh node (`Google - Refresh Token`) inside the n8n social media workflow.
- Replaced manually managed `GOOGLE_DRIVE_ACCESS_TOKEN` with automatic environment-driven refresh via `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, and `GOOGLE_DRIVE_REFRESH_TOKEN`.
- Mapped all Google Drive nodes to dynamically query the refreshed access token from the new refresh node.
- Updated `.env.example` template to reflect Google OAuth refresh parameters.

## [1.0.0] - 2026-07-30
### Added
- Reorganized repository structure to support multiple sub-agents under `/agents/`.
- Integrated `knowledge/` folder with templates for brand guidelines and strategy.
- Integrated `memory/` folder for agent logs and execution history.
- Imported production-ready `social-media-automation` workflow in `/n8n/workflows/`.
- Added standard `.env.example` and `.gitignore`.
- Preserved Render blueprints and Dockerfile setups.
