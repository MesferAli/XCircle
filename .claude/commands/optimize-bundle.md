---
description: Analyze and optimize the production bundle size and loading performance
---

You are analyzing the production bundle for XCircle/Atlas EAL.

Follow these steps:

1. **Build production bundle**: Run `npm run build` to generate the production output.

2. **Analyze bundle size**: Check `dist/public/` for:
   - Total bundle size (JS + CSS + assets)
   - Individual chunk sizes
   - Largest files that may need optimization

3. **Dependency analysis**: Examine `package.json` and import patterns for:
   - Large libraries that could be lazy-loaded (recharts, jspdf, xlsx)
   - Duplicate packages in the bundle
   - Barrel export issues causing full module inclusion
   - Unused dependencies

4. **Code splitting opportunities**: Check for:
   - Route-based splitting (Wouter routes with dynamic imports)
   - Feature-based splitting (admin panels, ML dashboards)
   - Heavy component lazy loading

5. **Asset optimization**: Review:
   - Image sizes and formats (use WebP/AVIF where possible)
   - Font loading strategy
   - SVG optimization opportunities
   - Static asset caching headers

6. **Vite configuration**: Review `vite.config.ts` for:
   - Manual chunk configuration
   - Rollup optimization options
   - Minification settings
   - Source map configuration for production

7. **Report**: Provide:
   - Current bundle size breakdown
   - Top 5 largest dependencies by size
   - Specific optimization recommendations with estimated impact
   - Priority-ordered action items
