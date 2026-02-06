---
name: express-patterns
description: Express.js API patterns for routes, middleware, error handling, and engine integration
disable-model-invocation: true
---

# Express API Patterns for XCircle/Atlas EAL

## Route Structure

All routes are defined in `server/routes.ts` using the Express Router pattern.

### Basic CRUD Route
```typescript
// GET with tenant isolation and pagination
app.get("/api/items", requireAuth, async (req, res) => {
  const tenantId = (req.user as User).tenantId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  const items = await db.select().from(inventoryItems)
    .where(eq(inventoryItems.tenantId, tenantId))
    .limit(limit)
    .offset((page - 1) * limit)
    .orderBy(desc(inventoryItems.createdAt));

  const [{ count: total }] = await db.select({ count: count() })
    .from(inventoryItems)
    .where(eq(inventoryItems.tenantId, tenantId));

  res.json({ items, total, page, limit });
});

// POST with Zod validation
app.post("/api/items", requireAuth, requireRole("admin", "operator"), async (req, res) => {
  const parsed = insertItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const tenantId = (req.user as User).tenantId;
  const [item] = await db.insert(inventoryItems)
    .values({ ...parsed.data, tenantId })
    .returning();
  res.status(201).json(item);
});
```

## Engine Integration Pattern

### Using Backend Engines
```typescript
import { aiEngine } from "./ai-engine";
import { policyEngine } from "./policy-engine";
import { executionLock } from "./execution-lock";

app.post("/api/recommendations", requireAuth, async (req, res) => {
  const tenantId = (req.user as User).tenantId;

  // 1. Policy check
  const allowed = await policyEngine.evaluate(tenantId, "generate_recommendation");
  if (!allowed) return res.status(403).json({ error: "Policy denied" });

  // 2. Generate recommendation (AI engine)
  const recommendation = await aiEngine.recommend(tenantId, req.body);

  // 3. Execution lock (draft mode)
  const draft = await executionLock.createDraft(tenantId, recommendation);

  res.json(draft);
});
```

## Middleware Patterns

### Error Wrapper for Async Routes
```typescript
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// Usage
app.get("/api/items/:id", requireAuth, asyncHandler(async (req, res) => {
  // async code here — errors automatically caught
}));
```

### Request Logging
```typescript
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`Slow request: ${req.method} ${req.path} ${duration}ms`);
    }
  });
  next();
});
```

## Response Patterns

### Consistent API Response
```typescript
// Success
res.json({ data: items, meta: { total, page, limit } });

// Created
res.status(201).json(newItem);

// No content
res.status(204).end();

// Error
res.status(400).json({ error: "Validation failed", details: zodErrors });
res.status(401).json({ error: "Authentication required" });
res.status(403).json({ error: "Insufficient permissions" });
res.status(404).json({ error: "Resource not found" });
```

## File Locations

- All routes: `server/routes.ts`
- Auth middleware: `server/auth/`
- Engines: `server/ai-engine.ts`, `server/policy-engine.ts`, `server/connector-engine.ts`
- Guards: `server/audit-guard.ts`, `server/capability-guard.ts`
- Execution lock: `server/execution-lock.ts`
- DB client: `server/db.ts`
