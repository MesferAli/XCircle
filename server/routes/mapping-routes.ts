import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { mappingEngine } from "../mapping-engine";
import { mappingConfigPayloadSchema } from "@shared/schema";
import { requireCapability } from "../capability-guard";

const router = Router();

const validateTenant = async (tenantId: string | undefined): Promise<{ valid: boolean; error?: string }> => {
  if (!tenantId) {
    return { valid: false, error: "tenantId is required" };
  }
  const tenant = await storage.getTenant(tenantId);
  if (!tenant) {
    return { valid: false, error: `Tenant '${tenantId}' not found` };
  }
  if (tenant.status === "suspended") {
    return { valid: false, error: `Tenant '${tenantId}' is suspended` };
  }
  return { valid: true };
};

// ==================== Mappings ====================

router.get("/mappings", async (req, res) => {
  const connectorId = req.query.connector as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const mappings = await storage.getMappings(connectorId, limit, offset);
  res.json(mappings);
});

router.get("/mappings/:id", async (req, res) => {
  const mapping = await storage.getMapping(req.params.id);
  if (!mapping) {
    return res.status(404).json({ error: "Mapping not found" });
  }
  res.json(mapping);
});

// SECURITY: Capability enforcement for mapping write operations
router.post("/mappings", requireCapability("mapping_write"), async (req, res) => {
  const user = (req as any).user;
  const mapping = await storage.createMapping(req.body);
  await storage.createAuditLog({
    tenantId: user?.tenantId || "default",
    userId: user?.id || "admin",
    action: "create",
    resourceType: "mapping",
    resourceId: mapping.id,
    newState: { name: mapping.name },
    ipAddress: req.ip || "unknown",
  });
  res.status(201).json(mapping);
});

router.patch("/mappings/:id", requireCapability("mapping_write"), async (req, res) => {
  const mapping = await storage.updateMapping(req.params.id, req.body);
  if (!mapping) {
    return res.status(404).json({ error: "Mapping not found" });
  }
  res.json(mapping);
});

router.delete("/mappings/:id", async (req, res) => {
  const deleted = await storage.deleteMapping(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Mapping not found" });
  }
  res.status(204).send();
});

// ==================== Mapping Configs ====================

router.get("/mapping-configs", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;
    const connectorId = req.query.connectorId as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "tenantId query parameter is required" });
    }

    const tenantValidation = await validateTenant(tenantId);
    if (!tenantValidation.valid) {
      return res.status(401).json({ error: tenantValidation.error });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const configs = await storage.getMappingConfigs(tenantId, connectorId, limit, offset);
    res.json(configs);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch mapping configs",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/mapping-configs/:id", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "tenantId query parameter is required" });
    }

    const tenantValidation = await validateTenant(tenantId);
    if (!tenantValidation.valid) {
      return res.status(401).json({ error: tenantValidation.error });
    }

    const config = await storage.getMappingConfig(req.params.id);
    if (!config) {
      return res.status(404).json({ error: "Mapping config not found" });
    }

    if (config.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied: config belongs to a different tenant" });
    }

    res.json(config);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch mapping config",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// SECURITY: Capability enforcement for mapping config write operations
