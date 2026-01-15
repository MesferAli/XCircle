import { storage } from "./storage";
import type {
  FieldMapping,
  MappingConfig,
  MappingConfigPayload,
  InsertItem,
  InsertLocation,
  InsertStockBalance,
  InsertStockMovement,
} from "@shared/schema";
import { fieldMappingSchema } from "@shared/schema";
import { z } from "zod";
import { JSONPath } from "jsonpath-plus";

export interface ValidationError {
  field: string;
  message: string;
  path?: string;
}

export interface TransformResult<T = unknown> {
  success: boolean;
  data?: T;
  errors: ValidationError[];
  warnings?: string[];
}

export interface PreviewResult {
  success: boolean;
  input: unknown;
  output: unknown;
  errors: ValidationError[];
  fieldResults: Array<{
    sourceField: string;
    targetField: string;
    sourceValue: unknown;
    transformedValue: unknown;
    applied: boolean;
    error?: string;
  }>;
}

const itemRequiredFields = ["sku", "name"];
const locationRequiredFields = ["name", "type"];
const stockBalanceRequiredFields = ["itemId", "locationId", "quantityOnHand"];
const stockMovementRequiredFields = ["itemId", "locationId", "movementType", "quantity"];

export class MappingEngine {
  extractValue(obj: unknown, path: string): unknown {
    if (!path || !obj) {
      return undefined;
    }

    if (typeof obj !== "object") {
      return undefined;
    }

    let normalizedPath = path;
    if (!normalizedPath.startsWith("$")) {
      normalizedPath = "$." + normalizedPath;
    }

    try {
      const results = JSONPath({ path: normalizedPath, json: obj, wrap: true });
      if (!results || results.length === 0) {
        return undefined;
      }
      if (results.length === 1) {
        return results[0];
      }
      return results;
    } catch (error) {
      console.warn(`JSONPath extraction failed for path "${normalizedPath}":`, error);
      return undefined;
    }
  }


