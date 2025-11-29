# Mirae Connext Expert Network Platform

## Overview

Mirae Connext is a B2B SaaS platform for managing expert network services. It enables organizations to manage project requests, expert profiles, vetting processes, assignments, and usage tracking. The platform aims to provide a clean, professional interface inspired by modern design principles, facilitating efficient expert network operations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework & Build System**: React 18 with TypeScript, Vite for fast HMR, and Wouter for lightweight client-side routing.
- **UI Component Strategy**: shadcn/ui with Radix UI primitives for accessible components, Tailwind CSS for styling, and a custom theme system supporting light/dark modes. Design is inspired by Linear and Notion.
- **State Management**: TanStack Query for server state, React Hook Form with Zod for form management, and local component state for UI concerns.
- **Styling Approach**: Tailwind CSS with custom design tokens, CSS variables for theming, and Inter/JetBrains Mono for typography.

### Backend Architecture

- **Server Framework**: Express.js for RESTful API design with conventional endpoints.
- **API Structure**: CRUD operations for Projects, Experts, Vetting Questions, Project-Expert Assignments, and Usage Records. Includes Zod schema validation and robust error handling.
- **Development Workflow**: Vite middleware for HMR in development; esbuild for production bundling.

### Data Storage

- **Database Solution**: PostgreSQL (Neon serverless) with Drizzle ORM for type-safe queries and schema management.
- **Data Model**: Core entities include Projects, Experts, Project Angles, Vetting Questions, Project Experts, Call Records, and Usage Records. Key attributes support project management, expert profiling, and KPI calculations (e.g., `cuRatePerCU`, `sourcedByRaId`).
- **Angles System**: Project Angles are an organizational layer for structuring vetting questions by research angle:
    - **Table**: `projectAngles` with `id`, `projectId`, `title`, `description`, `orderIndex`, and timestamps.
    - **VQ Association**: `vettingQuestions` has `angleId` (nullable) linking questions to specific angles.
    - **Expert-Angle Mapping**: `projectExperts` has `angleIds` (integer array) for tracking which angles an expert is associated with.
    - **Invitation Flow**: `expertInvitationLinks` has `angleIds` to filter VQs shown to experts when accepting project invites.
    - **UI**: Project Detail page has "Angles & VQ" tab with collapsible angle sections and CRUD modals. Expert invite page groups VQs by angle.
- **KPI & Incentive System**:
    - **Credit Unit (CU)**: 1 CU = 1 hour, calculated proportionally in America/Sao_Paulo timezone.
    - **Incentives**: RAs receive R$250 per sourced call (cap R$2,500/month); PMs receive R$70 per CU (no cap).
    - **Admin/Finance**: Access to company-wide metrics: total CU, completed calls, and total revenue (`revenueUSD = cuUsed * cuRatePerCU`).
    - **Endpoints**: `/api/kpi/my-monthly` for user-specific KPIs; `/api/employees/:id/overview` for admin/finance employee oversight, including accounts list for PMs.
- **Migration Strategy**: Drizzle Kit for schema migrations, with schema definitions in `shared/schema.ts`.

### Recent Changes (This Session)

- **Expert Profile Editor**: New RA interface for editing expert profiles
  - Components: `/expert-profile/:id` route with ExpertProfileEditor component
  - Fields: Name, Email, Phone, LinkedIn URL, Work History (company/job title/years), Biography
  - UI: Card layout with Edit/Save buttons, read-only by default, inline table editing for work history
  - API: Uses PATCH `/api/experts/:id` to update expert records
  - Schema: Added `workHistory` (JSONB array) and `biography` (text) fields to experts table

- **Fixed Expert Search & Attach**: Corrected API endpoint mismatch in project detail page
  - Changed frontend from `/api/projects/:projectId/attach-experts` to `/api/projects/:projectId/experts/bulk`
  - Fixed "Attach" button functionality in Expert Search modal
  - Experts can now be attached to projects from the search results

- **Fixed Invitation Email URLs**: All invitation links now use deployed domain instead of localhost
  - Updated 5 locations in backend to use `APP_BASE_URL` environment variable
  - Invitation links now work: `${APP_BASE_URL}/expert/project-invite/${token}`
  - Set APP_BASE_URL in Replit Secrets (defaults to deployed Replit URL)
  - Supports custom domain after deployment to miraeconnexthub.com