router.post("/mapping-configs", requireCapability("mapping_write"), async (req, res) => {
  try {
    const user = (req as any).user;
    const { tenantId, connectorId, endpointId, ...configData } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required in request body" });
    }

    const tenantValidation = await validateTenant(tenantId);
    if (!tenantValidation.valid) {
      return res.status(401).json({ error: tenantValidation.error });
    }

    const parseResult = mappingConfigPayloadSchema.safeParse(configData);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Invalid mapping configuration",
        details: parseResult.error.errors,
      });
    }

    const validationResult = mappingEngine.validateMapping(parseResult.data);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Mapping validation failed",
        errors: validationResult.errors,
      });
    }

    const config = await storage.createMappingConfig({
      tenantId,
      connectorId,
      endpointId,
      name: parseResult.data.name,
      sourceType: parseResult.data.sourceType,
      targetEntity: parseResult.data.targetEntity,
      fieldMappings: parseResult.data.fieldMappings,
      arrayPath: parseResult.data.arrayPath,
    });

    await storage.createAuditLog({
      tenantId,
      userId: user?.id || "admin",
      action: "create",
      resourceType: "mapping_config",
      resourceId: config.id,
      newState: { name: config.name, version: config.version },
      ipAddress: req.ip || "unknown",
    });

    res.status(201).json(config);
  } catch (error) {
    res.status(500).json({
      error: "Failed to create mapping config",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.patch("/mapping-configs/:id", requireCapability("mapping_write"), async (req, res) => {
  try {
    const tenantId = req.body.tenantId || req.query.tenantId as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required" });
    }

    const tenantValidation = await validateTenant(tenantId);
    if (!tenantValidation.valid) {
      return res.status(401).json({ error: tenantValidation.error });
    }

    const existingConfig = await storage.getMappingConfig(req.params.id);
    if (!existingConfig) {
      return res.status(404).json({ error: "Mapping config not found" });
    }

    if (existingConfig.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied: config belongs to a different tenant" });
    }

    await storage.createMappingHistory({
      mappingConfigId: existingConfig.id,
      version: existingConfig.version,
      fieldMappings: existingConfig.fieldMappings as Record<string, unknown>,
      arrayPath: existingConfig.arrayPath || undefined,
      changedBy: "admin",
      changeReason: req.body.changeReason || "Update",
    });

    const { fieldMappings, arrayPath, name, sourceType, targetEntity, tenantId: _, ...otherUpdates } = req.body;

    if (fieldMappings) {
      const validationPayload = {
        name: name || existingConfig.name,
        sourceType: sourceType || existingConfig.sourceType,
        targetEntity: targetEntity || existingConfig.targetEntity,
        fieldMappings,
        arrayPath: arrayPath ?? existingConfig.arrayPath,
      };

      const parseResult = mappingConfigPayloadSchema.safeParse(validationPayload);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid field mappings",
          details: parseResult.error.errors,
        });
      }

      const validationResult = mappingEngine.validateMapping(parseResult.data);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Mapping validation failed",
          errors: validationResult.errors,
        });
      }
    }

    const updates = {
      ...otherUpdates,
      ...(fieldMappings && { fieldMappings }),
      ...(arrayPath !== undefined && { arrayPath }),
      ...(name && { name }),
      ...(sourceType && { sourceType }),
      ...(targetEntity && { targetEntity }),
      version: existingConfig.version + 1,
      updatedAt: new Date(),
    };

    const updated = await storage.updateMappingConfig(req.params.id, updates);

    await storage.createAuditLog({
      tenantId: existingConfig.tenantId,
      userId: "admin",
      action: "update",
      resourceType: "mapping_config",
      resourceId: req.params.id,
      previousState: { version: existingConfig.version },
      newState: { version: updated?.version },
      ipAddress: req.ip || "unknown",
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({
      error: "Failed to update mapping config",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.delete("/mapping-configs/:id", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "tenantId query parameter is required" });
    }

    const tenantValidation = await validateTenant(tenantId);
    if (!tenantValidation.valid) {
      return res.status(401).json({ error: tenantValidation.error });
    }

    const config = await storage.getMappingConfig(req.params.id);
    if (!config) {
      return res.status(404).json({ error: "Mapping config not found" });
    }

    if (config.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied: config belongs to a different tenant" });
    }

    await storage.deleteMappingConfig(req.params.id);

    await storage.createAuditLog({
      tenantId: config.tenantId,
      userId: "admin",
      action: "delete",
      resourceType: "mapping_config",
      resourceId: req.params.id,
      previousState: { name: config.name, version: config.version },
      ipAddress: req.ip || "unknown",
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: "Failed to delete mapping config",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/mapping-configs/:id/preview", async (req, res) => {
  try {
    const tenantId = req.body.tenantId || req.query.tenantId as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required" });
    }

    const tenantValidation = await validateTenant(tenantId);
    if (!tenantValidation.valid) {
      return res.status(401).json({ error: tenantValidation.error });
    }

    const config = await storage.getMappingConfig(req.params.id);
    if (!config) {
      return res.status(404).json({ error: "Mapping config not found" });
    }

    if (config.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied: config belongs to a different tenant" });
    }

    const { sampleData } = req.body;
    if (!sampleData) {
      return res.status(400).json({ error: "sampleData is required" });
    }

    const mappingPayload = {
      name: config.name,
      sourceType: config.sourceType as "items" | "locations" | "stock_balances" | "stock_movements",
      targetEntity: config.targetEntity as "items" | "locations" | "stockBalances" | "stockMovements",
      fieldMappings: config.fieldMappings as any[],
      arrayPath: config.arrayPath || undefined,
    };

    const result = await mappingEngine.previewMapping(sampleData, mappingPayload);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "Failed to preview mapping",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/mapping-configs/:id/validate", async (req, res) => {
  try {
    const tenantId = req.body.tenantId || req.query.tenantId as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required" });
    }

    const tenantValidation = await validateTenant(tenantId);
    if (!tenantValidation.valid) {
      return res.status(401).json({ error: tenantValidation.error });
    }

    const config = await storage.getMappingConfig(req.params.id);
    if (!config) {
      return res.status(404).json({ error: "Mapping config not found" });
    }

    if (config.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied: config belongs to a different tenant" });
    }

    const mappingPayload = {
      id: config.id,
      name: config.name,
      version: config.version,
      sourceType: config.sourceType as "items" | "locations" | "stock_balances" | "stock_movements",
      targetEntity: config.targetEntity as "items" | "locations" | "stockBalances" | "stockMovements",
      fieldMappings: config.fieldMappings as any[],
      arrayPath: config.arrayPath || undefined,
    };

    const result = mappingEngine.validateMapping(mappingPayload);
    res.json({
      valid: result.success,
      errors: result.errors,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to validate mapping",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/mapping-configs/:id/transform", async (req, res) => {
  try {
    const { data, persist = false, tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required in request body" });
    }

    const tenantValidation = await validateTenant(tenantId);
    if (!tenantValidation.valid) {
      return res.status(401).json({ error: tenantValidation.error });
    }

    const config = await storage.getMappingConfig(req.params.id);
    if (!config) {
      return res.status(404).json({ error: "Mapping config not found" });
    }

    if (config.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied: config belongs to a different tenant" });
    }

    if (!data) {
      return res.status(400).json({ error: "data is required" });
    }

    if (persist) {
      const result = await mappingEngine.transformAndPersist(data, req.params.id, tenantId);

      await storage.createAuditLog({
        tenantId,
        userId: "admin",
        action: "transform_persist",
        resourceType: "mapping_config",
        resourceId: req.params.id,
        newState: result.data,
        ipAddress: req.ip || "unknown",
      });

      res.json(result);
    } else {
      const result = await mappingEngine.transformPayload(data, req.params.id);
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({
      error: "Failed to transform data",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/mapping-configs/:id/history", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string | undefined;

    if (!tenantId) {
      return res.status(400).json({ error: "tenantId query parameter is required" });
    }

    const tenantValidation = await validateTenant(tenantId);
    if (!tenantValidation.valid) {
      return res.status(401).json({ error: tenantValidation.error });
    }

    const config = await storage.getMappingConfig(req.params.id);
    if (!config) {
      return res.status(404).json({ error: "Mapping config not found" });
    }

    if (config.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied: config belongs to a different tenant" });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const history = await storage.getMappingHistory(req.params.id, limit, offset);
    res.json({
      currentVersion: config.version,
      history: history.sort((a, b) => b.version - a.version),
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch mapping history",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/mapping-configs/:id/rollback", async (req, res) => {
  try {
    const { targetVersion, tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: "tenantId is required in request body" });
    }

    const tenantValidation = await validateTenant(tenantId);
    if (!tenantValidation.valid) {
      return res.status(401).json({ error: tenantValidation.error });
    }

    const config = await storage.getMappingConfig(req.params.id);
    if (!config) {
      return res.status(404).json({ error: "Mapping config not found" });
    }

    if (config.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied: config belongs to a different tenant" });
    }

    if (typeof targetVersion !== "number") {
      return res.status(400).json({ error: "targetVersion is required and must be a number" });
    }

    const result = await mappingEngine.rollbackToVersion(req.params.id, targetVersion);

    if (!result.success) {
      return res.status(400).json({
        error: "Rollback failed",
        errors: result.errors,
      });
    }

    await storage.createAuditLog({
      tenantId: result.data!.tenantId,
      userId: "admin",
      action: "rollback",
      resourceType: "mapping_config",
      resourceId: req.params.id,
      newState: { rolledBackToVersion: targetVersion, newVersion: result.data!.version },
      ipAddress: req.ip || "unknown",
    });

    res.json(result.data);
  } catch (error) {
    res.status(500).json({
      error: "Failed to rollback mapping config",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
