# Requirements Document

## Introduction

Refactor the event/media architecture to enforce a clean separation between Event Cover Images and Event Media. Currently, cover images are uploaded through the media upload endpoint, creating duplicate Media records that appear in the gallery. The gallery page displays all media globally without event-based organization. This refactor establishes event-based media segregation, a hierarchical gallery navigation (Events → Event Media), and proper cover image handling through a dedicated upload path.

## Glossary

- **Cover_Image_Uploader**: The server-side handler responsible for uploading and storing event cover images directly on the Event model via Cloudflare R2, without creating Media records
- **Media_Upload_Service**: The server-side handler responsible for uploading media files (photos/videos) and creating Media records associated with a specific event
- **Event_Card**: A UI component displaying an event's cover image, title, category, tags, media count, and date in a grid layout
- **Gallery_Page**: The frontend page at `/gallery` that displays event-based media collections
- **Event_Media_Page**: The frontend page at `/events/:eventId` that displays only media belonging to a specific event
- **Media_Collection**: The set of Media records associated with a specific event via the eventId reference
- **Event_Management_Panel**: The admin panel component for creating and editing events, including cover image upload
- **Filter_Bar**: A UI component providing tag-based and category-based filtering controls for event listings

## Requirements

### Requirement 1: Cover Image Upload Separation

**User Story:** As an admin, I want to upload a cover image for an event without it appearing in the media gallery, so that the cover image serves only as the event's visual representation.

#### Acceptance Criteria

1. WHEN an admin uploads a cover image during event creation, THE Event_Management_Panel SHALL use the dedicated `/events/:id/cover` endpoint instead of the `/media/upload/:eventId` endpoint
2. WHEN a cover image is uploaded via the `/events/:id/cover` endpoint, THE Cover_Image_Uploader SHALL store the image URL on the Event model's coverImage field without creating a Media record
3. THE Cover_Image_Uploader SHALL compress the uploaded image to WebP format with a maximum dimension of 2048 pixels before storing it in the `covers/` prefix on Cloudflare R2
4. WHEN a new cover image replaces an existing one, THE Cover_Image_Uploader SHALL delete the previous cover image from Cloudflare R2
5. IF the cover image upload fails due to storage unavailability, THEN THE Cover_Image_Uploader SHALL return a 503 status code with an error message

### Requirement 2: Media Upload Event Association

**User Story:** As an admin or photographer, I want every media upload to require an associated event, so that media is always organized within an event context.

#### Acceptance Criteria

1. THE Media_Upload_Service SHALL require a valid eventId parameter for every media upload request
2. IF a media upload request is submitted without a valid eventId, THEN THE Media_Upload_Service SHALL return a 400 status code with a descriptive error message
3. WHEN media files are uploaded, THE Media_Upload_Service SHALL create Media records with the eventId field referencing the target event
4. IF the referenced eventId does not correspond to an existing event, THEN THE Media_Upload_Service SHALL return a 404 status code with an error message

### Requirement 3: Gallery Page Event-Based Navigation

**User Story:** As a user, I want the gallery page to show event cards instead of a flat media grid, so that I can browse media organized by event.

#### Acceptance Criteria

1. WHEN a user navigates to the Gallery_Page, THE Gallery_Page SHALL display a grid of Event_Cards instead of individual media items
2. THE Gallery_Page SHALL retrieve events from the `/events/public` endpoint with pagination support
3. WHEN a user clicks an Event_Card, THE Gallery_Page SHALL navigate to `/events/:eventId` to display the Event_Media_Page
4. THE Gallery_Page SHALL display Event_Cards sorted by event date in descending order

### Requirement 4: Event Card Display

**User Story:** As a user, I want event cards to show the cover image, title, category, tags, media count, and date, so that I can quickly identify and choose events to browse.

#### Acceptance Criteria

1. THE Event_Card SHALL display the event's cover image as the card background
2. THE Event_Card SHALL display the event title overlaid on the cover image
3. THE Event_Card SHALL display the event category as a badge in the top-left corner
4. THE Event_Card SHALL display event tags as pill-shaped chips below the title area
5. THE Event_Card SHALL display the media count with an icon in the top-right corner
6. THE Event_Card SHALL display the event date in a human-readable format
7. WHEN an event has no cover image, THE Event_Card SHALL display a placeholder background

