# Security Checklists

## Pre-Launch Security Checklist

### Authentication & Authorization
- [ ] Multi-factor authentication available for user accounts
- [ ] Password policy enforced (minimum length, complexity, breached password check)
- [ ] Account lockout after failed attempts
- [ ] Session timeout (idle + absolute)
- [ ] Secure session management (HttpOnly, Secure, SameSite cookies)
- [ ] Authorization checks on every API endpoint
- [ ] Role-based access control properly implemented
- [ ] Password reset flow is secure (time-limited tokens, no info leakage)

### Data Protection
- [ ] TLS 1.2+ on all connections (internal + external)
- [ ] Sensitive data encrypted at rest (AES-256)
- [ ] No secrets in source code or environment variables
- [ ] Secrets stored in Secret Manager / Vault
- [ ] PII data identified and protection measures in place
- [ ] Data retention and deletion policies implemented
- [ ] Backups encrypted and tested

### API Security
- [ ] Input validation on all endpoints
- [ ] Output encoding for all responses
- [ ] Rate limiting implemented
- [ ] Request size limits configured
- [ ] CORS properly configured (no wildcard in production)
- [ ] CSRF protection on state-changing operations
- [ ] API versioning strategy in place
- [ ] Authentication required on all non-public endpoints

### Infrastructure
- [ ] Firewall rules: default deny, specific allows
- [ ] No public IPs on backend services
- [ ] Private subnets for databases and internal services
- [ ] WAF configured on public endpoints
- [ ] DDoS protection enabled
- [ ] Container images scanned for vulnerabilities
- [ ] Non-root containers
- [ ] Network policies restrict pod-to-pod traffic

### Monitoring & Incident Response
- [ ] Security events logged (auth failures, access denied, errors)
- [ ] Centralized log aggregation
- [ ] Alerting on suspicious patterns
- [ ] Incident response plan documented
- [ ] On-call rotation established
- [ ] Runbooks for common security scenarios

### Compliance
- [ ] Privacy policy published and accurate
- [ ] Cookie consent implemented (if applicable)
- [ ] Data processing agreements with third parties
- [ ] Right to deletion / data portability (GDPR)
- [ ] Audit trail for sensitive operations

## Code Review Security Checklist

### Input Handling
- [ ] All external input validated (type, length, range, format)
- [ ] SQL queries use parameterized statements
- [ ] No string concatenation in queries
- [ ] File uploads validated (type, size, content)
- [ ] Path traversal prevented (no user input in file paths)
- [ ] Command injection prevented (no user input in shell commands)
- [ ] HTML output properly encoded to prevent XSS

### Cryptography
- [ ] Using established crypto libraries (not custom)
- [ ] Strong algorithms (AES-256-GCM, RSA-2048+, SHA-256+)
- [ ] No MD5/SHA1 for security purposes
- [ ] `crypto/rand` for random values (not `math/rand`)
- [ ] Keys not hardcoded
- [ ] Proper IV/nonce handling (never reused)

### Error Handling
- [ ] Errors don't expose sensitive information
- [ ] Generic error messages to users
- [ ] Detailed errors only in server logs
- [ ] All errors handled (no ignored errors)
- [ ] Errors don't reveal system internals

### Concurrency
- [ ] Shared state properly protected (mutexes, channels)
- [ ] No race conditions in authentication/authorization
- [ ] No TOCTOU (time-of-check-time-of-use) vulnerabilities
- [ ] Goroutines properly cleaned up
- [ ] Context cancellation respected

### Dependencies
- [ ] No known vulnerabilities (govulncheck, npm audit, Snyk)
- [ ] Dependencies pinned to specific versions
- [ ] Minimal dependency footprint
- [ ] License compliance verified

## Incident Response Template

```
## Incident Summary
- **Severity**: P1/P2/P3/P4
- **Status**: Investigating / Mitigating / Resolved
- **Start time**: YYYY-MM-DD HH:MM UTC
- **Detection method**: Automated alert / User report / Internal discovery
- **Affected systems**: [list]
- **Affected users**: [scope]

## Timeline
- HH:MM - Event detected
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Mitigation applied
- HH:MM - Resolved

## Root Cause
[Technical explanation of what went wrong]

## Impact
[What was affected, data exposure scope, user impact]

## Mitigation
[What was done to resolve the immediate issue]

## Prevention
[What changes will prevent recurrence]
- [ ] Action item 1 - Owner - Due date
- [ ] Action item 2 - Owner - Due date

## Lessons Learned
[What we learned, what went well, what could improve]
```

## Threat Model Template

```
## System: [Name]
## Date: [Date]
## Author: [Name]

### Assets
1. [What are we protecting?]
2. [User data, API keys, business logic, etc.]

### Entry Points
1. [Public API endpoints]
2. [Admin interfaces]
3. [File uploads]
4. [Third-party integrations]

### Trust Boundaries
1. [Internet → Load Balancer]
2. [Load Balancer → Application]
3. [Application → Database]
4. [Application → Third-party APIs]

### Threats (STRIDE)
| ID | Category | Threat | Likelihood | Impact | Risk | Mitigation |
|----|----------|--------|------------|--------|------|------------|
| T1 | Spoofing | ... | High | High | Critical | ... |
| T2 | Tampering | ... | Medium | High | High | ... |

### Accepted Risks
[Risks acknowledged and accepted with justification]

### Action Items
- [ ] Implement mitigation for T1 - Priority: High
- [ ] Implement mitigation for T2 - Priority: Medium
```
