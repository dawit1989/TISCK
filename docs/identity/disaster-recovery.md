# TISCK Identity Disaster Recovery & Break-Glass Runbook

## Overview

In austere tactical deployments, communications or identity services may experience unexpected failure, network partitions, or administrator credential loss. This runbook details operational procedures for emergency access and disaster recovery.

---

## 1. Scenario 1: Lost Authentik Administrator Password

If the `akadmin` password is lost or MFA token is unavailable:

### Step 1: Generate Emergency Single-Use Recovery Key
Execute the Authentik Django management CLI inside the `identity-server` container:
```bash
docker compose exec identity-server ./manage.py recovery_key 1
```

**Output**:
```text
https://localhost:9000/if/flow/initial-setup/?token=<emergency-token>
```
* Accessing this link provides immediate, authenticated administrative access to Authentik without prompting for existing passwords or multi-factor authentication tokens.

### Step 2: Reset Admin Password via CLI
Alternatively, reset the `akadmin` password directly from the console:
```bash
docker compose exec identity-server ./manage.py set_admin_password "NEW_SECURE_ADMIN_PASSWORD"
```

---

## 2. Scenario 2: Identity Service Outage (CloudTAK Break-Glass)

If Authentik server or worker containers are stopped, crashing, or unreachable over the internal Docker network:

### Expected System Behavior
1. Unauthenticated users attempting SSO will be redirected to `/login?local=true&sso_error=SSO%20Login%20Failed`.
2. Existing active CloudTAK user sessions continue operating until the JWT session token expires.
3. System fails closed — unauthorized users cannot bypass authentication.

### Emergency Administrator Break-Glass Flow
1. Navigate directly to the break-glass login URL in any browser:
   ```text
   http://localhost:5000/login?local=true
   ```
2. Enter the local administrator credentials configured in PostgreSQL (e.g., username `admin`, password configured during initial setup).
3. The API validates credentials against PostgreSQL and issues a local administrative session (`access: admin`), bypassing the OIDC IdP.

---

## 3. Scenario 3: Identity Database Corruption or Loss

If the PostgreSQL `authentik` database becomes corrupted:

### Step 1: Verify Health of PostgreSQL Engine
```bash
docker inspect --format '{{.State.Health.Status}}' cloudtak-postgis-1
```

### Step 2: Restore from Latest Periodic Dump
```bash
# Using PowerShell
.\cloudtak\scripts\backup-identity.ps1 -Action Restore -File "D:\backups\authentik_latest.dump"

# Or using Bash
./cloudtak/scripts/backup-identity.sh --restore /media/backup/authentik_latest.dump
```

### Step 3: Restart Identity Containers
```bash
docker compose restart identity-server identity-worker
```

### Step 4: Verify Identity Health
```bash
docker compose ps identity-server identity-worker
```
