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
- **Projects**: Client projects with status tracking, budget, timeline, industry categorization, and cuRatePerCU (USD per CU, defaults to 1150)
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
- **Admin/Finance**: NO personal incentives. Instead, view company-wide metrics: total CU, completed calls, and total revenue

**Revenue Calculation for Admin/Finance**
- Per Call: `revenueUSD = cuUsed * cuRatePerCU`
- Where `cuRatePerCU` is project-specific (stored in projects table, defaults to USD 1,150)
- Company Total Revenue: Sum of all call revenues for the month
- Returns `companyTotals` object with `totalCompanyCU`, `totalCompanyCalls`, and `totalCompanyRevenueUSD`

**KPI Endpoint**: GET /api/kpi/my-monthly
- Returns monthly KPI data filtered by authenticated user's role
- **RA/PM**: Includes total CU, total calls, calculated incentive, and detailed call list
- **Admin/Finance**: Includes company-wide totals (CU, calls, revenue in USD), detailed call list with per-call revenue
- All dates filtered and displayed in America/Sao_Paulo timezone
- Call list includes: interviewDate, expertName, projectName, clientName (admin only), cuUsed, cuRatePerCU, revenueUSD (admin only)

**Employee Overview Endpoint**: GET /api/employees/:id/overview
- Only accessible by admin and finance roles
- Returns detailed employee info, monthly KPIs, and (for PMs) accounts list
- **KPI Calculation**:
  - RA: Counts calls where expert was sourced by this RA within 60 days; R$250 per call, R$2,500 monthly cap
  - PM: Counts calls where pmId = this employee; R$70 per CU, no cap
  - Admin/Finance: No personal KPIs (shows 0 for all metrics)
- **Accounts List** (PM role only): 
  - Aggregates clients from PM's completed calls for the month
  - Shows: clientName, totalCU, completedCalls, revenueUSD, lastActivityAt
  - contractedCU and usageRate return null (no contract model implemented yet)
  - RAs do not have assigned client accounts - they focus solely on expert sourcing

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

## Force Password Change on First Login Feature

### Overview
New employees must change their password on first login before accessing the main application.

### User Model Extension
- **New Field**: `mustChangePassword: boolean` (defaults to false)
- Set to `true` when admin creates a new employee via `/api/employees` endpoint
- Set to `false` after user successfully changes password

### Login Flow
**POST /api/auth/login** now returns:
```json
{
  "token": "...",
  "user": {
    "id": number,
    "fullName": string,
    "email": string,
    "role": string,
    "mustChangePassword": boolean
  }
}
```

### Frontend Routing
- After login: If `mustChangePassword === true`, redirect to `/change-password`
- Route Protection: Users with `mustChangePassword === true` are blocked from accessing any page except `/change-password` and `/logout`
- ProtectedRoute component enforces this via new `allowChangePassword` prop

### Change Password Endpoint
**POST /api/auth/change-password** (requires auth)
- Request body: `{ currentPassword, newPassword }`
- Validates current password matches user's existing password
- Updates password and sets `mustChangePassword = false` on success
- Returns `{ success: true }`

### New Pages
- **GET /change-password**: Displays password change form
  - Shows logged-in user's email
  - Form validates: new password min 8 chars, passwords match
  - Includes logout button for security
  - On success, redirects to dashboard

### Implementation Details
1. **Schema**: Added `mustChangePassword` to users table in `shared/schema.ts`
2. **Insert Schema**: Updated to include mustChangePassword with `.extend()` in zod
3. **Backend**: 
   - Login endpoint returns the flag
   - New POST /api/auth/change-password endpoint with password verification
   - Employee creation sets mustChangePassword = true by default
4. **Frontend**:
   - Auth context tracks the flag
   - Login redirects based on flag value
   - ProtectedRoute enforces route protection with new allowChangePassword parameter
5. **UI**: New change-password page with professional design matching Mirae Connext styling

### Database Migration
Run `npm run db:push` to add the `must_change_password` column to the users table (defaults to false for existing users).

### Employee Creation Workflow
1. Admin creates employee via Employees page
2. Employee logged as `mustChangePassword: true`
3. Employee logs in with temporary password
4. Frontend redirects to /change-password
5. Employee enters current password (temporary) and new password
6. Backend validates and updates user record
7. On success, `mustChangePassword` becomes false
8. Employee redirected to Dashboard with full access

## Multi-language Expert Onboarding Feature

### Overview
New expert registration flow allowing Research Associates (RAs) to send project-specific invitation links. Experts complete a comprehensive onboarding form in their preferred language (Portuguese, Spanish, or English).

### Route Pattern
- **URL Format**: `/invite/:projectId/:inviteType/:token`
- **Example**: `/invite/5/project/abc123token456`
- Parameters:
  - `projectId`: Database ID of the project
  - `inviteType`: Type of invitation (e.g., "project", "general")
  - `token`: Unique invitation token from `expert_invitation_links` table

### Multi-language Support
- **Supported Languages**: Portuguese (pt), Spanish (es), English (en)
- **Browser Detection**: Auto-detects preferred language from browser settings
- **Language Toggle**: Users can switch languages at any time via dropdown
- **Translation File**: `client/src/lib/translations/expert-onboarding.ts`

### Form Sections
1. **Login Information**: Email, password with confirmation
2. **Basic Information**: Name, country, region, phone (with country code), LinkedIn, timezone
3. **Professional Experience**: Repeatable experience entries with company, title, date ranges
4. **Biography**: 50+ character professional bio
5. **Hourly Rate**: Rate amount and currency selection
6. **Vetting Questions**: Project-specific screening questions (from Insight Hub)
7. **Terms & Privacy**: Required acceptance checkbox

### Backend Endpoints
**GET /api/invite/:projectId/:inviteType/:token**
- Validates invitation link (not expired, not used)
- Returns project details, vetting questions, RA information
- Response includes: project, vettingQuestions[], recruitedBy, recruitedByRaId

**POST /api/invite/:projectId/:inviteType/:token/submit**
- Creates expert record with form data
- Links expert to project (auto-accepts)
- Stores vetting question answers
- Marks invitation link as used
- Sets sourcedByRaId and sourcedAt for RA attribution

### Expert Record Mapping
Form data is mapped to expert record:
- `name`: firstName + lastName
- `email`: From form
- `phone`/`whatsapp`: countryCode + phoneNumber
- `country`, `timezone`: From form selections
- `company`, `jobTitle`: From first/current experience
- `yearsOfExperience`: Calculated from earliest experience start year
- `bio`: Biography + formatted experience list
- `hourlyRate`: From form
- `status`: "available"
- `sourcedByRaId`: RA user ID (from invitation link)
- `sourcedAt`: Registration timestamp

### Project-Expert Assignment
On successful registration:
- Creates project_experts record with status "accepted"
- Stores vqAnswers as structured JSON
- Includes notes about invitation type
- Sets invitedAt and respondedAt timestamps

### Files
- **Frontend**: `client/src/pages/expert-onboarding.tsx`
- **Translations**: `client/src/lib/translations/expert-onboarding.ts`
- **Backend Routes**: `server/routes.ts` (GET/POST /api/invite/:projectId/:inviteType/:token)
- **App Router**: Route defined in `client/src/App.tsx`