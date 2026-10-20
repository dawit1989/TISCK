# Design: Upstream Boundary Definition & Customization Preservation

## Context

See `proposal.md` for overall motivation.
TISCK is deployed on CloudTAK v13.102.4 (`cloudtak/.upstream-version`). The system is fully operational in `docker-compose` mode using Garage S3 for object storage, PostGIS for geospatial data, MediaMTX for video streaming, and Authentik for OIDC authentication. OIDC authentication, token validation, session refresh, tactical group mapping, and certificate enrollment hooks have been validated via automated tests (`cloudtak/api/test/oidc-url-validation.test.ts`, `cloudtak/api/test/tisck-signing-secret.test.ts`, `cloudtak/api/test/tisck-tactical-groups.test.ts`, and `cloudtak/scripts/e2e-browser-login.mjs`).

The codebase currently contains a mix of upstream CloudTAK code, customized application logic, Docker Compose deployment configurations, and operational scripts. An essential architectural condition shapes this integration: **upstream CloudTAK DOES have built-in OIDC SSO concepts, but its configuration model is database/UI-driven (`oidc::*` settings), and its backchannel network assumptions assume a flat DNS space rather than dual-homed Docker service names.** To prevent future regressions and simplify upstream updates, an explicit boundary must be established without altering working code or destabilizing live deployments.

## Goals / Non-Goals

**Goals:**
- Delineate the 5-tier architecture: Upstream CloudTAK, TISCK Deployment Layer, TISCK Integration Layer, TISCK Tests, and External Support Services.
- Classify all customizations across the repository into a structured 6-category taxonomy.
- Document every existing source patch with justification, capability mapping, regression risk, required verification, and retirement viability.
- Define a 5-stage migration plan (Stages A through E) that provides an evidence-based pathway for long-term maintenance.
- Enforce strict regression protections for OIDC flows, database contents, persistent volumes, and secrets.

**Non-Goals:**
- Modifying CloudTAK application source code in this planning change.
- Reverting, removing, or refactoring existing working patches.
- Changing identity provider credentials, endpoints, or issuer configurations.
- Re-running destructive database initialization or reset scripts.
- Re-implementing OIDC authentication or TAK certificate enrollment.

## Architectural Boundary Definition

The repository architecture is partitioned into five distinct layers:

```
+-------------------------------------------------------------------------------+
| Layer 1: Upstream CloudTAK Application Code                                   |
| (cloudtak/api/stateless, cloudtak/api/stateful, cloudtak/app, cloudtak/tasks) |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| Layer 2: TISCK Deployment Layer                                               |
| (cloudtak/docker-compose.yml, cloudtak/.env*, cloudtak/Dockerfile, networks)  |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| Layer 3: TISCK Integration & Operations Layer                                 |
| (cloudtak/scripts/*, init-garage, bootstrap-authentik, backup-identity)       |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| Layer 4: TISCK Test & Verification Layer                                      |
| (cloudtak/api/test/tisck-*, e2e-browser-login.mjs, verify-persistence.mjs)    |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| Layer 5: External & Supporting Services                                       |
| (Authentik, PostGIS, Garage S3, MediaMTX, TAK Server)                         |
+-------------------------------------------------------------------------------+
```

### Layer Responsibilities
1. **Upstream CloudTAK**: Core application logic maintained by upstream. Pinned to v13.102.4. Target state is zero downstream source edits.
2. **TISCK Deployment Layer**: Docker Compose orchestration, container port isolation (LAN `0.0.0.0` for tactical ingress, loopback `127.0.0.1` for administration), volume bindings, and environment variables.
3. **TISCK Integration Layer**: Standalone helper scripts, bootstrap automation, credential generation, and backup/restore tooling.
4. **TISCK Test Harness**: Non-destructive unit, integration, and E2E browser tests verifying OIDC, token validation, tactical groups, and volume persistence.
5. **External Services**: Standalone containerized dependencies running pinned public container images.

---

## Customization Classification Taxonomy

Existing customizations are categorized into six standard types:

