---
description: Start development workflow - run dev server, check types, and verify setup
---

You are starting a development session for XCircle/Atlas EAL.

Follow these steps in order:

1. **Verify environment**: Check that `.env` exists (do NOT read its contents). If missing, warn the user to copy from `.env.example`.

2. **Type check**: Run `npm run check` to verify TypeScript compilation.

3. **Start dev server**: Run `npm run dev` as a background task.

4. **Report status**: Summarize what's running and any issues found.

If type checking fails, list the errors and offer to fix them before starting the server.
