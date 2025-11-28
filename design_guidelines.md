# Design Guidelines: Mirae Connext Expert Network Platform

## Design Approach
**Reference-Based: Linear + Notion Hybrid**
Drawing inspiration from Linear's precision and Notion's approachability to create a professional B2B SaaS experience. Clean, functional, and efficient without unnecessary visual flourish.

## Typography
- **Primary Font:** Inter (Google Fonts)
- **Secondary Font:** JetBrains Mono (for IDs, codes, metrics)

**Hierarchy:**
- Page Titles: text-3xl font-semibold
- Section Headers: text-xl font-medium
- Card Titles: text-base font-medium
- Body Text: text-sm font-normal
- Labels: text-xs font-medium uppercase tracking-wide
- Table Headers: text-xs font-semibold uppercase
- Metrics/Numbers: text-2xl font-bold (JetBrains Mono)

## Layout System
**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, and 12
- Component padding: p-6
- Card spacing: space-y-4
- Section margins: mb-8
- Table cell padding: px-4 py-3
- Form field gaps: gap-4
- Page container: px-8 py-6

**Grid Structure:**
- Main container: max-w-7xl mx-auto
- Dashboard: 12-column grid (grid-cols-12)
- Tables: Full-width within containers
- Forms: max-w-2xl for single-column, grid-cols-2 for multi-column

## Component Library

### Navigation
- **Top Navigation Bar:** Full-width, fixed, with logo left, navigation center, user profile right
- **Sidebar Navigation:** Fixed left, 240px wide, collapsible to 60px icon-only
- Active states with subtle left border accent

### Data Tables
- Striped rows for readability (alternate row background)
- Sticky header on scroll
- Row hover states
- Action buttons (Edit/Delete/View) aligned right
- Status badges with rounded-full design
- Pagination controls at bottom
- Search and filter controls above table

### Forms
- Two-column layout for registration/profile forms
- Single-column for short forms (vetting questions)
- Input fields with subtle border, focus ring on interaction
- Required field indicators (asterisk)
- Helper text below inputs (text-xs)
- Submit buttons aligned right

### Cards
- Subtle border with rounded-lg corners
- Minimal shadow (shadow-sm)
- Header with icon and title
- Body with consistent p-6 padding
- Footer for actions when needed

### Buttons
- Primary: Solid fill for main actions
- Secondary: Outlined for secondary actions  
- Tertiary: Ghost/text-only for low-priority actions
- Icon buttons: Circular for table actions
- Sizes: Small (px-3 py-2 text-sm), Medium (px-4 py-2 text-base), Large (px-6 py-3 text-lg)

### Modals
- Centered overlay with backdrop blur
- max-w-2xl for forms, max-w-md for confirmations
- Close button top-right
- Footer with action buttons right-aligned

### Status Indicators
- Badges: rounded-full px-3 py-1 text-xs font-medium
- Project Status: Active, Pending, Completed, Archived
- Expert Status: Available, Busy, Inactive
- Call Status: Scheduled, In Progress, Completed

### Data Visualization
- Simple progress bars for CU usage
- Metric cards with large numbers and trend indicators
- Clean table layouts for usage history

## Key Pages

### Dashboard
- Overview metrics in 3-4 card grid at top (grid-cols-4)
- Recent projects table below
- Quick actions sidebar on right (if space allows)

### Expert Directory
- Search bar with filters (expertise, industry, availability)
- Grid of expert cards (grid-cols-3) with photo, name, specialty, rate
- Click to expand detailed profile modal

### Project Details
- Breadcrumb navigation
- Project info card at top
- Tabs for: Overview, Vetting Questions, Assigned Experts, Usage Tracker
- Table within each tab as appropriate

### Vetting Questions
- Question list with add/edit/delete capabilities
- Drag handles for reordering
- Inline editing or modal form for creation

### Assignment Interface
- Split view: Available experts (left), Assigned experts (right)
- Transfer buttons between lists
- Filter/search in both panels

### CU Tracker
- Summary cards showing total usage, credits remaining
- Detailed table with columns: Expert, Project, Date, Duration, Credits Used
- Export button for reports

## Icons
**Heroicons** (via CDN)
- Navigation: outline style
- Actions: solid style at 20px
- Decorative/illustrative: outline at 24px

## Images
This is a B2B dashboard application - no hero images or decorative photography needed. Focus on:
- Expert profile photos (circular avatars)
- Company logo in navigation
- Empty state illustrations (simple, minimalist line art)

## Animations
Minimal and purposeful:
- Smooth transitions on hover (transition-colors duration-200)
- Modal fade-in/scale (duration-300)
- Loading spinners for data fetching
- No scroll animations or complex motion