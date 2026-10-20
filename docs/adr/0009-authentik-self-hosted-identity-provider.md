# ADR 0009: Self-Hosted Authentik Identity Provider for Disconnected Environments

- **Status**: Proposed
- **Date**: 2026-10-20
- **Authors**: TISCK Engineering Team

---

## Context

TISCK requires an on-premise, sovereign identity solution (Pillar A) capable of running completely offline in tactical environments across Ethiopia and the Horn of Africa. The existing CloudTAK deployment relies either on local fallback credentials or external identity providers (Cognito/Authentik hosted in cloud environments with AWS Secrets Manager).

To support multi-user operations, role-based access control, and tactical team assignments without cloud IAM or internet access, TISCK must self-host an identity provider on edge hardware alongside CloudTAK and Garage.

---

## Decision

We propose deploying **Authentik** as TISCK's sovereign identity foundation using Docker Compose:

1. **Topology & Version Pinning**: Pinned to upstream version `2024.12.3`, deploying `identity-server`, `identity-worker`, and a dedicated `identity-cache` (`redis:7.4-alpine`).
2. **Data Storage & Co-location**: Authentik requires PostgreSQL 13+. In the unified tactical compose stack, Authentik utilizes a dedicated logical database (`authentik`) within the existing PostGIS 17 instance to optimize edge RAM while preserving logical database separation.
3. **Secret Provisioning Without Cloud Dependencies**: All secrets (`AUTHENTIK_SECRET_KEY`, `AUTHENTIK_BOOTSTRAP_PASSWORD`, `AUTHENTIK_BOOTSTRAP_TOKEN`) are injected via local environment variables (`.env.identity`) or Docker secret mounts without AWS Secrets Manager.
4. **Network Perimeter & Administrative Isolation**: In adherence to ADR 0006, Authentik web and admin ports (`9000`) are bound strictly to `127.0.0.1` or internal Docker networks (`cloudtak-net`). Public tactical ingress is mediated by reverse proxy.
5. **Emergency Administrative Recovery**: Preserves offline administrative recovery via container CLI `manage.py recovery_key` and retains CloudTAK's local break-glass login (`LOCAL_ONLY_ACCOUNTS`).

---

## Consequences

### Positive
- Fully self-contained identity provider requiring zero outbound network requests.
- Native OIDC provider supporting modern authentication, group claims, and session management.
- Dynamic REST API enables script-based bootstrapping and automated client provisioning.
- Low resource footprint relative to enterprise JVM alternatives like Keycloak.

### Negative / Neutral
- Adds container services (server, worker, Redis cache) requiring ~400–600MB of additional RAM on edge hardware.
- Operators must manage local database backups and secret rotation without automated cloud snapshots.

---

## OpenSpec Traceability

- **Change**: `add-tisck-self-hosted-identity`
- **Capability Specs**:
  - `self-hosted-identity`:
    - Requirement: `Disconnected identity service startup`
    - Requirement: `Local secret bootstrapping and recovery`
    - Requirement: `Fail-closed outage behavior`
  - `self-hosted-deployment`:
    - Requirement: `Orchestration of self-hosted identity services`
    - Requirement: `Health checks for stateful services`
    - Requirement: `Network interface isolation and port binding`
- **Tasks**: Tasks in Task Groups 1 and 2 of `tasks.md`.

---

## Verification Evidence

- **Status**: Proposed (pending implementation in OpenSpec apply phase).
- **Verification Plan**:
  1. Boot stack with `docker compose up -d` in an air-gapped test VM with no default gateway.
  2. Verify all identity containers reach healthy status within 120 seconds.
  3. Validate that no external DNS or IP lookups are attempted.
  4. Test local CLI admin recovery link generation using `manage.py recovery_key 1`.
