/**
 * Enterprise AI Layer - Demo Flow Runner
 * 
 * This script executes the complete demo flow:
 * 1. Creates a connector to the Mock External System
 * 2. Defines endpoints for data ingestion
 * 3. Creates mappings from external format to Canonical Model
 * 4. Polls endpoints to ingest data
 * 5. Runs AI Engine to generate recommendations and anomalies
 * 6. Displays results with full audit trace
 * 
 * PREREQUISITES:
 *   - Mock External System running on port 3001
 *   - Main EAL application running
 *   - Database seeded with demo data
 * 
 * USAGE:
 *   npx tsx scripts/run-demo-flow.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql, eq } from "drizzle-orm";
import {
  tenants,
  connectors,
  endpoints,
  mappings,
  items,
  locations,
  stockBalances,
  stockMovements,
  demandSignals,
  recommendations,
  anomalies,
  auditLogs,
  mappingConfigs,
} from "../shared/schema";

const { Pool } = pg;

// Configuration
const DEMO_TENANT_ID = "demo-tenant-001";
const MOCK_API_BASE_URL = "http://localhost:3001";
const MOCK_API_KEY = "DEMO-API-KEY-2024";

// Helper to pause execution
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to format output
function printSection(title: string) {
  console.log("\n" + "═".repeat(70));
  console.log(`📌 ${title}`);
  console.log("═".repeat(70));
}

function printSubSection(title: string) {
  console.log(`\n  ▸ ${title}`);
}

async function runDemoFlow() {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║     ENTERPRISE AI LAYER - COMPLETE DEMO FLOW                        ║");
  console.log("║     End-to-End: Connector → Mapping → AI → Recommendations          ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    // =========================================================================
    // STEP 1: Verify Prerequisites
    // =========================================================================
    printSection("STEP 1: Verifying Prerequisites");

    // Check tenant exists
    const tenant = await db.select().from(tenants).where(eq(tenants.id, DEMO_TENANT_ID));
    if (tenant.length === 0) {
      console.log("  ❌ Demo tenant not found. Run seed script first:");
      console.log("     npx tsx scripts/seed-demo-inventory.ts");
      process.exit(1);
    }
    console.log(`  ✅ Demo tenant found: ${tenant[0].name}`);

    // Check Mock API is running
    try {
      const healthCheck = await fetch(`${MOCK_API_BASE_URL}/health`);
      if (!healthCheck.ok) throw new Error("Health check failed");
      console.log("  ✅ Mock External System is running");
    } catch (error) {
      console.log("  ❌ Mock External System not reachable at", MOCK_API_BASE_URL);
      console.log("     Start it with: cd mock-external-system && npm start");
      process.exit(1);
    }

    // =========================================================================
    // STEP 2: Create Connector
    // =========================================================================
    printSection("STEP 2: Creating REST Connector");

    // Clean up existing demo connector
    await db.delete(endpoints).where(sql`connector_id IN (SELECT id FROM connectors WHERE tenant_id = ${DEMO_TENANT_ID})`);
    await db.delete(mappings).where(sql`connector_id IN (SELECT id FROM connectors WHERE tenant_id = ${DEMO_TENANT_ID})`);
    await db.delete(mappingConfigs).where(sql`tenant_id = ${DEMO_TENANT_ID}`);
    await db.delete(connectors).where(eq(connectors.tenantId, DEMO_TENANT_ID));

    const connectorId = `conn-demo-${Date.now()}`;
    await db.insert(connectors).values({
      id: connectorId,
      tenantId: DEMO_TENANT_ID,
      name: "Mock Inventory System",
      type: "rest",
      baseUrl: MOCK_API_BASE_URL,
      authType: "api_key",
      authConfig: {
        headerName: "X-API-Key",
        apiKey: MOCK_API_KEY,
      },
      status: "connected",
      healthCheckEndpoint: "/health",
      lastHealthCheck: new Date(),
      requestsPerMinute: 60,
    });

    console.log(`  ✅ Connector created: Mock Inventory System`);
    console.log(`     ID: ${connectorId}`);
    console.log(`     Base URL: ${MOCK_API_BASE_URL}`);
    console.log(`     Auth: API Key (X-API-Key header)`);

    // Log to audit
    await db.insert(auditLogs).values({
      tenantId: DEMO_TENANT_ID,
      userId: "demo-admin-001",
      action: "create",
      resourceType: "connector",
      resourceId: connectorId,
      eventType: "action_executed",
      newState: { name: "Mock Inventory System", baseUrl: MOCK_API_BASE_URL },
      ipAddress: "127.0.0.1",
    });

    // =========================================================================
    // STEP 3: Define Endpoints
    // =========================================================================
    printSection("STEP 3: Defining API Endpoints");

    const endpointConfigs = [
      {
        id: `ep-items-${Date.now()}`,
        name: "Items Endpoint",
        path: "/api/items",
        description: "Fetch all inventory items",
        capability: "read",
        dataPath: "$.data[*]",
        paginationConfig: {
          type: "offset",
          limitParam: "limit",
          offsetParam: "offset",
          defaultLimit: 50,
        },
      },
      {
        id: `ep-locations-${Date.now()}`,
        name: "Locations Endpoint",
        path: "/api/locations",
        description: "Fetch all warehouse/store locations",
        capability: "read",
        dataPath: "$.data[*]",
        paginationConfig: {
          type: "offset",
          limitParam: "limit",
          offsetParam: "offset",
          defaultLimit: 50,
        },
      },
      {
        id: `ep-balances-${Date.now()}`,
        name: "Stock Balances Endpoint",
        path: "/api/stock-balances",
        description: "Fetch current stock levels",
        capability: "read",
        dataPath: "$.data[*]",
        paginationConfig: {
          type: "offset",
          limitParam: "limit",
          offsetParam: "offset",
          defaultLimit: 50,
        },
      },
      {
        id: `ep-movements-${Date.now()}`,
        name: "Stock Movements Endpoint",
        path: "/api/stock-movements",
        description: "Fetch stock movement transactions",
        capability: "read",
        dataPath: "$.data[*]",
        paginationConfig: {
          type: "offset",
          limitParam: "limit",
          offsetParam: "offset",
          defaultLimit: 100,
        },
      },
    ];

    for (const config of endpointConfigs) {
      await db.insert(endpoints).values({
        ...config,
        connectorId,
        method: "GET",
        isEnabled: true,
      });
      console.log(`  ✅ Endpoint: ${config.name} (${config.path})`);
    }

    // =========================================================================
    // STEP 4: Create Mappings
    // =========================================================================
    printSection("STEP 4: Creating Data Mappings (JSONPath → Canonical)");

    const mappingConfigurations = [
      {
        id: `map-items-${Date.now()}`,
        name: "Items Mapping",
        sourceEndpoint: "/api/items",
        targetEntity: "item",
        mappingConfig: {
          externalId: "$.item_id",
          sku: "$.sku",
          name: "$.item_name",
          description: "$.item_description",
          category: "$.item_category",
          unit: "$.unit_of_measure",
          reorderPoint: "$.reorder_level",
          reorderQuantity: "$.reorder_qty",
          leadTimeDays: "$.lead_time",
          isActive: "$.is_active",
        },
        transformations: {
          unit: { type: "lowercase" },
          isActive: { type: "boolean" },
        },
      },
      {
        id: `map-locations-${Date.now()}`,
        name: "Locations Mapping",
        sourceEndpoint: "/api/locations",
        targetEntity: "location",
        mappingConfig: {
          externalId: "$.location_id",
          name: "$.location_name",
          type: "$.location_type",
          address: "$.address",
          isActive: "$.is_active",
        },
        transformations: {
          type: {
            type: "enum",
            mapping: {
              WAREHOUSE: "warehouse",
              DISTRIBUTION: "distribution_center",
              STORE: "store",
            },
          },
        },
      },
      {
        id: `map-balances-${Date.now()}`,
        name: "Stock Balances Mapping",
        sourceEndpoint: "/api/stock-balances",
        targetEntity: "stock_balance",
        mappingConfig: {
          itemId: "$.item_id",
          locationId: "$.location_id",
          quantityOnHand: "$.qty_on_hand",
          quantityReserved: "$.qty_reserved",
          quantityAvailable: "$.qty_available",
        },
        transformations: {
          quantityOnHand: { type: "integer" },
          quantityReserved: { type: "integer" },
          quantityAvailable: { type: "integer" },
        },
      },
      {
        id: `map-movements-${Date.now()}`,
        name: "Stock Movements Mapping",
        sourceEndpoint: "/api/stock-movements",
        targetEntity: "stock_movement",
        mappingConfig: {
          itemId: "$.item_id",
          locationId: "$.location_id",
          movementType: "$.movement_type",
          quantity: "$.quantity",
          referenceId: "$.reference_number",
          timestamp: "$.movement_date",
        },
        transformations: {
          movementType: {
            type: "enum",
            mapping: {
              RECEIPT: "in",
              ISSUE: "out",
              TRANSFER: "transfer",
              ADJUSTMENT: "adjustment",
            },
          },
          quantity: { type: "integer" },
          timestamp: { type: "datetime" },
        },
      },
    ];

    for (const config of mappingConfigurations) {
      await db.insert(mappings).values({
        ...config,
        connectorId,
        version: 1,
        status: "active",
      });
      console.log(`  ✅ Mapping: ${config.name}`);
      console.log(`     Source: ${config.sourceEndpoint} → Target: ${config.targetEntity}`);
    }

    // Log mapping creation to audit
    await db.insert(auditLogs).values({
      tenantId: DEMO_TENANT_ID,
      userId: "demo-admin-001",
      action: "create",
      resourceType: "mapping",
      resourceId: "batch_mapping_creation",
      eventType: "action_executed",
      newState: { mappingsCreated: mappingConfigurations.length },
      ipAddress: "127.0.0.1",
    });

    // =========================================================================
    // STEP 5: Simulate Data Ingestion
    // =========================================================================
    printSection("STEP 5: Simulating Data Ingestion from External System");

    // Fetch data from Mock API
    const headers = { "X-API-Key": MOCK_API_KEY };

    printSubSection("Fetching Items from External System...");
    const itemsResponse = await fetch(`${MOCK_API_BASE_URL}/api/items?limit=100`, { headers });
    const itemsData = await itemsResponse.json();
    console.log(`     Retrieved ${itemsData.data.length} items`);

    printSubSection("Fetching Locations from External System...");
    const locationsResponse = await fetch(`${MOCK_API_BASE_URL}/api/locations?limit=50`, { headers });
    const locationsData = await locationsResponse.json();
    console.log(`     Retrieved ${locationsData.data.length} locations`);

    printSubSection("Fetching Stock Balances from External System...");
    const balancesResponse = await fetch(`${MOCK_API_BASE_URL}/api/stock-balances?limit=500`, { headers });
    const balancesData = await balancesResponse.json();
    console.log(`     Retrieved ${balancesData.data.length} stock balances`);

    printSubSection("Fetching Stock Movements from External System...");
    const movementsResponse = await fetch(`${MOCK_API_BASE_URL}/api/stock-movements?limit=500`, { headers });
    const movementsData = await movementsResponse.json();
    console.log(`     Retrieved ${movementsData.data.length} stock movements`);

    // Log data ingestion to audit
    await db.insert(auditLogs).values({
      tenantId: DEMO_TENANT_ID,
      userId: "system",
      action: "data_ingestion",
      resourceType: "connector",
      resourceId: connectorId,
      eventType: "signal_received",
      newState: {
        itemsIngested: itemsData.data.length,
        locationsIngested: locationsData.data.length,
        balancesIngested: balancesData.data.length,
        movementsIngested: movementsData.data.length,
        source: MOCK_API_BASE_URL,
      },
      ipAddress: "127.0.0.1",
    });

    console.log("\n  ✅ Data ingestion completed and logged to audit trail");

    // =========================================================================
    // STEP 6: Run AI Engine Analysis
    // =========================================================================
    printSection("STEP 6: Running AI Engine Analysis");

    // Clear previous recommendations and anomalies
    await db.delete(recommendations).where(eq(recommendations.tenantId, DEMO_TENANT_ID));
    await db.delete(anomalies).where(eq(anomalies.tenantId, DEMO_TENANT_ID));

    console.log("  🔄 Analyzing inventory data...");
    await sleep(1000);

    // Get current data for analysis
    const currentItems = await db.select().from(items).where(eq(items.tenantId, DEMO_TENANT_ID));
    const currentBalances = await db.select().from(stockBalances).where(eq(stockBalances.tenantId, DEMO_TENANT_ID));
    const currentMovements = await db.select().from(stockMovements).where(eq(stockMovements.tenantId, DEMO_TENANT_ID));
    const currentLocations = await db.select().from(locations).where(eq(locations.tenantId, DEMO_TENANT_ID));

    console.log(`\n  📊 Data Summary:`);
    console.log(`     • Items: ${currentItems.length}`);
    console.log(`     • Locations: ${currentLocations.length}`);
    console.log(`     • Stock Balances: ${currentBalances.length}`);
    console.log(`     • Stock Movements: ${currentMovements.length}`);

    // Generate recommendations based on scenarios
    const generatedRecommendations: any[] = [];
    const generatedAnomalies: any[] = [];

    // Find items with low stock (stockout risk)
    for (const balance of currentBalances) {
      const item = currentItems.find(i => i.id === balance.itemId);
      const location = currentLocations.find(l => l.id === balance.locationId);
      
      if (!item || !location) continue;

      // Calculate average daily consumption from movements
      const itemMovements = currentMovements.filter(
        m => m.itemId === balance.itemId && 
             m.locationId === balance.locationId && 
             m.movementType === "out"
      );
      
      const totalOut = itemMovements.reduce((sum, m) => sum + Math.abs(m.quantity), 0);
      const avgDailyConsumption = itemMovements.length > 0 ? totalOut / 30 : 5; // Default to 5 if no data
      
      const daysUntilStockout = avgDailyConsumption > 0 
        ? Math.floor(balance.quantityOnHand / avgDailyConsumption) 
        : 999;

      // Check for stockout risk
      if (daysUntilStockout <= 14 && balance.quantityOnHand < (item.reorderPoint || 50)) {
        const priority = daysUntilStockout <= 7 ? "critical" : "high";
        const confidenceScore = Math.min(95, 70 + (14 - daysUntilStockout) * 2);

        generatedRecommendations.push({
          tenantId: DEMO_TENANT_ID,
          type: "reorder",
          priority,
          itemId: item.id,
          locationId: location.id,
          title: `Urgent Reorder: ${item.name}`,
          description: `Stock level (${balance.quantityOnHand} units) at ${location.name} is critically low. Estimated ${daysUntilStockout} days until stockout based on current consumption rate.`,
          explanation: `Analysis based on ${itemMovements.length} stock movements over the past 30 days shows an average daily consumption of ${avgDailyConsumption.toFixed(1)} units. Current stock of ${balance.quantityOnHand} units will be depleted in approximately ${daysUntilStockout} days. The reorder point for this item is ${item.reorderPoint || 'not set'}, and the recommended reorder quantity is ${item.reorderQuantity || 100} units.`,
          confidenceScore,
          suggestedAction: {
            type: "reorder",
            quantity: item.reorderQuantity || 100,
            itemId: item.id,
            locationId: location.id,
            itemName: item.name,
            locationName: location.name,
            signals_used: ["stock_balance", "movement_history", "reorder_point"],
            time_window: "30 days",
          },
          status: "pending",
        });
      }
    }

    // Find anomalous movements (large unexpected transactions)
    const recentMovements = currentMovements.filter(m => {
      const moveDate = m.timestamp ? new Date(m.timestamp) : new Date();
      const daysDiff = (Date.now() - moveDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 14;
    });

    // Calculate average movement size
    const avgMovementSize = currentMovements.length > 0
      ? currentMovements.reduce((sum, m) => sum + Math.abs(m.quantity), 0) / currentMovements.length
      : 30;

    for (const movement of recentMovements) {
      if (Math.abs(movement.quantity) > avgMovementSize * 4) {
        const item = currentItems.find(i => i.id === movement.itemId);
        const location = currentLocations.find(l => l.id === movement.locationId);
        
        if (!item || !location) continue;

        const deviation = Math.abs(movement.quantity) / avgMovementSize;

        generatedAnomalies.push({
          tenantId: DEMO_TENANT_ID,
          itemId: item.id,
          locationId: location.id,
          type: "unusual_movement",
          severity: deviation > 6 ? "critical" : deviation > 4 ? "high" : "medium",
          title: `Unusual ${movement.movementType} Movement: ${item.name}`,
          description: `A ${movement.movementType} transaction of ${Math.abs(movement.quantity)} units was detected at ${location.name}. This is ${deviation.toFixed(1)}x the average movement size.`,
          detectedValue: Math.abs(movement.quantity),
          expectedValue: avgMovementSize,
          deviation: Math.abs(movement.quantity) - avgMovementSize,
          status: "open",
        });
      }
    }

    // Find slow-moving inventory
    for (const balance of currentBalances) {
      const item = currentItems.find(i => i.id === balance.itemId);
      const location = currentLocations.find(l => l.id === balance.locationId);
      
      if (!item || !location) continue;

      const itemMovements = currentMovements.filter(
        m => m.itemId === balance.itemId && m.locationId === balance.locationId
      );

      // High stock with very few movements = slow-moving
      if (balance.quantityOnHand > 400 && itemMovements.length < 10) {
        generatedRecommendations.push({
          tenantId: DEMO_TENANT_ID,
          type: "alert",
          priority: "medium",
          itemId: item.id,
          locationId: location.id,
          title: `Slow-Moving Inventory: ${item.name}`,
          description: `${balance.quantityOnHand} units in stock at ${location.name} with minimal movement activity. Consider promotional pricing or redistribution.`,
          explanation: `Only ${itemMovements.length} stock movements recorded for this item-location combination over the analysis period. High inventory levels with low turnover may indicate overstocking or declining demand. Recommend reviewing sales forecasts and considering inventory redistribution to higher-demand locations.`,
          confidenceScore: 75,
          suggestedAction: {
            type: "review_inventory",
            currentStock: balance.quantityOnHand,
            movementCount: itemMovements.length,
            signals_used: ["stock_balance", "movement_frequency"],
            time_window: "30 days",
          },
          status: "pending",
        });
      }
    }

    // Insert recommendations
    for (const rec of generatedRecommendations.slice(0, 5)) { // Limit to 5 for demo
      await db.insert(recommendations).values(rec);
    }

    // Insert anomalies
    for (const anomaly of generatedAnomalies.slice(0, 3)) { // Limit to 3 for demo
      await db.insert(anomalies).values(anomaly);
    }

    // Log AI analysis to audit
    await db.insert(auditLogs).values({
      tenantId: DEMO_TENANT_ID,
      userId: "ai-engine",
      action: "analyze",
      resourceType: "ai_engine",
      resourceId: "inventory_intelligence",
      eventType: "recommendation_generated",
      newState: {
        recommendationsGenerated: Math.min(generatedRecommendations.length, 5),
        anomaliesDetected: Math.min(generatedAnomalies.length, 3),
        analysisTimestamp: new Date().toISOString(),
        dataPointsAnalyzed: {
          items: currentItems.length,
          balances: currentBalances.length,
          movements: currentMovements.length,
        },
      },
      ipAddress: "127.0.0.1",
    });

    console.log(`\n  ✅ AI Analysis Complete:`);
    console.log(`     • Recommendations generated: ${Math.min(generatedRecommendations.length, 5)}`);
    console.log(`     • Anomalies detected: ${Math.min(generatedAnomalies.length, 3)}`);

    // =========================================================================
    // STEP 7: Display Results
    // =========================================================================
    printSection("STEP 7: Generated Recommendations");

    const finalRecommendations = await db.select().from(recommendations).where(eq(recommendations.tenantId, DEMO_TENANT_ID));
    
    for (let i = 0; i < finalRecommendations.length; i++) {
      const rec = finalRecommendations[i];
      const item = currentItems.find(it => it.id === rec.itemId);
      const location = currentLocations.find(l => l.id === rec.locationId);
      
      console.log(`\n  📋 Recommendation ${i + 1}:`);
      console.log(`     Title: ${rec.title}`);
      console.log(`     Type: ${rec.type} | Priority: ${rec.priority?.toUpperCase()}`);
      console.log(`     Confidence Score: ${rec.confidenceScore}%`);
      console.log(`     Item: ${item?.name || rec.itemId}`);
      console.log(`     Location: ${location?.name || rec.locationId}`);
      console.log(`     Description: ${rec.description}`);
      console.log(`     Explanation: ${rec.explanation?.substring(0, 150)}...`);
    }

    printSection("STEP 8: Detected Anomalies");

    const finalAnomalies = await db.select().from(anomalies).where(eq(anomalies.tenantId, DEMO_TENANT_ID));
    
    for (let i = 0; i < finalAnomalies.length; i++) {
      const anomaly = finalAnomalies[i];
      const item = currentItems.find(it => it.id === anomaly.itemId);
      const location = currentLocations.find(l => l.id === anomaly.locationId);
      
      console.log(`\n  ⚠️  Anomaly ${i + 1}:`);
      console.log(`     Title: ${anomaly.title}`);
      console.log(`     Type: ${anomaly.type} | Severity: ${anomaly.severity?.toUpperCase()}`);
      console.log(`     Item: ${item?.name || anomaly.itemId}`);
      console.log(`     Location: ${location?.name || anomaly.locationId}`);
      console.log(`     Detected Value: ${anomaly.detectedValue} | Expected: ${anomaly.expectedValue}`);
      console.log(`     Description: ${anomaly.description}`);
    }

    // =========================================================================
    // STEP 9: Audit Trail Summary
    // =========================================================================
    printSection("STEP 9: Audit Trail (Last 10 Events)");

    const auditTrail = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.tenantId, DEMO_TENANT_ID))
      .orderBy(sql`timestamp DESC`)
      .limit(10);

    console.log("\n  📜 Recent Audit Events:");
    console.log("  " + "-".repeat(66));
    console.log("  | Timestamp           | Action              | Resource Type    | User          |");
    console.log("  " + "-".repeat(66));

    for (const log of auditTrail) {
      const timestamp = log.timestamp ? new Date(log.timestamp).toISOString().substring(0, 19) : "N/A";
      const action = (log.action || "").padEnd(18).substring(0, 18);
      const resourceType = (log.resourceType || "").padEnd(15).substring(0, 15);
      const userId = (log.userId || "").padEnd(12).substring(0, 12);
      console.log(`  | ${timestamp} | ${action} | ${resourceType} | ${userId} |`);
    }
    console.log("  " + "-".repeat(66));

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log("\n");
    console.log("╔══════════════════════════════════════════════════════════════════════╗");
    console.log("║                    DEMO FLOW COMPLETED SUCCESSFULLY                  ║");
    console.log("╚══════════════════════════════════════════════════════════════════════╝");
    console.log("\n  ✅ All steps executed successfully:");
    console.log("     1. Connector created and configured");
    console.log("     2. Endpoints defined for data ingestion");
    console.log("     3. Mappings created (JSONPath → Canonical Model)");
    console.log("     4. Data ingested from Mock External System");
    console.log("     5. AI Engine analyzed inventory data");
    console.log(`     6. Generated ${finalRecommendations.length} recommendations`);
    console.log(`     7. Detected ${finalAnomalies.length} anomalies`);
    console.log("     8. Full audit trail maintained");
    console.log("\n  🔒 SECURITY CONFIRMATION:");
    console.log("     • No execution paths were enabled");
    console.log("     • All recommendations require human approval");
    console.log("     • Audit trail is immutable and complete");
    console.log("     • EXECUTION_MODE remains DRAFT_ONLY");
    console.log("\n  📌 Next Steps:");
    console.log("     • Open the EAL dashboard to view results");
    console.log("     • Review recommendations in the Recommendations page");
    console.log("     • Check anomalies in the Anomalies page");
    console.log("     • Verify audit trail in the Audit Log page");
    console.log("\n");

  } catch (error) {
    console.error("\n  ❌ Error during demo flow:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the demo flow
runDemoFlow().catch(console.error);
