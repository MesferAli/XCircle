---
description: Clean development caches and temporary files to reclaim disk space
---

You are cleaning up development caches for XCircle/Atlas EAL.

Argument: $ARGUMENTS

Follow these steps based on cleanup level:

## Conservative (default — no arguments)

1. **Node modules cache**: Remove `node_modules/.cache/` if it exists
2. **Vite cache**: Remove `node_modules/.vite/` temp files
3. **TypeScript cache**: Remove `tsconfig.tsbuildinfo` if present
4. **Test cache**: Clear Vitest cache
5. **Build artifacts**: Remove `dist/` directory

Report space reclaimed after cleanup.

## Aggressive (argument: `--aggressive`)

All conservative steps, plus:

1. **Playwright browsers**: Run `npx playwright install --dry-run` to show installed browsers
2. **npm cache**: Run `npm cache clean --force`
3. **Docker**: List dangling images and stopped containers (do NOT remove automatically)

## Full Reset (argument: `--reset`)

All aggressive steps, plus:

1. **Remove node_modules**: Delete `node_modules/` entirely
2. **Reinstall**: Run `npm install` to get a fresh dependency tree
3. **Verify**: Run `npm run check` to confirm everything works

## Safety Rules

- NEVER delete `.env` files
- NEVER delete `shared/` or `server/` source code
- NEVER delete git history
- Always report what will be deleted BEFORE deleting
- Show disk space before and after cleanup