| Category | Description | Examples |
| :--- | :--- | :--- |
| **Type 1: External Deployment Config** | Compose definitions, volume mounts, port bindings, and env templates. | `docker-compose.yml`, `.env.example`, `.env.identity.example`, `garage.toml` |
| **Type 2: Documented Upstream Config** | Upstream-native environment variables supported without source patching. | `API_URL`, `PMTILES_URL`, `POSTGRES`, `ASSET_BUCKET`, `AWS_S3_Endpoint`, `SigningSecret` |
| **Type 3: TISCK Integration Scripts & Tests**| Independent operational automation, test harnesses, and documentation. | `cloudtak/scripts/*`, `cloudtak/api/test/tisck-*`, `docs/adr/*`, `docs/identity/*` |
| **Type 4: Source Patches Replaceable with Config**| Code patches that may be superseded by upstream env vars or configuration flags. | `cloudtak/api/common/config.ts` (StackName / default secret logic) |
| **Type 5: Essential Retained Source Patches** | Code patches providing necessary functionality lacking upstream equivalents. | `cloudtak/api/stateless/lib/oidc.ts`, `cloudtak/api/stateless/routes/login.ts` (dual-homed URL resolution, HS256 validation, attribute sync) |
| **Type 6: Unnecessary / Redundant Patches** | Unused or dead modifications (none identified in current working build). | None currently identified; any candidate requires empirical proof before removal. |

---

## Detailed Source Patch Inventory & Analysis

### 1. `cloudtak/api/stateless/lib/oidc.ts`
- **Original Purpose**: CloudTAK upstream assumed an AWS Application Load Balancer (ALB) performing OIDC authentication and forwarding claims via HTTP headers. In self-hosted TISCK, CloudTAK directly performs the OIDC authorization code flow against Authentik.
- **Enabled Capability**: Direct in-app OIDC Authorization Code grant, dual-homed container backchannel communication (`resolveInternalUrl`), X-Forwarded headers injection, and RFC 7519 / OIDC Core 3.1.3.7 ID token validation (HS256 signature, canonical issuer matching, audience check, 16-byte cryptographic nonce verification).
- **Required Currently?**: **YES (CRITICAL)**. Core to the working offline OIDC foundation.
- **Configuration-Only Replacement?**: **NO**. Upstream CloudTAK v13.102.4 has no native support for direct OAuth2 code exchange or dual-homed Docker URL rewriting without an ALB.
- **Regression Risks**: Complete failure of browser SSO login, token exchange failure, or inability to route between external browser URLs and internal Docker service names (`identity-server:9000`).
- **Required Test Before Removal**: Full RFC 7519 validation suite and CDP browser E2E test (`e2e-browser-login.mjs`).
- **Status**: **Retain untouched (Type 5)**.

### 2. `cloudtak/api/stateless/routes/login.ts`
- **Original Purpose**: Route incoming OIDC callbacks, issue CloudTAK JWT sessions, synchronize Authentik tactical groups, enforce local-only admin accounts, and initiate TAK CA certificate enrollment.
- **Enabled Capability**: Endpoints `/login/oidc`, `/login/oidc/callback`, `/login/refresh`, `/logout`, and synchronization of callsign, tactical group, and role into `ProfileConfig`.
- **Required Currently?**: **YES (CRITICAL)**. Governs all user authentication and tactical group claims.
- **Configuration-Only Replacement?**: **NO**. Upstream relies on ALB header parsing (`AuthUserAccess`) and lacks direct Authentik attribute synchronization.
- **Regression Risks**: Users cannot obtain sessions; operator callsigns and tactical roles fail to populate; break-glass local accounts fail.
- **Required Test Before Removal**: `login.srv.test.ts`, `login-oidc.srv.test.ts`, `tisck-tactical-groups.test.ts`, and browser E2E tests.
- **Status**: **Retain untouched (Type 5)**.

### 3. `cloudtak/api/stateless/lib/authentik-provider.ts`
- **Original Purpose**: Provide programmatic integration with Authentik core API for group management, machine user provisioning, and TAK client certificate enrollment.
- **Enabled Capability**: Direct API token authentication via `AUTHENTIK_API_TOKEN` (bypassing AWS Secrets Manager), group synchronization, and M2M/temporary-password certificate enrollment protocols.
- **Required Currently?**: **YES**. Decouples identity administration from AWS Secrets Manager.
- **Configuration-Only Replacement?**: **PARTIAL**. Direct token resolution is supported via env vars, but the Authentik-specific client calls are custom integration logic.
- **Regression Risks**: Failure to manage tactical agencies, channels, or issue automated TAK client certificates.
- **Required Test Before Removal**: `authentik-provider-direct-token.test.ts` and `authentik-live-integration.test.ts`.
- **Status**: **Retain untouched (Type 5)**.

