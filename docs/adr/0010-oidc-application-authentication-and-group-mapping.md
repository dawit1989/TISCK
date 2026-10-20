# ADR 0010: OIDC Application Authentication and Tactical Group Mapping

- **Status**: Proposed
- **Date**: 2026-10-20
- **Authors**: TISCK Engineering Team

---

## Context

CloudTAK currently includes an in-app OIDC Authorization Code client (`cloudtak/api/stateless/routes/login.ts`), but its production integration was originally built against AWS Secrets Manager for obtaining the Authentik API token (`AUTHENTIK_API_TOKEN_SECRET_ARN`).

Furthermore, TISCK introduces distinct operational groups (`TISCK_INTEL`, `TISCK_RECON`, `TISCK_COMMAND`, `TISCK_ISR`) that must be recognized by the identity provider and conveyed across consuming applications (CloudTAK Web COP, future TAK Core, and ETL feeds) to enforce role-based access control.

---

## Decision

1. **OIDC as the Primary Application Protocol**: OIDC Authorization Code flow with PKCE is adopted as the primary authentication protocol for all browser and web-based applications.
2. **CloudTAK AuthentikProvider Decoupling**: Update `cloudtak/api/stateless/lib/authentik-provider.ts` to support direct injection of `AUTHENTIK_API_TOKEN` via environment variable, bypassing `@aws-sdk/client-secrets-manager` when `CLOUDTAK_Mode=docker-compose` (consistent with ADR 0001).
3. **Tactical Group Mapping Contract**:
   - Authentik manages membership for initial TISCK groups: `TISCK_INTEL`, `TISCK_RECON`, `TISCK_COMMAND`, `TISCK_ISR`.
   - Authentik exposes an OAuth2 `groups` scope containing an array of group names.
   - Applications treat group names as identity attributes rather than hardcoded permission sets.
   - Applications enforce deny-by-default access control and map incoming groups to internal roles (e.g. `CloudTAKSystemAdmin` -> system admin; `TISCK_COMMAND` -> executive operational permissions).
4. **Outage and Fail-Closed Behavior**: If Authentik is unreachable during login, downstream applications fail closed, blocking unauthenticated access while preserving existing active sessions and break-glass administrator access (`LOCAL_ONLY_ACCOUNTS`).

---

## Consequences

### Positive
- Standardized, vendor-agnostic OIDC token exchange across all tactical web services.
- Eliminates remaining AWS Secrets Manager dependency in `authentik-provider.ts`.
- Clear authorization boundary separating identity assertions from application permission policies.

### Negative / Neutral
- Token issuance requires local network availability of `identity-server` at login time.
- Group hierarchy changes in Authentik require mapped sync logic in consuming applications.

---

## OpenSpec Traceability

- **Change**: `add-tisck-self-hosted-identity`
- **Capability Specs**:
  - `self-hosted-identity`:
    - Requirement: `Tactical group claims and role mapping`
    - Requirement: `Disconnected authentication and MFA policy`
    - Requirement: `Fail-closed outage behavior`
  - `external-dependency-removal`:
    - Requirement: `AWS SDK call isolation` (Scenario: `Authentik API token resolution bypass`)
- **Tasks**: Tasks in Task Groups 3 and 4 of `tasks.md`.

---

## Verification Evidence

- **Status**: Proposed (pending implementation in OpenSpec apply phase).
- **Verification Plan**:
  1. Inspect `cloudtak/api/stateless/lib/authentik-provider.ts` to verify direct `AUTHENTIK_API_TOKEN` handling.
  2. Execute unit test `npm test login-oidc.srv.test.ts` verifying OIDC callback and role assignment.
  3. Validate tactical group claims delivery (`TISCK_INTEL`, etc.) in `/userinfo` response.
  4. Verify break-glass access under simulated IdP network disconnection.
