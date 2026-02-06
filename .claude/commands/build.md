---
description: Build the project for production and verify the output
---

You are building XCircle/Atlas EAL for production.

Follow these steps:

1. **Type check**: Run `npm run check` to catch type errors before building.

2. **Build**: Run `npm run build` to create the production bundle.

3. **Verify output**: Check that `dist/` directory was created with:
   - `dist/index.cjs` (server bundle)
   - `dist/public/` (client assets)

4. **Report**: Summarize build results including any warnings or errors.

If type checking or build fails, analyze the errors and offer to fix them.
