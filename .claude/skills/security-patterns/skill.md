---
name: security-patterns
description: Enterprise security patterns for multi-tenant SaaS - authentication, authorization, and data protection
disable-model-invocation: true
---

# Security Patterns for XCircle/Atlas EAL

## Authentication Patterns

### Passport.js Session Setup
```typescript
// Session configuration with security defaults
app.use(session({
  store: new PgStore({ pool, tableName: "sessions" }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));
```

### Route Authentication Guard
```typescript
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}
```

## Authorization Patterns

### RBAC Middleware
```typescript
function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as User;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

// Usage: app.delete("/api/items/:id", requireAuth, requireRole("admin"), handler);
```

### Tenant Isolation in Queries
```typescript
// CORRECT: Always scope by tenant from session
const tenantId = (req.user as User).tenantId;
const items = await db.select().from(table)
  .where(and(eq(table.tenantId, tenantId), eq(table.id, itemId)));

// WRONG: Never trust client-provided tenant ID
// const tenantId = req.body.tenantId; // NEVER DO THIS
```

## Input Validation Patterns

### Zod Schema at API Boundary
```typescript
import { z } from "zod";

const createItemSchema = z.object({
  name: z.string().min(1).max(255),
  quantity: z.number().int().positive(),
  category: z.enum(["raw", "finished", "packaging"]),
});

app.post("/api/items", requireAuth, async (req, res) => {
  const parsed = createItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  // Use parsed.data (validated and typed)
});
```

### File Upload Validation
```typescript
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];

function validateUpload(file: Express.Multer.File): boolean {
  return file.size <= MAX_FILE_SIZE && ALLOWED_TYPES.includes(file.mimetype);
}
```

## Error Response Patterns

### Safe Error Handling
```typescript
// CORRECT: Generic error for clients, detailed log for ops
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`[${req.method} ${req.path}]`, err.message, err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// WRONG: Never expose internals
// res.status(500).json({ error: err.message, stack: err.stack });
```

## Security Headers (nginx)
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline';" always;
```

## Audit Logging Pattern
```typescript
import { auditGuard } from "./audit-guard";

// Log sensitive operations
await auditGuard.log({
  tenantId,
  userId: user.id,
  action: "DELETE_ITEM",
  resource: `items/${itemId}`,
  details: { reason },
  timestamp: new Date(),
});
```