### Requirement 5: Event Media Page Segregation

**User Story:** As a user, I want to see only media belonging to a specific event when I open that event, so that media from different events is never mixed together.

#### Acceptance Criteria

1. WHEN a user navigates to `/events/:eventId`, THE Event_Media_Page SHALL display only Media records where the eventId matches the route parameter
2. THE Event_Media_Page SHALL retrieve media from the `/events/public/:id` endpoint which filters by eventId
3. THE Event_Media_Page SHALL display the event's cover image as a hero banner at the top of the page
4. THE Event_Media_Page SHALL support pagination for events with large media collections
5. THE Event_Media_Page SHALL display the event title, description, category, and date in the hero section

### Requirement 6: Tag and Category Filtering

**User Story:** As a user, I want to filter events by tags and categories, so that I can find specific types of events quickly.

#### Acceptance Criteria

1. THE Filter_Bar SHALL provide a category dropdown populated with distinct categories from available events
2. THE Filter_Bar SHALL provide a tag filter that displays available tags as selectable chips
3. WHEN a user selects a category filter, THE Gallery_Page SHALL display only Event_Cards matching the selected category
4. WHEN a user selects one or more tag filters, THE Gallery_Page SHALL display only Event_Cards that contain at least one of the selected tags
5. WHEN both category and tag filters are active, THE Gallery_Page SHALL display Event_Cards matching the selected category AND containing at least one selected tag

### Requirement 7: Cover Image Exclusion from Media Collection

**User Story:** As a user, I want the event's cover image to never appear inside the event's media gallery, so that there are no duplicate images.

#### Acceptance Criteria

1. THE Media_Upload_Service SHALL store media files under the `media/` prefix on Cloudflare R2, separate from the `covers/` prefix used by the Cover_Image_Uploader
2. THE Event_Media_Page SHALL query only the Media collection (not the Event coverImage field) when displaying event media
3. WHEN an event is displayed, THE Event_Media_Page SHALL use the Event model's coverImage field exclusively for the hero banner and SHALL NOT include it in the media grid

### Requirement 8: Admin Media Upload with Event Selection

**User Story:** As an admin, I want to select a target event before uploading media, so that uploaded files are correctly associated with the intended event.

#### Acceptance Criteria

1. WHEN the admin opens the media upload modal, THE Event_Management_Panel SHALL display an event selector dropdown populated with available events
2. THE Event_Management_Panel SHALL disable the upload button until an event is selected
3. WHEN the admin selects an event and uploads files, THE Event_Management_Panel SHALL send the upload request to `/media/upload/:eventId` with the selected event's ID
4. WHEN the upload completes, THE Event_Management_Panel SHALL refresh the media list to reflect the newly uploaded items

### Requirement 9: Routing Structure

**User Story:** As a user, I want clear URL-based navigation between the events listing and individual event media pages, so that I can bookmark and share specific event galleries.

#### Acceptance Criteria

1. THE Gallery_Page SHALL be accessible at the `/events` route displaying the event grid
2. THE Event_Media_Page SHALL be accessible at the `/events/:eventId` route displaying event-specific media
3. WHEN a user navigates to `/gallery`, THE application SHALL redirect to `/events` to maintain the event-based navigation pattern
4. THE application SHALL support browser back/forward navigation between the events grid and individual event media pages

### Requirement 10: Data Migration for Existing Cover Images

**User Story:** As an admin, I want existing cover images that were incorrectly stored as Media records to be cleaned up, so that the gallery does not show duplicate cover images.

#### Acceptance Criteria

1. WHEN the migration runs, THE system SHALL identify Media records whose URL matches an Event's coverImage URL
2. WHEN a duplicate Media record is identified, THE system SHALL delete the Media record without deleting the underlying R2 object (since the Event still references it)
3. THE system SHALL log the count of removed duplicate Media records after migration completes
