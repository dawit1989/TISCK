# TAK Certificate Enrollment Integration Boundary Specification

## Overview

TAK clients (ATAK for Android, WinTAK for Windows) authenticate to TAK Core messaging services (Pillar C) via mutual TLS (mTLS) using client X.509 certificates.

In TISCK, **Authentik is the authoritative identity provider (Pillar A)**, but it does not act as a TAK Certificate Authority. This document establishes the formal interface contract, endpoint specifications, and network port validation matrix separating identity verification from certificate issuance.

---

## 1. REST Enrollment Protocol Specification

TAK certificate enrollment is mediated through standard Marti REST endpoints:

### Endpoint 1: Certificate Configuration Discovery
* **URL**: `GET /Marti/api/tls/config`
* **Authentication**: Bearer Token (exchanged via Authentik RFC 7523 grant) or HTTP Basic Auth
* **Response Payload (XML)**:
  ```xml
  <ns2:certificateConfig xmlns:ns2="http://bbn.com/marti/xml/config">
    <nameEntries>
      <nameEntry name="O" value="TISCK Tactical Force"/>
      <nameEntry name="OU" value="Ethiopia Operations"/>
    </nameEntries>
  </ns2:certificateConfig>
  ```
* **Client Behavior**: The client reads the `O` and `OU` values to generate an X.509 Certificate Signing Request (CSR) with the Common Name (`CN`) set to the authenticated username.

### Endpoint 2: Client Certificate Signing
* **URL**: `POST /Marti/api/tls/signClient/v2?clientUid={username}%20(Web)&version=3`
* **Content-Type**: `text/plain` (raw PEM CSR)
* **Authentication**: Bearer Token or HTTP Basic Auth
* **Response Payload (JSON)**:
  ```json
  {
    "signedCert": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
    "ca0": "-----BEGIN CERTIFICATE-----\n... (Intermediate CA) ...\n-----END CERTIFICATE-----",
    "ca1": "-----BEGIN CERTIFICATE-----\n... (Root CA) ...\n-----END CERTIFICATE-----"
  }
  ```

---

## 2. Port Verification Matrix (Candidate Port Analysis)

Historical documentation and configuration files (such as `.env.example`) mention port `8446`. This analysis defines the verification contract:

| Port | Traditional Standard Role | Candidate Server Distributions | Verification Status |
| :--- | :--- | :--- | :--- |
| **8089** | TAK Core mTLS Streaming CoT | TAK Server, OpenTAKServer | **Verified Standard** |
| **8443** | Marti HTTPS API & WebTAK | TAK Server standard | **Verified Standard** |
| **8446** | Alternate mTLS / Client Enrollment | Custom TAK Server / FreeTAKServer Web | **Candidate Parameter — Must Verify** |

### Policy on Port 8446
Port `8446` is treated as a **configurable candidate parameter**, not an immutable default. The TAK Core integration change (Pillar C) must probe the candidate server distribution and bind enrollment services to the verified active port.

---

## 3. Concurrency Protection & Advisory Lock Safety

To prevent enrollment race conditions during rapid re-authentication or concurrent browser requests:

```typescript
await tx.execute(sql`SELECT pg_advisory_xact_lock(918273645, hashtext(${username}))`);
```

* **Advisory Lock Scope**: Transaction-scoped lock keyed on the hashed username.
* **Failure Safety**: If enrollment fails, the temporary password in Authentik is revoked in a `finally` block, ensuring credentials are never left active.
* **Probing**: Prior to re-enrollment, CloudTAK probes active cert validity via `TAKAPI.Certificate.probe()`; network errors default to assuming the cert is valid to prevent renewal churn during TAK Server outages.