### 4. `cloudtak/api/common/config.ts`
- **Original Purpose**: Decouple runtime from AWS services when `CLOUDTAK_Mode=docker-compose`, disable AWS IMDS (`AWS_EC2_METADATA_DISABLED=true`), enforce secure 32-character signing secret validation, and bypass PostGIS SSL certificate verification.
- **Enabled Capability**: Self-hosted bootstrap without AWS credentials; secure signing secret enforcement; local database connection over Unix/TCP sockets.
- **Required Currently?**: **YES**. Prevents AWS SDK timeout crashes on boot.
- **Configuration-Only Replacement?**: **POTENTIALLY LATER (Type 4)**. Future CloudTAK upstream releases might support complete non-AWS flags natively, but v13.102.4 still defaults to AWS STS/SecretsManager unless intercepted.
- **Regression Risks**: Application boot crashes with AWS connection timeouts; database fails to connect due to SSL certificate verification mismatch.
- **Required Test Before Removal**: `tisck-signing-secret.test.ts`, startup smoke tests without AWS credentials.
- **Status**: **Retain for now; evaluate in Stage D (Type 4/5)**.

### 5. `cloudtak/api/common/etl-events.ts`
- **Original Purpose**: Prevent API crashes when attempting to post event notifications to non-existent AWS SQS queues.
- **Enabled Capability**: Event processing without AWS SQS queues in docker-compose mode (`noetlevents=true`).
- **Required Currently?**: **YES**.
- **Configuration-Only Replacement?**: **PARTIAL**. Driven by `noetlevents` flag, but guard in `submit()` prevents unhandled rejection.
- **Regression Risks**: CoT ingestion endpoints throw unhandled exceptions when processing incoming telemetry.
- **Required Test Before Removal**: CoT event submission integration tests.
- **Status**: **Retain untouched (Type 5)**.

---

## Staged Migration Plan

```
+-----------------------------------------------------------------------------------+
| Stage A: Inventory & Protection Baseline                                          |
| (Audit working baseline, verify test suite passes, lock volume configs)           |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| Stage B: Boundary Definition & Documentation                                      |
| (Document 5 tiers, codify upstream preservation policy in repo guidelines)         |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| Stage C: Safe Opportunities (Zero-Source Modifications)                           |
| (Harden Compose env files, externalize configs, ensure no new source patches)    |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| Stage D: Optional Migration of Replaceable Patches (Future, Separately Approved)   |
| (Prototype config-only bypasses for Type 4 patches in isolated worktrees)         |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| Stage E: Long-Term Upstream Upgrade Protocol                                      |
| (Structured upstream sync process using .upstream-version and 3-way git merges)   |
+-----------------------------------------------------------------------------------+
```

- **Stage A — Inventory and Protection Baseline**: Confirm all existing tests pass; document persistent volumes, secrets, and database connections.
- **Stage B — Boundary Definition**: Establish documentation and structural boundaries separating TISCK deployment scripts from CloudTAK source code.
- **Stage C — Safe Opportunities**: Identify configuration improvements in `docker-compose.yml` and `.env.identity.example` that do not alter application source code.
- **Stage D — Optional Migration**: For each Type 4 patch, specify rigorous isolated test harnesses before any source line is refactored into pure configuration.
- **Stage E — Long-Term Maintenance**: Document exact procedures for upgrading CloudTAK beyond v13.102.4 using upstream git remotes and automated regression tests.

---

## Risks / Trade-offs

- **[Risk] Upstream Drift During Future Upgrades**
  *Mitigation*: Track pinned upstream version in `cloudtak/.upstream-version` (v13.102.4). All custom patches are documented with their specific target files and rationale. Upgrades must follow the Stage E protocol.
- **[Risk] Accidental Destruction of Persistent Volumes**
  *Mitigation*: Pre-flight checks in deployment scripts verify volume existence before initialization. Scripts never execute `docker volume rm` or `docker compose down -v`.
- **[Risk] OIDC Authentication Loop or Session Failure**
  *Mitigation*: Maintain dual-homed URL resolution in `oidc.ts`, preserve `local=true` escape query parameter for emergency administrative login, and enforce automated testing with `e2e-browser-login.mjs`.
- **[Risk] Incomplete TAK Certificate Enrollment**
  *Mitigation*: Explicitly treat TAK certificate enrollment as a distinct capability separate from OIDC login, with independent health probes and failure-tolerant non-blocking fallbacks.
