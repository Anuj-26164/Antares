# Requirements Document

## Introduction

This feature enhances the Antares Event & Media Management Platform with two major capabilities: (1) a complete dark mode theming system with global persistence, smooth transitions, and system preference detection, and (2) a modern admin dashboard accessible only to users with the admin role. The dark mode system extends across all existing pages and components, while the admin dashboard provides a SaaS-style interface for managing events, media, users, notifications, and platform settings. Both systems integrate with the existing React/Tailwind/Zustand/Framer Motion stack and respect all hard design constraints.

## Glossary

- **Theme_Store**: The Zustand store responsible for managing the current theme state (dark or light), persisting preference to localStorage, and exposing the toggle action
- **Theme_Toggle**: The accessible button rendered in the Navbar and Admin Top Bar that switches between dark and light themes
- **Admin_Dashboard**: The protected frontend section accessible only to admin-role users, containing analytics, management panels, and settings
- **Admin_Sidebar**: The collapsible navigation panel on the left side of the Admin Dashboard providing section links
- **Admin_Top_Bar**: The horizontal bar at the top of the Admin Dashboard containing user info, notifications bell, and Theme Toggle
- **Analytics_Panel**: The Admin Dashboard section displaying aggregate metrics (total events, media, users, storage) and time-series charts
- **Event_Management_Panel**: The Admin Dashboard section providing a searchable, filterable table of all events with CRUD actions
- **Media_Management_Panel**: The Admin Dashboard section providing grid/table views of all media with bulk actions and filters
- **User_Management_Panel**: The Admin Dashboard section providing a table of all users with role management and activity views
- **Notifications_Panel**: The Admin Dashboard section displaying real-time notifications for platform activity
- **AI_Insights_Panel**: The Admin Dashboard placeholder section for AI-powered analytics and engagement metrics
- **Settings_Panel**: The Admin Dashboard section for configuring platform-wide defaults (upload limits, file types, visibility)
- **Glassmorphism_Card**: A card component using backdrop-filter blur with semi-transparent background and 36px border-radius
- **Platform**: The Antares web application comprising frontend client and backend API server
- **Design_System**: The set of visual tokens (colors, radii, typography, spacing) governing all UI elements

## Requirements

### Requirement 1: Theme State Management

**User Story:** As a user, I want my theme preference to persist across sessions and respect my system settings on first visit, so that I always see the interface in my preferred mode.

#### Acceptance Criteria

1. THE Theme_Store SHALL manage a theme value of either "dark" or "light" using Zustand and persist the value to localStorage under the key "theme"
2. WHEN a user visits the Platform for the first time with no stored theme preference, THE Theme_Store SHALL read the system preference via window.matchMedia("(prefers-color-scheme: dark)") and set the theme accordingly
3. WHEN a user visits the Platform with an existing stored theme preference in localStorage, THE Theme_Store SHALL apply the stored value regardless of the current system preference
4. WHEN the theme value changes, THE Theme_Store SHALL add or remove the "dark" class on the document.documentElement element synchronously before the next paint
5. THE Theme_Store SHALL expose a toggleTheme action that switches the current theme value between "dark" and "light" and persists the new value to localStorage

### Requirement 2: Theme Toggle Accessibility and Placement

**User Story:** As a user, I want to easily switch between dark and light modes from any page, so that I can adjust the interface to my environment.

#### Acceptance Criteria

1. THE Theme_Toggle SHALL be rendered in the Navbar on all public and authenticated pages (landing, login, register, gallery, profile)
2. THE Theme_Toggle SHALL be rendered in the Admin_Top_Bar within the Admin Dashboard
3. THE Theme_Toggle SHALL include an aria-label attribute with the value "Switch to dark mode" when the current theme is light, and "Switch to light mode" when the current theme is dark
4. THE Theme_Toggle SHALL display a sun icon when the current theme is dark (indicating switch to light) and a moon icon when the current theme is light (indicating switch to dark)
5. WHEN a user activates the Theme_Toggle, THE Theme_Store SHALL invoke the toggleTheme action

### Requirement 3: Dark Mode Visual Theming

**User Story:** As a user, I want all pages and components to render correctly in dark mode with appropriate contrast and readability, so that I can use the platform comfortably in low-light environments.

#### Acceptance Criteria