  applyTransform(value: unknown, transform?: string): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    switch (transform) {
      case "toString":
        return String(value);
      case "toNumber":
        const num = Number(value);
        return isNaN(num) ? null : num;
      case "toDate":
        const date = new Date(value as string | number);
        return isNaN(date.getTime()) ? null : date;
      case "uppercase":
        return typeof value === "string" ? value.toUpperCase() : value;
      case "lowercase":
        return typeof value === "string" ? value.toLowerCase() : value;
      case "trim":
        return typeof value === "string" ? value.trim() : value;
      default:
        return value;
    }
  }

  validateMapping(mappingConfig: MappingConfigPayload): TransformResult<boolean> {
    const errors: ValidationError[] = [];

    if (!mappingConfig.name || mappingConfig.name.trim() === "") {
      errors.push({ field: "name", message: "Mapping name is required" });
    }

    if (!mappingConfig.sourceType) {
      errors.push({ field: "sourceType", message: "Source type is required" });
    }

    if (!mappingConfig.targetEntity) {
      errors.push({ field: "targetEntity", message: "Target entity is required" });
    }

    if (!mappingConfig.fieldMappings || !Array.isArray(mappingConfig.fieldMappings)) {
      errors.push({ field: "fieldMappings", message: "Field mappings must be an array" });
    } else {
      mappingConfig.fieldMappings.forEach((mapping, index) => {
        try {
          fieldMappingSchema.parse(mapping);
        } catch (e) {
          if (e instanceof z.ZodError) {
            e.errors.forEach((err) => {
              errors.push({
                field: `fieldMappings[${index}].${err.path.join(".")}`,
                message: err.message,
              });
            });
          }
        }

        if (!mapping.sourceField) {
          errors.push({
            field: `fieldMappings[${index}].sourceField`,
            message: "Source field is required",
          });
        }
        if (!mapping.targetField) {
          errors.push({
            field: `fieldMappings[${index}].targetField`,
            message: "Target field is required",
          });
        }
      });
    }

    const requiredFields = this.getRequiredFieldsForEntity(mappingConfig.targetEntity);
    const mappedTargetFields = mappingConfig.fieldMappings?.map((m) => m.targetField) || [];
    
    for (const requiredField of requiredFields) {
      if (!mappedTargetFields.includes(requiredField)) {
        const hasRequiredMapping = mappingConfig.fieldMappings?.some(
          (m) => m.targetField === requiredField && (m.required || m.defaultValue !== undefined)
        );
        if (!hasRequiredMapping) {
          errors.push({
            field: requiredField,
            message: `Required field '${requiredField}' is not mapped and has no default value`,
          });
        }
      }
    }

    return {
      success: errors.length === 0,
      data: errors.length === 0,
      errors,
    };
  }

  private getRequiredFieldsForEntity(targetEntity: string): string[] {
    switch (targetEntity) {
      case "items":
        return itemRequiredFields;
      case "locations":
        return locationRequiredFields;
      case "stockBalances":
        return stockBalanceRequiredFields;
      case "stockMovements":
        return stockMovementRequiredFields;
      default:
        return [];
    }
  }

  validateOutput(data: unknown, targetEntity: string): TransformResult<boolean> {
    const errors: ValidationError[] = [];

    if (!data || typeof data !== "object") {
      errors.push({ field: "root", message: "Output data must be an object" });
      return { success: false, data: false, errors };
    }

    const record = data as Record<string, unknown>;
    const requiredFields = this.getRequiredFieldsForEntity(targetEntity);

    for (const field of requiredFields) {
      if (record[field] === undefined || record[field] === null) {
        errors.push({
          field,
          message: `Required field '${field}' is missing or null`,
        });
      }
    }

    switch (targetEntity) {
      case "items":
        if (record.reorderPoint !== undefined && typeof record.reorderPoint !== "number") {
          errors.push({ field: "reorderPoint", message: "reorderPoint must be a number" });
        }
        if (record.leadTimeDays !== undefined && typeof record.leadTimeDays !== "number") {
          errors.push({ field: "leadTimeDays", message: "leadTimeDays must be a number" });
        }
        break;

      case "stockBalances":
        if (record.quantityOnHand !== undefined && typeof record.quantityOnHand !== "number") {
          errors.push({ field: "quantityOnHand", message: "quantityOnHand must be a number" });
        }
        if (record.quantityReserved !== undefined && typeof record.quantityReserved !== "number") {
          errors.push({ field: "quantityReserved", message: "quantityReserved must be a number" });
        }
        break;

      case "stockMovements":
        if (record.quantity !== undefined && typeof record.quantity !== "number") {
          errors.push({ field: "quantity", message: "quantity must be a number" });
        }
        const validMovementTypes = ["in", "out", "transfer", "adjustment"];
        if (record.movementType && !validMovementTypes.includes(record.movementType as string)) {
          errors.push({
            field: "movementType",
            message: `movementType must be one of: ${validMovementTypes.join(", ")}`,
          });
        }
        break;

      case "locations":
        const validLocationTypes = ["warehouse", "store", "distribution_center"];
        if (record.type && !validLocationTypes.includes(record.type as string)) {
          errors.push({
            field: "type",
            message: `type must be one of: ${validLocationTypes.join(", ")}`,
          });
        }
        break;
    }

    return {
      success: errors.length === 0,
      data: errors.length === 0,
      errors,
    };
  }

  transformRecord(
    data: unknown,
    fieldMappings: FieldMapping[]
  ): TransformResult<Record<string, unknown>> {
    const errors: ValidationError[] = [];
    const result: Record<string, unknown> = {};

    for (const mapping of fieldMappings) {
      let value = this.extractValue(data, mapping.sourceField);

      if (value === undefined || value === null) {
        if (mapping.defaultValue !== undefined) {
          value = mapping.defaultValue;
        } else if (mapping.required) {
          errors.push({
            field: mapping.targetField,
            message: `Required field '${mapping.sourceField}' is missing`,
            path: mapping.sourceField,
          });
          continue;
        } else {
          continue;
        }
      }

      const transformedValue = this.applyTransform(value, mapping.transform);
      result[mapping.targetField] = transformedValue;
    }

    return {
      success: errors.length === 0,
      data: result,
      errors,
    };
  }

  async transformPayload(
    data: unknown,
    mappingId: string
  ): Promise<TransformResult<unknown[]>> {
    const mappingConfig = await storage.getMappingConfig(mappingId);
    if (!mappingConfig) {
      return {
        success: false,
        errors: [{ field: "mappingId", message: `Mapping config '${mappingId}' not found` }],
      };
    }

    const fieldMappings = mappingConfig.fieldMappings as FieldMapping[];
    let records: unknown[];

    if (mappingConfig.arrayPath) {
      const extracted = this.extractValue(data, mappingConfig.arrayPath);
      if (!Array.isArray(extracted)) {
        return {
          success: false,
          errors: [
            {
              field: "arrayPath",
              message: `Array path '${mappingConfig.arrayPath}' did not return an array`,
            },
          ],
        };
      }
      records = extracted;
    } else if (Array.isArray(data)) {
      records = data;
    } else {
      records = [data];
    }

    const transformedRecords: unknown[] = [];
    const allErrors: ValidationError[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const transformResult = this.transformRecord(record, fieldMappings);

      if (transformResult.success && transformResult.data) {
        const validationResult = this.validateOutput(
          transformResult.data,
          mappingConfig.targetEntity
        );

        if (validationResult.success) {
          transformedRecords.push(transformResult.data);
        } else {
          validationResult.errors.forEach((err) => {
            allErrors.push({
              ...err,
              field: `[${i}].${err.field}`,
            });
          });
        }
      } else {
        transformResult.errors.forEach((err) => {
          allErrors.push({
            ...err,
            field: `[${i}].${err.field}`,
          });
        });
      }
    }

    return {
      success: allErrors.length === 0,
      data: transformedRecords,
      errors: allErrors,
      warnings:
        transformedRecords.length < records.length
          ? [`${records.length - transformedRecords.length} records failed transformation`]
          : undefined,
    };
  }

  async previewMapping(
    sampleData: unknown,
    mappingConfig: MappingConfigPayload
  ): Promise<PreviewResult> {
    const fieldMappings = mappingConfig.fieldMappings;
    const fieldResults: PreviewResult["fieldResults"] = [];
    const errors: ValidationError[] = [];

    let record: unknown;
    if (mappingConfig.arrayPath) {
      const extracted = this.extractValue(sampleData, mappingConfig.arrayPath);
      if (Array.isArray(extracted) && extracted.length > 0) {
        record = extracted[0];
      } else {
        record = sampleData;
      }
    } else if (Array.isArray(sampleData) && sampleData.length > 0) {
      record = sampleData[0];
    } else {
      record = sampleData;
    }

    const output: Record<string, unknown> = {};

    for (const mapping of fieldMappings) {
      let sourceValue = this.extractValue(record, mapping.sourceField);
      let transformedValue: unknown;
      let applied = true;
      let error: string | undefined;

      if (sourceValue === undefined || sourceValue === null) {
        if (mapping.defaultValue !== undefined) {
          sourceValue = mapping.defaultValue;
          transformedValue = this.applyTransform(sourceValue, mapping.transform);
        } else if (mapping.required) {
          applied = false;
          error = `Required field '${mapping.sourceField}' is missing`;
          errors.push({ field: mapping.targetField, message: error, path: mapping.sourceField });
        } else {
          applied = false;
          transformedValue = undefined;
        }
      } else {
        transformedValue = this.applyTransform(sourceValue, mapping.transform);
      }

      if (applied && transformedValue !== undefined) {
        output[mapping.targetField] = transformedValue;
      }

      fieldResults.push({
        sourceField: mapping.sourceField,
        targetField: mapping.targetField,
        sourceValue,
        transformedValue,
        applied,
        error,
      });
    }

    return {
      success: errors.length === 0,
      input: record,
      output,
      errors,
      fieldResults,
    };
  }

  transformToItem(
    data: Record<string, unknown>,
    tenantId: string
  ): TransformResult<InsertItem> {
    const errors: ValidationError[] = [];

    if (!data.sku) {
      errors.push({ field: "sku", message: "SKU is required" });
    }
    if (!data.name) {
      errors.push({ field: "name", message: "Name is required" });
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const item: InsertItem = {
      tenantId,
      sku: String(data.sku),
      name: String(data.name),
      externalId: data.externalId ? String(data.externalId) : undefined,
      description: data.description ? String(data.description) : undefined,
      category: data.category ? String(data.category) : undefined,
      unit: data.unit ? String(data.unit) : undefined,
      reorderPoint: typeof data.reorderPoint === "number" ? data.reorderPoint : undefined,
      reorderQuantity: typeof data.reorderQuantity === "number" ? data.reorderQuantity : undefined,
      leadTimeDays: typeof data.leadTimeDays === "number" ? data.leadTimeDays : undefined,
    };

    return { success: true, data: item, errors: [] };
  }

  transformToLocation(
    data: Record<string, unknown>,
    tenantId: string
  ): TransformResult<InsertLocation> {
    const errors: ValidationError[] = [];

    if (!data.name) {
      errors.push({ field: "name", message: "Name is required" });
    }
    if (!data.type) {
      errors.push({ field: "type", message: "Type is required" });
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const location: InsertLocation = {
      tenantId,
      name: String(data.name),
      type: String(data.type),
      externalId: data.externalId ? String(data.externalId) : undefined,
      address: data.address ? String(data.address) : undefined,
    };

    return { success: true, data: location, errors: [] };
  }

  transformToStockBalance(
    data: Record<string, unknown>,
    tenantId: string
  ): TransformResult<InsertStockBalance> {
    const errors: ValidationError[] = [];

    if (!data.itemId) {
      errors.push({ field: "itemId", message: "Item ID is required" });
    }
    if (!data.locationId) {
      errors.push({ field: "locationId", message: "Location ID is required" });
    }
    if (data.quantityOnHand === undefined || data.quantityOnHand === null) {
      errors.push({ field: "quantityOnHand", message: "Quantity on hand is required" });
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const stockBalance: InsertStockBalance = {
      tenantId,
      itemId: String(data.itemId),
      locationId: String(data.locationId),
      quantityOnHand: Number(data.quantityOnHand),
      quantityReserved:
        data.quantityReserved !== undefined ? Number(data.quantityReserved) : undefined,
      quantityAvailable:
        data.quantityAvailable !== undefined ? Number(data.quantityAvailable) : undefined,
    };

    return { success: true, data: stockBalance, errors: [] };
  }

  transformToStockMovement(
    data: Record<string, unknown>,
    tenantId: string
  ): TransformResult<InsertStockMovement> {
    const errors: ValidationError[] = [];

    if (!data.itemId) {
      errors.push({ field: "itemId", message: "Item ID is required" });
    }
    if (!data.locationId) {
      errors.push({ field: "locationId", message: "Location ID is required" });
    }
    if (!data.movementType) {
      errors.push({ field: "movementType", message: "Movement type is required" });
    }
    if (data.quantity === undefined || data.quantity === null) {
      errors.push({ field: "quantity", message: "Quantity is required" });
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const stockMovement: InsertStockMovement = {
      tenantId,
      itemId: String(data.itemId),
      locationId: String(data.locationId),
      movementType: String(data.movementType),
      quantity: Number(data.quantity),
      referenceId: data.referenceId ? String(data.referenceId) : undefined,
    };

    return { success: true, data: stockMovement, errors: [] };
  }

  private async validateForeignKeyReferences(
    data: Record<string, unknown>,
    targetEntity: string,
    tenantId: string
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    if (targetEntity === "stockBalances" || targetEntity === "stockMovements") {
      const itemId = data.itemId ? String(data.itemId) : null;
      const locationId = data.locationId ? String(data.locationId) : null;

      if (itemId) {
        const items = await storage.getItems(tenantId);
        const itemExists = items.some((item) => item.id === itemId || item.externalId === itemId || item.sku === itemId);
        if (!itemExists) {
          errors.push({
            field: "itemId",
            message: `Item '${itemId}' does not exist in tenant '${tenantId}'`,
          });
        }
      }

      if (locationId) {
        const locations = await storage.getLocations(tenantId);
        const locationExists = locations.some((loc) => loc.id === locationId || loc.externalId === locationId);
        if (!locationExists) {
          errors.push({
            field: "locationId",
            message: `Location '${locationId}' does not exist in tenant '${tenantId}'`,
          });
        }
      }
    }

    return errors;
  }

  private async resolveOrCreateItem(
    itemRef: string,
    tenantId: string
  ): Promise<string | null> {
    const items = await storage.getItems(tenantId);
    const existingItem = items.find((item) => 
      item.id === itemRef || item.externalId === itemRef || item.sku === itemRef
    );
    return existingItem?.id || null;
  }

  private async resolveOrCreateLocation(
    locationRef: string,
    tenantId: string
  ): Promise<string | null> {
    const locations = await storage.getLocations(tenantId);
    const existingLocation = locations.find((loc) => 
      loc.id === locationRef || loc.externalId === locationRef
    );
    return existingLocation?.id || null;
  }

  async transformAndPersist(
    data: unknown,
    mappingId: string,
    tenantId: string
  ): Promise<TransformResult<{ created: number; failed: number }>> {
    const transformResult = await this.transformPayload(data, mappingId);

    if (!transformResult.success || !transformResult.data) {
      return {
        success: false,
        errors: transformResult.errors,
      };
    }

    const mappingConfig = await storage.getMappingConfig(mappingId);
    if (!mappingConfig) {
      return {
        success: false,
        errors: [{ field: "mappingId", message: "Mapping config not found" }],
      };
    }

    if (mappingConfig.tenantId !== tenantId) {
      return {
        success: false,
        errors: [{ field: "tenantId", message: "Mapping config does not belong to this tenant" }],
      };
    }

    let created = 0;
    let failed = 0;
    const errors: ValidationError[] = [];

    for (let i = 0; i < transformResult.data.length; i++) {
      const record = transformResult.data[i] as Record<string, unknown>;

      try {
        const fkErrors = await this.validateForeignKeyReferences(
          record,
          mappingConfig.targetEntity,
          tenantId
        );

        if (fkErrors.length > 0) {
          failed++;
          fkErrors.forEach((err) =>
            errors.push({ ...err, field: `[${i}].${err.field}` })
          );
          continue;
        }

        switch (mappingConfig.targetEntity) {
          case "items": {
            const result = this.transformToItem(record, tenantId);
            if (result.success && result.data) {
              await storage.createItem(result.data);
              created++;
            } else {
              failed++;
              result.errors.forEach((err) =>
                errors.push({ ...err, field: `[${i}].${err.field}` })
              );
            }
            break;
          }
          case "locations": {
            const result = this.transformToLocation(record, tenantId);
            if (result.success && result.data) {
              await storage.createLocation(result.data);
              created++;
            } else {
              failed++;
              result.errors.forEach((err) =>
                errors.push({ ...err, field: `[${i}].${err.field}` })
              );
            }
            break;
          }
          case "stockBalances": {
            const resolvedItemId = await this.resolveOrCreateItem(String(record.itemId), tenantId);
            const resolvedLocationId = await this.resolveOrCreateLocation(String(record.locationId), tenantId);
            
            if (!resolvedItemId || !resolvedLocationId) {
              failed++;
              if (!resolvedItemId) {
                errors.push({
                  field: `[${i}].itemId`,
                  message: `Could not resolve item '${record.itemId}' for tenant '${tenantId}'`,
                });
              }
              if (!resolvedLocationId) {
                errors.push({
                  field: `[${i}].locationId`,
                  message: `Could not resolve location '${record.locationId}' for tenant '${tenantId}'`,
                });
              }
              break;
            }

            const resolvedRecord = { ...record, itemId: resolvedItemId, locationId: resolvedLocationId };
            const result = this.transformToStockBalance(resolvedRecord, tenantId);
            if (result.success && result.data) {
              await storage.createStockBalance(result.data);
              created++;
            } else {
              failed++;
              result.errors.forEach((err) =>
                errors.push({ ...err, field: `[${i}].${err.field}` })
              );
            }
            break;
          }
          case "stockMovements": {
            const resolvedItemId = await this.resolveOrCreateItem(String(record.itemId), tenantId);
            const resolvedLocationId = await this.resolveOrCreateLocation(String(record.locationId), tenantId);
            
            if (!resolvedItemId || !resolvedLocationId) {
              failed++;
              if (!resolvedItemId) {
                errors.push({
                  field: `[${i}].itemId`,
                  message: `Could not resolve item '${record.itemId}' for tenant '${tenantId}'`,
                });
              }
              if (!resolvedLocationId) {
                errors.push({
                  field: `[${i}].locationId`,
                  message: `Could not resolve location '${record.locationId}' for tenant '${tenantId}'`,
                });
              }
              break;
            }

            const resolvedRecord = { ...record, itemId: resolvedItemId, locationId: resolvedLocationId };
            const result = this.transformToStockMovement(resolvedRecord, tenantId);
            if (result.success && result.data) {
              await storage.createStockMovement(result.data);
              created++;
            } else {
              failed++;
              result.errors.forEach((err) =>
                errors.push({ ...err, field: `[${i}].${err.field}` })
              );
            }
            break;
          }
          default:
            failed++;
            errors.push({
              field: `[${i}]`,
              message: `Unknown target entity: ${mappingConfig.targetEntity}`,
            });
        }
      } catch (err) {
        failed++;
        errors.push({
          field: `[${i}]`,
          message: err instanceof Error ? err.message : "Unknown error during persistence",
        });
      }
    }

    return {
      success: failed === 0,
      data: { created, failed },
      errors,
    };
  }

  async rollbackToVersion(
    mappingConfigId: string,
    targetVersion: number
  ): Promise<TransformResult<MappingConfig>> {
    const historyEntry = await storage.getMappingHistoryByVersion(mappingConfigId, targetVersion);

    if (!historyEntry) {
      return {
        success: false,
        errors: [
          {
            field: "version",
            message: `Version ${targetVersion} not found for mapping ${mappingConfigId}`,
          },
        ],
      };
    }

    const currentConfig = await storage.getMappingConfig(mappingConfigId);
    if (!currentConfig) {
      return {
        success: false,
        errors: [{ field: "mappingConfigId", message: "Mapping config not found" }],
      };
    }

    await storage.createMappingHistory({
      mappingConfigId,
      version: currentConfig.version,
      fieldMappings: currentConfig.fieldMappings as object,
      arrayPath: currentConfig.arrayPath || undefined,
      changedBy: "system",
      changeReason: `Rollback to version ${targetVersion}`,
    });

    const updated = await storage.updateMappingConfig(mappingConfigId, {
      fieldMappings: historyEntry.fieldMappings,
      arrayPath: historyEntry.arrayPath,
      version: currentConfig.version + 1,
      updatedAt: new Date(),
    });

    if (!updated) {
      return {
        success: false,
        errors: [{ field: "mappingConfigId", message: "Failed to update mapping config" }],
      };
    }

    return {
      success: true,
      data: updated,
      errors: [],
    };
  }

  async getMappingVersions(mappingConfigId: string): Promise<MappingConfig["version"][]> {
    const history = await storage.getMappingHistory(mappingConfigId);
    return history.map((h) => h.version);
  }
}

export const mappingEngine = new MappingEngine();
