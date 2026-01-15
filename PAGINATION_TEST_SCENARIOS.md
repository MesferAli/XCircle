# Pagination State Persistence - Test Scenarios

## Overview
The ConnectorEngine now persists pagination state for all 4 pagination strategies, enabling resumable polling across multiple cycles. This document outlines test scenarios for verifying each strategy works correctly.

## Setup
Pagination state is stored in the `endpoints.lastCursor` column as JSON:
```json
{
  "type": "cursor|offset|page|time_window",
  "cursor": "...",     // For cursor pagination
  "offset": 100,       // For offset pagination
  "page": 2,           // For page pagination
  "timeWindow": "..."  // For time_window pagination
}
```

## Test Scenario 1: Cursor Pagination

### Setup
- Endpoint configuration: `paginationConfig.type = "cursor"`
- Example API: GitHub GraphQL or Stripe list endpoints

### Test Flow
```
Poll 1:
  - Initial state: lastCursor = null (first poll)
  - buildUrl: No cursor parameter added (null cursor)
  - API Response: { data: [...], nextCursor: "cursor_page_2" }
  - extractPagination: Returns { hasMore: true, nextCursor: "cursor_page_2" }
  - Persisted state: { type: "cursor", cursor: "cursor_page_2" }

Poll 2:
  - Initial state: lastCursor = '{"type":"cursor","cursor":"cursor_page_2"}'
  - buildUrl: Adds ?after=cursor_page_2 to request
  - API Response: { data: [...], nextCursor: "cursor_page_3" }
  - extractPagination: Returns { hasMore: true, nextCursor: "cursor_page_3" }
  - Persisted state: { type: "cursor", cursor: "cursor_page_3" }

Poll 3:
  - Initial state: lastCursor = '{"type":"cursor","cursor":"cursor_page_3"}'
  - buildUrl: Adds ?after=cursor_page_3 to request
  - API Response: { data: [...], nextCursor: null }
  - extractPagination: Returns { hasMore: false, nextCursor: undefined }
  - Persisted state: {} (empty cursor state, pagination complete)
```

### Verification
✓ Each poll uses the previous cursor from lastCursor
✓ Cursor value is correctly included in URL parameters
✓ Poll chain: cursor_page_2 → cursor_page_3 → (end)

---

## Test Scenario 2: Offset Pagination

### Setup
- Endpoint configuration: `paginationConfig.type = "offset", limit = 100`
- Example API: SQL database APIs with offset/limit

### Test Flow
```
Poll 1:
  - Initial state: lastCursor = null
  - buildUrl: offset=0&limit=100 (default offset when none stored)
  - API Response: 100 items returned
  - extractPagination: 
    - currentOffset: 0 (from state or default)
    - itemCount: 100 (>= limit, so hasMore = true)
    - Returns { hasMore: true, nextOffset: 100 }
  - Persisted state: { type: "offset", offset: 100 }

Poll 2:
  - Initial state: lastCursor = '{"type":"offset","offset":100}'
  - buildUrl: offset=100&limit=100
  - API Response: 100 items returned
  - extractPagination:
    - currentOffset: 100 (from deserialized state)
    - itemCount: 100 (>= limit, so hasMore = true)
    - Returns { hasMore: true, nextOffset: 200 }
  - Persisted state: { type: "offset", offset: 200 }

Poll 3:
  - Initial state: lastCursor = '{"type":"offset","offset":200}'
  - buildUrl: offset=200&limit=100
  - API Response: 50 items returned
  - extractPagination:
    - currentOffset: 200 (from state)
    - itemCount: 50 (< limit, so hasMore = false)
    - Returns { hasMore: false, nextOffset: undefined }
  - Persisted state: {} (no nextOffset when hasMore=false)
```

### Verification
✓ Offset increases by limit amount each poll: 0 → 100 → 200
✓ Pagination stops when returned items < limit
✓ Poll chain: offset=0 → offset=100 → offset=200 → (end)
✓ Total records fetched: 250 (100 + 100 + 50)

---

## Test Scenario 3: Page Pagination

### Setup
- Endpoint configuration: `paginationConfig.type = "page", pageParam = "page"`
- Example API: WordPress REST API with /posts?page=1

