---
description: TypeScript coding conventions and patterns for XCircle
globs: "**/*.ts,**/*.tsx"
---

# TypeScript Rules

## General
- Strict mode is enabled — no implicit any
- Use explicit return types on exported functions
- Prefer `interface` for object shapes, `type` for unions/intersections
- Use `const` by default, `let` only when reassignment is needed
- No `var` declarations

## Imports
- Use path aliases: `@/*` for client, `@shared/*` for shared
- Group imports: external libs → shared → local
- Use named exports (avoid default exports except for pages)

## Error Handling
- Use typed errors with discriminated unions
- Validate external data with Zod at API boundaries
- Never swallow errors silently — log or rethrow

## React Components
- Use function components with TypeScript props interface
- Destructure props in function signature
- Use React.FC only when children are needed
- Keep components focused — one responsibility per component

## Async Code
- Use async/await over raw Promises
- Handle errors with try/catch at appropriate levels
- Avoid nested callbacks
