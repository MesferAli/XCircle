import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { connectorEngine } from "../connector-engine";

const router = Router();

// Endpoints
router.get("/endpoints", async (req, res) => {
  const connectorId = req.query.connector as string;
  if (!connectorId) {
    return res.status(400).json({ error: "connector query parameter is required" });
  }
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const endpointList = await storage.getEndpoints(connectorId, limit, offset);
  res.json(endpointList);
});

router.get("/endpoints/:id", async (req, res) => {
  const endpoint = await storage.getEndpoint(req.params.id);
  if (!endpoint) {
    return res.status(404).json({ error: "Endpoint not found" });
  }
  res.json(endpoint);
});

router.post("/endpoints", async (req, res) => {
  const endpoint = await storage.createEndpoint(req.body);
  res.status(201).json(endpoint);
});

router.patch("/endpoints/:id", async (req, res) => {
  const endpoint = await storage.updateEndpoint(req.params.id, req.body);
  if (!endpoint) {
    return res.status(404).json({ error: "Endpoint not found" });
  }
  res.json(endpoint);
});

router.post("/endpoints/:id/poll", async (req, res) => {
  try {
    const endpoint = await storage.getEndpoint(req.params.id);
    if (!endpoint) {
      return res.status(404).json({ error: "Endpoint not found" });
    }

    const connector = await storage.getConnector(endpoint.connectorId);
    if (!connector) {
      return res.status(404).json({ error: "Connector not found for endpoint" });
    }

    const tenantId = connector.tenantId;
    const result = await connectorEngine.pollEndpoint(
      endpoint.connectorId,
      req.params.id,
      tenantId
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      requestLog: {
        url: "",
        method: "",
        responseTimeMs: 0,
        timestamp: new Date(),
      },
    });
  }
});

// Items
router.get("/items", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const items = await storage.getItems("default", limit, offset);
  res.json(items);
});

// Locations
router.get("/locations", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const locations = await storage.getLocations("default", limit, offset);
  res.json(locations);
});

export default router;
