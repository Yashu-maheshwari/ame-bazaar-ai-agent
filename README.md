# AME Bazaar AI Agent Library

Master repository hosting the multi-agent automation framework for AME Bazaar. This library runs on n8n and is deployed on Render.

## Directory Layout

```
├── .github/              # CI/CD Workflows
├── agents/               # Multi-agent directory (social-media, blog, whatsapp, seo, reviews, analytics)
├── assets/               # Image/video assets and media overlays
├── backups/              # Automated database/workflow backups
├── docs/                 # General documentation & setup files
├── knowledge/            # Permanent AI brand guidelines and context
├── memory/               # Execution logs, daily logs, and posted content
├── n8n/                  # Workflows configuration
│   └── workflows/        # JSON exports of n8n workflows
├── prompts/              # System/LLM prompts used by agents
├── scripts/              # Helper shell and node scripts
├── Dockerfile            # n8n base deployment setup
└── render.yaml           # Render blueprint for web service & PostgreSQL DB
```

## First Production Agent: Social Media Automation
- **Location**: `n8n/workflows/social-media-automation.json`
- **Schedule**: 3x daily (09:00, 14:00, 19:00 IST)
- **Features**: Pulls image from Google Drive source folder, uploads to Cloudinary, adds branding overlay, queries Gemini for Hinglish caption, and publishes to Instagram, Facebook Page, Threads, and GBP.

## Local Development & Setup

1. Copy `.env.example` to `.env` and configure credentials.
2. Import the JSON workflow from `n8n/workflows/social-media-automation.json` into your local n8n instance.
3. Configure the active environment variables.
