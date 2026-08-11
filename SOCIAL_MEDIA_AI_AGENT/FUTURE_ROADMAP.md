# Future Roadmap

Planned enhancements and extension points for the AME Bazaar AI Agent.

## Threads Integration Extension Point
- **Target node**: `Threads - Create Container` & `Threads - Publish`.
- **Status**: Configured in workflow JSON, but currently bypassed.
- **Action**: Once user authentication/token is verified, enable the nodes.

## AI Video Generation
- **Strategy**: Integrate a video generation API (e.g. Runway, Luma, or Sora API) to create short promotional video clips dynamically from static fashion images.
- **n8n integration**: Insert the video generator node between image preparation and Instagram publishing.
