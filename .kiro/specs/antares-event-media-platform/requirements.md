# Requirements Document

## Introduction

Antares is a full-stack web platform for clubs and societies to upload, organize, and interact with event media (photos and videos). Phase 1 delivers a polished landing page, authentication system, event and media management with cloud storage, and a role-based access control layer. The platform uses React with Tailwind CSS v4 on the frontend, Node.js/Express on the backend, MongoDB for persistence, and Cloudflare R2 for media storage.

## Glossary

- **Platform**: The Antares web application comprising frontend client and backend API server
- **Landing_Page**: The public-facing marketing page with animated sections and call-to-action elements
- **Auth_System**: The authentication and authorization subsystem handling user identity and session management
- **Media_Service**: The backend service responsible for uploading, compressing, storing, and serving media files
- **Event_Service**: The backend service responsible for creating, updating, and managing events
- **Gallery_View**: The frontend component displaying media in a masonry or grid layout with infinite scroll
- **Upload_Handler**: The backend middleware pipeline handling file reception, validation, compression, and R2 storage
- **Role_Guard**: The middleware enforcing role-based access control on protected routes
- **Design_System**: The set of visual tokens (colors, radii, typography, spacing) governing all UI elements
- **R2_Storage**: Cloudflare R2 object storage used for persisting media files
- **JWT_Token**: JSON Web Token used for stateless authentication (access token 15min, refresh token 7days)
- **Watermark_Service**: The Sharp-based service that applies dynamic watermarks to downloaded media

## Requirements

### Requirement 1: Landing Page Structure

**User Story:** As a visitor, I want to see a polished, animated marketing page, so that I understand the platform's value and can sign up.

#### Acceptance Criteria