- **Token-Based Expert Invite Flow**: Implemented frictionless project invitation for experts
  - **Public route** `/expert/project-invite/:token` - no login required
  - Experts see project details, client info, vetting questions grouped by angle
  - **Accept/Decline** without logging in via POST `/api/expert/project-invite/:token/respond`
  - Security: Tokens validated, time-limited (30-day expiration), deactivated after use
  - Shows confirmation message after response
  - Invalid/expired links show: "This invitation link is no longer valid"

- **Assignments Module Refactor**: Removed standalone "Assignments" page, merged into Project workflow
  - ✅ Removed "Assignments" from sidebar navigation
  - ✅ Removed `/assignments` route and Assignments import from App.tsx
  - ✅ Removed "assignments" pageKey from permissions system
  - ✅ All assignment functionality now in Project Detail page's "Existing Experts" tab
  - ✅ RA workflow is fully contained within project screens (no context switching)

- **RA Consultations Access with Limited Scope**: RAs can now monitor calls for their assigned projects
  - **Permissions**: Added "consultations" to RA role permissions in `client/src/lib/permissions.ts`
  - **Backend Filtering** (`/api/call-records`): Filters consultations by RA's assigned projects (matches `assignedRaId` or `assignedRaIds` array)
  - **RA UI Restrictions**:
    - ✅ Can view "Consultations" menu item in sidebar
    - ✅ Can see only consultations from projects assigned to them
    - ✅ Can see: consultation date, project name, expert name, call status (scheduled/completed/cancelled)
    - ✅ **Cannot see**: CU usage, billing/financial details, actions (Complete/Cancel buttons)
    - ✅ Empty state message: "No consultations yet. Once your projects have scheduled calls, they will appear here."
    - ✅ Stat cards show only 2 columns for RAs (Scheduled, Completed) - no CU card
  - **Implementation**: Uses `useAuth()` hook to detect RA role and conditionally render UI

### Core Features

- **Force Password Change on First Login**: New users must change a temporary password. Implemented via a `mustChangePassword` flag in the user model, frontend redirection, and a dedicated `/api/auth/change-password` endpoint.
- **Multi-language Expert Onboarding**: RAs send project-specific invite links (`/invite/:projectId/:inviteType/:token`). Experts complete a comprehensive, multi-language (PT, ES, EN) form covering personal, professional, and vetting details. On submission, an expert record is created, linked to the project, and the invitation is marked as used, with RA attribution.
- **Enhanced Project Management**: Redesigned project detail page (`/projects/:id`) with tabbed navigation:
    - **Overview**: Project details, client notes, metadata.
    - **Angles & VQ**: Manage research angles and vetting questions with collapsible sections, CRUD modals, and angle-based organization.
    - **Existing Experts**: Manage internal experts with angle filter, track invitation statuses (`not_invited` to `declined`), generate angle-specific invite links, and bulk operations.
    - **RA Sourcing**: Assign RAs, track RA-sourced experts pipeline, and view vetting answers.
    - **Activity**: Chronological activity log for project events and manual notes.
- **Existing Expert Project Invite Flow**: Public endpoint (`/expert/project-invite/:token`) allows existing experts to accept/decline project invitations, submit vetting answers, and provide availability notes.
- **Expert Search Modal**: Advanced search capability in project detail page ("Existing Experts" tab) with 10 comprehensive filters in a 2-column layout:
    - **Filters**: Keywords/expertise, current employer, past employers, country/location, years of experience (min/max), job title, industry, language, available now toggle, min hours worked, min acceptance rate, prior project involvement.
    - **New Expert Fields**: `city` (text), `pastEmployers` (text array), `availableNow` (boolean), `nextAvailableDate` (timestamp), `totalHoursWorked` (decimal) for enhanced filtering.
    - **Metrics**: Computes `priorProjectCount` (number of previous project assignments) and `acceptanceRate` (percentage of accepted vs. declined invitations) from `projectExperts` table.
    - **Schema**: `experts.languages` (text array) for filtering by spoken languages.
    - **API**: `GET /api/experts/search` with query params for all 10+ filters, returns experts with computed metrics.
    - **UI**: Modal with 2-column filter layout, scrollable results showing expert cards with metric badges, and "Attach" button to add to project.

## External Dependencies

- **Third-Party UI Libraries**: @radix-ui/*, lucide-react, date-fns, date-fns-tz, embla-carousel-react, cmdk.
- **Database & Backend Services**: @neondatabase/serverless, drizzle-orm, drizzle-kit, ws.
- **Development Tools**: @replit/vite-plugin-*, tsx.
- **Form & Validation**: react-hook-form, @hookform/resolvers, zod, drizzle-zod.
- **Session Management**: express-session, connect-pg-simple (infrastructure present, not fully active).