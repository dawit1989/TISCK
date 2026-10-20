# ADR 0007: Self-Contained Docker Compose Deployment Architecture

- **Status**: Accepted
- **Date**: 2026-10-20
- **Authors**: TISCK Engineering Team

---

## Context

The upstream CloudTAK ecosystem relied on an assortment of external infrastructure repositories:
1. `auth-infra`: Managed external OAuth/OIDC identity providers (AWS Cognito / Keycloak).
2. `tak-infra`: Managed CoreTAK server infrastructure and external TAK network routing.
3. `media-infra`: Provided media relay images and deployment scripts.

Deploying CloudTAK independently was error-prone because local development was treated as secondary to AWS ECS/CDK deployments, and the single-host Docker Compose deployment had accumulated bit rot (broken relative build contexts, quoted environment variables causing invalid URLs, and SSL connection handshake failures).

---

## Decision

1. **Unified Single-File Orchestration**:
   - Deliver the entire TISCK stack through a single `cloudtak/docker-compose.yml` file.
   - Orchestrate all 7 core services: `api`, `tiles`, `events`, `retention`, `postgis`, `store`, and `media`.
2. **Complete Independence from Excluded Repositories**:
   - Zero runtime or build dependency on `auth-infra`, `tak-infra`, or `media-infra`.
   - Local authentication uses built-in database user authentication with JWT signing secrets.
   - Media streaming is handled by upstream MediaMTX (ADR 0002).
3. **Database SSL Handshake Decoupling**:
   - In `cloudtak/api/common/config.ts`, disable client-side SSL enforcement when `CLOUDTAK_Mode === 'docker-compose'` to allow plaintext connections to the local `postgis` container.
4. **Environment Variable Expansion Standardization**:
   - Use standard Compose parameter expansion (`${VAR:-default}`) without outer quotation marks (`"${VAR}"`) to prevent literal quote characters from corrupting Node.js URL parsing or PostgreSQL role creation statements.
5. **Stateful Health Checks**:
   - Integrate Docker health checks for stateful dependencies (`pg_isready` on `postgis`, S3 port readiness on `store`) with dependent service ordering (`depends_on: { condition: service_healthy }`).

---

## Consequences

### Positive
- A single command (`docker compose up -d`) starts the complete tactical geospatial situational awareness suite.
- Containers boot deterministically with zero internet connectivity.
- Self-contained schema migrations run automatically on startup.

### Negative / Neutral
- For multi-node high availability or cluster federation, a separate distributed architecture (e.g. Nomad or Kubernetes) would be needed beyond this single-node baseline.

---

## OpenSpec Traceability

- **Change**: `adapt-cloudtak-for-tisck-selfhosted-garage`
- **Capability Specs**:
  - `openspec/changes/adapt-cloudtak-for-tisck-selfhosted-garage/specs/self-hosted-deployment/spec.md`:
    - Requirement: `Self-contained Docker Compose deployment`
    - Requirement: `No dependency on excluded infrastructure repositories`
    - Requirement: `Health checks for stateful services`
- **Tasks**: Tasks 2.2, 2.3 in `tasks.md`.

---

## Verification Evidence

1. **Compose Configuration Validation**: Executed `docker compose config` without warnings or syntax errors.
2. **Health Check Verification**: Checked container health status via `docker inspect`:
   - `cloudtak-postgis-1`: `Status: healthy` (`pg_isready -h 127.0.0.1 -U docker -d tak_psql`)
   - `cloudtak-store-1`: `Status: healthy`
3. **Database Migration Verification**: Inspected `cloudtak-api-1` startup logs; confirmed all PostgreSQL migrations up to current version executed cleanly and populated initial tables (`users`, `layers`, `tokens`, etc.).
4. **API Initialization**: Confirmed API logged `ok - initialized database` and `ok - listening on port 5000`.
