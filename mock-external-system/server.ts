/**
 * Mock External System - REST API
 * 
 * This service simulates an external inventory management system
 * that the Enterprise AI Layer can connect to via its Connector Engine.
 * 
 * ENDPOINTS:
 *   GET /api/items          - List all items with pagination
 *   GET /api/locations      - List all locations with pagination
 *   GET /api/stock-balances - List stock balances with pagination
 *   GET /api/stock-movements - List stock movements with pagination
 * 
 * AUTHENTICATION:
 *   API Key via header: X-API-Key
 *   Valid keys: DEMO-API-KEY-2024, ENTERPRISE-KEY-001
 * 
 * ERROR SIMULATION:
 *   - 401 Unauthorized: Invalid or missing API key
 *   - 429 Rate Limit: More than 100 requests per minute
 *   - 500 Server Error: Random 2% chance on any request
 * 
 * USAGE:
 *   npx tsx mock-external-system/server.ts
 *   Server runs on port 3001
 */

import express, { Request, Response, NextFunction } from "express";

const app = express();
const PORT = 3001;

// Valid API keys
const VALID_API_KEYS = ["DEMO-API-KEY-2024", "ENTERPRISE-KEY-001"];

// Rate limiting storage
const requestCounts: Map<string, { count: number; resetTime: number }> = new Map();
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60000; // 1 minute in ms

// ==================== MOCK DATA ====================

// Type definitions
interface Item {
  item_id: string;
  sku: string;
  item_name: string;
  item_description: string;
  item_category: string;
  unit_of_measure: string;
  reorder_level: number;
  reorder_qty: number;
  lead_time: number;
  is_active: boolean;
  created_date: string;
  last_modified: string;
}

interface Location {
  location_id: string;
  location_name: string;
  location_type: string;
  city: string;
  country: string;
  address: string;
  is_active: boolean;
  created_date: string;
}

interface StockBalance {
  balance_id: string;
  item_id: string;
  location_id: string;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
  last_count_date: string;
  last_updated: string;
}

interface StockMovement {
  movement_id: string;
  item_id: string;
  location_id: string;
  movement_type: string;
  quantity: number;
  reference_number: string;
  movement_date: string;
  created_by: string;
  notes: string;
}

