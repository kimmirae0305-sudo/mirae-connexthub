# Mirae Connext Expert Network Platform

## Overview

Mirae Connext is a B2B SaaS platform for managing expert network services. The platform enables organizations to manage project requests, expert profiles, vetting processes, assignments, and usage tracking. Built with a modern full-stack architecture, it provides a clean, professional interface inspired by Linear and Notion design principles.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server for fast HMR (Hot Module Replacement)
- Wouter for lightweight client-side routing instead of React Router

**UI Component Strategy**
- shadcn/ui component library with Radix UI primitives for accessible, customizable components
- Tailwind CSS for utility-first styling with custom design tokens
- Custom theme system supporting light/dark modes with CSS variables
- Design system follows Linear + Notion hybrid approach with emphasis on cleanliness and functionality

**State Management**
- TanStack Query (React Query) for server state management, caching, and data synchronization
- React Hook Form with Zod validation for form state and validation
- Local component state for UI-specific concerns

**Styling Approach**
- Tailwind configuration extends default theme with custom spacing (2, 4, 6, 8, 12), border radius, and color system
- CSS custom properties for theme variables enabling runtime theme switching
- Typography using Inter (primary) and JetBrains Mono (for IDs, codes, metrics)
- Component variants using class-variance-authority for consistent styling patterns

### Backend Architecture

**Server Framework**
- Express.js for HTTP server and API routing
- RESTful API design with conventional endpoints (/api/projects, /api/experts, etc.)
- Custom logging middleware for request/response tracking

**API Structure**
- CRUD operations for five main entities: Projects, Experts, Vetting Questions, Project-Expert Assignments, Usage Records
- Zod schema validation on incoming requests using drizzle-zod integration
- Error handling with friendly error messages via zod-validation-error
- Storage abstraction layer (IStorage interface) separating business logic from data access

**Development Workflow**
- Development mode uses Vite middleware integration for HMR
- Production build bundles server with esbuild, selectively bundling dependencies to reduce cold start times
- Build process compiles both client (Vite) and server (esbuild) into dist directory

### Data Storage

**Database Solution**
- PostgreSQL as the primary database (via Neon serverless)
- Drizzle ORM for type-safe database queries and schema management
- WebSocket connection pooling for serverless environment compatibility
- Schema-first approach with TypeScript types generated from Drizzle schema

**Data Model**
- **Projects**: Client projects with status tracking, budget, timeline, and industry categorization
- **Experts**: Professional profiles with expertise, rates, availability status, sourcedByRaId, and sourcedAt for RA attribution
- **Vetting Questions**: Project-specific screening questions with ordering and required flags (displayed as "Insight Hub" in UI)
- **Project Experts**: Many-to-many assignments linking projects to experts with notes and status
- **Call Records**: Consultation tracking with pmId, raId, durationMinutes, cuUsed, completedAt for KPI calculations
- **Usage Records**: Legacy time tracking with duration, credits, and billing information

### KPI & Incentive System

**Credit Unit (CU) Calculation**
- 1 CU = 1 hour of completed consultation
- Partial hours calculated proportionally (30 min = 0.5 CU)
- All monthly calculations use Brazil timezone (America/Sao_Paulo)

**Incentive Rules by Role**
- **RA (Research Associate)**: R$250 per completed call where expert was sourced by RA within 60 days. Monthly cap: R$2,500
- **PM (Project Manager)**: R$70 per CU with no monthly cap
- **Admin/Finance**: View global company totals

**KPI Endpoint**: GET /api/kpi/my-monthly
- Returns monthly KPI data filtered by authenticated user's role
- Includes total CU, total calls, calculated incentive, and detailed call list
- All dates filtered and displayed in America/Sao_Paulo timezone

**Migration Strategy**
- Drizzle Kit for schema migrations with push-based deployments
- Schema definitions in shared/schema.ts accessible to both client and server
- Relations defined using Drizzle's relations API for type-safe joins

### External Dependencies

**Third-Party UI Libraries**
- @radix-ui/* components (20+ primitives) for accessible, unstyled UI building blocks
- lucide-react for consistent iconography
- date-fns and date-fns-tz for date formatting with DST-safe timezone support (America/Sao_Paulo)
- embla-carousel-react for carousel/slider components
- cmdk for command palette interfaces

**Database & Backend Services**
- @neondatabase/serverless: PostgreSQL serverless driver with WebSocket support
- drizzle-orm & drizzle-kit: ORM and migration tooling
- ws: WebSocket library for Neon database connections

**Development Tools**
- @replit/vite-plugin-*: Replit-specific development plugins for error overlays, cartographer, and banners
- tsx: TypeScript execution for development server and build scripts
- Vite plugins for React and development experience enhancements

**Form & Validation**
- react-hook-form: Performant form state management
- @hookform/resolvers: Integration layer for schema validators
- zod: Schema validation library
- drizzle-zod: Automatic Zod schema generation from Drizzle schemas

**Session Management**
- express-session: Session middleware (infrastructure present, not actively used in current implementation)
- connect-pg-simple: PostgreSQL session store adapter