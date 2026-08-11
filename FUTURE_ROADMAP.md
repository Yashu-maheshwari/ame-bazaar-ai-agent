# AME Bazaar AI Agent — Future Roadmap

## Current baseline

The production baseline is the successful n8n Execution ID 119.

Verified platform publishing:

- Instagram Feed
- Instagram Story
- Facebook Page

Threads was not tested in that execution.

## Phase 1 — Production hardening

1. Add Gemini HTTP 429 retry/backoff.
2. Add proactive Meta token-expiry validation before scheduled publishing.
3. Add a clear failure notification path for the owner.
4. Verify that duplicate protection remains intact after every workflow change.
5. Keep GitHub migration documentation updated after structural changes.

## Phase 2 — Threads

Goal: connect Threads without disturbing Instagram/Facebook.

Recommended approach:

1. Audit existing Threads credentials and account ID.
2. Validate the Threads token independently.
3. Confirm the Threads publishing API flow.
4. Add/enable the Threads node.
5. Test Threads with a controlled test item.
6. Verify the result through the API.
7. Only then enable Threads in the scheduled production path.

Never regenerate working Meta/Instagram credentials just because Threads is being added.

## Phase 3 — AI video content

Goal: replace or supplement static poster generation with AI-generated video.

Keep the architecture modular:

`Input image/product -> Media generation -> Cloud media URL -> Gemini caption -> Platform publishing -> Done/History`

The existing publishing layer should remain reusable.

When adding video:

1. Add a dedicated video-generation module.
2. Store the resulting video in a publicly reachable media host if required by the destination APIs.
3. Validate MIME type, file size, duration and aspect ratio before publishing.
4. Add platform-specific video publishing only after the media asset is validated.
5. Keep the existing static-image path available as a fallback.

## Phase 4 — Smarter content engine

Possible future additions:

- product/category-aware captions
- seasonal content planning
- platform-specific caption variants
- automatic CTA selection
- content calendar
- performance logging
- AI-assisted post selection
- post-performance feedback loop

## Phase 5 — Reliability and observability

Add:

- one central execution log
- failure alerts
- token-expiry alerts
- rate-limit alerts
- per-platform success/failure status
- daily execution summary

## Change-management rule

Every future enhancement should follow:

`Inspect -> smallest change -> targeted test -> production verification -> GitHub commit/push -> update documentation`

Do not modify the working production workflow wholesale for a new feature.