// Generate realistic item data
const generateItems = (): Item[] => {
  const categories = ["Electronics", "Office Supplies", "Industrial", "Safety", "Consumables"];
  const items: Item[] = [];
  
  const itemNames = [
    { name: "24-inch Computer Monitor", category: "Electronics" },
    { name: "Wireless Keyboard", category: "Electronics" },
    { name: "Optical Mouse", category: "Electronics" },
    { name: "Professional Headset", category: "Electronics" },
    { name: "HD Webcam", category: "Electronics" },
    { name: "65W Power Adapter", category: "Electronics" },
    { name: "HDMI Cable 2m", category: "Electronics" },
    { name: "External HDD 1TB", category: "Electronics" },
    { name: "USB Flash Drive 64GB", category: "Electronics" },
    { name: "Adjustable Monitor Stand", category: "Office Supplies" },
    { name: "Color Laser Printer", category: "Office Supplies" },
    { name: "A4 Printing Paper", category: "Consumables" },
    { name: "Black Printer Ink", category: "Consumables" },
    { name: "Color Printer Ink", category: "Consumables" },
    { name: "Office Stapler", category: "Office Supplies" },
    { name: "Metal Paper Clips", category: "Office Supplies" },
    { name: "Ballpoint Pens", category: "Office Supplies" },
    { name: "Notebooks", category: "Office Supplies" },
    { name: "Archive Folders", category: "Office Supplies" },
    { name: "Clear Tape", category: "Office Supplies" },
    { name: "Split AC Unit", category: "Electronics" },
    { name: "Mini Office Fridge", category: "Electronics" },
    { name: "Electric Kettle", category: "Electronics" },
    { name: "Coffee Machine", category: "Electronics" },
    { name: "Desk Fan", category: "Electronics" },
    { name: "LED Desk Lamp", category: "Office Supplies" },
    { name: "Swivel Office Chair", category: "Office Supplies" },
    { name: "Wooden Desk 120cm", category: "Office Supplies" },
    { name: "Metal Filing Cabinet", category: "Office Supplies" },
    { name: "Magnetic Whiteboard", category: "Office Supplies" },
    { name: "AC Air Filter", category: "Industrial" },
    { name: "Small Water Pump", category: "Industrial" },
    { name: "1HP Electric Motor", category: "Industrial" },
    { name: "Industrial Conveyor Belt", category: "Industrial" },
    { name: "Hydraulic Control Valve", category: "Industrial" },
    { name: "Industrial Temperature Sensor", category: "Industrial" },
    { name: "PLC Control Panel", category: "Industrial" },
    { name: "Electrical Cables 10m", category: "Industrial" },
    { name: "32A Circuit Breaker", category: "Industrial" },
    { name: "Industrial Wrench", category: "Industrial" },
    { name: "Protective Work Gloves", category: "Safety" },
    { name: "Safety Glasses", category: "Safety" },
    { name: "Industrial Safety Helmet", category: "Safety" },
    { name: "Safety Shoes", category: "Safety" },
    { name: "Reflective Vest", category: "Safety" },
    { name: "Fire Extinguisher", category: "Safety" },
    { name: "First Aid Kit", category: "Safety" },
    { name: "Hand Sanitizer", category: "Consumables" },
    { name: "Industrial Cleaning Wipes", category: "Consumables" },
    { name: "Industrial Lubricant Oil", category: "Consumables" },
    { name: "Lithium Battery 18650", category: "Electronics" },
    { name: "Smart Battery Charger", category: "Electronics" },
    { name: "12V Voltage Converter", category: "Electronics" },
    { name: "UPS Power Supply", category: "Electronics" },
    { name: "WiFi Router", category: "Electronics" },
    { name: "8-Port Network Switch", category: "Electronics" },
    { name: "Cat6 Ethernet Cable", category: "Electronics" },
    { name: "IP Office Phone", category: "Electronics" },
    { name: "Projector", category: "Electronics" },
    { name: "Foldable Projection Screen", category: "Office Supplies" },
    { name: "Wireless Microphone", category: "Electronics" },
    { name: "Portable Speaker", category: "Electronics" },
    { name: "Indoor Security Camera", category: "Electronics" },
    { name: "DVR Recording Device", category: "Electronics" },
    { name: "Smart Electronic Lock", category: "Electronics" },
    { name: "Biometric Attendance Device", category: "Electronics" },
    { name: "Motion Sensor", category: "Electronics" },
    { name: "Smoke Detector", category: "Safety" },
    { name: "Fire Alarm Panel", category: "Safety" },
    { name: "Backup Generator", category: "Industrial" },
  ];

  for (let i = 0; i < itemNames.length; i++) {
    const item = itemNames[i];
    items.push({
      item_id: `EXT-ITM-${String(i + 1).padStart(5, "0")}`,
      sku: `SKU-${String(i + 1).padStart(5, "0")}`,
      item_name: item.name,
      item_description: `High quality ${item.name.toLowerCase()} for enterprise use`,
      item_category: item.category,
      unit_of_measure: "EACH",
      reorder_level: Math.floor(Math.random() * 50) + 20,
      reorder_qty: Math.floor(Math.random() * 150) + 50,
      lead_time: Math.floor(Math.random() * 10) + 3,
      is_active: true,
      created_date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      last_modified: new Date().toISOString(),
    });
  }
  
  return items;
};

