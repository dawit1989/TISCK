# Design

## Context

TISCK is deployed in disconnected, austere tactical environments (specifically focused on Ethiopia and the Horn of Africa). Following the baseline established in `adapt-cloudtak-for-tisck-selfhosted-garage`, the core application tier operates in Docker Compose with local PostGIS and Garage S3 storage. However, authentication currently either relies on local development credentials or AWS Cognito via cloud-managed OIDC and AWS Secrets Manager. 

To achieve true operational sovereignty (Pillar A — Identity and Zero-Touch Enrollment), TISCK requires an on-premise, offline-first identity provider. Authentik has been selected as the identity platform. CloudTAK's codebase already contains an in-app OIDC Authorization Code client (`api/stateless/routes/login.ts` and `api/stateless/lib/oidc.ts`) and an `AuthentikProvider` abstraction (`api/stateless/lib/authentik-provider.ts`), but `AuthentikProvider.auth()` still hardcodes calls to `@aws-sdk/client-secrets-manager`. Furthermore, TAK clients require X.509 certificates whose enrollment protocol and authority boundaries must be decoupled from the web UI.

See `proposal.md` for the motivation and high-level scope.

## Goals / Non-Goals

**Goals:**
- Provide a self-contained Authentik deployment (server, worker, Redis, PostgreSQL storage) orchestrated via Docker Compose without public internet or cloud IAM dependencies.
- Map TISCK tactical groups (`TISCK_INTEL`, `TISCK_RECON`, `TISCK_COMMAND`, `TISCK_ISR`) to OIDC claims and downstream CloudTAK permissions.
- Provide a non-AWS secrets provisioning mechanism for Authentik (`AUTHENTIK_SECRET_KEY`, bootstrap tokens) and CloudTAK (`AUTHENTIK_API_TOKEN`).
- Establish an optional, loopback-isolated LDAP Outpost interface for legacy tactical systems.
- Define a formal interface boundary for TAK client certificate enrollment, verifying candidate endpoints and ports (such as port 8446) against actual TAK Server requirements.
- Define reproducible offline image loading, backup/restore, and emergency administrative recovery procedures.

**Non-Goals:**
- Implementing the Bun ETL runtime (`@tisck/etl-runtime`) or feed adapters (Pillar E).
- Deploying a full TAK Server instance or replacing the Marti CA engine in this change.
- Ingesting or managing video streams in MediaMTX (Pillar F).
- Re-architecting CloudTAK's internal PostGIS schema or session storage table (`ProfileSession`).

## Decisions

### Decision 1: Authentik Deployment Model and Component Topology
We deploy Authentik using its standard container architecture pinned to version `2024.12.3`:
1. `identity-server` (`ghcr.io/goauthentik/server:2024.12.3`): Handles HTTP/HTTPS web endpoints, OIDC provider endpoints (`/.well-known/openid-configuration`, `/application/o/authorize/`, `/application/o/token/`, `/application/o/userinfo/`), and the administration UI on port `9000`.
2. `identity-worker` (`ghcr.io/goauthentik/server:2024.12.3` command `worker`): Executes Celery background tasks, scheduled maintenance, and event processing.
3. `identity-cache` (`redis:7.4-alpine`): Dedicated Redis instance for Celery task queuing, session state caching, and internal event pub/sub.
4. Database Storage: Authentik requires PostgreSQL 13+. In TISCK, we allocate a dedicated logical database `authentik` within the existing `postgis` container (or an isolated `identity-db` container if strict operational separation is required). For the unified compose deployment, sharing the running PostGIS 17 instance with a dedicated `authentik` database user and schema reduces memory footprint on tactical edge hardware while preserving data isolation.
5. Storage Volumes: `authentik-media` (custom branding, icons) and `authentik-templates` (custom email/login templates).

