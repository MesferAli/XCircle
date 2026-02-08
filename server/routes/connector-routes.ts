import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { connectorEngine } from "../connector-engine";
import { requireCapability } from "../capability-guard";

const router = Router();

router.get("/", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const connectors = await storage.getConnectors(undefined, limit, offset);
  res.json(connectors);
});

router.get("/:id", async (req, res) => {
  const connector = await storage.getConnector(req.params.id);
  if (!connector) {
    return res.status(404).json({ error: "Connector not found" });
  }
  res.json(connector);
});

// SECURITY: Capability enforcement for connector write operations
router.post("/", requireCapability("connector_write"), async (req, res) => {
  const user = (req as any).user;
  const connector = await storage.createConnector(req.body);
  await storage.createAuditLog({
    tenantId: connector.tenantId,
    userId: user?.id || "admin",
    action: "create",
    resourceType: "connector",
    resourceId: connector.id,
    newState: { name: connector.name },
    ipAddress: req.ip || "unknown",
  });
  res.status(201).json(connector);
});

router.patch("/:id", requireCapability("connector_write"), async (req, res) => {
  const connector = await storage.updateConnector(req.params.id, req.body);
  if (!connector) {
    return res.status(404).json({ error: "Connector not found" });
  }
  res.json(connector);
});

router.delete("/:id", requireCapability("connector_write"), async (req, res) => {
  const user = (req as any).user;
  const connector = await storage.getConnector(req.params.id);
  if (!connector) {
    return res.status(404).json({ error: "Connector not found" });
  }
  await storage.deleteConnector(req.params.id);
  await storage.createAuditLog({
    tenantId: connector.tenantId,
    userId: user?.id || "admin",
    action: "delete",
    resourceType: "connector",
    resourceId: req.params.id,
    previousState: { name: connector.name },
    ipAddress: req.ip || "unknown",
  });
  res.status(204).send();
});

router.post("/:id/health-check", async (req, res) => {
  const connector = await storage.getConnector(req.params.id);
  if (!connector) {
    return res.status(404).json({ error: "Connector not found" });
  }
  const updated = await storage.updateConnector(req.params.id, {
    status: "connected",
    lastHealthCheck: new Date(),
  });
  res.json(updated);
});

router.post("/:id/discover", async (req, res) => {
  const connector = await storage.getConnector(req.params.id);
  if (!connector) {
    return res.status(404).json({ error: "Connector not found" });
  }
  const capabilities = [
    { endpoint: "/api/products", method: "GET", capability: "list", isSupported: true },
    { endpoint: "/api/products/{id}", method: "GET", capability: "read", isSupported: true },
    { endpoint: "/api/inventory", method: "GET", capability: "list", isSupported: true },
  ];
  for (const cap of capabilities) {
    await storage.createCapability({
      connectorId: connector.id,
      ...cap,
      sampleResponse: {},
    });
  }
  res.json({ discovered: capabilities.length });
});

router.post("/:id/test", async (req, res) => {
  try {
    const result = await connectorEngine.testConnection(req.params.id);

    if (result.success) {
      await storage.createAuditLog({
        tenantId: result.details.healthStatus.status === "online" ? "default" : "default",
        userId: "admin",
        action: "test_connection",
        resourceType: "connector",
        resourceId: req.params.id,
        newState: {
          success: result.success,
          status: result.details.healthStatus.status,
          latencyMs: result.details.healthStatus.latencyMs,
        },
        ipAddress: req.ip || "unknown",
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      details: {
        authValid: false,
        healthStatus: {
          status: "offline",
          lastChecked: new Date(),
          latencyMs: 0,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
        endpointCount: 0,
      },
    });
  }
});

router.post("/:id/poll", async (req, res) => {
  try {
    const connector = await storage.getConnector(req.params.id);
    if (!connector) {
      return res.status(404).json({ error: "Connector not found" });
    }

    const tenantId = connector.tenantId;
    const result = await connectorEngine.pollAllEndpoints(req.params.id, tenantId);

    await storage.createAuditLog({
      tenantId,
      userId: "admin",
      action: "poll_connector",
      resourceType: "connector",
      resourceId: req.params.id,
      newState: {
        success: result.success,
        summary: result.summary,
      },
      ipAddress: req.ip || "unknown",
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      results: [],
      summary: { total: 0, successful: 0, failed: 0, rateLimited: 0 },
    });
  }
});

router.get("/:id/health", async (req, res) => {
  try {
    const healthStatus = await connectorEngine.checkHealth(req.params.id);
    const rateLimitStatus = connectorEngine.getRateLimitStatus(req.params.id);

    res.json({
      health: healthStatus,
      rateLimit: rateLimitStatus,
    });
  } catch (error) {
    res.status(500).json({
      health: {
        status: "offline",
        lastChecked: new Date(),
        latencyMs: 0,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
      rateLimit: {
        requestsUsed: 0,
        requestsPerMinute: 60,
        remaining: 60,
        resetInMs: 0,
      },
    });
  }
});

export default router;