// Generate location data
const generateLocations = (): Location[] => {
  const locationData = [
    { name: "Main Warehouse - Riyadh", type: "WAREHOUSE", city: "Riyadh" },
    { name: "Distribution Center - Jeddah", type: "DISTRIBUTION", city: "Jeddah" },
    { name: "Dammam Branch", type: "STORE", city: "Dammam" },
    { name: "Eastern Region Warehouse", type: "WAREHOUSE", city: "Khobar" },
    { name: "Makkah Branch", type: "STORE", city: "Makkah" },
    { name: "Madinah Distribution Center", type: "DISTRIBUTION", city: "Madinah" },
    { name: "Qassim Branch", type: "STORE", city: "Buraidah" },
    { name: "Tabuk Warehouse", type: "WAREHOUSE", city: "Tabuk" },
  ];

  return locationData.map((loc, i) => ({
    location_id: `EXT-LOC-${String(i + 1).padStart(3, "0")}`,
    location_name: loc.name,
    location_type: loc.type,
    city: loc.city,
    country: "Saudi Arabia",
    address: `Industrial Area, ${loc.city}`,
    is_active: true,
    created_date: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
  }));
};

// Generate stock balances
const generateStockBalances = (): StockBalance[] => {
  const items = generateItems();
  const locations = generateLocations();
  const balances: StockBalance[] = [];

  for (const item of items) {
    // Each item in 2-4 locations
    const numLocations = Math.floor(Math.random() * 3) + 2;
    const selectedLocations = [...locations].sort(() => Math.random() - 0.5).slice(0, numLocations);

    for (const location of selectedLocations) {
      const itemIndex = parseInt(item.item_id.split("-")[2]) - 1;
      
      // Scenario: Items 1-5 have low stock (stockout risk)
      // Scenario: Items 61-65 have high stock (slow-moving)
      let qty_on_hand: number;
      let qty_reserved: number;

      if (itemIndex < 5) {
        // Low stock scenario
        qty_on_hand = Math.floor(Math.random() * 20) + 5;
        qty_reserved = Math.floor(Math.random() * Math.min(10, qty_on_hand));
      } else if (itemIndex >= 60 && itemIndex < 65) {
        // High stock scenario
        qty_on_hand = Math.floor(Math.random() * 500) + 500;
        qty_reserved = Math.floor(Math.random() * 10);
      } else {
        // Normal stock
        qty_on_hand = Math.floor(Math.random() * 250) + 50;
        qty_reserved = Math.floor(Math.random() * (qty_on_hand * 0.2));
      }

      balances.push({
        balance_id: `BAL-${item.item_id}-${location.location_id}`,
        item_id: item.item_id,
        location_id: location.location_id,
        qty_on_hand,
        qty_reserved,
        qty_available: qty_on_hand - qty_reserved,
        last_count_date: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      });
    }
  }

  return balances;
};

// Generate stock movements
const generateStockMovements = (): StockMovement[] => {
  const items = generateItems();
  const locations = generateLocations();
  const movements: StockMovement[] = [];
  const movementTypes = ["RECEIPT", "ISSUE", "TRANSFER", "ADJUSTMENT"];

  for (let i = 0; i < 1500; i++) {
    const item = items[Math.floor(Math.random() * items.length)];
    const location = locations[Math.floor(Math.random() * locations.length)];
    const itemIndex = parseInt(item.item_id.split("-")[2]) - 1;
    
    // Days ago (0-180 for 6 months)
    const daysAgo = Math.floor(Math.random() * 180);
    const movementDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    // Scenario: Items 11-15 have anomalous movements in recent 2 weeks
    let quantity: number;
    let movementType: string;

    if (itemIndex >= 10 && itemIndex < 15 && daysAgo < 14 && Math.random() > 0.7) {
      // Anomalous large movement
      quantity = Math.floor(Math.random() * 300) + 200;
      movementType = Math.random() > 0.5 ? "ISSUE" : "ADJUSTMENT";
    } else {
      quantity = Math.floor(Math.random() * 45) + 5;
      movementType = movementTypes[Math.floor(Math.random() * movementTypes.length)];
    }

    movements.push({
      movement_id: `MOV-${String(i + 1).padStart(7, "0")}`,
      item_id: item.item_id,
      location_id: location.location_id,
      movement_type: movementType,
      quantity,
      reference_number: `REF-${Date.now()}-${i}`,
      movement_date: movementDate.toISOString(),
      created_by: "system",
      notes: `${movementType} transaction`,
    });
  }

  // Sort by date descending
  movements.sort((a, b) => new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime());

  return movements;
};

