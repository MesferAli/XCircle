# Atlas - Enterprise AI Layer (EAL) - Decision Intelligence Platform

## Overview
Atlas is a production-grade, REST-first Decision Intelligence Platform for inventory management. It connects to any REST API, maps data to a canonical model, and provides AI-powered recommendations with human-in-the-loop approval workflows. The platform prioritizes a zero-code, plug-and-play onboarding experience and ensures all AI recommendations require explicit human approval before execution.

**Key Capabilities:**
- Connector management for external REST APIs
- Data mapping to a canonical inventory model
- AI-powered recommendations with explainable confidence scores
- Anomaly detection with priority-based alerting
- Policy governance for automated rules
- Complete audit trail for compliance

**Core Principles:**
- REST-First: Assumes customers expose only REST APIs.
- Plug & Play: Zero-code onboarding via UI and configuration.
- AI Recommends Only: AI generates recommendations but never auto-executes.
- Human-in-the-Loop: All decisions require explicit approval before execution.

**Brand Identity:**
- Platform Name: Atlas
- Tagline: Enterprise integration, simplified.
- Primary Color: Dark Blue (HSL 220° 50% 25%)
- Accent Color: Muted Teal (HSL 185° 40% 45%)
- Default Theme: Light mode with clean white aesthetic
- Default Language: Arabic (RTL) with English toggle available

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **UI Components**: shadcn/ui built on Radix UI
- **Styling**: Tailwind CSS with CSS variables
- **Design System**: Carbon Design System principles
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful JSON APIs under `/api/*`
- **Server Structure**: Single Express server for API and static files

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod
- **Schema Location**: `shared/schema.ts`

### Authentication
- **Provider**: Replit Auth (OIDC)
- **Architecture**: Dual-table approach (`auth_identities` for OIDC claims, `users` for domain users)
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple
- **Auto-Provisioning**: New users automatically get a tenant and admin role on first login

### Key Data Entities
Tenants, Users, AuthIdentities, Connectors, Endpoints, Mappings, Items/Locations/StockBalances, Recommendations, Anomalies, Policies, AuditLogs, SubscriptionPlans, Subscriptions, Payments.

### Core Engines
- **AI Engine**: Demand Forecasting (moving average), Stockout Risk Prediction, Anomaly Detection (Z-score), Explainable AI.
- **REST Connector Engine**: Supports various authentication methods (API Key, Bearer Token, OAuth2), pagination strategies, rate limiting, health checks, and JSONPath extraction.
- **Mapping Engine**: JSONPath Transformations to canonical model, mapping versioning, capability discovery.
- **Execution Hard Lock**: Platform is hardcoded to NEVER execute actions on external systems, ensuring human approval for all external writes.
- **Policy Engine**: Zero Trust Security, RBAC, Approval Workflows, Blast Radius Limits, Dry-Run Requirement.
- **Immutable Audit Engine**: Append-only audit logs with sequence numbers, event types, and correlation IDs for complete traceability.

### Subscription Billing System
- **Plans**: Basic, Professional, Enterprise with 7-day free trial.
- **Payment Gateway**: Moyasar (PCI-compliant tokenization, 3D Secure).

### Onboarding Flows (Atlas UX)
Dual-track system (Enterprise and SMB) designed for guided user onboarding with distinct UI/UX constraints for each.

### Admin Customer Management
Platform admin interface for managing tenants, subscription statuses, and viewing platform statistics.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.
- **connect-pg-simple**: PostgreSQL session store for Express.

### UI Framework
- **Radix UI**: Accessible UI primitives.
- **shadcn/ui**: Component library.
- **Tailwind CSS**: Utility-first CSS.
- **Lucide React**: Icon library.

### Data & Forms
- **TanStack React Query**: Server state management.
- **React Hook Form**: Form state management.
- **Zod**: Schema validation.
- **date-fns**: Date manipulation.

### Build & Development
- **Vite**: Frontend build tool.
- **esbuild**: Production server bundling.
- **tsx**: TypeScript execution.
- **Drizzle Kit**: Database migration tooling.

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal**: Error overlay.
- **@replit/vite-plugin-cartographer**: Development tooling.
- **@replit/vite-plugin-dev-banner**: Development environment indicator.