### Test Flow
```
Poll 1:
  - Initial state: lastCursor = null
  - buildUrl: page=1 (default page when none stored)
  - API Response: { data: [...], hasNextPage: true }
  - extractPagination:
    - currentPage: 1 (from state or default)
    - hasNextPage: true (from response)
    - Returns { hasMore: true, nextPage: 2 }
  - Persisted state: { type: "page", page: 2 }

Poll 2:
  - Initial state: lastCursor = '{"type":"page","page":2}'
  - buildUrl: page=2
  - API Response: { data: [...], hasNextPage: true }
  - extractPagination:
    - currentPage: 2 (from deserialized state)
    - hasNextPage: true (from response)
    - Returns { hasMore: true, nextPage: 3 }
  - Persisted state: { type: "page", page: 3 }

Poll 3:
  - Initial state: lastCursor = '{"type":"page","page":3}'
  - buildUrl: page=3
  - API Response: { data: [...], hasNextPage: false }
  - extractPagination:
    - currentPage: 3 (from state)
    - hasNextPage: false (from response)
    - Returns { hasMore: false, nextPage: undefined }
  - Persisted state: {} (no nextPage when hasNextPage=false)
```

### Verification
✓ Page number increments by 1 each poll: 1 → 2 → 3
✓ Pagination stops when hasNextPage=false
✓ Poll chain: page=1 → page=2 → page=3 → (end)

---

## Test Scenario 4: Time Window Pagination

### Setup
- Endpoint configuration: `paginationConfig.type = "time_window", timestampParam = "since"`
- Example API: Webhook logs or audit logs with ?since=timestamp

### Test Flow
```
Poll 1:
  - Initial state: lastCursor = null
  - buildUrl: No since parameter (first poll gets all recent)
  - API Response: Records with lastTimestamp: "2024-01-15T12:34:56Z"
  - extractPagination:
    - timestampPath: "lastTimestamp"
    - nextTimestamp: "2024-01-15T12:34:56Z"
    - Returns { hasMore: true, nextCursor: "2024-01-15T12:34:56Z" }
  - Persisted state: { type: "time_window", timeWindow: "2024-01-15T12:34:56Z" }

Poll 2 (15 minutes later):
  - Initial state: lastCursor = '{"type":"time_window","timeWindow":"2024-01-15T12:34:56Z"}'
  - buildUrl: since=2024-01-15T12:34:56Z
  - API Response: Records modified after 12:34:56Z, lastTimestamp: "2024-01-15T12:49:30Z"
  - extractPagination:
    - timestampPath: "lastTimestamp"
    - nextTimestamp: "2024-01-15T12:49:30Z"
    - Returns { hasMore: true, nextCursor: "2024-01-15T12:49:30Z" }
  - Persisted state: { type: "time_window", timeWindow: "2024-01-15T12:49:30Z" }

Poll 3 (15 minutes later, no new records):
  - Initial state: lastCursor = '{"type":"time_window","timeWindow":"2024-01-15T12:49:30Z"}'
  - buildUrl: since=2024-01-15T12:49:30Z
  - API Response: No records returned, response.timestamp: "2024-01-15T13:04:30Z"
  - extractPagination:
    - nextTimestamp: null (no lastTimestamp in response)
    - Returns { hasMore: false, nextCursor: undefined }
  - Persisted state: {} (maintains last sync time for next poll)
```

### Verification
✓ Timestamp advances with each poll: 12:34:56Z → 12:49:30Z
✓ Each poll fetches only NEW records modified after previous timestamp
✓ Polls can be spaced at any interval (5min, 1hr, 1day)
✓ No duplicate records fetched across polls

---

## Test Scenario 5: Backward Compatibility (Legacy Cursor String)

### Setup
- Existing data with `lastCursor = "legacy_cursor_string"` (non-JSON format)
- Endpoint configuration: `paginationConfig.type = "cursor"`