// Cache generated data
const ITEMS = generateItems();
const LOCATIONS = generateLocations();
const STOCK_BALANCES = generateStockBalances();
const STOCK_MOVEMENTS = generateStockMovements();

// ==================== MIDDLEWARE ====================

// API Key Authentication
const authenticateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing API key. Include X-API-Key header.",
      code: "AUTH_MISSING_KEY",
    });
  }

  if (!VALID_API_KEYS.includes(apiKey)) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid API key.",
      code: "AUTH_INVALID_KEY",
    });
  }

  next();
};

// Rate Limiting
const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers["x-api-key"] as string;
  const now = Date.now();

  let record = requestCounts.get(apiKey);

  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + RATE_WINDOW };
    requestCounts.set(apiKey, record);
  }

  record.count++;

  if (record.count > RATE_LIMIT) {
    return res.status(429).json({
      error: "Too Many Requests",
      message: `Rate limit exceeded. Maximum ${RATE_LIMIT} requests per minute.`,
      code: "RATE_LIMIT_EXCEEDED",
      retry_after: Math.ceil((record.resetTime - now) / 1000),
    });
  }

  // Add rate limit headers
  res.setHeader("X-RateLimit-Limit", RATE_LIMIT);
  res.setHeader("X-RateLimit-Remaining", RATE_LIMIT - record.count);
  res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000));

  next();
};

// Random Server Error Simulation (2% chance)
const simulateServerError = (req: Request, res: Response, next: NextFunction) => {
  if (Math.random() < 0.02) {
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred. Please try again.",
      code: "SERVER_ERROR",
      request_id: `REQ-${Date.now()}`,
    });
  }
  next();
};

// Apply middleware
app.use(express.json());
app.use(authenticateApiKey);
app.use(rateLimiter);
app.use(simulateServerError);

// ==================== PAGINATION HELPER ====================

interface PaginationParams {
  limit: number;
  offset: number;
  cursor?: string;
}

const parsePagination = (req: Request): PaginationParams => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const cursor = req.query.cursor as string;

  return { limit, offset, cursor };
};

const paginateArray = <T>(data: T[], params: PaginationParams) => {
  const { limit, offset } = params;
  const total = data.length;
  const paginatedData = data.slice(offset, offset + limit);
  const hasMore = offset + limit < total;
  const nextOffset = hasMore ? offset + limit : null;

  return {
    data: paginatedData,
    pagination: {
      total,
      limit,
      offset,
      has_more: hasMore,
      next_offset: nextOffset,
    },
  };
};

// ==================== API ENDPOINTS ====================

// Health check (no auth required)
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Mock External Inventory System",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// GET /api/items
app.get("/api/items", (req, res) => {
  const pagination = parsePagination(req);
  const result = paginateArray(ITEMS, pagination);

  res.json({
    success: true,
    ...result,
    _links: {
      self: `/api/items?limit=${pagination.limit}&offset=${pagination.offset}`,
      next: result.pagination.has_more
        ? `/api/items?limit=${pagination.limit}&offset=${result.pagination.next_offset}`
        : null,
    },
  });
});

// GET /api/locations
app.get("/api/locations", (req, res) => {
  const pagination = parsePagination(req);
  const result = paginateArray(LOCATIONS, pagination);

  res.json({
    success: true,
    ...result,
    _links: {
      self: `/api/locations?limit=${pagination.limit}&offset=${pagination.offset}`,
      next: result.pagination.has_more
        ? `/api/locations?limit=${pagination.limit}&offset=${result.pagination.next_offset}`
        : null,
    },
  });
});

