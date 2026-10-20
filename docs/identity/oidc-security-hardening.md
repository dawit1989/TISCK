# TISCK Identity — OIDC Security Hardening & Canonical Issuer Architecture

## 1. Overview

In TISCK's self-hosted, offline-first tactical deployment, CloudTAK utilizes **Authentik (2024.12)** as its OpenID Connect (OIDC) identity provider. To guarantee secure authentication without relying on public cloud services or external trust anchors, the identity integration enforces strict cryptographic guarantees, canonical issuer identity, and dual-homed network routing.

---

## 2. Cryptographic ID Token Validation (RFC 7519 / OIDC Core 3.1.3.7)

CloudTAK validates ID tokens received during authorization code exchange using `validateIdToken()` in `cloudtak/api/stateless/lib/oidc.ts`. The validation enforces:

1. **Cryptographic Signature Verification**:
   - Algorithmic enforcement: `HS256` signed with `OIDC_CLIENT_SECRET`.
   - Rejects unsigned tokens, alg `none`, or asymmetric signature confusion attacks.
2. **Strict Canonical Issuer Validation**:
   - The token's `iss` claim must strictly match `OIDC_ISSUER` (e.g. `http://localhost:9000/application/o/cloudtak/` or `https://tisck.tactical.lan:9000/application/o/cloudtak/`).
   - Rejects tokens issued under internal Docker aliases (e.g. `identity-server:9000`) or mismatched hostnames.
3. **Audience Restriction**:
   - The token's `aud` claim must contain `OIDC_CLIENT_ID` (`cloudtak`).
4. **Token Expiration**:
   - Enforces `exp` timestamps with zero tolerance for expired assertions.
5. **Replay & Injection Defense via Nonce**:
   - When an operator initiates `/api/login/oidc`, a 16-byte cryptographically random hex nonce is generated:
     ```ts
     const nonce = crypto.randomBytes(16).toString('hex');
     ```
   - The nonce is embedded in the HMAC-SHA256-signed state JWT and passed to Authentik's authorization endpoint.
   - On callback, the state is verified, and `validateIdToken()` asserts that `token.nonce === state.nonce`.

---

## 3. Dual-Homed Network Routing & Canonical Issuer Preservation

### The Dual-Homed Challenge
In Docker Compose deployments:
- **Client Browsers** access Authentik externally via the host binding (`http://localhost:9000` or LAN domain).
- **CloudTAK API Container** reaches Authentik internally via the Docker bridge network (`http://identity-server:9000`).

Without adaptation, Authentik dynamically derives its issuer URL and endpoints from the incoming HTTP `Host` header. If the API fetches discovery internally from `http://identity-server:9000`, the ID token would be signed with `iss: http://identity-server:9000/...`, violating external browser trust and failing validation. Conversely, if Authentik's discovery document advertises browser-facing endpoints (`localhost:9000`), internal container fetch requests fail with `ECONNREFUSED`.

### The Solution: Forwarded Host Injection & Internal Backchannel Resolution
CloudTAK resolves this through two cooperating mechanisms in `oidc.ts`:

1. **Forwarded Host Preservation**:
   - When CloudTAK queries Authentik's discovery or token endpoint, it injects:
     ```http
     X-Forwarded-Host: <canonical_host>
     X-Forwarded-Proto: <protocol>
     ```
   - Authentik respects these headers and issues discovery documents and ID tokens using the canonical browser-facing issuer URL.

2. **Internal URL Resolution (`resolveInternalUrl`)**:
   - If discovery metadata returns a public/browser-facing `token_endpoint` or `userinfo_endpoint` (e.g. `http://localhost:9000/application/o/token/`), `resolveInternalUrl` rewrites the request destination to the internal Docker service host (`http://identity-server:9000/application/o/token/`) while preserving the forwarded headers.
   - This ensures reliable backchannel communication over the internal Docker network with zero network hairpinning or DNS split-horizon requirements.

---

## 4. Signing Secret Hardening

In `cloudtak/api/common/config.ts`, `Config.envInit()` enforces production cryptographic boundaries in `docker-compose` mode:

- Insecure defaults (`coe-wildland-fire`) are rejected with an explicit error.
- Placeholder strings (`CHANGE_ME_TO_A_SECURE_RANDOM_STRING_MIN_32_CHARS`) are rejected.
- Any secret shorter than 32 characters throws an exception on container initialization.
- Automated generation scripts (`generate-identity-secrets.ps1` and `.sh`) automatically provision 50+ character random secrets.

---

## 5. Automated Verification & Regression Test Suites

The following permanent test suites verify the identity and OIDC implementation:

| Test Suite | Purpose | Execution Command |
| :--- | :--- | :--- |
| `test/oidc-url-validation.test.ts` | Unit tests for URL fallbacks, `resolveInternalUrl`, ID token HS256 signature, issuer match, audience match, expiration, and nonce validation. | `docker exec cloudtak-api-1 npx tsx --test --test-force-exit test/oidc-url-validation.test.ts` |
| `test/tisck-signing-secret.test.ts` | Unit tests verifying strict rejection of insecure signing secret defaults and length requirements in `docker-compose` mode. | `docker exec cloudtak-api-1 npx tsx --test --test-force-exit test/tisck-signing-secret.test.ts` |
| `test/authentik-live-integration.test.ts` | Live integration test verifying discovery document, token endpoint rejection of invalid credentials, token issuance, userinfo, and tactical operational groups in Authentik. | `docker exec cloudtak-api-1 npx tsx --test --test-force-exit test/authentik-live-integration.test.ts` |
| `cloudtak/scripts/e2e-browser-login.mjs` | Automated Chrome/Edge DevTools Protocol (CDP) headless browser test validating real human login, callback, session creation via `#sso=`, refresh tokens, and logout. | `node cloudtak/scripts/e2e-browser-login.mjs` |
| `cloudtak/scripts/verify-persistence.mjs` | Automated restart and persistence test verifying Authentik health recovery, database role authentication, and entity persistence across service restarts. | `node cloudtak/scripts/verify-persistence.mjs` |
