# Upstream CloudTAK Synchronization & Release Maintenance Runbook

## 1. Overview & Architectural Baseline

TISCK maintains an adapted copy of CloudTAK under `cloudtak/` pinned to version `v13.102.4` (resolved commit SHA `19ed703003436efc36cd3440e0b6a5358f8d3098`). The single authoritative source of truth for the approved upstream version tag is [`cloudtak/.upstream-version`](file:///c:/Users/Dave/Downloads/tak/TISCK/cloudtak/.upstream-version), with metadata tracked in [`cloudtak/config/upstream-release-state.json`](file:///c:/Users/Dave/Downloads/tak/TISCK/cloudtak/config/upstream-release-state.json).

A foundational architectural constraint governs this relationship:
> **Upstream CloudTAK DOES have built-in OIDC SSO concepts, but its configuration model is database/UI-driven (`oidc::*` settings), and its backchannel network assumptions assume a flat DNS space rather than dual-homed Docker service names.**

TISCK bridges this by maintaining documented customizations cataloged in [`cloudtak/config/tisck-customization-manifest.json`](file:///c:/Users/Dave/Downloads/tak/TISCK/cloudtak/config/tisck-customization-manifest.json):
- Dual-homed Docker URL rewriting in `cloudtak/api/stateless/lib/oidc.ts`.
- 32-character signing secret guards and local PostGIS SSL bypass in `cloudtak/api/common/config.ts`.
- Direct `AUTHENTIK_API_TOKEN` support in `cloudtak/api/stateless/lib/authentik-provider.ts`.
- Authentik tactical group synchronization and advisory-locked TAK certificate issuance in `cloudtak/api/stateless/routes/login.ts`.
- Environment-driven 5-tier orchestration in `cloudtak/docker-compose.yml`.

---

## 2. Six-Stage Release Maintenance Protocol (Stages A–F)

Upstream CloudTAK maintenance follows a strict six-stage lifecycle that decouples release discovery and candidate qualification from production deployment:

```
[Stage A: Detect] -> [Stage B: Analyze] -> [Stage C: Test] -> [Stage D: Prepare] -> [Stage E: Approve] -> [Stage F: Deploy]
```

### Stage A — Detect: Release Discovery & Deduplication
- **Trigger**: Weekly cron (`.github/workflows/upstream-maintenance.yml`) or manual workflow dispatch (`--tag <tag>`).
- **Engine**: `cloudtak/scripts/upstream/discover-release.ts`.
- **Protocol**: Queries `https://github.com/dfpc-coe/CloudTAK.git` via `git ls-remote`, extracts peeled commit SHAs, and verifies against `upstream-release-state.json`.
- **Guarantees**: Deduplicates already-known releases; skips execution if the release matches the approved baseline; rejects moving branches (`main`, `master`, `latest`).

### Stage B — Analyze: Static Compatibility Assessment
- **Engine**: `cloudtak/scripts/upstream/assess-compatibility.ts`.
- **Protocol**: Computes diff against `vendor/upstream`, scanning for:
  - Irreversible database migrations (`DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN TYPE`, `RENAME TO`).
  - Authentication and OIDC endpoint changes.
  - Overlaps with active TISCK patches in `tisck-customization-manifest.json`.
- **Output**: Generates `COMPATIBILITY-REPORT.md` with risk indicator classifications (High, Medium, Low).

### Stage C — Test: Sandboxed CI Validation
- **Engine**: `cloudtak/scripts/upstream/run-candidate-tests.ts`.
- **Sandboxed Compose**: `cloudtak/docker-compose.test-candidate.yml` running with unique project prefix (`-p tisck-ci-<run_id>`) on isolated bridge network `tisck-ci-net` with synthetic credentials.
- **Test Tiers**:
  1. *Tier 1 (Unit & Invariants)*: `oidc-url-validation.test.ts`, `tisck-signing-secret.test.ts`, `tisck-tactical-groups.test.ts`, `upstream-version-pin.test.ts`.
  2. *Tier 2 (Compose Smoke)*: Candidate Compose configuration syntax validation.
  3. *Tier 3 (Live Integration)*: Authentik direct token provisioning and headless browser CDP login flow (`e2e-browser-login.mjs`).
  4. *Tier 4 (Persistence)*: Container restart recovery (`verify-persistence.mjs`).
- **Reporting**: Categorizes outcomes into `PASSED`, `FAILED`, `NOT_RUN`, or `BLOCKED`. Zero production volume mounts or credentials allowed.

### Stage D — Prepare: Pull Request or Triage Issue
- **Engine**: `cloudtak/scripts/upstream/publish-proposal.ts`.
- **On Success**: Opens candidate pull request from `candidate/upstream-<tag>` containing release lineage, static compatibility summary, qualification test evidence, and rollback instructions.
- **On Failure**: Opens a triage issue titled `[Upstream Candidate Blocked] CloudTAK <tag> failed validation` with diagnostic logs. Halts candidate promotion.
- **Credential Redaction**: All tokens, private keys, and passwords are automatically scrubbed.

### Stage E — Approve: Maintainer Manual Review
- **Requirement**: A human maintainer reviews the pull request, compatibility findings, and test matrix evidence.
- **Merge Constraint**: The candidate PR MUST be merged into `main` using a **3-way merge commit** (`git merge --no-ff`).
  > [!CAUTION]
  > **NEVER squash or rebase merge upstream candidate pull requests.** Squash and rebase merges discard the second parent commit, destroying the `vendor/upstream` merge base required for future 3-way merges.

### Stage F — Deploy: Authorized Production Deployment
- **Policy**: Production deployment is NEVER automated or unattended. It is an explicitly authorized operator action.
- **Pre-Flight Snapshot**: Operator executes pre-deployment database and identity snapshots:
  ```bash
  docker exec cloudtak-postgis-1 pg_dump -U docker gis > pre-upgrade-gis.sql
  docker exec cloudtak-postgis-1 pg_dump -U authentik authentik > pre-upgrade-authentik.sql
  pwsh cloudtak/scripts/backup-identity.ps1
  ```
- **Deployment**:
  ```bash
  docker compose -f cloudtak/docker-compose.yml up -d --build
  ```
- **Verification**: Run post-deployment health probes and browser login checks.

---

## 3. Disaster Recovery & Rollback Protocol

If post-deployment anomalies arise:
1. Revert `cloudtak/.upstream-version` and Docker Compose tags to `lastKnownGood` version recorded in `upstream-release-state.json`.
2. Stop candidate containers:
   ```bash
   docker compose -f cloudtak/docker-compose.yml down
   ```
3. If database migrations ran during upgrade, restore pre-upgrade snapshots:
   ```bash
   docker compose -f cloudtak/docker-compose.yml up -d postgis
   docker exec -i cloudtak-postgis-1 psql -U docker -d gis < pre-upgrade-gis.sql
   docker exec -i cloudtak-postgis-1 psql -U authentik -d authentik < pre-upgrade-authentik.sql
   ```
4. Re-launch verified baseline containers:
   ```bash
   docker compose -f cloudtak/docker-compose.yml up -d --build
   ```
5. Confirm operational recovery via `node cloudtak/scripts/verify-persistence.mjs`.
