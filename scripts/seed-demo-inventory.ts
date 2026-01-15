/**
 * Enterprise AI Layer - Demo Inventory Seed Script
 * 
 * This script populates PostgreSQL with realistic inventory data
 * to demonstrate Inventory Intelligence capabilities.
 * 
 * SCENARIOS INCLUDED:
 * 1. Imminent stockout - Items with critically low stock
 * 2. Sudden demand spike - Items with unusual demand patterns
 * 3. Slow-moving inventory - Items with minimal movement
 * 4. Anomalous stock movement - Unusual patterns in stock changes
 * 
 * USAGE:
 *   npx tsx scripts/seed-demo-inventory.ts
 * 
 * IDEMPOTENT: Running multiple times will reset and recreate data
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";
import {
  tenants,
  users,
  items,
  locations,
  stockBalances,
  stockMovements,
  demandSignals,
} from "../shared/schema";

const { Pool } = pg;

// Configuration
const DEMO_TENANT_ID = "demo-tenant-001";
const DEMO_TENANT_NAME = "شركة المخزون الذكي للتجارة";
const DEMO_USER_ID = "demo-admin-001";

// Categories for items
const CATEGORIES = [
  "إلكترونيات",
  "أجهزة منزلية",
  "مستلزمات مكتبية",
  "قطع غيار",
  "مواد استهلاكية",
  "معدات صناعية",
];

// Location types
const LOCATION_TYPES = ["warehouse", "store", "distribution_center"];

// Movement types
const MOVEMENT_TYPES = ["in", "out", "transfer", "adjustment"];

// Demand signal types
const SIGNAL_TYPES = ["order", "forecast", "trend"];

// Helper functions
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSKU(index: number): string {
  const prefix = ["SKU", "PRD", "ITM"][index % 3];
  return `${prefix}-${String(index + 1).padStart(5, "0")}`;
}

function generateDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(randomInt(8, 18), randomInt(0, 59), 0, 0);
  return date;
}

// Item names in Arabic
const ITEM_NAMES = [
  "شاشة كمبيوتر 24 بوصة",
  "لوحة مفاتيح لاسلكية",
  "ماوس بصري",
  "سماعات رأس احترافية",
  "كاميرا ويب عالية الدقة",
  "محول طاقة 65 واط",
  "كابل HDMI 2 متر",
  "قرص صلب خارجي 1 تيرا",
  "ذاكرة USB 64 جيجا",
  "حامل شاشة قابل للتعديل",
  "طابعة ليزر ملونة",
  "ورق طباعة A4",
  "حبر طابعة أسود",
  "حبر طابعة ملون",
  "دباسة مكتبية",
  "مشابك ورق معدنية",
  "أقلام حبر جاف",
  "دفاتر ملاحظات",
  "ملفات أرشيف",
  "شريط لاصق شفاف",
  "مكيف هواء سبليت",
  "ثلاجة مكتبية صغيرة",
  "غلاية ماء كهربائية",
  "ماكينة قهوة",
  "مروحة مكتبية",
  "مصباح LED مكتبي",
  "كرسي مكتب دوار",
  "مكتب خشبي 120 سم",
  "خزانة ملفات معدنية",
  "سبورة بيضاء مغناطيسية",
  "فلتر مكيف هواء",
  "مضخة مياه صغيرة",
  "محرك كهربائي 1 حصان",
  "حزام ناقل صناعي",
  "صمام تحكم هيدروليكي",
  "مستشعر حرارة صناعي",
  "لوحة تحكم PLC",
  "كابلات كهربائية 10 متر",
  "قاطع كهربائي 32 أمبير",
  "مفتاح ربط صناعي",
  "قفازات عمل واقية",
  "نظارات سلامة",
  "خوذة أمان صناعية",
  "حذاء سلامة",
  "سترة عاكسة",
  "طفاية حريق",
  "صندوق إسعافات أولية",
  "مطهر يدين",
  "مناديل تنظيف صناعية",
  "زيت تشحيم صناعي",
  "بطارية ليثيوم 18650",
  "شاحن بطاريات ذكي",
  "محول جهد 12 فولت",
  "مصدر طاقة غير منقطع",
  "راوتر واي فاي",
  "سويتش شبكات 8 منافذ",
  "كابل إيثرنت Cat6",
  "هاتف مكتبي IP",
  "جهاز عرض بروجكتور",
  "شاشة عرض قابلة للطي",
  "ميكروفون لاسلكي",
  "مكبر صوت محمول",
  "كاميرا مراقبة داخلية",
  "جهاز تسجيل DVR",
  "قفل إلكتروني ذكي",
  "جهاز بصمة حضور",
  "حساس حركة",
  "إنذار دخان",
  "لوحة إنذار حريق",
  "مولد كهربائي احتياطي",
];

// Location names in Arabic
const LOCATION_NAMES = [
  { name: "المستودع الرئيسي - الرياض", type: "warehouse", address: "الرياض، المنطقة الصناعية الثانية" },
  { name: "مركز التوزيع - جدة", type: "distribution_center", address: "جدة، ميناء جدة الإسلامي" },
  { name: "فرع الدمام", type: "store", address: "الدمام، شارع الملك فهد" },
  { name: "مستودع المنطقة الشرقية", type: "warehouse", address: "الخبر، المنطقة الصناعية" },
  { name: "فرع مكة المكرمة", type: "store", address: "مكة المكرمة، العزيزية" },
  { name: "مركز توزيع المدينة", type: "distribution_center", address: "المدينة المنورة، طريق المطار" },
  { name: "فرع القصيم", type: "store", address: "بريدة، شارع الخبيب" },
  { name: "مستودع تبوك", type: "warehouse", address: "تبوك، المنطقة الصناعية" },
];

async function seedDatabase() {
  console.log("🚀 Starting Enterprise AI Layer Demo Data Seed...\n");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    // Step 1: Clean existing demo data
    console.log("🧹 Cleaning existing demo data...");
    await db.delete(demandSignals).where(sql`tenant_id = ${DEMO_TENANT_ID}`);
    await db.delete(stockMovements).where(sql`tenant_id = ${DEMO_TENANT_ID}`);
    await db.delete(stockBalances).where(sql`tenant_id = ${DEMO_TENANT_ID}`);
    await db.delete(items).where(sql`tenant_id = ${DEMO_TENANT_ID}`);
    await db.delete(locations).where(sql`tenant_id = ${DEMO_TENANT_ID}`);
    await db.delete(users).where(sql`tenant_id = ${DEMO_TENANT_ID}`);
    await db.delete(tenants).where(sql`id = ${DEMO_TENANT_ID}`);
    console.log("✅ Existing demo data cleaned\n");

    // Step 2: Create demo tenant
    console.log("🏢 Creating demo tenant...");
    await db.insert(tenants).values({
      id: DEMO_TENANT_ID,
      name: DEMO_TENANT_NAME,
      status: "active",
    });
    console.log(`✅ Tenant created: ${DEMO_TENANT_NAME}\n`);

    // Step 3: Create demo user
    console.log("👤 Creating demo user...");
    await db.insert(users).values({
      id: DEMO_USER_ID,
      username: "demo-admin",
      password: "demo-password-hash", // In production, this would be hashed
      tenantId: DEMO_TENANT_ID,
      role: "admin",
    });
    console.log("✅ Demo admin user created\n");

    // Step 4: Create locations
    console.log("📍 Creating locations...");
    const locationRecords = LOCATION_NAMES.map((loc, index) => ({
      id: `loc-${String(index + 1).padStart(3, "0")}`,
      tenantId: DEMO_TENANT_ID,
      externalId: `EXT-LOC-${index + 1}`,
      name: loc.name,
      type: loc.type,
      address: loc.address,
      isActive: true,
    }));
    await db.insert(locations).values(locationRecords);
    console.log(`✅ Created ${locationRecords.length} locations\n`);

    // Step 5: Create items (70 items for variety)
    console.log("📦 Creating items...");
    const itemRecords = ITEM_NAMES.slice(0, 70).map((name, index) => {
      // Define special scenarios
      const isStockoutRisk = index < 5; // First 5 items will have stockout risk
      const isSlowMoving = index >= 60 && index < 65; // Items 60-64 are slow-moving
      const isDemandSpike = index >= 5 && index < 10; // Items 5-9 have demand spike

      return {
        id: `item-${String(index + 1).padStart(3, "0")}`,
        tenantId: DEMO_TENANT_ID,
        externalId: `EXT-${generateSKU(index)}`,
        sku: generateSKU(index),
        name: name,
        description: `${name} - منتج عالي الجودة`,
        category: randomElement(CATEGORIES),
        unit: "each",
        reorderPoint: isStockoutRisk ? 100 : randomInt(20, 50),
        reorderQuantity: randomInt(50, 200),
        leadTimeDays: randomInt(3, 14),
        isActive: true,
      };
    });
    await db.insert(items).values(itemRecords);
    console.log(`✅ Created ${itemRecords.length} items\n`);

    // Step 6: Create stock balances with scenarios
    console.log("📊 Creating stock balances...");
    const stockBalanceRecords: any[] = [];

    for (const item of itemRecords) {
      const itemIndex = parseInt(item.id.split("-")[1]) - 1;
      const isStockoutRisk = itemIndex < 5;
      const isSlowMoving = itemIndex >= 60 && itemIndex < 65;

      // Each item exists in 2-4 random locations
      const numLocations = randomInt(2, 4);
      const selectedLocations = [...locationRecords]
        .sort(() => Math.random() - 0.5)
        .slice(0, numLocations);

      for (const location of selectedLocations) {
        let quantityOnHand: number;
        let quantityReserved: number;

        if (isStockoutRisk) {
          // SCENARIO 1: Imminent stockout - very low stock
          quantityOnHand = randomInt(5, 25);
          quantityReserved = randomInt(0, Math.min(10, quantityOnHand));
        } else if (isSlowMoving) {
          // SCENARIO 3: Slow-moving - high stock, low movement
          quantityOnHand = randomInt(500, 1000);
          quantityReserved = randomInt(0, 10);
        } else {
          // Normal items
          quantityOnHand = randomInt(50, 300);
          quantityReserved = randomInt(0, Math.floor(quantityOnHand * 0.2));
        }

        stockBalanceRecords.push({
          id: `sb-${item.id}-${location.id}`,
          tenantId: DEMO_TENANT_ID,
          itemId: item.id,
          locationId: location.id,
          quantityOnHand,
          quantityReserved,
          quantityAvailable: quantityOnHand - quantityReserved,
          lastUpdated: new Date(),
        });
      }
    }
    await db.insert(stockBalances).values(stockBalanceRecords);
    console.log(`✅ Created ${stockBalanceRecords.length} stock balances\n`);

    // Step 7: Create stock movements (1500+ over 6 months)
    console.log("📈 Creating stock movements...");
    const stockMovementRecords: any[] = [];
    const SIX_MONTHS_DAYS = 180;

    for (let i = 0; i < 1500; i++) {
      const randomItem = randomElement(itemRecords);
      const itemIndex = parseInt(randomItem.id.split("-")[1]) - 1;
      const randomLocation = randomElement(locationRecords);
      const daysAgo = randomInt(0, SIX_MONTHS_DAYS);
      
      // SCENARIO 4: Anomalous movement for specific items
      const isAnomalousItem = itemIndex >= 10 && itemIndex < 15;
      let quantity: number;
      let movementType: string;

      if (isAnomalousItem && daysAgo < 14 && Math.random() > 0.7) {
        // Anomalous: Large unexpected movements in recent 2 weeks
        quantity = randomInt(200, 500);
        movementType = Math.random() > 0.5 ? "out" : "adjustment";
      } else {
        quantity = randomInt(5, 50);
        movementType = randomElement(MOVEMENT_TYPES);
      }

      stockMovementRecords.push({
        id: `sm-${String(i + 1).padStart(6, "0")}`,
        tenantId: DEMO_TENANT_ID,
        itemId: randomItem.id,
        locationId: randomLocation.id,
        movementType,
        quantity,
        referenceId: `REF-${Date.now()}-${i}`,
        timestamp: generateDate(daysAgo),
      });
    }

    // Insert in batches to avoid memory issues
    const BATCH_SIZE = 500;
    for (let i = 0; i < stockMovementRecords.length; i += BATCH_SIZE) {
      const batch = stockMovementRecords.slice(i, i + BATCH_SIZE);
      await db.insert(stockMovements).values(batch);
    }
    console.log(`✅ Created ${stockMovementRecords.length} stock movements\n`);

    // Step 8: Create demand signals (700+ over 6 months)
    console.log("📉 Creating demand signals...");
    const demandSignalRecords: any[] = [];

    for (let i = 0; i < 700; i++) {
      const randomItem = randomElement(itemRecords);
      const itemIndex = parseInt(randomItem.id.split("-")[1]) - 1;
      const randomLocation = randomElement(locationRecords);
      const daysAgo = randomInt(0, SIX_MONTHS_DAYS);

      // SCENARIO 2: Sudden demand spike for specific items
      const isDemandSpikeItem = itemIndex >= 5 && itemIndex < 10;
      let quantity: number;
      let confidence: number;

      if (isDemandSpikeItem && daysAgo < 7) {
        // Demand spike: High demand in last week
        quantity = randomInt(100, 300);
        confidence = randomFloat(0.85, 0.95);
      } else if (isDemandSpikeItem && daysAgo < 30) {
        // Building up demand
        quantity = randomInt(50, 150);
        confidence = randomFloat(0.75, 0.90);
      } else {
        // Normal demand
        quantity = randomInt(10, 60);
        confidence = randomFloat(0.60, 0.85);
      }

      demandSignalRecords.push({
        id: `ds-${String(i + 1).padStart(6, "0")}`,
        tenantId: DEMO_TENANT_ID,
        itemId: randomItem.id,
        locationId: randomLocation.id,
        signalType: randomElement(SIGNAL_TYPES),
        quantity,
        date: generateDate(daysAgo),
        confidence,
      });
    }

    // Insert in batches
    for (let i = 0; i < demandSignalRecords.length; i += BATCH_SIZE) {
      const batch = demandSignalRecords.slice(i, i + BATCH_SIZE);
      await db.insert(demandSignals).values(batch);
    }
    console.log(`✅ Created ${demandSignalRecords.length} demand signals\n`);

    // Summary
    console.log("═══════════════════════════════════════════════════════════");
    console.log("🎉 DEMO DATA SEED COMPLETED SUCCESSFULLY!");
    console.log("═══════════════════════════════════════════════════════════\n");
    console.log("📊 DATA SUMMARY:");
    console.log(`   • Tenant: ${DEMO_TENANT_NAME}`);
    console.log(`   • Locations: ${locationRecords.length}`);
    console.log(`   • Items: ${itemRecords.length}`);
    console.log(`   • Stock Balances: ${stockBalanceRecords.length}`);
    console.log(`   • Stock Movements: ${stockMovementRecords.length}`);
    console.log(`   • Demand Signals: ${demandSignalRecords.length}`);
    console.log("\n📋 DEMO SCENARIOS INCLUDED:");
    console.log("   1️⃣  Imminent Stockout: Items 1-5 have critically low stock");
    console.log("   2️⃣  Demand Spike: Items 6-10 show sudden demand increase");
    console.log("   3️⃣  Slow-Moving: Items 61-65 have high stock, low movement");
    console.log("   4️⃣  Anomalous Movement: Items 11-15 have unusual patterns");
    console.log("\n🔑 DEMO CREDENTIALS:");
    console.log(`   • Tenant ID: ${DEMO_TENANT_ID}`);
    console.log(`   • Username: demo-admin`);
    console.log("═══════════════════════════════════════════════════════════\n");

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the seed
seedDatabase().catch(console.error);
