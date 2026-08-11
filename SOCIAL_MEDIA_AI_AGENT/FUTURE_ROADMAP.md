# AME Bazaar Social Media AI Agent — Future Roadmap

## Current stable baseline
Instagram Feed + Instagram Story + Facebook Page publishing are working in production test Execution 119.

## Planned next integrations
### Threads
- Validate the correct Threads account and credentials.
- Test the Threads publishing node separately.
- Verify the result before enabling it in the production schedule.
- Never alter the already-working Instagram/Facebook path while adding Threads.

### AI video generation
Goal: allow the media pipeline to evolve from static image posts to AI-generated product/fashion videos.

Preferred architecture:
`Google Drive source -> media preparation -> AI image/video generation -> branding -> Gemini content -> platform publishing -> DONE folder`

The video module should be modular so image publishing remains available as a fallback and existing production nodes are not unnecessarily replaced.

### Smarter content
Future additions may include:
- platform-specific captions
- seasonal campaigns
- product-aware captions
- automated CTA selection
- content calendar logic
- performance tracking
- failure alerts
- token-expiry alerts

## Change policy
Every new platform or media-generation capability must be added as a documented module. Do not rewrite the whole automation when a new module can be added safely.

Before any production change:
1. Read `README.md` and `TROUBLESHOOTING.md`.
2. Inspect the actual n8n workflow.
3. Preserve the working Meta/Instagram/Facebook credentials.
4. Test the new module independently.
5. Only then connect it to the production schedule.