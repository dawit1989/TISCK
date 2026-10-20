# TISCK Upstream Production Deployment & Disaster Rollback Runbook

## 1. Scope and Authority

This runbook defines the authoritative operational procedures for promoting approved CloudTAK upstream releases to production (Stage F) and rolling back to the last known-good baseline in the event of post-deployment defects.

> [!IMPORTANT]
> Production deployment is **never unattended or automated**. It must be executed by an authorized operator only after Stage E maintainer approval of the candidate pull request.

---

## 2. Pre-Deployment Snapshot Protocol

Before executing any production upgrade:

1. **Verify Current Container Health**:
   ```bash
   docker compose -f cloudtak/docker-compose.yml ps
   ```
   Ensure `cloudtak-api-1`, `cloudtak-postgis-1`, and `cloudtak-identity-server-1` report healthy status.

2. **Execute Full Database Snapshots**:
   Capture atomic SQL dumps of both the CloudTAK geospatial database (`gis`) and the Authentik identity database (`authentik`):
   ```bash
   mkdir -p backups/pre-upgrade
   docker exec cloudtak-postgis-1 pg_dump -U docker gis > backups/pre-upgrade/gis_pre_upgrade.sql
   docker exec cloudtak-postgis-1 pg_dump -U authentik authentik > backups/pre-upgrade/authentik_pre_upgrade.sql
   ```
   Verify snapshot files are non-empty and readable.

3. **Backup Authentik Identity Configuration & Media**:
   ```bash
   pwsh cloudtak/scripts/backup-identity.ps1
   ```

4. **Record Current Rollback Baseline**:
   Query the authoritative state ledger:
   ```bash
   npx tsx cloudtak/scripts/upstream/version-pin.ts --get-approved
   ```

---

## 3. Production Deployment Execution (Stage F)

1. **Fetch Approved Main Branch**:
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Verify Version Consistency**:
   ```bash
   npx tsx cloudtak/scripts/upstream/version-pin.ts --verify
   ```

3. **Rebuild and Restart Containers**:
   ```bash
   docker compose -f cloudtak/docker-compose.yml up -d --build
   ```

4. **Monitor Startup & Health Probes**:
   ```bash
   docker compose -f cloudtak/docker-compose.yml ps
   docker compose -f cloudtak/docker-compose.yml logs -f --tail=100 api
   ```

5. **Execute Post-Deployment Verification**:
   ```bash
   node cloudtak/scripts/e2e-browser-login.mjs
   node cloudtak/scripts/verify-persistence.mjs
   ```

---

## 4. Disaster Rollback Protocol

Trigger this procedure immediately if any of the following occur post-deployment:
- OIDC authentication, callback, or session refresh failures.
- PostGIS database connection or schema migration incompatibilities.
- Crash looping or unhandled rejections in `cloudtak-api-1`.
- Loss of tactical group authorization or TAK client certificate issuance.

### Step 1: Revert Version Pin & Working Tree
1. Revert `cloudtak/.upstream-version` to the `lastKnownGood` tag recorded in `cloudtak/config/upstream-release-state.json`.
2. Check out the previous approved commit or tag:
   ```bash
   git checkout $(npx tsx -e "console.log(require('./cloudtak/config/upstream-release-state.json').lastKnownGood.commitSha)")
   ```

### Step 2: Terminate Defective Containers
```bash
docker compose -f cloudtak/docker-compose.yml down
```

### Step 3: Restore Database Snapshots (If Migrations Ran)
If the candidate release executed database migrations on startup:
1. Start the PostGIS database container in isolation:
   ```bash
   docker compose -f cloudtak/docker-compose.yml up -d postgis
   ```
2. Wait for PostGIS readiness:
   ```bash
   docker compose -f cloudtak/docker-compose.yml exec postgis pg_isready -U docker -d gis
   ```
3. Restore pre-upgrade database snapshots:
   ```bash
   docker exec -i cloudtak-postgis-1 psql -U docker -d gis < backups/pre-upgrade/gis_pre_upgrade.sql
   docker exec -i cloudtak-postgis-1 psql -U authentik -d authentik < backups/pre-upgrade/authentik_pre_upgrade.sql
   ```

### Step 4: Re-deploy Baseline Containers
```bash
docker compose -f cloudtak/docker-compose.yml up -d --build
```

### Step 5: Post-Rollback Validation Gate
Verify full service restoration:
```bash
node cloudtak/scripts/verify-persistence.mjs
node cloudtak/scripts/e2e-browser-login.mjs
```
Confirm all tactical groups (`TISCK_COMMAND`, `TISCK_RECON`, `TISCK_INTEL`, `TISCK_ISR`) authenticate without errors.
