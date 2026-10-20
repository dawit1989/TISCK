# Design: Automated CloudTAK Upstream Release Maintenance

## Context

TISCK maintains an adapted, self-hosted deployment of CloudTAK pinned to upstream release `v13.102.4` (resolved commit SHA `19ed703003436efc36cd3440e0b6a5358f8d3098` from [`dfpc-coe/CloudTAK`](https://github.com/dfpc-coe/CloudTAK.git)). TISCK's operational stack integrates Authentik OIDC (`identity-server:9000`), PostGIS 17 (`postgis:5432`), Garage S3 (`store:3900`), and MediaMTX (`media:8554/8889`) via `cloudtak/docker-compose.yml`.

To support self-hosted, offline-first operations without AWS cloud infrastructure, TISCK maintains specific, documented customizations across `cloudtak/api/`:
- **OIDC Dual-Homed Network Resolution & Token Validation** (`cloudtak/api/stateless/lib/oidc.ts`): Rewrites internal Docker backchannel endpoints (`identity-server:9000`) while preserving browser-facing endpoints (`localhost:9000`), injects canonical host headers, and enforces RFC 7519 ID token validation.
- **Signing Secret Enforcement & PostGIS SSL Bypass** (`cloudtak/api/common/config.ts`): Enforces 32-character minimum signing secrets in `docker-compose` mode, disables TLS rejection for internal PostGIS container networking, and defaults `noetlevents=true` to prevent AWS SQS crashes.
- **Outgoing Event Queue Guard** (`cloudtak/api/common/etl-events.ts`): Bypasses AWS SQS message publishing when `this.config.noetlevents` is active.
- **Direct Authentik API Token Support** (`cloudtak/api/stateless/lib/authentik-provider.ts`): Supports static `AUTHENTIK_API_TOKEN` environment variable, removing reliance on AWS Secrets Manager.
- **Authentik Attribute Sync & Advisory Locking** (`cloudtak/api/stateless/routes/login.ts`): Synchronizes tactical user attributes on login, attaches cryptographic nonces, issues TAK client certificates via advisory locks, and handles public IdP logout redirects.
- **Agency and Connection Outpost Routing** (`cloudtak/api/stateless/routes/agency.ts`, `connection.ts`, `ldap.ts`): Allows direct Authentik API tokens for tactical agency scoping and channel management.

Previously, upstream updates required manual execution of `cloudtak/scripts/sync-upstream.sh` against an unseeded vendor branch. To make maintenance repeatable and safe, this design defines an automated lifecycle covering release discovery, AST-based diff analysis, sandboxed candidate qualification, and reviewable upgrade proposals.

## Goals / Non-Goals

### Goals
- Automate discovery of new releases from `https://github.com/dfpc-coe/CloudTAK.git`, resolving immutable commit SHAs and deduplicating prior events.
- Maintain a single, unambiguous version-pinning model distinguishing Approved, Currently Deployed, Discovered, Candidate Under Validation, and Last Known-Good states.
- Execute automated static compatibility analysis on upstream diffs, scoring risks in authentication, database migrations (flagging irreversible DDL), configuration keys, API contracts, and customization overlaps.
- Execute qualification tests inside a strictly isolated CI sandbox using unique Compose project names (`-p`), dedicated networks, disposable databases, and synthetic credentials without touching production systems.
- Classify test results explicitly into Passed, Failed, Not run, or Blocked by unavailable infrastructure, clearly separating mock/unit tests from live Authentik integration tests.
- Automatically generate reviewable, auditable upgrade pull requests when checks pass, or diagnostic triage issues when checks fail.
- Enforce strict 6-stage lifecycle governance (Stage A–F) where production deployment is strictly gated by human approval.

### Non-Goals
- Unattended or automatic deployment to production environments (Stage F remains an explicitly authorized human operation).
- Automatic removal or retirement of TISCK source patches without verified configuration equivalence.
- Modifying upstream application source code in `cloudtak/api`, `cloudtak/app`, or `cloudtak/tasks` during release discovery.
- Supporting arbitrary third-party forks other than canonical `dfpc-coe/CloudTAK`.

## Decisions

### 1. Authoritative Version Strategy & Multi-State Version Ledger
- **Decision**: `cloudtak/.upstream-version` owns the approved upstream release tag (currently `v13.102.4`). A version-controlled companion ledger at `cloudtak/config/upstream-release-state.json` maintains metadata and state tracking.
- **Ledger Schema & State Differentiation**:
  ```json
  {
    "schemaVersion": "1.0.0",
    "approvedUpstream": {
      "tag": "v13.102.4",
      "commitSha": "19ed703003436efc36cd3440e0b6a5358f8d3098",
      "approvedAt": "2026-10-21T01:00:00Z"
    },
    "currentlyDeployed": {
      "tag": "v13.102.4",
      "commitSha": "19ed703003436efc36cd3440e0b6a5358f8d3098",
      "deployedAt": "2026-10-21T01:00:00Z"
    },
    "lastKnownGood": {
      "tag": "v13.102.4",
      "commitSha": "19ed703003436efc36cd3440e0b6a5358f8d3098"
    },
    "discoveredReleases": [],
    "activeCandidate": null
  }
  ```
- **Consistency Rule**: A validation utility (`cloudtak/scripts/upstream/version-pin.ts --verify`) asserts that `approvedUpstream.tag` in the JSON ledger matches `cloudtak/.upstream-version` byte-for-byte. Moving branch names (`main`, `master`, `latest`) are strictly rejected.

### 2. Evidence-Based Customization Manifest
- **Decision**: Codify `cloudtak/config/tisck-customization-manifest.json` generated directly from the repository git diff against `dfpc-coe/CloudTAK` `v13.102.4`.
- **Manifest Catalog**:
  1. `cloudtak/api/common/config.ts` (Application Patch): 32-char secret enforcement, PostGIS local SSL bypass, `noetlevents=true` default. Required test: `tisck-signing-secret.test.ts`. Replaceable by config: No (v13.102.4 lacks native standalone flags). Removal approved: No.
  2. `cloudtak/api/common/etl-events.ts` (Application Patch): Guard `submit()` with `this.config.noetlevents`. Required test: `tisck-signing-secret.test.ts`. Replaceable: No. Removal approved: No.
  3. `cloudtak/api/stateless/lib/authentik-provider.ts` (Application Patch): Direct `AUTHENTIK_API_TOKEN` support without AWS Secrets Manager. Required test: `authentik-provider-direct-token.test.ts`. Replaceable: No. Removal approved: No.
  4. `cloudtak/api/stateless/lib/oidc.ts` (Application Patch): Dual-homed backchannel URL rewriting (`resolveInternalUrl`), RFC 7519 ID token validation (`validateIdToken`), canonical host headers. Required test: `oidc-url-validation.test.ts`. Replaceable: No (upstream requires flat DNS). Removal approved: No.
  5. `cloudtak/api/stateless/routes/login.ts` (Application Patch): Dual-homed OIDC auth flow, nonce verification, Authentik attribute sync, advisory-locked TAK cert issuance, IdP logout redirect. Required test: `oidc-url-validation.test.ts`, `e2e-browser-login.mjs`. Replaceable: No. Removal approved: No.
  6. `cloudtak/api/stateless/routes/agency.ts`, `connection.ts`, `ldap.ts` (Application Patch): Direct Authentik API token support. Required test: `authentik-live-integration.test.ts`. Replaceable: No. Removal approved: No.
  7. `cloudtak/docker-compose.yml` (Deployment Configuration): 5-tier self-hosted orchestration with PostGIS 17, Garage S3, Authentik, MediaMTX. Replaceable: No. Removal approved: No.
  8. `cloudtak/scripts/*.ps1`, `*.sh` (Integration Scripts): Authentik bootstrap, secret generation, identity backup, Garage init, upstream sync. Replaceable: No. Removal approved: No.
  9. `cloudtak/api/test/tisck-*`, `oidc-url-validation.test.ts` (Test Harness): Non-destructive validation of OIDC, signing secrets, roles, persistence. Replaceable: No. Removal approved: No.

### 3. Modular Automation Architecture (CLI Runner + CI Workflow)
- **Decision**: Core maintenance operations are implemented as self-contained Node.js/TypeScript scripts under `cloudtak/scripts/upstream/` with zero proprietary dependencies:
  - `discover-release.ts`: Queries GitHub API/git tags for `dfpc-coe/CloudTAK`, resolves commit SHAs, updates discovery ledger, filters duplicates.
  - `assess-compatibility.ts`: Compares candidate commit tree against approved vendor base, scans AST/regex patterns, calculates risk scores.
  - `prepare-candidate.ts`: Seeds/updates `vendor/upstream` git branch and creates `candidate/upstream-<tag>` branch.
  - `run-candidate-tests.ts`: Orchestrates isolated candidate Compose stack, executes tests, and categorizes results.
  - `publish-proposal.ts`: Formats markdown PR descriptions or failure triage issues, sanitizing all secrets.
- **CI Binding**: `.github/workflows/upstream-maintenance.yml` runs on `schedule` (cron) and `workflow_dispatch` (manual tag or commit parameter). The CLI tools can also run standalone locally on Windows or Linux.

### 4. Static Compatibility Scanner as Risk Indicator
- **Decision**: `assess-compatibility.ts` operates as an early warning risk indicator, not as proof of compatibility or incompatibility. It evaluates the git diff across five domains:
  1. **Authentication & OIDC**: Detects modifications to token endpoints, session formats, cookie flags, or OIDC helper functions.
  2. **Database Migrations**: Scans `cloudtak/api/migrations/` for DDL statements. Flags irreversible operations (`DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN ... TYPE`, `RENAME TO`) as **HIGH RISK**.
  3. **Configuration & Environment**: Detects modified, added, or removed `CLOUDTAK_*` keys, `Config.ts` properties, or AWS SDK client instantiations.
  4. **Customization Collision**: Matches diff hunks against `tisck-customization-manifest.json`. Overlapping hunks trigger a **HIGH SEVERITY** collision alert requiring manual merge review.
  5. **API & Interface Breaking Changes**: Scans route handlers, OpenAPI schemas, and WebSocket event payloads for removed or renamed parameters.
- **Output**: Generates `COMPATIBILITY-REPORT.md` and `compatibility-report.json`.

### 5. Sandboxed CI Isolation Architecture
- **Decision**: To prevent any accidental interference with production environments, candidate validation runs in a strictly partitioned Compose sandbox:
  - **Compose Project Flag**: Runs under `docker compose -p tisck-ci-<run_id> -f cloudtak/docker-compose.test-candidate.yml`.
  - **Network Sandboxing**: Dedicated bridge network `tisck-ci-net` with no connections to production `cloudtak-net`.
  - **Port Isolation**: Maps container ports to dynamic host ports or loopback test ranges (e.g. `127.0.0.1:15000:5000`, `127.0.0.1:19000:9000`, `127.0.0.1:15432:5432`) to prevent collisions with running production instances.
  - **Disposable Storage**: Uses ephemeral volume names (`ci-postgis-<run_id>`, `ci-authentik-<run_id>`) that are purged on teardown. Production volumes (`postgis-data`, `authentik-media`, `garage-data`) are never referenced.
  - **Synthetic Credentials**: Uses generated test secrets (`CLOUDTAK_SIGNING_SECRET=synthetic-ci-secret-32-chars-long-minimum`, `AUTHENTIK_SECRET_KEY=synthetic-ci-authentik-secret-key-32chars`).
- **Test Reporting Taxonomy**:
  Every test executed by `run-candidate-tests.ts` is explicitly reported in one of four states:
  - `PASSED`: Assertions satisfied.
  - `FAILED`: Execution failed or assertion error encountered.
  - `NOT_RUN`: Test omitted due to earlier pipeline stage failure.
  - `BLOCKED`: Required test infrastructure unavailable (e.g. live Authentik container unavailable, GPU/video hardware absent).
- **Test Matrix Tiers**:
  - *Tier 1: Unit & Mock Tests* (Fast, zero live services needed): `oidc-url-validation.test.ts`, `tisck-signing-secret.test.ts`, `tisck-tactical-groups.test.ts`.
  - *Tier 2: API Smoke Tests* (Ephemeral API + PostGIS container): Container health checks, schema migrations, `/api/health`, `/api/swagger`.
  - *Tier 3: Live Integration & Browser Authentication* (Ephemeral full stack): `authentik-provider-direct-token.test.ts`, `authentik-live-integration.test.ts`, and headless browser authentication (`e2e-browser-login.mjs` using dynamic Chromium resolution via `process.env.CHROME_BIN || process.env.EDGE_PATH`).
  - *Tier 4: Persistence Checks*: Container restart recovery (`verify-persistence.mjs` executed with `-p tisck-ci-<run_id>`).

### 6. Upgrade Proposal PR & Diagnostic Issue Reporting
- **Decision**:
  - **On Qualification Success**: Opens an audit-ready pull request titled `chore(upstream): upgrade CloudTAK to <tag>` from branch `candidate/upstream-<tag>`. Includes:
    - Version delta (`v13.102.4` → `<new-tag>`), upstream commit SHA, release notes link.
    - Full static compatibility score and collision assessment.
    - Categorized test matrix execution summary (`PASSED`, `BLOCKED`, etc.).
    - Database migration risk evaluation and pre-deployment backup runbook.
    - Verifiable rollback instructions with immutable image/commit references.
    - Confirmation that no unauthorized source modifications were introduced.
  - **On Qualification Failure**: Opens or updates a GitHub triage issue titled `[Upstream Candidate Blocked] CloudTAK <tag> failed validation`. Includes step failure logs, diff snippets, and reproduction instructions. No unverified PR is created.
  - **Secret Redaction**: `publish-proposal.ts` sanitizes all outputs, masking tokens, passwords, and private keys.

### 7. Staged Release Policy (Stages A–F)
- **Stage A (Detect)**: Scheduled cron or manual dispatch identifies new release tag and commit SHA, records event in `upstream-release-state.json`.
- **Stage B (Analyze)**: Static compatibility engine scans diffs and generates `COMPATIBILITY-REPORT.md`.
- **Stage C (Test)**: Ephemeral CI sandbox builds images, runs Compose stack, and executes qualification test tiers.
- **Stage D (Prepare)**: Upgrade PR (on success) or diagnostic issue (on failure) is opened.
- **Stage E (Approve)**: Maintainer inspects PR and merges candidate branch into `main` using a **3-way merge commit** (never squash or rebase, to preserve `vendor/upstream` ancestry).
- **Stage F (Deploy)**: Operator performs production deployment via verified runbook. Production deployment is never unattended.

## Risks / Trade-offs

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| Upstream introduces irreversible DB migration | Data loss upon upgrade failure | Compatibility scanner flags irreversible DDL (DROP TABLE, DROP COLUMN) as HIGH risk; PR requires verified `pg_dump` backup before Stage F deploy. |
| Test runner accidentally targets production containers | Overwriting production database or stopping services | Sandbox forces unique Compose project name (`-p tisck-ci-<run_id>`), dedicated bridge network, and ephemeral volumes; tests check project prefix before executing. |
| Browser E2E test fails in Linux CI due to hardcoded Edge path | Pipeline blockage in CI environment | Parameterize `e2e-browser-login.mjs` to resolve Chromium executable dynamically from `CHROME_BIN`, `EDGE_PATH`, or standard system paths. |
| Upstream changes break dual-homed OIDC backchannel resolution | Complete authentication failure | Tier 3 live integration and browser E2E tests validate token exchange and callback in CI; candidate PR is blocked on failure. |
| Duplicate PRs generated on recurring cron runs | Cluttered repository and wasted CI minutes | Ledger tracks discovered tags and commit SHAs; discovery skips existing candidates and checks for existing PRs via GitHub API. |

## Migration & Rollback Runbook

### Production Upgrade Protocol (Stage F - Manual/Authorized):
1. Maintainer merges approved candidate PR into `main` via 3-way merge commit.
2. Verify production status and execute pre-deployment database snapshots:
   ```bash
   docker exec cloudtak-postgis-1 pg_dump -U docker gis > /backups/pre-upgrade-gis.sql
   docker exec cloudtak-postgis-1 pg_dump -U authentik authentik > /backups/pre-upgrade-authentik.sql
   pwsh cloudtak/scripts/backup-identity.ps1
   ```
3. Deploy updated containers using TISCK Compose definition:
   ```bash
   docker compose -f cloudtak/docker-compose.yml up -d --build
   ```
4. Verify deployment health:
   ```bash
   docker compose -f cloudtak/docker-compose.yml ps
   node cloudtak/scripts/e2e-browser-login.mjs
   ```

### Production Rollback Protocol:
1. Revert `cloudtak/.upstream-version` and Compose configuration to the `lastKnownGood` commit SHA recorded in `cloudtak/config/upstream-release-state.json`.
2. Stop candidate containers:
   ```bash
   docker compose -f cloudtak/docker-compose.yml down
   ```
3. If database migrations were executed during upgrade:
   ```bash
   docker compose -f cloudtak/docker-compose.yml up -d postgis
   docker exec -i cloudtak-postgis-1 psql -U docker -d gis < /backups/pre-upgrade-gis.sql
   docker exec -i cloudtak-postgis-1 psql -U authentik -d authentik < /backups/pre-upgrade-authentik.sql
   ```
4. Re-launch verified baseline containers:
   ```bash
   docker compose -f cloudtak/docker-compose.yml up -d --build
   ```
5. Execute persistence and login verification:
   ```bash
   node cloudtak/scripts/verify-persistence.mjs
   ```
