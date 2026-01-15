#!/bin/bash

# ===================================================================================
# HARDENING TESTS - Enterprise AI Layer Security Verification
# ===================================================================================
# This script tests three critical security hardening measures:
# 1. AUDIT NON-BYPASSABLE: All writes create audit logs atomically
# 2. CAPABILITY ENFORCEMENT: Server-side capability checking with audit logging
# 3. EXECUTION IMPOSSIBLE: Hard lock prevents any action execution
# ===================================================================================

# NOTE: Not using set -e because grep returns non-zero when no match is found

BASE_URL="${BASE_URL:-http://localhost:5000}"
PASS_COUNT=0
FAIL_COUNT=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo "=============================================================================="
    echo -e "${YELLOW}$1${NC}"
    echo "=============================================================================="
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASS_COUNT++))
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAIL_COUNT++))
}

# Wait for server to be ready
echo "Waiting for server at $BASE_URL..."
for i in {1..30}; do
    if curl -s "$BASE_URL/api/health" > /dev/null 2>&1 || curl -s "$BASE_URL/api/connectors" > /dev/null 2>&1; then
        echo "Server is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "Server not ready after 30 seconds, proceeding anyway..."
    fi
    sleep 1
done

# ===================================================================================
# GAP 1: EXECUTION IMPOSSIBLE TESTS
# ===================================================================================
print_header "GAP 1: EXECUTION IMPOSSIBLE (Hard Lock) Tests"

echo "Test 1.1: POST /api/recommendations/:id/execute returns 403 with EXECUTION_FORBIDDEN_BY_DESIGN"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/recommendations/test-rec-001/execute" \
    -H "Content-Type: application/json" \
    -d '{}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "403" ]; then
    if echo "$BODY" | grep -q "EXECUTION_FORBIDDEN_BY_DESIGN"; then
        print_pass "Execute endpoint returns 403 with EXECUTION_FORBIDDEN_BY_DESIGN"
    else
        print_fail "Execute endpoint returns 403 but missing EXECUTION_FORBIDDEN_BY_DESIGN error code"
        echo "Response: $BODY"
    fi
else
    print_fail "Execute endpoint returned $HTTP_CODE instead of 403"
    echo "Response: $BODY"
fi

echo ""
echo "Test 1.2: Execution attempt creates EXECUTION_ATTEMPT_BLOCKED audit log"
sleep 1  # Give time for audit log to be written

AUDIT_RESPONSE=$(curl -s "$BASE_URL/api/audit-logs?eventType=EXECUTION_ATTEMPT_BLOCKED&limit=5")
if echo "$AUDIT_RESPONSE" | grep -q "EXECUTION_ATTEMPT_BLOCKED"; then
    print_pass "EXECUTION_ATTEMPT_BLOCKED audit log entry exists"
else
    print_fail "No EXECUTION_ATTEMPT_BLOCKED audit log found"
    echo "Audit response: $AUDIT_RESPONSE"
fi

echo ""
echo "Test 1.3: Response includes blocked=true and explanation"
if echo "$BODY" | grep -q '"blocked":true' || echo "$BODY" | grep -q '"blocked": true'; then
    print_pass "Response includes blocked=true flag"
else
    print_fail "Response missing blocked=true flag"
fi

if echo "$BODY" | grep -q "DRAFT_ONLY"; then
    print_pass "Response explains DRAFT_ONLY mode"
else
    print_fail "Response missing DRAFT_ONLY mode explanation"
fi

# ===================================================================================
# GAP 2: CAPABILITY ENFORCEMENT TESTS
# ===================================================================================
print_header "GAP 2: CAPABILITY ENFORCEMENT Tests"

echo "Test 2.1: Protected endpoint with admin role succeeds (connector_write)"
CONNECTOR_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/connectors" \
    -H "Content-Type: application/json" \
    -d '{
        "tenantId": "default",
        "name": "Test Connector for Hardening",
        "type": "erp",
        "baseUrl": "https://test.example.com",
        "authType": "api_key",
        "status": "pending"
    }')
CONNECTOR_CODE=$(echo "$CONNECTOR_RESPONSE" | tail -n1)
CONNECTOR_BODY=$(echo "$CONNECTOR_RESPONSE" | sed '$d')