// GET /api/stock-balances
app.get("/api/stock-balances", (req, res) => {
  const pagination = parsePagination(req);
  
  // Optional filters
  const itemId = req.query.item_id as string;
  const locationId = req.query.location_id as string;

  let filteredData = STOCK_BALANCES;

  if (itemId) {
    filteredData = filteredData.filter((b) => b.item_id === itemId);
  }
  if (locationId) {
    filteredData = filteredData.filter((b) => b.location_id === locationId);
  }

  const result = paginateArray(filteredData, pagination);

  res.json({
    success: true,
    ...result,
    _links: {
      self: `/api/stock-balances?limit=${pagination.limit}&offset=${pagination.offset}`,
      next: result.pagination.has_more
        ? `/api/stock-balances?limit=${pagination.limit}&offset=${result.pagination.next_offset}`
        : null,
    },
  });
});

// GET /api/stock-movements
app.get("/api/stock-movements", (req, res) => {
  const pagination = parsePagination(req);

  // Optional filters
  const itemId = req.query.item_id as string;
  const locationId = req.query.location_id as string;
  const movementType = req.query.movement_type as string;
  const fromDate = req.query.from_date as string;
  const toDate = req.query.to_date as string;

  let filteredData = STOCK_MOVEMENTS;

  if (itemId) {
    filteredData = filteredData.filter((m) => m.item_id === itemId);
  }
  if (locationId) {
    filteredData = filteredData.filter((m) => m.location_id === locationId);
  }
  if (movementType) {
    filteredData = filteredData.filter((m) => m.movement_type === movementType);
  }
  if (fromDate) {
    filteredData = filteredData.filter((m) => new Date(m.movement_date) >= new Date(fromDate));
  }
  if (toDate) {
    filteredData = filteredData.filter((m) => new Date(m.movement_date) <= new Date(toDate));
  }

  const result = paginateArray(filteredData, pagination);

  res.json({
    success: true,
    ...result,
    _links: {
      self: `/api/stock-movements?limit=${pagination.limit}&offset=${pagination.offset}`,
      next: result.pagination.has_more
        ? `/api/stock-movements?limit=${pagination.limit}&offset=${result.pagination.next_offset}`
        : null,
    },
  });
});

// API Documentation endpoint
app.get("/api", (req, res) => {
  res.json({
    service: "Mock External Inventory System API",
    version: "1.0.0",
    documentation: {
      authentication: {
        type: "API Key",
        header: "X-API-Key",
        valid_keys: ["DEMO-API-KEY-2024", "ENTERPRISE-KEY-001"],
      },
      rate_limit: {
        limit: RATE_LIMIT,
        window: "1 minute",
      },
      endpoints: [
        {
          path: "/api/items",
          method: "GET",
          description: "List all inventory items",
          pagination: "limit, offset",
        },
        {
          path: "/api/locations",
          method: "GET",
          description: "List all warehouse/store locations",
          pagination: "limit, offset",
        },
        {
          path: "/api/stock-balances",
          method: "GET",
          description: "List stock balances by item and location",
          filters: ["item_id", "location_id"],
          pagination: "limit, offset",
        },
        {
          path: "/api/stock-movements",
          method: "GET",
          description: "List stock movement transactions",
          filters: ["item_id", "location_id", "movement_type", "from_date", "to_date"],
          pagination: "limit, offset",
        },
      ],
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Endpoint ${req.method} ${req.path} not found`,
    code: "ENDPOINT_NOT_FOUND",
  });
});

// Start server
app.listen(PORT, () => {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🏭 Mock External Inventory System API");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`📖 API Documentation: http://localhost:${PORT}/api`);
  console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
  console.log("");
  console.log("🔑 Valid API Keys:");
  console.log("   • DEMO-API-KEY-2024");
  console.log("   • ENTERPRISE-KEY-001");
  console.log("");
  console.log("📊 Available Data:");
  console.log(`   • ${ITEMS.length} Items`);
  console.log(`   • ${LOCATIONS.length} Locations`);
  console.log(`   • ${STOCK_BALANCES.length} Stock Balances`);
  console.log(`   • ${STOCK_MOVEMENTS.length} Stock Movements`);
  console.log("═══════════════════════════════════════════════════════════");
});
