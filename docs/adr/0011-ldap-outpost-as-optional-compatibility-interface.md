# ADR 0011: LDAP Outpost as an Optional Compatibility Interface

- **Status**: Proposed
- **Date**: 2026-10-20
- **Authors**: TISCK Engineering Team

---

## Context

Certain legacy tactical systems, network radios, and legacy TAK Server plug-ins lack native support for OpenID Connect (OIDC) and instead rely on LDAP directory binds for authentication. However, modern applications in TISCK (including CloudTAK) support OIDC natively.

Making LDAP a mandatory dependency across the stack would introduce unnecessary protocol complexity, cleartext credential risks, and maintenance overhead for services that already function with token-based OIDC.

---

## Decision

1. **Optional Compatibility Interface**: The Authentik LDAP Outpost is designated strictly as an **optional compatibility layer**, enabled only when integrated with legacy consumers that genuinely require LDAP.
2. **OIDC Precedence**: CloudTAK and modern TISCK services SHALL NOT use LDAP for authentication; they integrate via OIDC directly.
3. **Network Isolation**: When enabled, the LDAP Outpost container (`identity-ldap` running `ghcr.io/goauthentik/ldap:2024.12.3`) is bound strictly to `127.0.0.1` (ports 389 and 636) or an internal Docker network, preventing exposure across external tactical network interfaces.
4. **Service Account Least Privilege**: Legacy consumers connect to the LDAP Outpost using dedicated service accounts with read-only search permissions scoped to designated directory trees (`dc=tisck,dc=local`).

---

## Consequences

### Positive
- Legacy systems can authenticate against the same single source of truth (Authentik) without modifying legacy code.
- Modern services avoid LDAP client libraries, connection pool overhead, and bind credential management.
- Strict loopback isolation prevents unencrypted directory traffic over tactical wireless networks.

### Negative / Neutral
- Running the LDAP Outpost requires an additional container process and memory allocation (~100MB).
- Credential rotation for LDAP service accounts requires manual or scripted directory updates.

---

## OpenSpec Traceability

- **Change**: `add-tisck-self-hosted-identity`
- **Capability Specs**:
  - `self-hosted-identity`:
    - Requirement: `Optional LDAP Outpost compatibility interface`
      - Scenario: `LDAP bind authentication`
      - Scenario: `Loopback and network restriction`
- **Tasks**: Tasks in Task Group 5 of `tasks.md`.

---

## Verification Evidence

- **Status**: Proposed (pending implementation in OpenSpec apply phase).
- **Verification Plan**:
  1. Boot stack with `--profile ldap` enabled.
  2. Perform `ldapsearch -H ldap://127.0.0.1:389 -D "cn=bind,ou=users,dc=tisck,dc=local" -W -b "ou=users,dc=tisck,dc=local"`.
  3. Verify external scan confirms ports 389 and 636 are not reachable from external tactical LAN interfaces (`0.0.0.0`).