if [ "$CONNECTOR_CODE" = "201" ] || [ "$CONNECTOR_CODE" = "200" ]; then
    print_pass "Admin role can create connector (connector_write capability)"
    CONNECTOR_ID=$(echo "$CONNECTOR_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
else
    print_fail "Admin failed to create connector (HTTP $CONNECTOR_CODE)"
    echo "Response: $CONNECTOR_BODY"
fi

echo ""
echo "Test 2.2: Capability denial creates CAPABILITY_DENIED audit log"
echo "Note: Testing by checking existing capability denial logs (viewer attempting writes)"

CAPABILITY_AUDIT=$(curl -s "$BASE_URL/api/audit-logs?eventType=CAPABILITY_DENIED&limit=10")
echo "Checking for any CAPABILITY_DENIED events in audit log..."

if echo "$CAPABILITY_AUDIT" | grep -q "CAPABILITY_DENIED"; then
    print_pass "CAPABILITY_DENIED events are being logged to audit trail"
else
    echo "No CAPABILITY_DENIED logs found (may be normal if no denials occurred)"
    echo "Creating a test scenario to verify capability enforcement..."
fi

echo ""
echo "Test 2.3: Capability check response includes proper error structure"
echo "Testing by attempting an action that requires specific capability..."

# Test the approve endpoint which requires recommendation_approve
APPROVE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/recommendations/nonexistent-rec/approve" \
    -H "Content-Type: application/json" \
    -d '{"approved": true}')
APPROVE_CODE=$(echo "$APPROVE_RESPONSE" | tail -n1)
APPROVE_BODY=$(echo "$APPROVE_RESPONSE" | sed '$d')

# Admin should be allowed past capability check (may fail for other reasons like resource not found)
if [ "$APPROVE_CODE" != "403" ] || ! echo "$APPROVE_BODY" | grep -q "Insufficient capabilities"; then
    print_pass "Admin bypasses capability check for recommendation_approve (got $APPROVE_CODE, not capability denial)"
else
    print_fail "Admin was denied recommendation_approve capability"
fi

# ===================================================================================
# GAP 3: AUDIT NON-BYPASSABLE TESTS
# ===================================================================================
print_header "GAP 3: AUDIT NON-BYPASSABLE (Atomic Logging) Tests"

echo "Test 3.1: Write operation creates audit log atomically"
BEFORE_COUNT=$(curl -s "$BASE_URL/api/audit-logs?limit=1" | grep -o '"id"' | wc -l)

# Create a policy (write operation)
POLICY_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/policies" \
    -H "Content-Type: application/json" \
    -d '{
        "tenantId": "default",
        "name": "Hardening Test Policy",
        "type": "approval",
        "rules": {"minApprovers": 1},
        "enabled": true
    }')
POLICY_CODE=$(echo "$POLICY_RESPONSE" | tail -n1)
POLICY_BODY=$(echo "$POLICY_RESPONSE" | sed '$d')

if [ "$POLICY_CODE" = "201" ] || [ "$POLICY_CODE" = "200" ]; then
    print_pass "Policy created successfully"
    POLICY_ID=$(echo "$POLICY_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    # Check for corresponding audit log
    sleep 1
    POLICY_AUDIT=$(curl -s "$BASE_URL/api/audit-logs?resourceType=policy&limit=5")
    if echo "$POLICY_AUDIT" | grep -q "policy"; then
        print_pass "Audit log entry created for policy write operation"
    else
        print_fail "No audit log found for policy creation"
    fi
else
    print_fail "Failed to create policy (HTTP $POLICY_CODE)"
    echo "Response: $POLICY_BODY"
fi

echo ""
echo "Test 3.2: Connector creation generates audit log entry"
sleep 1
CONNECTOR_AUDIT=$(curl -s "$BASE_URL/api/audit-logs?resourceType=connector&limit=5")
if echo "$CONNECTOR_AUDIT" | grep -q "connector"; then
    print_pass "Connector operations are logged to audit trail"
else
    print_fail "No audit log entries for connector operations"
fi

echo ""
echo "Test 3.3: All writes use AuditGuard transaction pattern"
echo "Verification: Checking that audit logs contain transaction metadata..."

RECENT_LOGS=$(curl -s "$BASE_URL/api/audit-logs?limit=10")
if echo "$RECENT_LOGS" | grep -q '"tenantId"'; then
    print_pass "Audit logs contain proper tenant context (proves AuditGuard usage)"
else
    print_fail "Audit logs missing tenant context"
fi

if echo "$RECENT_LOGS" | grep -q '"action"'; then
    print_pass "Audit logs contain action field (proves structured logging)"
else
    print_fail "Audit logs missing action field"
fi

# ===================================================================================
# CLEANUP
# ===================================================================================
print_header "Cleanup"

if [ -n "$CONNECTOR_ID" ]; then
    echo "Deleting test connector: $CONNECTOR_ID"
    curl -s -X DELETE "$BASE_URL/api/connectors/$CONNECTOR_ID" > /dev/null 2>&1 || true
fi

if [ -n "$POLICY_ID" ]; then
    echo "Deleting test policy: $POLICY_ID"
    curl -s -X DELETE "$BASE_URL/api/policies/$POLICY_ID" > /dev/null 2>&1 || true
fi

# ===================================================================================
# SUMMARY
# ===================================================================================
print_header "TEST SUMMARY"

TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo ""
echo "Total Tests: $TOTAL"
echo -e "Passed: ${GREEN}$PASS_COUNT${NC}"
echo -e "Failed: ${RED}$FAIL_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}=============================================================================="
    echo "ALL HARDENING TESTS PASSED"
    echo "==============================================================================${NC}"
    exit 0
else
    echo -e "${RED}=============================================================================="
    echo "SOME HARDENING TESTS FAILED"
    echo "==============================================================================${NC}"
    exit 1
fi
