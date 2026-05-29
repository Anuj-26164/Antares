# Implementation Plan: Event Media Architecture Refactor

## Overview

Refactor the event/media architecture to enforce clean separation between Event Cover Images and Event Media. Implementation proceeds backend-first (cover endpoint fix, media upload validation, R2 prefix changes), then frontend (admin panel cover upload, gallery page refactor, routing), then migration script, then UI enhancements (tags on cards, filter bar).

## Tasks

- [x] 1. Backend: Media upload validation and R2 prefix changes
  - [x] 1.1 Add event existence validation to media upload controller
    - In `server/controllers/mediaController.js`, add a check at the top of `uploadMedia` that verifies the `eventId` param references an existing Event document
    - Return 404 with `{ success: false, error: "Event not found" }` if the event does not exist
    - Return 400 with `{ success: false, error: "Valid eventId is required" }` if eventId is missing or invalid
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 1.2 Add `media/` prefix to R2 keys in upload middleware
    - In `server/middleware/uploadMiddleware.js`, update the multer-s3 `key` function to prepend `media/` to the generated UUID filename
    - Change from `cb(null, uniqueName)` to `cb(null, 'media/' + uniqueName)`
    - This ensures all media uploads are stored under the `media/` prefix, separate from `covers/`
    - _Requirements: 7.1_

  - [ ]* 1.3 Write property test for media upload event association (Property 4)
    - **Property 4: Media Upload Event Association**
    - Test that valid eventId creates Media with matching eventId, invalid eventId returns 404
    - **Validates: Requirements 2.1, 2.3, 2.4**

  - [ ]* 1.4 Write property test for R2 prefix separation (Property 8)
    - **Property 8: R2 Prefix Separation**
    - Test that media upload keys start with `media/` and cover upload keys start with `covers/`
    - **Validates: Requirements 7.1**

- [x] 2. Checkpoint - Ensure backend changes pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Frontend: Admin panel cover upload fix
  - [x] 3.1 Refactor EventManagementPanel to use dedicated cover endpoint
    - In `client/src/pages/admin/EventManagementPanel.jsx`, replace the cover upload logic in `handleSave`
    - For editing: POST to `/events/${editingEvent._id}/cover` with FormData containing the file under field name `avatar`
    - For creating: create event first (without cover), then POST to `/events/${newEvent._id}/cover` with the cover file, no need to patch coverImage separately
    - Remove the workaround that uploads covers through `/media/upload/:eventId`
    - _Requirements: 1.1, 1.2_

  - [ ]* 3.2 Write unit test for admin panel cover upload endpoint usage
    - Verify that EventManagementPanel calls `/events/:id/cover` instead of `/media/upload/:eventId` for cover images
    - _Requirements: 1.1_

- [x] 4. Frontend: Gallery page refactor and routing
  - [x] 4.1 Refactor GalleryPage to redirect to /events
    - In `client/src/pages/GalleryPage.jsx`, replace the entire component with a redirect to `/events` using `Navigate` from react-router-dom
    - Alternatively, update `client/src/App.jsx` to redirect `/gallery` to `/events`
    - _Requirements: 9.3_

  - [x] 4.2 Update App.jsx routing for /gallery redirect
    - In `client/src/App.jsx`, change the `/gallery` route to render a `<Navigate to="/events" replace />` instead of the current `GalleryPage` component
    - Remove the `ProtectedRoute` wrapper since events page is public
    - Keep the `/events` and `/events/:id` routes as they are
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 4.3 Write unit test for /gallery redirect
    - Verify that navigating to `/gallery` redirects to `/events`
    - _Requirements: 9.3_

- [x] 5. Checkpoint - Ensure frontend routing changes work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Migration script for existing cover image duplicates
  - [x] 6.1 Create migration script to remove duplicate Media records
    - Create `server/scripts/migrateCoverMedia.js`
    - Find all Events with a non-empty `coverImage` field
    - For each event, find Media records whose `url` matches the event's `coverImage`
    - Delete those Media records (do NOT delete the R2 objects since the Event still references them)
    - Log the count of removed duplicate Media records
    - Include MongoDB connection setup and graceful disconnect
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ]* 6.2 Write property test for migration correctness (Property 10)
    - **Property 10: Migration Correctness**
    - Generate events with coverImage URLs and Media records with some URL overlaps
    - Verify migration deletes exactly those Media records whose URL matches an Event's coverImage
    - Verify no R2 object deletion commands are issued
    - **Validates: Requirements 10.1, 10.2**

- [x] 7. Frontend: EventAlbumCard tags display
  - [x] 7.1 Add tags display to EventAlbumCard component
    - In `client/src/components/events/EventAlbumCard.jsx`, add a tags section below the title overlay
    - Render `event.tags` as pill-shaped chips (small rounded badges)
    - Style with semi-transparent background, small text, and truncate if too many tags
    - Show max 3-4 tags with a "+N more" indicator if there are more
    - _Requirements: 4.4_

  - [ ]* 7.2 Write unit test for EventAlbumCard tags rendering
    - Verify tags are rendered as pill chips when event has tags
    - Verify no tags section when event has no tags
    - _Requirements: 4.4_

- [x] 8. Frontend: FilterBar component for events page
  - [x] 8.1 Create FilterBar component
    - Create `client/src/components/events/FilterBar.jsx`
    - Accept props: `events`, `selectedCategory`, `selectedTags`, `onCategoryChange`, `onTagsChange`
    - Extract distinct categories from events for a dropdown
    - Extract distinct tags from all events for selectable chip buttons
    - Render category dropdown with "All categories" default option
    - Render tag chips that toggle selection on click
    - Style consistently with existing UI (rounded-[14px], bg-snow/bg-ink, border-fog/border-graphite)
    - _Requirements: 6.1, 6.2_

  - [x] 8.2 Integrate FilterBar into EventsPage with client-side filtering
    - In `client/src/pages/EventsPage.jsx`, import and render FilterBar above the events grid
    - Add state for `selectedCategory` and `selectedTags`
    - Filter the events list client-side: match category (if selected) AND match at least one tag (if tags selected)
    - Pass filtered events to the grid rendering
    - _Requirements: 6.3, 6.4, 6.5_

  - [ ]* 8.3 Write property test for filter extraction completeness (Property 6)
    - **Property 6: Filter Extraction Completeness**
    - Generate events with random categories and tags
    - Verify extracted categories equal distinct non-empty categories from events
    - Verify extracted tags equal distinct tags across all events
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 8.4 Write property test for filter application correctness (Property 7)
    - **Property 7: Filter Application Correctness**
    - Generate events with random categories/tags and filter selections
    - Verify filtered results match: category matches (if selected) AND at least one tag matches (if tags selected)
    - **Validates: Requirements 6.3, 6.4, 6.5**

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The `/events/:id/cover` endpoint already exists in `eventRoutes.js` and `eventController.js` — no backend endpoint creation needed
- The cover upload middleware reuses `uploadAvatar` (multer memory storage, field name `avatar`)
- The `Event` model already has a `tags` field — no schema changes needed
- Property tests use fast-check with Vitest as the test runner
- Checkpoints ensure incremental validation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "3.1"] },
    { "id": 2, "tasks": ["3.2", "4.1", "4.2"] },
    { "id": 3, "tasks": ["4.3", "6.1"] },
    { "id": 4, "tasks": ["6.2", "7.1"] },
    { "id": 5, "tasks": ["7.2", "8.1"] },
    { "id": 6, "tasks": ["8.2"] },
    { "id": 7, "tasks": ["8.3", "8.4"] }
  ]
}
```
