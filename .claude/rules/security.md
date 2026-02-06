---
description: Security guidelines and best practices
globs: "server/**/*.ts,shared/**/*.ts"
---

# Security Rules

## Authentication & Authorization
- All API routes must check authentication (except public routes)
- Enforce RBAC roles before data access: `admin`, `operator`, `viewer`
- Never trust client-provided tenant IDs — derive from session
- Validate session tokens on every request

## Data Access
- Always scope queries by tenant ID for data isolation
- Use Drizzle ORM for all queries (prevents SQL injection)
- Never construct raw SQL from user input
- Validate all API inputs with Zod schemas

## Secrets Management
- Never hardcode secrets, API keys, or credentials
- All secrets go in `.env` (gitignored)
- Reference `.env.example` for required variables
- Never log secrets or include them in error messages

## Input Validation
- Validate at API boundaries using Zod
- Sanitize user-generated content before rendering
- Use parameterized queries exclusively (Drizzle handles this)

## Response Security
- Never expose stack traces to clients in production
- Return generic error messages for internal errors
- Strip sensitive fields from API responses

## Infrastructure
- Non-root Docker containers
- Rate limiting via nginx
- HTTPS enforced in production
- Security headers configured in nginx