*Alternatives Considered:*
- *Single-container embedded identity solutions (e.g., Dex or Authelia)*: Rejected because Dex lacks administrative UIs, user self-service, built-in MFA lifecycle management, and LDAP outpost capabilities; Authelia lacks a robust dynamic REST API for automated service-account creation.
- *Keycloak*: Rejected due to significantly higher JVM memory footprint (1.5GB+ baseline vs Authentik's ~400MB) which strains edge tactical hardware.

### Decision 2: Offline Image Bundling and Pinned Versioning
All identity containers must be resolvable without outbound registry access.
- Image tags are strictly pinned by exact semver (e.g. `ghcr.io/goauthentik/server:2024.12.3`, `docker.io/library/redis:7.4.2-alpine`, `ghcr.io/goauthentik/ldap:2024.12.3`).
- An offline deployment archive (`tisck-identity-images-2024.12.3.tar.gz`) is generated using `docker save` during release staging and loaded via `docker load` during air-gapped host preparation.

*Alternatives Considered:*
- *Local Docker registry container*: Adds operational complexity for single-node deployments; direct `docker load` of tarballs is preferred for field kit provisioning.

### Decision 3: Network Topology, DNS, and TLS Isolation
In compliance with ADR 0006 (Dual Network Interface and Port Binding Isolation Matrix):
- `identity-server` binds its HTTP port `9000` to `127.0.0.1` by default. Field operators access Authentik through CloudTAK's ingress reverse-proxy or designated edge proxy.
- Inter-service communication takes place over the internal Docker bridge network (`cloudtak-net`). CloudTAK connects to Authentik via internal DNS `http://identity-server:9000`.
- In production tactical deployments with TLS enabled, Authentik terminates TLS or receives forwarded headers (`X-Forwarded-Proto: https`, `X-Forwarded-Host`) from the host reverse-proxy.

*Alternatives Considered:*
- *Exposing port 9000 on `0.0.0.0`*: Rejected because it exposes administrative login endpoints to the entire tactical Wi-Fi/mesh LAN without filtering.

### Decision 4: Non-Cloud Secret Provisioning and Administrative Recovery
All secrets are injected via local environment variables or Docker secrets files (e.g. `cloudtak/.env.identity`), eliminating AWS Secrets Manager and STS.
- `AUTHENTIK_SECRET_KEY`: A 50+ character cryptographic random string.
- `AUTHENTIK_BOOTSTRAP_PASSWORD`: Administrative password for initial setup.
- `AUTHENTIK_BOOTSTRAP_TOKEN`: Pre-shared administrative API token allowing automated bootstrapping of OIDC clients and service accounts without interactive UI steps.
- Administrative Recovery: If the identity service becomes unreachable or admin credentials are lost:
  1. Authentik provides local CLI recovery via `docker compose exec identity-server ./manage.py recovery_key 1` (generates an emergency single-use admin login link bypassing passwords and MFA).
  2. CloudTAK preserves break-glass recovery via `LOCAL_ONLY_ACCOUNTS=admin` and `/login?local=true`, allowing local administrative login with PostgreSQL-stored credentials even if Authentik is completely offline.

### Decision 5: Tactical Groups, Claims, and Authorization Model
We establish four core TISCK operational groups in Authentik:
1. `TISCK_INTEL`: Geospatial intelligence analysts, imagery exploitation, basemap/layer administrators.
2. `TISCK_RECON`: Forward reconnaissance scouts, ground tracking, sensor deployers.
3. `TISCK_COMMAND`: Tactical Operations Center commanders, mission planning, approval authorities.
4. `TISCK_ISR`: Unmanned aerial systems (UAS) operators, tactical payload managers, sensor telemetry ingest.

Authorization Contract:
- Group names are identity attributes, not direct application permissions.
- Authentik provides an OIDC scope `groups` and an OAuth2 Property Mapping that includes `claims["groups"] = [group.name for group in request.user.ak_groups.all()]`.
- Downstream applications (CloudTAK, TAK Server, MediaMTX) implement deny-by-default access control and map incoming groups to internal capabilities:
  - In CloudTAK: `CloudTAKSystemAdmin` maps to `system_admin: true`; `TISCK_COMMAND` maps to executive agency admin; other groups map to tactical team channels (`tak::group`).

### Decision 6: CloudTAK In-App OIDC Integration and Adapter Decoupling
CloudTAK's existing OIDC architecture (`cloudtak/api/stateless/routes/login.ts` and `cloudtak/api/stateless/lib/oidc.ts`) already implements the RFC 6749 Authorization Code grant:
- Flow: `GET /api/login/oidc` -> Authentik `/application/o/authorize/` -> Authentik callback to `/api/login/oidc/callback` -> Code exchange via TLS against `/application/o/token/` -> Claims retrieval via `/application/o/userinfo/`.
- Session handoff: Delivery via base64url payload in the URL fragment (`/login#sso=...`), preventing tokens from leaking into webserver logs.

Required Code Adapter:
- `cloudtak/api/stateless/lib/authentik-provider.ts` currently requires `AUTHENTIK_API_TOKEN_SECRET_ARN` and invokes `@aws-sdk/client-secrets-manager`.
- Adapter Requirement: Modify `AuthentikProvider.auth()` to check `process.env.AUTHENTIK_API_TOKEN` first. If present, it returns the token directly, bypassing AWS Secrets Manager entirely.

### Decision 7: Optional LDAP Outpost Compatibility
- CloudTAK does NOT require LDAP; it uses OIDC natively.
- An LDAP Outpost service (`identity-ldap` running `ghcr.io/goauthentik/ldap:2024.12.3`) is defined as an optional profile (`--profile ldap`).
- When activated, it connects to `identity-server` via internal API token and exposes LDAP (port 389) and LDAPS (port 636) bound strictly to `127.0.0.1`.
- Service accounts authenticating via LDAP use dedicated bind credentials with read-only group query permissions.

### Decision 8: TAK Certificate Enrollment Boundary
TAK clients (ATAK, WinTAK) authenticate to TAK Server via mutual TLS (mTLS) using client X.509 certificates.
Interface Contract:
- TAK Server exposes `/Marti/api/tls/config` (retrieves CA details) and `/Marti/api/tls/signClient/v2` (signs client CSR).
- Candidate Port Verification: Port `8446` is documented in some deployments as an alternate enrollment or mutual-TLS port. In this design, port `8446` is treated as a candidate parameter to be verified against the specific TAK Server runtime configuration, not an immutable standard. Standard TAK Server ports are `8089` (mTLS CoT) and `8443` (Marti API).
- Enrollment Mediation: CloudTAK's `AuthentikProvider.enrollUserCertificate()` supports:
  1. RFC 7523 JWT-bearer client assertion exchange: Exchanging the user's OIDC access token for a TAK Server enrollment token.
  2. Temporary password fallback: Setting a temporary random password on the Authentik user via REST API, authenticating against TAK Server's Basic Auth enrollment endpoint, and immediately revoking the password.
- Identity and TAK CA boundary: Authentik manages user identity and authentication; the TAK Server (or dedicated step-ca / internal CA) maintains the private CA key and issues X.509 certificates.

## Risks / Trade-offs

- **[Risk] Authentik container startup latency on edge hardware** → *Mitigation*: Configure explicit Docker Compose `healthcheck` intervals (15s), `start_period` (45s), and dependencies (`depends_on: { condition: service_healthy }`) to prevent dependent services from timing out during cold boot.
- **[Risk] Secret leakage in environment files or git history** → *Mitigation*: Ensure `cloudtak/.env.identity` and related secret files are added to `.gitignore`. Provide a script (`cloudtak/scripts/generate-identity-secrets.sh`) that generates random secrets locally without committing them.
- **[Risk] Identity service unavailability during tactical missions** → *Mitigation*: CloudTAK issues internal JWT tokens and refresh tokens with configurable validity (`login::token::expiry`, default 192 hours; `login::refresh::expiry`, default 720 hours). Valid sessions continue operating offline even if Authentik is temporarily offline. Break-glass admin access is preserved via `LOCAL_ONLY_ACCOUNTS`.
- **[Risk] Certificate enrollment race condition for concurrent logins** → *Mitigation*: Preserve CloudTAK's PostgreSQL advisory transaction lock (`pg_advisory_xact_lock(918273645, hashtext(username))`) during certificate generation to prevent concurrent enrollment requests from invalidating credentials.

## Migration Plan

1. **Phase 1: Environment and Secret Scaffolding**: Create `.env.identity.example` and secret generation script; ensure all secret targets are ignored in git.
2. **Phase 2: Compose Integration**: Define `identity-server`, `identity-worker`, `identity-cache`, and optional `identity-ldap` in `docker-compose.yml` (or `docker-compose.identity.yml`).
3. **Phase 3: Database Preparation**: Initialize the `authentik` logical database and database role in the PostGIS instance.
4. **Phase 4: CloudTAK Adapter Update**: Update `AuthentikProvider.ts` to support `AUTHENTIK_API_TOKEN` environment variable.
5. **Phase 5: Authentik Automated Bootstrap**: Run bootstrap scripts to create the OIDC Provider, application slug `cloudtak`, redirect URIs, property mappings, and initial TISCK groups.
6. **Rollback Strategy**: If the self-hosted identity service encounters issues, operators set `OIDC_ENABLED=false` or use `LOCAL_ONLY_ACCOUNTS=admin` via `/login?local=true` to revert immediately to local PostgreSQL-based username/password authentication without downtime.

## Open Questions

- *TAK Server CA Deployment Mode*: Will future TAK Core deployments utilize OpenTAKServer's internal CA or a standalone `step-ca` container? (Deferred to TAK Core change; interface contract in `tak-certificate-enrollment` handles both).
- *Hardware Security Module (HSM) / Smartcard Authentication*: Will future tactical field kits require hardware PKI tokens (YubiKey/CAC) for Authentik WebAuthn? (Supported natively by Authentik WebAuthn stage without architectural changes).