1. THE Landing_Page SHALL render an Announcement Banner with full-width layout, #222222 background, and 48px border-radius
2. THE Landing_Page SHALL render a sticky Navbar at 56px height with backdrop-filter blur(10px), containing a wordmark, navigation links, and authentication buttons (Sign In and Sign Up)
3. THE Landing_Page SHALL render a Hero Section in a 2-column layout with a 56-64px display headline, a cycling accent word that rotates every 2.5 seconds, and an email call-to-action input with a maximum length of 254 characters
4. THE Landing_Page SHALL render a Stats Ticker using CSS @keyframes translateX with linear timing and 25-second infinite loop
5. THE Landing_Page SHALL render a Features Section as a 3-column grid of Snow-colored (#ffffff) cards with 36px border-radius displaying at least 6 feature cards
6. THE Landing_Page SHALL render a Dark Problem Panel with Obsidian (#09090b) background, 36px border-radius, and slide-in row animations
7. THE Landing_Page SHALL render a Stats Section with numerals at 40-56px font-size and Steel (#71717a) colored labels
8. THE Landing_Page SHALL render a CTA Footer Band as an Obsidian (#09090b) panel containing a pill-shaped button with 36px border-radius
9. THE Landing_Page SHALL render all sections in top-to-bottom order: Announcement Banner, Navbar, Hero Section, Stats Ticker, Features Section, Dark Problem Panel, Stats Section, CTA Footer Band
10. WHEN a visitor submits an email address in the Hero Section call-to-action input, THE Landing_Page SHALL navigate the visitor to the registration page with the email address pre-filled
11. THE Landing_Page SHALL render all sections within a 1200px max-width centered container with 80px vertical spacing between sections

### Requirement 2: Design System Compliance

**User Story:** As a designer, I want all UI elements to follow the defined design tokens, so that the platform maintains visual consistency.

#### Acceptance Criteria

1. THE Platform SHALL use DM Sans or Plus Jakarta Sans as the sole typeface applied to every rendered element with weight range 300-700, with a sans-serif system font as the fallback if the primary typeface fails to load
2. THE Platform SHALL register all color tokens (Obsidian #09090b, Ink #18181b, Graphite #3f3f46, Steel #71717a, Ash #a1a1aa, Fog #ececee, Mist #f4f4f5, Snow #ffffff, Ember #ff5a00, Orchid Flash #fe45e2) in a Tailwind v4 @theme {} block inside the global CSS file
3. THE Platform SHALL apply border-radius values of 48px for hero elements, 36px for primary cards, 28px for compact cards, 36px for pill buttons, 16px for rounded-rect buttons, 12px for badges, and 14px for inputs
4. THE Platform SHALL restrict filled button background colors to #09090b or #222222 for default and hover states, and SHALL apply reduced opacity (0.5) for the disabled state while preserving the same background color
5. THE Platform SHALL constrain all animations (both CSS transitions and Framer Motion driven) to transform, opacity, and filter properties only
6. THE Platform SHALL center content within a 1200px max-width container with 80px vertical section gaps and 24px card padding on screens at or above 1200px viewport width
7. WHEN the viewport width is below 1200px, THE Platform SHALL scale the container to 100% width with 16px horizontal padding, reduce vertical section gaps to 48px, and maintain 24px card padding

### Requirement 3: Animation System

**User Story:** As a visitor, I want smooth, performant animations throughout the interface, so that the experience feels polished and responsive.

#### Acceptance Criteria

1. THE Platform SHALL animate Hero Section elements with a fade-up entrance (opacity 0 to 1, translateY 24px to 0) over 0.6 seconds with easeOut easing using Framer Motion
2. THE Platform SHALL animate Hero child elements with staggered delays of 0.15 seconds between each child using Framer Motion staggerChildren
3. THE Platform SHALL cycle the Hero accent word every 2.5 seconds using AnimatePresence with a 0.4-second crossfade transition on opacity
4. THE Platform SHALL reveal Feature cards on scroll using Framer Motion with IntersectionObserver triggering at 0.2 threshold, animating opacity 0 to 1 and translateY 20px to 0 with 0.08-second stagger per card
5. THE Platform SHALL animate the Navbar backdrop-filter from blur(0) to blur(12px) when scroll position exceeds 50px, transitioning over 0.3 seconds
6. THE Platform SHALL animate Dark Problem Panel rows with a slide-in effect (translateX -20px to 0, opacity 0 to 1) staggered by 0.1 seconds per row on scroll intersection
7. THE Platform SHALL scale buttons to 1.02 on hover using transform property with 0.2-second ease transition
8. THE Platform SHALL apply page transition animations using Framer Motion AnimatePresence with opacity 0 to 1 and translateY 10px to 0 over 0.3 seconds

### Requirement 4: Email and Password Authentication

**User Story:** As a user, I want to register and log in with email and password, so that I can access the platform without a third-party account.

#### Acceptance Criteria

1. WHEN a user submits a registration form with a valid email format and a password between 8 and 128 characters, THE Auth_System SHALL hash the password using bcrypt with saltRounds of 12, store the user record in MongoDB, and return the created user profile with a 201 status
2. WHEN a user submits valid login credentials (matching email and correct password), THE Auth_System SHALL issue a JWT access token with 15-minute expiry and a refresh token with 7-day expiry stored in httpOnly cookies
3. IF a user submits an invalid email format or a password shorter than 8 characters or longer than 128 characters during registration or login, THEN THE Auth_System SHALL reject the request with a 400 status and a validation error message indicating which field failed validation
4. WHEN an access token expires and a valid refresh token is present, THE Auth_System SHALL issue a new access token without requiring re-authentication
5. IF a refresh token is invalid or expired, THEN THE Auth_System SHALL clear authentication cookies and return a 401 status requiring re-login
6. WHEN a user requests logout, THE Auth_System SHALL invalidate the refresh token and clear all authentication cookies
7. IF a user submits a registration request with an email that already exists in the system, THEN THE Auth_System SHALL reject the request with a 409 status and an error message indicating the email is already registered
8. IF a user submits login credentials with an email that does not exist or a password that does not match, THEN THE Auth_System SHALL reject the request with a 401 status and a generic error message that does not reveal whether the email or password was incorrect

### Requirement 5: Google OAuth 2.0 Authentication

**User Story:** As a user, I want to sign in with my Google account, so that I can access the platform quickly without creating a new password.

#### Acceptance Criteria

1. WHEN a user initiates Google sign-in, THE Auth_System SHALL redirect to Google OAuth 2.0 consent screen using passport-google-oauth20 strategy requesting profile and email scopes
2. WHEN Google returns a successful authorization callback with a verified email, THE Auth_System SHALL create or update the user record with Google profile data (name, email, avatar, googleId), issue a JWT access token with 15-minute expiry and a refresh token with 7-day expiry stored in httpOnly cookies, and redirect the user to the client application URL
3. IF Google OAuth callback returns an error, THEN THE Auth_System SHALL redirect the user to the login page with an error message indicating that Google authentication failed
4. WHEN a user with an existing email-based account signs in via Google using the same verified email, THE Auth_System SHALL store the googleId on the existing user record while preserving the existing password and profile data
5. IF Google returns a profile with an unverified email address, THEN THE Auth_System SHALL reject the authentication and redirect the user to the login page with an error message indicating that a verified email is required

### Requirement 6: Role-Based Access Control

**User Story:** As an administrator, I want to control what actions each user role can perform, so that the platform remains secure and organized.

#### Acceptance Criteria

1. THE Auth_System SHALL assign one of four roles to each user: admin, photographer, club_member, or viewer, with a default role of viewer upon registration, following the permission hierarchy admin > photographer > club_member > viewer
2. WHEN an unauthenticated request reaches a protected route, THE Role_Guard SHALL reject the request with a 401 status and a JSON error response indicating authentication is required
3. WHEN an authenticated user requests a resource requiring a role higher than their assigned role in the hierarchy (admin > photographer > club_member > viewer), THE Role_Guard SHALL reject the request with a 403 status and a JSON error response indicating insufficient permissions
4. THE Role_Guard SHALL allow admin users to access all routes and perform all operations including user role management
5. THE Role_Guard SHALL allow photographer users to upload media, edit metadata of their own uploads, delete their own uploads, and view all public media
6. THE Role_Guard SHALL allow club_member users to view public event media, view private event media for events they are permitted to access, favourite items, and post comments
7. THE Role_Guard SHALL allow viewer users to view public media only without ability to favourite, comment, or upload
8. WHEN an admin submits a role change request for a user, THE Auth_System SHALL update the target user's role to the specified valid role and return the updated user record

### Requirement 7: Data Models

**User Story:** As a developer, I want well-defined MongoDB schemas, so that data integrity is maintained across the platform.

#### Acceptance Criteria

1. THE Platform SHALL define a User model with fields: name (String, required, max 100 characters), email (String, required, unique, max 254 characters, validated against standard email format), password (String, max 128 characters), googleId (String, max 255 characters), role (String, enum ["admin","photographer","club_member","viewer"], default "viewer"), avatar (String, max 2048 characters), refreshToken (String), and createdAt (Date, default now)
2. THE Platform SHALL define an Event model with fields: title (String, required, max 150 characters), description (String, max 2000 characters), category (String, max 50 characters), date (Date), createdBy (ObjectId ref User, required), isPublic (Boolean, default true), coverImage (String, max 2048 characters), tags (Array of String, max 20 items, each max 50 characters), and createdAt (Date, default now)
3. THE Platform SHALL define a Media model with fields: eventId (ObjectId ref Event, required), uploadedBy (ObjectId ref User, required), url (String, required, max 2048 characters), r2Key (String, required, max 512 characters), type (String, enum ["photo","video"], required), tags (Array of String, max 30 items, each max 50 characters), likes (Number, default 0, min 0), comments (Array of ObjectId ref Comment), favouritedBy (Array of ObjectId ref User), isPublic (Boolean, default true), and createdAt (Date, default now)
4. THE Platform SHALL define a Comment model with fields: mediaId (ObjectId ref Media, required), userId (ObjectId ref User, required), text (String, required, max 1000 characters, min 1 character), and createdAt (Date, default now)
5. WHEN a User document is deleted, THE Platform SHALL remove all Comment documents referencing that user and remove the user's ObjectId from all favouritedBy arrays in Media documents
6. WHEN an Event document is deleted, THE Platform SHALL remove all Media documents referencing that event and all Comment documents referencing those media items
7. WHEN a Media document is deleted, THE Platform SHALL remove all Comment documents referencing that media item

### Requirement 8: Event Management API

**User Story:** As a club administrator, I want to create and manage events, so that media can be organized by occasion.

#### Acceptance Criteria

1. WHEN an admin or photographer submits an event creation request with all required fields (title, createdBy), THE Event_Service SHALL create the event record, set createdBy to the authenticated user, and return the created record with a 201 status
2. WHEN a user requests the event list, THE Event_Service SHALL return all public events and any private events where the user is the creator or has admin role, paginated with a default page size of 20 and a maximum page size of 100
3. WHEN an admin or the event creator submits an update request with valid field values, THE Event_Service SHALL update only the mutable event fields (title, description, category, date, isPublic, coverImage, tags) and return the updated record
4. WHEN an admin or the event creator submits a delete request for an existing event, THE Event_Service SHALL remove the event record, all associated media records, and their corresponding files from R2_Storage
5. IF a required field is missing or invalid in an event creation request, THEN THE Event_Service SHALL reject the request with a 400 status and a response indicating which fields failed validation
6. IF an update or delete request targets an event ID that does not exist, THEN THE Event_Service SHALL return a 404 status with an error message indicating the event was not found
7. IF a non-admin user who is not the event creator submits an update or delete request, THEN THE Event_Service SHALL reject the request with a 403 status

### Requirement 9: Media Upload and Storage

**User Story:** As a photographer, I want to upload photos and videos to events, so that club members can view and interact with event media.

#### Acceptance Criteria

1. WHEN a photographer uploads a single file, THE Upload_Handler SHALL stream the file through multer and multer-s3 to Cloudflare R2 storage
2. WHEN a photographer uploads multiple files, THE Upload_Handler SHALL accept up to 50 files in a single bulk upload request with a maximum total request size of 500 MB
3. WHEN an image file is received, THE Upload_Handler SHALL compress it using Sharp to a maximum dimension of 2048px and convert to WebP format before storing
4. WHEN a video file is received, THE Upload_Handler SHALL store the file in its original format without re-encoding
5. WHEN upload completes successfully, THE Media_Service SHALL create a Media record with the R2 key, public URL, file type, and association to the event and uploader
6. IF a file exceeds 25 MB for images or 500 MB for videos, THEN THE Upload_Handler SHALL reject the file with a 400 status and an error message indicating the size limit exceeded
7. IF a file format is not one of the supported types (JPEG, PNG, WebP, GIF for images; MP4, MOV, WebM for videos), THEN THE Upload_Handler SHALL reject the file with a 400 status and an error message indicating the unsupported format
8. IF one or more files in a bulk upload are rejected due to size or format violations, THEN THE Upload_Handler SHALL process all valid files and return a response listing both successfully uploaded files and individually rejected files with their rejection reasons
9. THE Media_Service SHALL configure CORS on the R2 bucket to allow requests from the client origin

### Requirement 10: Media Access and Delivery

**User Story:** As a club member, I want to view and download event media, so that I can access photos and videos from events I attended.

#### Acceptance Criteria

1. WHEN a user requests public media, THE Media_Service SHALL return the public R2 URL for direct access
2. WHEN a user requests private media, IF the user has admin, photographer, or club_member role, THEN THE Media_Service SHALL generate a signed URL with a 15-minute expiration using @aws-sdk/s3-request-presigner
3. WHEN a user requests to download a media file, THE Media_Service SHALL generate a signed download URL with a 15-minute expiration and a watermark applied via Sharp containing the requesting user's name and the current date
4. IF a user with viewer role or an unauthenticated user requests private media, THEN THE Media_Service SHALL return a 403 status with an error message indicating insufficient permissions
5. IF the requested media record does not exist, THEN THE Media_Service SHALL return a 404 status with an error message indicating the media was not found
6. IF signed URL generation fails due to R2 unavailability, THEN THE Media_Service SHALL return a 503 status with an error message indicating temporary unavailability

### Requirement 11: Gallery and Media Browsing

**User Story:** As a user, I want to browse event media in an attractive gallery layout, so that I can easily find and view photos and videos.

#### Acceptance Criteria

1. THE Gallery_View SHALL display media items in a responsive grid layout with a default page size of 20 items per loaded set
2. WHEN a user scrolls to the bottom of the current media set, THE Gallery_View SHALL load the next 20 media items and append them to the existing display
3. WHEN a user selects a sort option, THE Gallery_View SHALL re-order media items by event date (ascending or descending), upload date (most recent first), or like count (highest first), with upload date descending as the default sort
4. WHEN a user selects an event filter, THE Gallery_View SHALL display only media belonging to the selected event
5. IF the current filter or search yields no media items, THEN THE Gallery_View SHALL display an empty-state message indicating no results were found
6. IF a photographer or admin user is viewing the Gallery_View, THEN THE Gallery_View SHALL render a drag-and-drop upload zone using react-dropzone with file preview thumbnails of maximum 120px width
7. IF a media fetch request fails, THEN THE Gallery_View SHALL display an error message indicating the failure and provide a retry action

### Requirement 12: Media Interactions

**User Story:** As a club member, I want to favourite, comment on, and interact with media, so that I can engage with event content.

#### Acceptance Criteria

1. WHEN a club_member or higher role toggles the favourite action on a media item, THE Media_Service SHALL add or remove the user from the media's favouritedBy array and return the updated favourite state to the client
2. WHEN a user views their profile, THE Platform SHALL display media items the user has favourited in reverse-chronological order, paginated with a maximum of 20 items per page
3. WHEN a club_member or higher role submits a comment on a media item with text between 1 and 1000 characters, THE Media_Service SHALL create a Comment record and associate it with the media
4. WHEN a photographer requests to delete their own upload, THE Media_Service SHALL remove the media record, delete all associated Comment records, and delete the file from R2 storage
5. WHEN an admin requests to delete any media item, THE Media_Service SHALL remove the media record, delete all associated Comment records, and delete the file from R2 storage
6. IF a club_member or higher role submits a comment with empty text or text exceeding 1000 characters, THEN THE Media_Service SHALL reject the request with a 400 status and a validation error indicating the text length constraint
7. IF a user attempts to favourite, comment on, or delete a media item that does not exist, THEN THE Media_Service SHALL return a 404 status with an error message indicating the media was not found
8. IF R2 storage deletion fails during a media delete operation, THEN THE Media_Service SHALL retain the media record unchanged and return a 500 status with an error message indicating the deletion could not be completed

### Requirement 13: REST API Structure

**User Story:** As a frontend developer, I want a well-structured REST API, so that I can integrate all platform features reliably.

#### Acceptance Criteria

1. THE Platform SHALL expose authentication endpoints at /api/auth for register, login, logout, refresh, and Google OAuth flows
2. THE Platform SHALL expose event endpoints at /api/events for full CRUD operations with role-based access
3. THE Platform SHALL expose media endpoints at /api/media for upload, retrieval, deletion, favouriting, and commenting
4. THE Platform SHALL expose user endpoints at /api/users for profile retrieval and update operations
5. WHEN any API request fails validation, THE Platform SHALL return a JSON error response containing a "success" field set to false, an "error" field with a human-readable message indicating the failure reason, and the corresponding HTTP status code (400 for malformed input, 401 for missing or invalid authentication, 403 for insufficient permissions, 404 for resource not found, 500 for unexpected server errors)
6. THE Platform SHALL apply authMiddleware to all routes under /api/events, /api/media, and /api/users, and SHALL apply roleMiddleware to routes that require admin or photographer roles as defined in the role-based access control requirement
7. WHEN any API request succeeds, THE Platform SHALL return a JSON response containing a "success" field set to true and a "data" field containing the requested resource or confirmation of the completed operation, with HTTP status code 200 for retrievals and updates, or 201 for resource creation

### Requirement 14: Environment and Configuration

**User Story:** As a developer, I want all sensitive configuration externalized to environment variables, so that secrets are never committed to source control.

#### Acceptance Criteria

1. THE Platform SHALL read all sensitive values (PORT, MONGO_URI, JWT_SECRET, JWT_REFRESH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, CLIENT_URL, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL) from environment variables
2. IF any required environment variable is missing at startup, THEN THE Platform SHALL log an error message identifying each missing variable by name and terminate the process with a non-zero exit code before establishing any database or external service connections
3. THE Platform SHALL include a .env.example file listing every required environment variable name with a placeholder or empty value, and no actual secrets
4. THE Platform SHALL include .env in the .gitignore file to prevent secret files from being committed to source control

### Requirement 15: Technology Constraints

**User Story:** As a developer, I want clear technology boundaries enforced, so that the codebase remains consistent and maintainable.

#### Acceptance Criteria

1. THE Platform SHALL use JavaScript exclusively with .js and .jsx file extensions and zero TypeScript files (.ts, .tsx) present in the source directories
2. THE Platform SHALL use React with JSX for all frontend UI components, with non-UI utility modules permitted as plain .js files
3. THE Platform SHALL use Tailwind CSS v4 utility classes and @theme {} token blocks as the sole styling mechanism, with no CSS modules, styled-components, or CSS-in-JS libraries permitted, and inline styles permitted only for dynamically computed values that cannot be expressed as Tailwind utilities
4. THE Platform SHALL use Node.js with Express.js for the backend server
5. THE Platform SHALL use MongoDB with Mongoose for all database operations
6. THE Platform SHALL use Zustand for all shared and global frontend state management, with React built-in hooks (useState, useReducer) permitted for component-local state only
7. THE Platform SHALL use Framer Motion for all JavaScript-driven animations, with CSS @keyframes permitted only for continuous looping animations that require no runtime logic
8. WHEN a source file is added or modified, THE Platform SHALL pass a lint check that verifies zero TypeScript files exist, no disallowed styling libraries are imported, and no state management libraries other than Zustand are imported for shared state
