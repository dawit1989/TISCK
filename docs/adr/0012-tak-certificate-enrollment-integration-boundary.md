# ADR 0012: TAK Certificate Enrollment Integration Boundary

- **Status**: Proposed
- **Date**: 2026-10-20
- **Authors**: TISCK Engineering Team

---

## Context

TAK tactical endpoints (ATAK for Android, WinTAK for Windows) communicate over Cursor on Target (CoT) streams secured via mutual TLS (mTLS). Each client requires a valid X.509 client certificate and private key signed by the trusted TAK Certificate Authority (CA).

While Authentik provides identity verification, user authentication, and group assertions, it does not natively act as a TAK Server CA or implement the Marti certificate enrollment protocol. In historical discussions and configurations, port `8446` was cited for client enrollment, but TAK Server implementations differ (e.g. TAK Server standard ports 8089/8443 vs OpenTAKServer or custom FreeTAKServer configurations).

A clear architectural boundary is required between the identity provider (Pillar A) and the TAK messaging/CA infrastructure (Pillar C).

---

## Decision

1. **Decoupled CA and Enrollment Interface**: We establish a clear integration boundary: Authentik manages operator identity; the designated TAK Server (or dedicated CA service) manages the CA root key and issues X.509 certificates.
2. **Formal Enrollment Protocol Endpoints**: The enrollment contract relies on the standard Marti CA REST endpoints:
   - `GET /Marti/api/tls/config`: Retrieves server CA organization attributes (`O`, `OU`) and certificate policy parameters.
   - `POST /Marti/api/tls/signClient/v2`: Submits an X.509 Certificate Signing Request (CSR) along with authenticated user credentials, returning the signed client certificate and CA trust chain.
3. **Identity-Mediated Enrollment Mediation**:
   - Primary: RFC 7523 JWT-bearer client assertion exchange against Authentik to present an exchanged token to TAK Server.
   - Fallback: CloudTAK's existing `AuthentikProvider.enrollUserCertificate()` temporary password flow, protected by PostgreSQL transaction advisory locks (`pg_advisory_xact_lock`).
4. **Port 8446 Candidate Status**: Port `8446` is formally classified as a **candidate proposal to verify**, subject to validation against the specific selected TAK Server distribution and configuration, rather than an assumed fixed default.
5. **Lifecycle and Revocation**: CloudTAK probes certificate validity and automatically renews client certificates within 7 days of expiration or when rejected by TAK Server.

---

## Consequences

### Positive
- Strict separation of concerns: Identity management remains decoupled from X.509 cryptographic issuance.
- Prevents inventing non-standard enrollment ports or protocols in the identity layer.
- Establishes a verified interface contract ready for the subsequent TAK Core change (Pillar C).

### Negative / Neutral
- Full end-to-end zero-touch enrollment requires the TAK Server (or CA container) to be deployed and reachable.
- Re-enrollment during temporary TAK Server outages must fail safe without invalidating existing valid certificates.

---

## OpenSpec Traceability

- **Change**: `add-tisck-self-hosted-identity`
- **Capability Specs**:
  - `tak-certificate-enrollment`:
    - Requirement: `TAK client CSR signing interface`
    - Requirement: `Identity-mediated certificate enrollment`
    - Requirement: `Certificate lifecycle and validity verification`
    - Requirement: `Candidate endpoint and port verification`
- **Tasks**: Tasks in Task Group 6 of `tasks.md`.

---

## Verification Evidence

- **Status**: Proposed (pending implementation in OpenSpec apply phase).
- **Verification Plan**:
  1. Inspect `cloudtak/api/stateless/lib/authentik-provider.ts` for CSR generation and advisory lock safety.
  2. Verify against mock or live TAK Server `/Marti/api/tls/config` and `/Marti/api/tls/signClient/v2` endpoints.
  3. Validate certificate renewal triggers when validity < 7 days.
  4. Perform port audit on candidate TAK Server runtime to verify active listener ports.
