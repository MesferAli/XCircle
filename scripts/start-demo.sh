#!/bin/bash

# ============================================================================
# Enterprise AI Layer - Demo Startup Script
# ============================================================================
# This script starts all components needed for the demo:
# 1. Mock External System (port 3001)
# 2. Seeds demo data
# 3. Runs the complete demo flow
#
# Usage: ./scripts/start-demo.sh
# ============================================================================

set -e

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║          ENTERPRISE AI LAYER - DEMO STARTUP                         ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL environment variable is not set${NC}"
    echo "   Please set DATABASE_URL before running this script"
    exit 1
fi

echo -e "${GREEN}✅ DATABASE_URL is configured${NC}"
echo ""

# Step 1: Install dependencies for Mock External System
echo "📦 Step 1: Installing Mock External System dependencies..."
cd mock-external-system
npm install --silent
cd ..
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 2: Start Mock External System in background
echo "🚀 Step 2: Starting Mock External System on port 3001..."
cd mock-external-system
npx tsx server.ts &
MOCK_PID=$!
cd ..

# Wait for Mock API to be ready
echo "   Waiting for Mock API to be ready..."
sleep 3

# Check if Mock API is running
if curl -s http://localhost:3001/health > /dev/null; then
    echo -e "${GREEN}✅ Mock External System is running (PID: $MOCK_PID)${NC}"
else
    echo -e "${RED}❌ Failed to start Mock External System${NC}"
    exit 1
fi
echo ""

# Step 3: Seed demo data
echo "🌱 Step 3: Seeding demo inventory data..."
npx tsx scripts/seed-demo-inventory.ts
echo ""

# Step 4: Run demo flow
echo "🔄 Step 4: Running complete demo flow..."
npx tsx scripts/run-demo-flow.ts
echo ""

# Summary
echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                    DEMO ENVIRONMENT READY                           ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "  Services Running:"
echo "    • Mock External System: http://localhost:3001"
echo "    • Mock API Docs: http://localhost:3001/api"
echo ""
echo "  Demo Credentials:"
echo "    • API Key: DEMO-API-KEY-2024"
echo "    • Tenant ID: demo-tenant-001"
echo ""
echo "  To stop the Mock External System:"
echo "    kill $MOCK_PID"
echo ""
echo "  To view the EAL dashboard, start the main application:"
echo "    npm run dev"
echo ""
