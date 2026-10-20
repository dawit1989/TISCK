# TISCK Architectural Boundary & Upstream Preservation Guide

## 1. Overview and Core Architectural Baseline

TISCK operates as a self-hosted, offline-capable situational awareness appliance leveraging CloudTAK (pinned to `v13.102.4`), Authentik OIDC identity services, Garage S3 object storage, PostGIS spatial databases, and MediaMTX tactical video streaming.

A foundational architectural reality governs this integration:
> **Upstream CloudTAK DOES have built-in OIDC SSO concepts, but its configuration model is database/UI-driven (`oidc::*` settings), and its backchannel network assumptions assume a flat DNS space rather than dual-homed Docker service names.**

To guarantee maintainability without risking destabilization of running deployments, TISCK partitions all components into five strict architectural tiers.

---

## 2. The 5-Tier Architecture

```
+-----------------------------------------------------------------------------------+
| Layer 1: Upstream CloudTAK Application Code                                       |
| (cloudtak/api/stateless, cloudtak/api/stateful, cloudtak/app, cloudtak/tasks)     |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| Layer 2: TISCK Deployment Layer                                                   |
| (cloudtak/docker-compose.yml, cloudtak/.env*, cloudtak/Dockerfile, networks)      |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| Layer 3: TISCK Integration & Operations Layer                                     |
| (cloudtak/scripts/*, init-garage, bootstrap-authentik, backup-identity)           |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| Layer 4: TISCK Test & Verification Layer                                          |
| (cloudtak/api/test/tisck-*, e2e-browser-login.mjs, verify-persistence.mjs)        |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| Layer 5: External & Supporting Services                                           |
| (Authentik, PostGIS, Garage S3, MediaMTX, TAK Server)                             |
+-----------------------------------------------------------------------------------+
```

### Layer Rules and Responsibilities

1. **Layer 1: Upstream CloudTAK Application Code**
   - Source: Pinned upstream release v13.102.4 (`dfpc-coe/CloudTAK`).
   - Responsibility: Core web map interface, CoT ingestion endpoints, WebSocket broadcasts.
   - **Preservation Policy**: Zero direct application edits unless resolving an unbypassable upstream architectural defect lacking configuration hooks.

2. **Layer 2: TISCK Deployment Layer**
   - Assets: `cloudtak/docker-compose.yml`, `cloudtak/.env.example`, `cloudtak/.env.identity.example`, `cloudtak/garage.toml`.
   - Responsibility: Container lifecycle, tactical LAN ingress (`0.0.0.0` for ports 5000, 5002, 8554, 8889), administrative loopback isolation (`127.0.0.1` for ports 5432, 9000, 3900, 3903), and named volume attachments.

3. **Layer 3: TISCK Integration & Operations Layer**
   - Assets: `cloudtak/scripts/*.ps1`, `cloudtak/scripts/*.sh`, `cloudtak/scripts/init-authentik-db.sql`.
   - Responsibility: Secret generation, database bootstrapping, Authentik tactical group provisioning, Garage S3 bucket initialization, offline container image caching, and backup/restore automation.

4. **Layer 4: TISCK Test & Verification Layer**
   - Assets: `cloudtak/api/test/tisck-*`, `cloudtak/api/test/oidc-url-validation.test.ts`, `cloudtak/scripts/e2e-browser-login.mjs`, `cloudtak/scripts/verify-persistence.mjs`.
   - Responsibility: Non-destructive verification of OIDC token validation, signing secrets, role mappings, and volume restart survival.

5. **Layer 5: External & Supporting Services**
   - Services: Authentik (Identity Provider), PostGIS 17, Garage S3, MediaMTX, TAK Server CA.
   - Responsibility: Identity, spatial persistence, distributed object storage, tactical video, and TAK client certificates.
   - **Isolation Constraint**: Strictly zero runtime dependencies on `dfpc-coe/auth-infra`, `dfpc-coe/tak-infra`, or `dfpc-coe/media-infra`.

---

## 3. Developer Guidelines: Upstream Source Preservation Policy

1. **Configuration First**: When adding or altering behavior, exhaust environment variables, Compose flags, and dynamic settings (`CLOUDTAK_Config_*`) before considering code modifications.
2. **Never Edit Without Evidence**: Existing working patches in `cloudtak/api/stateless/lib/oidc.ts` (dual-homed URL resolution, RFC 7519 ID token validation) and `routes/login.ts` (Authentik attribute sync and TAK certificate advisory locks) MUST remain intact.
3. **Non-Destructive Testing**: Test suites must execute against live containers without dropping database tables, deleting secrets, or recreating volumes.
4. **Isolated Prototyping**: Any future proposal to replace an existing patch with native configuration must be conducted in an isolated git branch or worktree with reproducible pass/fail test evidence.
