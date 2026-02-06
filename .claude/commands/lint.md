---
description: Run TypeScript type checking and code quality analysis
---

You are running code quality checks for XCircle/Atlas EAL.

Follow these steps:

1. **TypeScript type check**: Run `npm run check` to verify strict TypeScript compilation across the entire project.

2. **Analyze errors**: If type errors are found:
   - Group errors by file
   - Identify common patterns (missing types, incorrect imports, type mismatches)
   - Prioritize fixes by severity

3. **Code quality scan**: Search for common issues:
   - `any` type usage that should be properly typed
   - Unused imports and variables
   - Missing Zod validation on API endpoints
   - Console.log statements that should be removed
   - TODO/FIXME comments that need attention

4. **Report**: Provide a structured summary:
   - Total type errors found
   - Code quality issues by category
   - Suggested fixes with file locations

Arguments:
- No args: Run full type check + quality scan
- `fix`: Auto-fix issues where possible
- `strict`: Include stricter checks (unused exports, complexity)
