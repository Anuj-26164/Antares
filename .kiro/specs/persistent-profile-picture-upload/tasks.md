# Implementation Plan: Persistent Profile Picture Upload

## Overview

This plan implements a full avatar upload pipeline: a new `compressAvatar` function in the image processor, a multer-based upload middleware, a controller that orchestrates processing → R2 upload → DB update → old avatar cleanup, a new route, modifications to the existing profile update handler for avatar removal, and client-side wiring in ProfilePage.jsx. Tasks are ordered by dependency (server utilities → middleware → controller → route → client).

## Tasks

- [x] 1. Create the `compressAvatar` function in the image processor
  - [x] 1.1 Add `compressAvatar(buffer)` to `server/utils/imageProcessor.js`
    - Resize to fit within 512×512 bounding box (preserve aspect ratio, no enlargement)
    - Convert to WebP at quality 80
    - Export alongside existing `compressImage` and `applyWatermark`
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 1.2 Write property test for `compressAvatar` output constraints
    - **Property 3: Image processing output constraints**
    - Generate random image buffers with varying dimensions, verify output fits within 512×512 and aspect ratio is preserved (±1px tolerance)
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 2. Create the upload middleware
  - [x] 2.1 Create `server/middleware/uploadMiddleware.js`
    - Configure multer with memory storage (no disk writes)
    - Add file filter that accepts only `image/jpeg`, `image/png`, `image/webp`, `image/gif`
    - Set file size limit to 5 MB
    - Export `uploadAvatar` middleware (single file, field name `avatar`)
    - Return 400 with descriptive error for invalid MIME type or oversized file
    - _Requirements: 1.4, 1.5_

  - [ ]* 2.2 Write property test for MIME type rejection
    - **Property 4: Invalid MIME type rejection**
    - Generate random non-image MIME types, verify middleware rejects with 400
    - **Validates: Requirements 1.4**

- [x] 3. Add the `uploadAvatar` controller function
  - [x] 3.1 Add `uploadAvatar` handler to `server/controllers/userController.js`
    - Add helper functions: `isR2Avatar(url)` and `extractR2Key(url)` using `config.R2_PUBLIC_URL`
    - Accept `req.file` from multer middleware
    - Call `compressAvatar(req.file.buffer)` to get WebP buffer
    - Generate unique R2 key: `avatars/{uuid}.webp`
    - Upload compressed buffer to R2 via PutObjectCommand
    - Update `user.avatar` with the public URL
    - Delete old R2 avatar object if `isR2Avatar(oldAvatar)` is true (non-blocking, log failures)
    - Return 201 with `{ success: true, data: { avatarUrl } }`
    - Handle errors: 400 if no file, 503 if R2 upload fails (avatar unchanged), 500 if Sharp fails
    - _Requirements: 1.1, 1.2, 1.3, 1.6_

  - [ ]* 3.2 Write property test for upload round-trip consistency
    - **Property 1: Upload round-trip consistency**
    - Generate random valid image buffers, mock R2, verify response URL matches DB value and has `avatars/` prefix
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 3.3 Write property test for old avatar cleanup on change
    - **Property 2: Old avatar cleanup on change**
    - Generate users with random R2-hosted avatar URLs, perform upload, verify old key deletion is called
    - **Validates: Requirements 1.3, 5.2**

  - [ ]* 3.4 Write property test for R2 failure state preservation
    - **Property 5: R2 failure does not corrupt state**
    - Generate valid images with mocked R2 failure, verify 503 response and avatar field unchanged
    - **Validates: Requirements 1.6**

- [x] 4. Add the avatar upload route and modify profile update for removal
  - [x] 4.1 Add `POST /api/users/me/avatar` route to `server/routes/userRoutes.js`
    - Import `uploadAvatar` middleware and `uploadAvatar` controller
    - Wire: `router.post('/me/avatar', uploadAvatarMiddleware, uploadAvatarController)`
    - _Requirements: 1.1_

  - [x] 4.2 Modify `updateMe` in `server/controllers/userController.js` for avatar removal with R2 cleanup
    - When `avatar` is set to `""` and current `user.avatar` is R2-hosted, delete old R2 object before saving
    - Use `isR2Avatar` and `extractR2Key` helpers (already added in 3.1)
    - Log but do not block on R2 deletion failure
    - _Requirements: 5.1, 5.2_

- [x] 5. Checkpoint — Server-side verification
  - Ensure all server-side tests pass, ask the user if questions arise.

- [x] 6. Update ProfilePage.jsx for upload integration
  - [x] 6.1 Wire file upload to the new `POST /api/users/me/avatar` endpoint
    - On "Save Changes" with a file selected, send the file as `FormData` to `/api/users/me/avatar`
    - On success, call `fetchUser()` to refresh state with new avatar URL
    - Remove the unused `avatarUrl` text input field (no longer needed)
    - _Requirements: 3.2, 3.3_

  - [x] 6.2 Add loading states and error handling for upload
    - Show a spinner/overlay on the avatar area while upload is in progress
    - Disable the save button during upload
    - Display error messages inline below the avatar area on failure
    - Retain the selected file on error so user can retry without re-selecting
    - _Requirements: 3.4, 3.5_

  - [x] 6.3 Add "Remove Avatar" button
    - Show a remove button when user has an R2-hosted avatar (or any non-empty avatar)
    - On click, send `PUT /api/users/me` with `{ avatar: "" }`
    - On success, call `fetchUser()` to refresh state — fallback avatar will display automatically
    - _Requirements: 5.1, 5.3_

- [x] 7. Verify avatar utility handles persisted URLs correctly
  - [x] 7.1 Confirm `getUserAvatar` in `client/src/utils/avatar.js` works with R2 URLs
    - Verify that when `user.avatar` contains a full R2 public URL, it is returned as-is
    - Verify that when `user.avatar` is empty/null/undefined, the DiceBear fallback is generated
    - No code changes expected — this is a verification step
    - _Requirements: 4.1, 4.2_

  - [ ]* 7.2 Write property tests for avatar utility
    - **Property 6: Avatar utility returns stored URL**
    - Generate random non-empty URL strings as avatar, verify `getUserAvatar` returns them unchanged
    - **Property 7: Avatar utility fallback generation**
    - Generate user objects with empty/null/undefined avatar, verify fallback URL is non-empty and contains name seed
    - **Validates: Requirements 4.1, 4.2**

- [x] 8. Final checkpoint — Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1", "2"],
      "description": "Server utilities — image processor and upload middleware (no dependencies)"
    },
    {
      "wave": 2,
      "tasks": ["3"],
      "description": "Upload controller — depends on compressAvatar (1) and upload middleware (2)"
    },
    {
      "wave": 3,
      "tasks": ["4"],
      "description": "Route wiring and updateMe modification — depends on controller (3)"
    },
    {
      "wave": 4,
      "tasks": ["5"],
      "description": "Server-side checkpoint — verify all server tasks pass"
    },
    {
      "wave": 5,
      "tasks": ["6", "7"],
      "description": "Client-side updates — depends on server endpoint being ready (5)"
    },
    {
      "wave": 6,
      "tasks": ["8"],
      "description": "Final integration checkpoint"
    }
  ]
}
```

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use [fast-check](https://github.com/dubzzz/fast-check) with minimum 100 iterations
- The `avatar.js` utility already handles the persisted URL case correctly — task 7.1 is a verification step
- Server tasks (1–5) must be completed before client tasks (6–7) since the client depends on the new endpoint
