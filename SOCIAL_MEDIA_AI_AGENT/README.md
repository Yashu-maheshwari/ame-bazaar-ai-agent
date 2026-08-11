# AME Bazaar Social Media AI Agent

This directory houses the documentation and architecture for the automated social media agent.

## Folder Structure
Google Drive contains the following structure under the main Source/Done directories:
- `SOURCE/`
  - `BOYS/`: Contains pending fashion/retail images for the boys section.
  - `WOMEN/`: Contains pending fashion/retail images for women.
  - `MEN/`: Contains pending fashion/retail images for men.
- `DONE/`
  - `BOYS/`: Processed images from the boys section.
  - `WOMEN/`: Processed images from the women section.
  - `MEN/`: Processed images from the men section.

## Queue & Schedule
- **Schedule slots**: `11:00`, `14:00`, and `19:00` IST.
- **Content Selection**: Shuffled/varied category selection from pending images. n8n plans slot assignments at startup for the day.
- **One Image Per Slot**: Exactly one post is published per slot.
- **Startup catch-up behavior**: If the laptop is offline during a slot, n8n immediately performs a safe sequential catch-up when it starts up.