### Test Flow
```
Poll 1 (with legacy data):
  - Initial state: lastCursor = "legacy_cursor_string" (pre-JSON format)
  - deserializePaginationState: Detects non-JSON, converts to { type: "cursor", cursor: "legacy_cursor_string" }
  - buildUrl: Uses legacy_cursor_string as cursor value
  - API Response: Works normally, returns { nextCursor: "new_cursor_format" }
  - Persisted state: { type: "cursor", cursor: "new_cursor_format" } (converted to JSON)

Poll 2:
  - Initial state: lastCursor = '{"type":"cursor","cursor":"new_cursor_format"}'
  - deserializePaginationState: Parses JSON successfully
  - buildUrl: Uses new_cursor_format
  - API continues working seamlessly
```

### Verification
✓ Legacy string cursors are automatically converted to JSON format
✓ Existing integrations continue working without modification
✓ New data is persisted in modern JSON format

---

## Integration Testing Checklist

### For Each Pagination Type:
- [ ] Poll 1 establishes initial pagination state
- [ ] Poll 2 retrieves and uses state from Poll 1
- [ ] Poll 3 retrieves and uses state from Poll 2
- [ ] Pagination state is correctly serialized/deserialized
- [ ] Query parameters reflect the persisted state
- [ ] Pagination completes when API indicates no more pages
- [ ] State persists correctly across database restarts

### Error Handling:
- [ ] If API returns no pagination info, state is cleared
- [ ] If state is corrupted JSON, falls back to empty/default state
- [ ] If poll fails, previous state is preserved (not updated)
- [ ] Rate limiting doesn't affect pagination state persistence

### Data Integrity:
- [ ] No duplicate records fetched across polls
- [ ] No records skipped between polls
- [ ] Complete dataset retrieved across all poll cycles
- [ ] Pagination works for endpoints returning 0 records

---

## Manual Testing Steps

### Setup Test Endpoint
```typescript
// Create test endpoint with offset pagination
const endpoint = await storage.createEndpoint({
  connectorId: testConnectorId,
  name: "Test Offset Endpoint",
  path: "/api/items",
  method: "GET",
  paginationConfig: {
    type: "offset",
    offsetParam: "offset",
    limitParam: "limit",
    limit: 100
  },
  dataPath: "$.data"
});
```

### Execute Polling Cycle
```typescript
const poll1 = await connectorEngine.pollEndpoint(connectorId, endpoint.id, tenantId);
console.log("Poll 1 - State saved:", poll1.pagination);

// Verify state was persisted
let endpointData = await storage.getEndpoint(endpoint.id);
console.log("Poll 1 - Stored state:", endpointData.lastCursor);

const poll2 = await connectorEngine.pollEndpoint(connectorId, endpoint.id, tenantId);
console.log("Poll 2 - State loaded and used:", poll2.pagination);

// Verify new state was persisted
endpointData = await storage.getEndpoint(endpoint.id);
console.log("Poll 2 - Stored state:", endpointData.lastCursor);
```

### Verify Query Parameters
Check the request logs in the audit trail or application logs:
- Poll 1: `offset=0&limit=100`
- Poll 2: `offset=100&limit=100` (or higher if multiple pages)
- Poll 3: Continues incrementing offset

---

## Production Considerations

1. **Idempotency**: Time-window pagination handles duplicate records by timestamp filtering
2. **Failures**: If a poll fails, pagination state is NOT updated (preserves retry point)
3. **Rate Limiting**: Pagination state persists across rate limit retries
4. **Data Consistency**: Each pagination type is optimized for different API patterns
5. **Monitoring**: Audit logs track pagination state changes for troubleshooting

---

## Reference: PaginationState JSON Format

```typescript
interface PaginationState {
  type: "cursor" | "offset" | "page" | "time_window";
  cursor?: string;      // For cursor pagination
  offset?: number;      // For offset pagination
  page?: number;        // For page pagination
  timeWindow?: string;  // For time_window pagination
}
```

### Examples:
```json
// Cursor pagination - at page 5
{"type":"cursor","cursor":"eyJvZmZzZXQiOjQwMH0="}

// Offset pagination - at offset 200
{"type":"offset","offset":200}

// Page pagination - at page 3
{"type":"page","page":3}

// Time window pagination - since specific timestamp
{"type":"time_window","timeWindow":"2024-01-15T18:45:30Z"}
```
