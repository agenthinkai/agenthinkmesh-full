# Mesh Enterprise Platform — Enterprise Documentation Suite
**Version 1.0 — Enterprise Certification Sprint**
**Classification: Customer-Facing**

---

## Table of Contents

1. [Deployment Guide](#1-deployment-guide)
2. [Administration Guide](#2-administration-guide)
3. [Operations Guide](#3-operations-guide)
4. [Security Guide](#4-security-guide)
5. [Backup and Recovery Guide](#5-backup-and-recovery-guide)
6. [Troubleshooting Guide](#6-troubleshooting-guide)
7. [Pilot Onboarding Guide](#7-pilot-onboarding-guide)
8. [Deployment Checklist](#8-deployment-checklist)

---

## 1. Deployment Guide

### 1.1 System Requirements

| Component | Minimum | Recommended |
|---|---|---|
| CPU | 4 vCPU | 8 vCPU |
| RAM | 8 GB | 16 GB |
| Disk | 50 GB SSD | 100 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| Node.js | 20.x LTS | 22.x LTS |
| MySQL | 8.0 | 8.0+ or TiDB |
| Network | 100 Mbps | 1 Gbps |

### 1.2 Docker Compose Deployment (Recommended)

This is the fastest path to a running instance. Requires Docker 24+ and Docker Compose v2.

```bash
# 1. Clone the repository
git clone https://github.com/your-org/agenthinkmesh-full.git
cd agenthinkmesh-full

# 2. Configure environment
cp .env.template .env
vi .env   # Fill in all CHANGE_ME values

# 3. Start all services
docker compose up -d

# 4. Verify health
curl http://localhost:3000/api/health
# Expected: {"status":"ok","db":"connected","version":"1.0.0","uptime":...}
```

The `docker-compose.yml` starts three services:
- **app** — the Node.js application (port 3000)
- **db** — MySQL 8.0 (port 3306, internal only)
- **adminer** — Database admin UI (port 8080, disable in production)

### 1.3 Bare-Metal / VM Deployment

For environments where Docker is not available:

```bash
# Prerequisites
node --version   # Must be 20+
npm install -g pnpm@9 pm2

# Deploy
cp .env.template .env && vi .env
chmod +x scripts/start-onprem.sh
./scripts/start-onprem.sh

# Verify
curl http://localhost:3000/api/health
pm2 status
```

The startup script performs: env validation → dependency install → DB migration → build → PM2 start → health check.

### 1.4 Environment Variables

All required variables are documented in `.env.template`. Critical variables:

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | MySQL connection string | Yes |
| `JWT_SECRET` | 32+ character random secret for session signing | Yes |
| `ANTHROPIC_API_KEY` | Claude API key for council engine | Yes |
| `BUILT_IN_FORGE_API_KEY` | Manus platform API key | Yes |
| `VITE_APP_ID` | OAuth application ID | Yes |
| `ENCRYPTION_MASTER_KEY` | 32-byte hex key for CMK encryption | Yes |
| `PORT` | HTTP port (default: 3000) | No |

### 1.5 SSL/TLS Configuration

The platform does not terminate TLS directly. Place a reverse proxy (nginx, Caddy, AWS ALB) in front:

**nginx example:**
```nginx
server {
    listen 443 ssl;
    server_name mesh.yourcompany.com;
    ssl_certificate     /etc/ssl/mesh.crt;
    ssl_certificate_key /etc/ssl/mesh.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 1.6 Upgrade Procedure

```bash
# 1. Pull latest code
git pull origin main

# 2. Zero-downtime reload (PM2)
./scripts/start-onprem.sh --reload

# OR full restart (Docker)
docker compose pull && docker compose up -d
```

### 1.7 Rollback Procedure

```bash
# Identify the last stable commit
git log --oneline -10

# Rollback to that commit
git checkout <commit-hash>
./scripts/start-onprem.sh --reload

# Rollback database (if schema changed)
# Restore from backup taken before upgrade (see Section 5)
```

---

## 2. Administration Guide

### 2.1 First-Time Setup

After deployment, the platform owner (the account whose `OWNER_OPEN_ID` is set in `.env`) has full administrative access.

**Initial steps:**
1. Log in at `https://your-domain/` using Manus OAuth
2. Navigate to **Enterprise** → **Organizations**
3. Create your first organisation
4. Add users via **Enterprise** → **User Management**
5. Assign roles
6. Create Decision Twins via **Admin** → **Twin Generator**

### 2.2 Organisation Management

Organisations are the top-level tenant unit. Each organisation is fully isolated from all others.

**Create an organisation:**
- Navigate to **Enterprise** → **Organizations** → **New Organisation**
- Enter name, slug (URL-safe identifier), and plan tier
- The slug cannot be changed after creation

**Organisation plans:**
| Plan | Max Users | Max Twins | Council Modes |
|---|---|---|---|
| `starter` | 5 | 3 | Standard |
| `professional` | 25 | 10 | Standard + GCC |
| `enterprise` | Unlimited | Unlimited | All modes |

### 2.3 User Management

**Add a user:**
1. Navigate to **Enterprise** → **User Management** → **Invite User**
2. Enter the user's Manus account email
3. Select their role
4. Click **Send Invitation**

**Roles:**
| Role ID | Name | Capabilities |
|---|---|---|
| 1 | `org_admin` | Full org management, user management, twin management |
| 2 | `dept_head` | Department management, twin runs, reports |
| 3 | `analyst` | Twin runs, view reports, outcome recording |
| 4 | `viewer` | Read-only access to reports and outcomes |

**Suspend a user:**
- Navigate to **Enterprise** → **User Management**
- Find the user → **Actions** → **Suspend**
- The user is immediately locked out; their data is preserved

**Reactivate a user:**
- Find the suspended user → **Actions** → **Reactivate**

### 2.4 Decision Twin Management

**Create a Decision Twin:**
1. Navigate to **Admin** → **Twin Generator**
2. Select a blueprint (M&A Screener, Capital Allocator, Vendor Risk, etc.)
3. Configure: display name, governance profile, industry, geography
4. Click **Generate Twin**
5. The twin appears in the Enterprise Dashboard

**Governance profiles:**
| Profile | Description |
|---|---|
| `STANDARD` | Default — balanced disclosure |
| `CONFIDENTIAL` | Restricted — session data not shared across departments |
| `RESTRICTED` | Maximum — admin-only access to session history |

**Configure connectors:**
1. Navigate to **Admin** → **Registry** → select a twin
2. Click **Connectors** → **Add Connector**
3. Select type: CSV, Excel, REST API, SQL
4. Configure connection parameters
5. Click **Test Connection** → **Save**

### 2.5 Platform Administration

**Health monitoring:**
```bash
# Check platform health
curl https://your-domain/api/health

# PM2 process monitor
pm2 monit

# View application logs
pm2 logs mesh-enterprise --lines 100
```

**Database administration:**
- Access Adminer at `http://localhost:8080` (Docker) or use any MySQL client
- Connection details are in `.env` under `DATABASE_URL`

---

## 3. Operations Guide

### 3.1 Daily Operations Checklist

| Task | Frequency | Method |
|---|---|---|
| Health check | Every 5 min (automated) | `/api/health` endpoint |
| Log review | Daily | `pm2 logs` |
| Backup verification | Daily | See Section 5 |
| Disk space check | Weekly | `df -h` |
| Certificate expiry | Monthly | `openssl x509 -enddate` |
| Dependency audit | Monthly | `pnpm audit` |

### 3.2 Monitoring

The `/api/health` endpoint returns:
```json
{
  "status": "ok",
  "db": "connected",
  "version": "1.0.0",
  "uptime": 86400,
  "timestamp": "2026-08-02T07:00:00.000Z"
}
```

Integrate with your monitoring tool (Datadog, Prometheus, UptimeRobot) by polling this endpoint every 60 seconds. Alert if status is not `"ok"` or if HTTP response code is not 200.

### 3.3 Log Management

Logs are written to `./logs/` by PM2:
- `logs/app-out.log` — application stdout
- `logs/app-err.log` — application stderr
- `logs/app-combined.log` — combined log

Log rotation is configured in `ecosystem.config.cjs` (10 MB max, 30-day retention).

For centralised logging, configure a log shipper (Filebeat, Fluentd) to forward `logs/*.log` to your SIEM or log aggregation platform.

### 3.4 Performance Tuning

**Node.js heap size** (for high-volume deployments):
```bash
# In ecosystem.config.cjs, add to node_args:
node_args: "--max-old-space-size=4096"
```

**Database connection pool:**
The platform uses a single connection per request (Drizzle ORM). For >50 concurrent users, configure a connection pooler (PgBouncer equivalent for MySQL: ProxySQL).

**Council execution timeout:**
Council runs take 60–120 seconds. The default Express request timeout is 180 seconds. Do not reduce below 180 seconds.

---

## 4. Security Guide

### 4.1 Authentication

The platform uses Manus OAuth 2.0 for authentication. All sessions are signed JWT cookies with:
- Algorithm: HS256
- Expiry: 7 days
- HttpOnly: true
- SameSite: Lax
- Secure: true (production)

**Air-gapped environments:** OAuth requires outbound connectivity to `api.manus.im`. For fully air-gapped deployments, contact Manus for an on-premises OAuth server package.

### 4.2 Authorisation

All tRPC procedures are protected at three levels:

1. **Authentication gate** — `protectedProcedure` rejects unauthenticated requests with HTTP 401
2. **Tenant isolation** — `requireOrgMembership` middleware resolves `orgId` from the authenticated user's actual membership record; it never trusts client-supplied `orgId` values
3. **Role gate** — individual procedures check `ctx.user.role` or `ctx.membership.roleId` for privileged operations

**Cross-tenant access is impossible by design.** The `requireOrgMembership` middleware throws `FORBIDDEN` if the user is not an active member of the organisation.

### 4.3 Tenant Isolation

Each organisation's data is isolated at the application layer:
- All database queries include `WHERE orgId = ctx.orgId`
- `ctx.orgId` is resolved exclusively from the authenticated user's membership record
- No client-supplied `orgId` is trusted for data access
- Cross-tenant penetration tests (20 scenarios) pass in the CI suite

### 4.4 Encryption

**Data at rest:**
- Customer Master Key (CMK) system encrypts sensitive fields using AES-256
- Keys are stored in the `encryptionKeys` table, encrypted with the `ENCRYPTION_MASTER_KEY` env var
- Key rotation is supported without downtime

**Data in transit:**
- All traffic must be served over TLS 1.2+ (enforced by HSTS header)
- The platform sets `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

### 4.5 Security Headers

The following headers are set on every response (via Helmet):

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | Restrictive policy (see source) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `X-DNS-Prefetch-Control` | `off` |
| `X-Download-Options` | `noopen` |

### 4.6 Rate Limiting

| Endpoint Group | Limit | Window |
|---|---|---|
| All `/api/*` routes | 500 requests | 15 minutes per IP |
| `/api/oauth/*` routes | 20 requests | 15 minutes per IP |
| `/api/health` | Unlimited | — |

### 4.7 Audit Logging

All enterprise actions are written to the `auditLogs` table:
- Twin runs and simulations
- Member suspension and reactivation
- Role changes
- Connector configuration changes
- Report generation

Audit logs are append-only and include: timestamp, userId, orgId, action, resourceType, resourceId, metadata.

### 4.8 Secrets Management

- All secrets are injected via environment variables
- No secrets are committed to the repository
- Use `.env.template` as the reference; never commit `.env`
- Rotate `JWT_SECRET` by updating the env var and restarting the server (existing sessions will be invalidated)
- Rotate `ENCRYPTION_MASTER_KEY` using the key rotation runbook (contact support)

### 4.9 On-Premises Security Hardening

For on-premises deployments:
1. Run the application as a non-root user (`useradd -m mesh && su mesh`)
2. Restrict database access to localhost only
3. Enable firewall: allow only ports 443 (HTTPS) and 22 (SSH admin)
4. Disable Adminer in production (`docker compose --profile prod up -d`)
5. Enable OS-level audit logging (auditd)
6. Configure log forwarding to your SIEM

---

## 5. Backup and Recovery Guide

### 5.1 Backup Strategy

| Component | Method | Frequency | Retention |
|---|---|---|---|
| Database | `mysqldump` | Daily (automated) | 30 days |
| Application config | `.env` file backup | On every change | 10 versions |
| Uploaded files | S3 cross-region replication | Continuous | 90 days |
| Application code | Git repository | Every commit | Indefinite |

### 5.2 Database Backup

**Manual backup:**
```bash
# Extract connection details from DATABASE_URL
# Format: mysql://user:password@host:port/database

mysqldump \
  --host=<host> \
  --port=<port> \
  --user=<user> \
  --password=<password> \
  --single-transaction \
  --routines \
  --triggers \
  <database> \
  > backup-$(date +%Y%m%d-%H%M%S).sql

gzip backup-*.sql
```

**Automated backup (cron):**
```bash
# Add to crontab: crontab -e
0 2 * * * /home/mesh/agenthinkmesh-full/scripts/backup-db.sh >> /var/log/mesh-backup.log 2>&1
```

Create `scripts/backup-db.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
source /home/mesh/agenthinkmesh-full/.env
BACKUP_DIR="/var/backups/mesh"
mkdir -p "$BACKUP_DIR"
FILENAME="mesh-db-$(date +%Y%m%d-%H%M%S).sql.gz"

# Parse DATABASE_URL: mysql://user:pass@host:port/db
DB_USER=$(echo "$DATABASE_URL" | sed 's|mysql://\([^:]*\):.*|\1|')
DB_PASS=$(echo "$DATABASE_URL" | sed 's|mysql://[^:]*:\([^@]*\)@.*|\1|')
DB_HOST=$(echo "$DATABASE_URL" | sed 's|.*@\([^:]*\):.*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed 's|.*:\([0-9]*\)/.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed 's|.*/\([^?]*\).*|\1|')

mysqldump --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" \
  --password="$DB_PASS" --single-transaction --routines --triggers \
  "$DB_NAME" | gzip > "$BACKUP_DIR/$FILENAME"

# Delete backups older than 30 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "[$(date)] Backup complete: $FILENAME"
```

### 5.3 Recovery Procedure

**Full database recovery:**
```bash
# 1. Stop the application
./scripts/start-onprem.sh --stop

# 2. Restore the database
gunzip -c backup-20260802-020000.sql.gz | \
  mysql --host=<host> --user=<user> --password=<password> <database>

# 3. Restart the application
./scripts/start-onprem.sh

# 4. Verify health
curl http://localhost:3000/api/health
```

**Point-in-time recovery (MySQL binary logs):**
If binary logging is enabled on your MySQL server, you can recover to any point in time. Contact your DBA for the `mysqlbinlog` procedure.

### 5.4 Disaster Recovery

**RTO (Recovery Time Objective):** 4 hours  
**RPO (Recovery Point Objective):** 24 hours (daily backup) / 1 hour (with binary logs)

**DR runbook:**
1. Provision a new server matching the system requirements
2. Clone the repository and restore `.env`
3. Restore the latest database backup
4. Run `./scripts/start-onprem.sh`
5. Update DNS to point to the new server
6. Verify all functionality via the health endpoint and a test council run

---

## 6. Troubleshooting Guide

### 6.1 Common Issues

#### Platform does not start

**Symptom:** `./scripts/start-onprem.sh` exits with an error.

**Diagnosis:**
```bash
# Check Node.js version
node --version   # Must be 20+

# Check .env file
cat .env | grep -v "^#" | grep -v "^$"

# Check database connectivity
mysql -h <host> -u <user> -p<password> -e "SELECT 1"

# Check PM2 logs
pm2 logs mesh-enterprise --lines 50
```

**Common causes:**
- Missing or incorrect `DATABASE_URL` — verify the connection string format
- `JWT_SECRET` too short — must be 32+ characters
- Node.js version < 20 — upgrade Node.js
- Port 3000 already in use — set `PORT=3001` in `.env`

#### Health check returns `"db":"error"`

**Symptom:** `GET /api/health` returns `{"status":"degraded","db":"error"}`

**Diagnosis:**
```bash
# Test database connection directly
mysql -h <host> -u <user> -p<password> <database> -e "SELECT COUNT(*) FROM users"
```

**Common causes:**
- Database server is down or unreachable
- Firewall blocking port 3306
- Incorrect credentials in `DATABASE_URL`
- Database user lacks SELECT privileges

#### Council run times out

**Symptom:** Twin run returns an error after ~180 seconds.

**Diagnosis:**
- Check `ANTHROPIC_API_KEY` is valid: `curl -H "x-api-key: $ANTHROPIC_API_KEY" https://api.anthropic.com/v1/models`
- Check outbound internet connectivity: `curl -I https://api.anthropic.com`
- Check the application logs for the specific error: `pm2 logs mesh-enterprise | grep -i "council\|anthropic\|timeout"`

**Common causes:**
- Invalid or expired `ANTHROPIC_API_KEY`
- Outbound HTTPS blocked by firewall (requires `api.anthropic.com:443`)
- Anthropic API rate limit exceeded

#### Users cannot log in

**Symptom:** Login redirects to an error page or loops.

**Diagnosis:**
```bash
# Check OAuth configuration
echo "App ID: $VITE_APP_ID"
echo "OAuth URL: $OAUTH_SERVER_URL"

# Check server logs for OAuth errors
pm2 logs mesh-enterprise | grep -i "oauth\|callback\|token"
```

**Common causes:**
- `VITE_APP_ID` does not match the registered OAuth application
- The callback URL registered in the OAuth portal does not match the deployed domain
- Clock skew > 5 minutes between server and OAuth provider (sync NTP)

#### "FORBIDDEN" error on enterprise procedures

**Symptom:** Enterprise API calls return `TRPC_ERROR: FORBIDDEN`.

**Cause:** The user is not an active member of the organisation. This is the tenant isolation middleware working correctly.

**Resolution:**
- Verify the user has been added to the organisation via **Enterprise** → **User Management**
- Verify their membership status is `active` (not `suspended`)
- If the user was recently added, ask them to log out and log back in

### 6.2 Log Reference

| Log Pattern | Meaning |
|---|---|
| `[OAuth] Initialized` | Server started successfully |
| `[Health] DB connected` | Database connection healthy |
| `[Council] Starting run` | Council execution beginning |
| `[Council] Completed in Xms` | Council execution successful |
| `[Tenant] FORBIDDEN` | Cross-tenant access attempt blocked |
| `[Rate Limit] Too many requests` | Rate limit triggered |

### 6.3 Support Escalation

For issues not resolved by this guide:
1. Collect logs: `pm2 logs mesh-enterprise --lines 200 > support-bundle.txt`
2. Include the output of `curl http://localhost:3000/api/health`
3. Include the `.env` file with all secret values redacted
4. Submit to support with the subject: `[Enterprise Support] <issue description>`

---

## 7. Pilot Onboarding Guide

### 7.1 Pre-Pilot Checklist

Before the pilot begins, verify:
- [ ] Platform deployed and health check passing
- [ ] SSL certificate installed and HTTPS working
- [ ] At least one organisation created
- [ ] Admin user added and can log in
- [ ] At least one Decision Twin created and visible in dashboard
- [ ] Council run test completed successfully
- [ ] Backup procedure tested and verified

### 7.2 Day 1: Administrator Onboarding (2 hours)

**Hour 1: Platform walkthrough**
1. Log in and review the dashboard
2. Navigate to **Enterprise** → **Organizations** — review org settings
3. Navigate to **Enterprise** → **User Management** — add pilot users
4. Navigate to **Admin** → **Twin Generator** — create the first pilot twin

**Hour 2: First council run**
1. Open the Enterprise Dashboard
2. Select the Decision Twin
3. Click **Run** — enter a real business question
4. Review the council output: verdict, score, conditions, dissents
5. Review the outcome in **Outcome Ledger**

### 7.3 Week 1: Pilot Scope (Alghanim Industries Reference)

**Recommended pilot configuration:**

| Element | Specification |
|---|---|
| Organisation | Alghanim Industries — Pilot |
| Departments | Corporate Development, Treasury |
| Users | 2 admins, 4 analysts, 2 viewers |
| Decision Twins | M&A Screener, Capital Allocator, Vendor Risk |
| Council mode | GCC |
| Governance profile | CONFIDENTIAL |
| Session target | 10 real decisions in Week 1 |

**Week 1 decision questions (examples):**
- "Should we acquire a 35% stake in [company] for [amount]?"
- "Should we allocate [amount] to [asset class] given current market conditions?"
- "Should we renew the [vendor] contract at the proposed terms?"

### 7.4 Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Council run completion rate | >95% | Sessions completed / sessions started |
| Decision quality score | >0.70 average | `finalScore` in outcome ledger |
| Time to verdict | <3 minutes | Session duration |
| User adoption | >80% weekly active | Users with ≥1 session per week |
| System availability | >99.5% | Health check uptime |
| User satisfaction | >4/5 | End-of-pilot survey |

### 7.5 Pilot Exit Criteria

The pilot is considered successful when:
1. At least 20 council sessions completed
2. Average decision quality score > 0.70
3. At least 3 decisions acted upon by management
4. Zero security incidents
5. System availability > 99.5%
6. User satisfaction score > 4/5

---

## 8. Deployment Checklist

### Pre-Deployment

- [ ] Server provisioned and meets minimum requirements
- [ ] Node.js 20+ installed
- [ ] MySQL 8.0 database provisioned and accessible
- [ ] All environment variables in `.env` filled in (no `CHANGE_ME` values remaining)
- [ ] `node scripts/validate-env.js` passes without errors
- [ ] SSL certificate obtained and configured in reverse proxy
- [ ] DNS record pointing to the server
- [ ] Firewall configured: 443 inbound, 3306 localhost-only
- [ ] Backup storage configured and accessible

### Deployment

- [ ] `./scripts/start-onprem.sh` completes without errors
- [ ] `GET /api/health` returns `{"status":"ok","db":"connected"}`
- [ ] PM2 shows `mesh-enterprise` as `online`
- [ ] Application accessible at `https://your-domain/`
- [ ] Login flow completes successfully
- [ ] First organisation created
- [ ] First admin user added
- [ ] First Decision Twin created
- [ ] Test council run completes (< 3 minutes)
- [ ] Test outcome recorded in Outcome Ledger

### Post-Deployment

- [ ] Monitoring configured (health endpoint polled every 60s)
- [ ] Alerting configured (notify on health check failure)
- [ ] First database backup taken and verified
- [ ] Backup restoration tested on a separate server
- [ ] Log forwarding configured (if required)
- [ ] PM2 startup on boot configured: `pm2 startup && pm2 save`
- [ ] Security headers verified: `curl -I https://your-domain/ | grep -i "strict\|content-security\|x-frame"`
- [ ] Rate limiting verified: 20 rapid requests to `/api/oauth/` triggers 429
- [ ] Pilot users onboarded and trained
- [ ] Support contact established

### Go-Live Sign-Off

| Role | Name | Date | Signature |
|---|---|---|---|
| IT Operations Lead | | | |
| CISO / Security Lead | | | |
| Business Sponsor | | | |
| Platform Administrator | | | |

---

*Document version: 1.0 — Enterprise Certification Sprint*
*Next review: 90 days after pilot go-live*
