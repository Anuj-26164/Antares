# Requirements Document

## Introduction

This feature enables users to upload a profile picture that persists across sessions by storing it in Cloudflare R2 object storage. Currently, the ProfilePage allows file selection but only creates a local blob URL that is lost on page refresh. This feature closes that gap by wiring the file upload through a dedicated server endpoint that uploads to R2, stores the resulting public URL in the User document's `avatar` field, and ensures the persisted avatar is displayed consistently across all UI surfaces (profile page, admin top bar, navbar).

## Glossary

- **Upload_Endpoint**: The server-side API route that accepts a multipart file upload for the user's profile picture and returns the persisted R2 URL
- **Avatar_Field**: The existing `avatar` string field on the User MongoDB document that stores the URL of the user's profile picture
- **R2_Storage**: Cloudflare R2 object storage, accessed via the S3-compatible SDK client configured in `server/config/r2.js`
- **Profile_Page**: The client-side page (`ProfilePage.jsx`) where users view and edit their profile information
- **Avatar_Utility**: The `getUserAvatar()` function in `client/src/utils/avatar.js` that returns the user's avatar URL or a generated fallback
- **Auth_Store**: The Zustand store (`authStore.js`) that holds the authenticated user's state and provides `fetchUser()` to refresh it from the server

## Requirements

### Requirement 1: Server-Side Avatar Upload Endpoint

**User Story:** As an authenticated user, I want a dedicated API endpoint that accepts my profile picture file, so that it is stored persistently in cloud storage and my profile is updated automatically.

#### Acceptance Criteria

1. WHEN an authenticated user sends a multipart file upload to the Upload_Endpoint, THE Upload_Endpoint SHALL accept the file, upload it to R2_Storage under a unique key prefixed with `avatars/`, and return the public URL in the response body
2. WHEN the upload to R2_Storage succeeds, THE Upload_Endpoint SHALL update the requesting user's Avatar_Field with the new public URL
3. WHEN the user already has a non-empty Avatar_Field pointing to an R2-hosted avatar, THE Upload_Endpoint SHALL delete the previous avatar object from R2_Storage before storing the new URL
4. IF the uploaded file is not an image (MIME type not in jpeg, png, webp, gif), THEN THE Upload_Endpoint SHALL reject the request with a 400 status and a descriptive error message
5. IF the uploaded file exceeds 5 MB in size, THEN THE Upload_Endpoint SHALL reject the request with a 400 status and a descriptive error message
6. IF the upload to R2_Storage fails, THEN THE Upload_Endpoint SHALL return a 503 status and a descriptive error message without modifying the Avatar_Field

### Requirement 2: Image Processing Before Storage

**User Story:** As a system operator, I want uploaded profile pictures to be compressed and converted to a consistent format, so that storage costs and page load times are minimized.

#### Acceptance Criteria

1. WHEN an image file is accepted by the Upload_Endpoint, THE Upload_Endpoint SHALL compress the image and convert it to WebP format before uploading to R2_Storage
2. WHEN compressing the image, THE Upload_Endpoint SHALL resize images larger than 512×512 pixels to fit within a 512×512 bounding box while preserving aspect ratio
3. THE Upload_Endpoint SHALL store the final avatar with the content type `image/webp` in R2_Storage

### Requirement 3: Client-Side Upload Integration

**User Story:** As a user on the profile page, I want to click my avatar, select a file, and have it uploaded and saved automatically, so that I do not need to manually paste URLs.

#### Acceptance Criteria

1. WHEN a user selects a file via the avatar file input on the Profile_Page, THE Profile_Page SHALL display a local preview of the selected image immediately
2. WHEN the user clicks "Save Changes" with a file selected, THE Profile_Page SHALL send the file to the Upload_Endpoint as a multipart form submission
3. WHEN the Upload_Endpoint returns a successful response, THE Profile_Page SHALL call Auth_Store's `fetchUser()` to refresh the user state with the new avatar URL
4. WHILE the upload is in progress, THE Profile_Page SHALL display a loading indicator on the avatar area and disable the save button
5. IF the Upload_Endpoint returns an error, THEN THE Profile_Page SHALL display the error message to the user and retain the previously selected file for retry

### Requirement 4: Consistent Avatar Display Across UI

**User Story:** As a user, I want my uploaded profile picture to appear everywhere my avatar is shown, so that my identity is visually consistent throughout the application.

#### Acceptance Criteria

1. THE Avatar_Utility SHALL return the user's Avatar_Field URL when it contains a non-empty, valid URL string
2. WHEN the Avatar_Field is empty or absent, THE Avatar_Utility SHALL return a generated fallback avatar based on the user's name
3. THE Admin Top Bar component SHALL display the current user's avatar using the Avatar_Utility
4. THE Profile_Page SHALL display the current user's avatar using the Avatar_Utility when not in edit mode with a preview

### Requirement 5: Avatar Removal

**User Story:** As a user, I want to remove my profile picture and revert to the generated fallback, so that I have control over my displayed identity.

#### Acceptance Criteria

1. WHEN a user triggers avatar removal on the Profile_Page, THE Profile_Page SHALL send a request to update the Avatar_Field to an empty string
2. WHEN the Avatar_Field is set to an empty string and the previous value pointed to an R2-hosted avatar, THE Upload_Endpoint SHALL delete the old avatar object from R2_Storage
3. WHEN the avatar is removed successfully, THE Profile_Page SHALL refresh the user state via Auth_Store and display the generated fallback avatar