1. WHILE the theme is set to "dark", THE Platform SHALL apply obsidian (#09090b) as the primary background color for page-level surfaces
2. WHILE the theme is set to "dark", THE Platform SHALL apply ink (#18181b) as the background color for card surfaces and elevated containers
3. WHILE the theme is set to "dark", THE Platform SHALL apply snow (#ffffff) as the primary text color and mist (#f4f4f5) as the secondary text color
4. WHILE the theme is set to "dark", THE Platform SHALL apply graphite (#3f3f46) as the border color for dividers, inputs, and card edges
5. WHILE the theme is set to "dark", THE Platform SHALL maintain all existing color tokens (ember, orchid-flash) at their original values for accent elements
6. THE Platform SHALL apply dark mode styles to all existing pages: Landing Page, Login Page, Register Page, Gallery Page, and Profile Page
7. THE Platform SHALL apply dark mode styles to all existing components: Navbar, Button, Input, Badge, EmptyState, MediaCard, MediaModal, UploadZone, GalleryGrid

### Requirement 4: Theme Transition Constraints

**User Story:** As a user, I want theme switching to feel smooth without jarring flashes, so that the experience remains polished.

#### Acceptance Criteria

1. THE Platform SHALL NOT animate background-color, color, or border-color properties during theme transitions
2. WHEN the theme changes, THE Platform SHALL apply the new theme class immediately via a synchronous DOM class swap on document.documentElement
3. WHERE a smooth visual transition is desired during theme change, THE Platform SHALL use an overlay element that fades out via opacity transition (opacity 1 to 0 over 200ms) to mask the instant class swap

### Requirement 5: Admin Dashboard Access Control

**User Story:** As an administrator, I want the admin dashboard to be accessible only to admin users, so that sensitive platform management features remain secure.

#### Acceptance Criteria

1. THE Platform SHALL expose the Admin Dashboard at the route path /admin and all sub-routes under /admin/*
2. WHEN an unauthenticated user navigates to any /admin route, THE Platform SHALL redirect the user to the login page
3. WHEN an authenticated user with a role other than "admin" navigates to any /admin route, THE Platform SHALL redirect the user to the home page and display no admin content
4. WHEN an authenticated user with the "admin" role navigates to any /admin route, THE Platform SHALL render the Admin Dashboard layout with Sidebar, Top Bar, and the requested section content
5. THE Platform SHALL validate admin access on both the frontend route guard and the backend API endpoints serving admin-specific data

### Requirement 6: Admin Dashboard Layout

**User Story:** As an administrator, I want a modern, responsive dashboard layout with sidebar navigation, so that I can efficiently access all management sections.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL render a layout with a fixed Admin_Sidebar on the left (240px width when expanded) and a content area occupying the remaining viewport width
2. THE Admin_Sidebar SHALL contain navigation links for: Analytics Overview, Event Management, Media Management, User & Role Management, Notifications, AI Insights, and Settings
3. THE Admin_Sidebar SHALL support a collapsed state (64px width) showing only icons, toggled via a collapse button
4. WHEN the viewport width is below 768px, THE Admin_Sidebar SHALL default to the collapsed state and overlay the content area when expanded
5. THE Admin_Top_Bar SHALL render at the top of the content area with a height of 64px, containing the current section title, a notifications bell icon, user avatar and name, and the Theme_Toggle
6. THE Admin_Dashboard SHALL use dark mode as the primary default theme, with light mode available via the Theme_Toggle
7. THE Admin_Dashboard SHALL use DM Sans as the sole typeface throughout all sections

### Requirement 7: Admin Dashboard Design System

**User Story:** As an administrator, I want the dashboard to have a modern glassmorphism aesthetic consistent with the platform design tokens, so that the interface feels cohesive and premium.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL render all metric cards and section containers as Glassmorphism_Cards with backdrop-filter blur(12px), a semi-transparent background (rgba(24,24,27,0.6) in dark mode, rgba(255,255,255,0.6) in light mode), and 36px border-radius
2. THE Admin_Dashboard SHALL apply graphite (#3f3f46) borders with 1px width to all Glassmorphism_Cards in dark mode, and fog (#ececee) borders in light mode
3. THE Admin_Dashboard SHALL restrict all filled button backgrounds to #09090b or #222222 with no colored CTA buttons
4. THE Admin_Dashboard SHALL apply a minimum border-radius of 28px to all card elements
5. THE Admin_Dashboard SHALL follow the existing Design_System spacing tokens: 24px card padding, 16px gap between grid items, and 80px section spacing on viewports at or above 1200px

### Requirement 8: Admin Dashboard Animations

**User Story:** As an administrator, I want smooth animations for page transitions, card entrances, and sidebar interactions, so that the dashboard feels responsive and polished.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL animate page section transitions using Framer Motion with opacity 0 to 1 and translateY 12px to 0 over 0.3 seconds with easeOut easing
2. THE Admin_Dashboard SHALL animate Glassmorphism_Card entrances with staggered delays of 0.08 seconds per card, animating opacity 0 to 1 and scale 0.97 to 1 over 0.4 seconds
3. THE Admin_Sidebar SHALL animate expand/collapse transitions using Framer Motion with width interpolation from 64px to 240px over 0.25 seconds with easeInOut easing
4. THE Admin_Dashboard SHALL constrain all animations to transform, opacity, and filter properties only
5. WHEN a user hovers over a Glassmorphism_Card, THE Admin_Dashboard SHALL scale the card to 1.01 using transform with a 0.2-second ease transition

### Requirement 9: Analytics Overview Panel

**User Story:** As an administrator, I want to see key platform metrics at a glance, so that I can monitor platform health and growth.

#### Acceptance Criteria

1. THE Analytics_Panel SHALL display metric cards for: total events count, total media count, total users count, and total storage used (formatted in MB or GB)
2. THE Analytics_Panel SHALL display a line chart showing media uploads over time (last 30 days, grouped by day)
3. THE Analytics_Panel SHALL display a line chart showing user registrations over time (last 30 days, grouped by day)
4. WHEN the Analytics_Panel loads, THE Platform SHALL fetch aggregate data from admin-only API endpoints that return counts and time-series data
5. IF the analytics data fetch fails, THEN THE Analytics_Panel SHALL display an error state with a retry action button

### Requirement 10: Event Management Panel

**User Story:** As an administrator, I want to manage all platform events from a single table view, so that I can create, edit, and remove events efficiently.

#### Acceptance Criteria

1. THE Event_Management_Panel SHALL display a table of all events with columns: title, date, category, creator name, media count, public/private status, and actions
2. THE Event_Management_Panel SHALL provide a search input that filters events by title or category in real-time as the user types
3. THE Event_Management_Panel SHALL provide filter controls for: status (public/private), date range, and category
4. WHEN an admin clicks the create action, THE Event_Management_Panel SHALL display a modal form for creating a new event with fields: title, description, category, date, public/private toggle, and cover image URL
5. WHEN an admin clicks the edit action on an event row, THE Event_Management_Panel SHALL display a modal form pre-filled with the event data for editing
6. WHEN an admin clicks the delete action on an event row, THE Event_Management_Panel SHALL display a confirmation dialog before executing the deletion
7. THE Event_Management_Panel SHALL display status indicators using colored badges: green for public events and steel (#71717a) for private events

### Requirement 11: Media Management Panel

**User Story:** As an administrator, I want to manage all platform media with bulk actions, so that I can moderate content and manage storage efficiently.

#### Acceptance Criteria

1. THE Media_Management_Panel SHALL display media items in a switchable grid view (thumbnail cards) or table view (rows with metadata)
2. THE Media_Management_Panel SHALL provide filter controls for: event association, media type (photo/video), date range, and visibility (public/private)
3. THE Media_Management_Panel SHALL support selecting multiple media items via checkboxes for bulk operations
4. WHEN an admin selects one or more media items and chooses a bulk action, THE Media_Management_Panel SHALL execute the action (delete, make public, or make private) on all selected items and display a confirmation count
5. WHEN an admin clicks delete on selected media items, THE Media_Management_Panel SHALL display a confirmation dialog showing the count of items to be deleted before executing
6. THE Media_Management_Panel SHALL display each media item with: thumbnail preview, file type badge, event name, uploader name, upload date, and visibility status

### Requirement 12: User and Role Management Panel

**User Story:** As an administrator, I want to manage user accounts and roles, so that I can control platform access and permissions.

#### Acceptance Criteria

1. THE User_Management_Panel SHALL display a table of all users with columns: name, email, role, registration date, and actions
2. THE User_Management_Panel SHALL provide a search input that filters users by name or email in real-time
3. WHEN an admin selects a new role from the role dropdown on a user row, THE User_Management_Panel SHALL send a role update request to the backend and reflect the updated role upon success
4. THE User_Management_Panel SHALL display the four available roles (admin, photographer, club_member, viewer) in the role selection dropdown
5. IF a role update request fails, THEN THE User_Management_Panel SHALL revert the displayed role to the previous value and show an error notification
6. THE User_Management_Panel SHALL provide a filter control for role to display only users of a selected role

### Requirement 13: Notifications Panel

**User Story:** As an administrator, I want to see real-time platform activity notifications, so that I can stay informed about new uploads, registrations, and comments.

#### Acceptance Criteria

1. THE Notifications_Panel SHALL display a chronological list of platform notifications including: new media uploads, new user registrations, and new comments
2. WHEN a new notification is received, THE Notifications_Panel SHALL prepend the notification to the list without requiring a page refresh
3. THE Admin_Top_Bar SHALL display a notifications bell icon with an unread count badge showing the number of unseen notifications
4. WHEN an admin clicks the notifications bell, THE Admin_Top_Bar SHALL display a dropdown preview of the 5 most recent notifications with a link to the full Notifications_Panel
5. WHEN an admin views a notification, THE Notifications_Panel SHALL mark the notification as read and decrement the unread count badge

### Requirement 14: AI Insights Panel (Placeholder)

**User Story:** As an administrator, I want a dedicated section for AI-powered analytics, so that the platform is prepared for future intelligent features.

#### Acceptance Criteria

1. THE AI_Insights_Panel SHALL render a placeholder section with a heading "AI Insights" and a description indicating the feature is coming soon
2. THE AI_Insights_Panel SHALL display placeholder cards for: most popular events, trending media, and user engagement metrics, each showing sample static data or empty states
3. THE AI_Insights_Panel SHALL follow the same Glassmorphism_Card styling and animation patterns as other Admin Dashboard sections

### Requirement 15: Settings Panel

**User Story:** As an administrator, I want to configure platform-wide defaults, so that I can control upload limits, allowed file types, and visibility defaults without code changes.

#### Acceptance Criteria

1. THE Settings_Panel SHALL display configurable fields for: default upload size limit (in MB), maximum bulk upload count, allowed image file types, allowed video file types, and default media visibility (public or private)
2. WHEN an admin modifies a setting and clicks save, THE Settings_Panel SHALL send the updated settings to the backend API and display a success confirmation
3. IF a settings save request fails, THEN THE Settings_Panel SHALL display an error notification and retain the unsaved values in the form
4. THE Settings_Panel SHALL validate that upload size limit is a positive number and that at least one file type is selected for both image and video categories before allowing save
5. THE Settings_Panel SHALL display the current saved values when the panel loads, fetched from the backend API

### Requirement 16: Admin API Endpoints

**User Story:** As a frontend developer, I want dedicated admin API endpoints, so that the admin dashboard can fetch aggregate data and perform management operations securely.

#### Acceptance Criteria

1. THE Platform SHALL expose admin endpoints at /api/admin/analytics returning aggregate counts (total events, total media, total users, total storage) and time-series data (uploads per day, registrations per day for the last 30 days)
2. THE Platform SHALL expose admin endpoints at /api/admin/users for listing all users with pagination, updating user roles, and viewing user activity
3. THE Platform SHALL expose admin endpoints at /api/admin/notifications for listing notifications, marking as read, and fetching unread count
4. THE Platform SHALL expose admin endpoints at /api/admin/settings for reading and updating platform configuration
5. WHEN any request to an /api/admin/* endpoint lacks a valid authentication token or the authenticated user does not have the "admin" role, THE Platform SHALL reject the request with a 403 status and an error message indicating insufficient permissions
6. THE Platform SHALL apply rate limiting of 100 requests per minute per user to all /api/admin/* endpoints

### Requirement 17: Responsive Admin Layout

**User Story:** As an administrator, I want the dashboard to work well on mobile and tablet devices, so that I can manage the platform from any device.

#### Acceptance Criteria

1. WHEN the viewport width is below 768px, THE Admin_Sidebar SHALL collapse to icon-only mode (64px width) by default and expand as an overlay when toggled
2. WHEN the viewport width is below 768px, THE Admin_Dashboard SHALL stack metric cards in a single column layout
3. WHEN the viewport width is between 768px and 1200px, THE Admin_Dashboard SHALL display metric cards in a 2-column grid
4. WHEN the viewport width is at or above 1200px, THE Admin_Dashboard SHALL display metric cards in a 4-column grid
5. THE Event_Management_Panel and User_Management_Panel tables SHALL support horizontal scrolling on viewports below 768px while maintaining readable column widths
6. THE Admin_Top_Bar SHALL remain fixed at the top of the content area across all viewport sizes
