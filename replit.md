# Mirae Connext Expert Network Platform

## Overview

Mirae Connext is a B2B SaaS platform designed to streamline expert network services. Its core purpose is to empower organizations to efficiently manage project requests, expert profiles, vetting processes, assignments, and usage tracking. The platform aims to provide a professional, modern interface for optimized expert network operations, with a vision to become a leading solution in the expert network industry.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React 18 and TypeScript, using Vite for development and Wouter for routing. It leverages shadcn/ui and Radix UI for accessible components, styled with Tailwind CSS and a custom theme system supporting light/dark modes (inspired by Linear and Notion). State management utilizes TanStack Query for server state and React Hook Form with Zod for form handling.

### Backend

The backend is an Express.js application providing a RESTful API. It handles CRUD operations for core entities such as Projects, Experts, Vetting Questions, and Usage Records, with Zod for schema validation and robust error handling.

### Data Storage

PostgreSQL (Neon serverless) is used as the database, managed with Drizzle ORM for type-safe queries and schema migrations. The data model includes entities like Projects, Experts, Project Angles, Vetting Questions, and Call Records, designed to support comprehensive project management, expert profiling, and KPI calculations (e.g., `cuRatePerCU`, `sourcedByRaId`). A key feature is the "Angles System" which organizes vetting questions and expert associations by research angle. KPI and incentive calculations are integrated, providing metrics for RAs, PMs, and administrative/finance roles.

### Core Features

- **Force Password Change**: New users are required to change temporary passwords upon first login.
- **Multi-language Expert Onboarding**: Experts are invited via project-specific links to a multi-language form to provide personal, professional, and vetting details.
- **Enhanced Project Management**: A tabbed project detail page (`/projects/:id`) includes sections for Overview, Angles & Vetting Questions (with CRUD for organization), Existing Experts (for managing internal experts, invitations, and bulk operations), RA Sourcing (for assigning RAs and tracking experts), and Activity logs.
- **Existing Expert Project Invite Flow**: Experts can accept/decline invitations, submit vetting answers, and provide availability notes via a public link without logging in.
- **Expert Search Modal**: An advanced search feature within the project detail page allows filtering experts by numerous criteria including keywords, employer history, location, experience, and availability, with computed metrics like `priorProjectCount` and `acceptanceRate`. New expert fields like `city`, `pastEmployers`, `availableNow`, and `totalHoursWorked` enhance filtering capabilities.
- **Token-Based Expert Invite Flow**: A frictionless process where experts can respond to project invitations via a public, time-limited tokenized link.
- **Quick Invite Generator**: Lightweight invite flow in the RA-Sourced Experts Pipeline allowing RAs to quickly generate unique invite links by entering only candidate name + one contact method (LinkedIn, Email, or Phone).
- **In-Project Expert Registration**: RAs can register new experts directly from the RA Sourcing tab via the "Register Expert" modal with full profile form, multi-language support, and unique token generation.
- **RA Scoped Views**: RAs have restricted views, seeing only projects and consultations they are assigned to, with limited UI actions and financial data visibility.
- **Unique Invite Tokens & History**: Each invitation generates a new unique token for better tracking. A centralized `/invites` page allows Admin, PM, and RA roles to view and manage invitation links with filtering and statistics.
- **RA Incentive Tracking**: Comprehensive RA recruitment incentive system tracking experts sourced by RAs. Includes `sourcedByRaId` and `sourcedAt` timestamps on experts, incentive calculation (R$250 per completed call within 60 days of recruitment), and dedicated RA Performance dashboard (`/ra-performance`) accessible to Admin, PM, and Finance roles.
- **Recruiter Info Display**: Experts list shows "Recruited By" and "Recruited At" columns. Expert profile modal displays recruitment details section when applicable.

## External Dependencies

- **UI Libraries**: @radix-ui/*, lucide-react, date-fns, date-fns-tz, embla-carousel-react, cmdk.
- **Database & Backend**: @neondatabase/serverless, drizzle-orm, drizzle-kit, ws.
- **Development Tools**: @replit/vite-plugin-*, tsx.
- **Form & Validation**: react-hook-form, @hookform/resolvers, zod, drizzle-zod.
- **Session Management**: express-session, connect-pg-simple (infrastructure present).