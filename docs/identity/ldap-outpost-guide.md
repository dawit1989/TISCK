# Authentik LDAP Outpost Compatibility Guide

## Overview

In TISCK, **OpenID Connect (OIDC) is the primary authentication protocol** across modern tactical web applications (CloudTAK Web COP). 

The Authentik LDAP Outpost is deployed strictly as an **optional compatibility interface** for legacy tactical systems, network radios, or legacy tactical plugins that do not natively support modern OIDC authentication.

---

## 1. Network Boundary and Port Isolation

In compliance with [ADR 0006](file:///c:/Users/Dave/Downloads/tak/TISCK/docs/adr/0006-network-interface-and-port-binding-matrix.md) and [ADR 0011](file:///c:/Users/Dave/Downloads/tak/TISCK/docs/adr/0011-ldap-outpost-as-optional-compatibility-interface.md):

* **Loopback Binding**: Standard LDAP (`389`) and LDAPS (`636`) ports are bound exclusively to `127.0.0.1`.
* **Prohibited Exposure**: Under no circumstances should port `389` or `636` be bound to `0.0.0.0` or exposed over tactical wireless/mesh radio perimeters.
* **Compose Profile**: The service is gated behind Docker Compose profile `ldap`:
  ```bash
  # Start stack with LDAP Outpost enabled
  docker compose --profile ldap up -d identity-ldap
  ```

---

## 2. Directory Structure and Base DN

The LDAP Outpost projects Authentik users and groups into standard LDAP schemas:

* **Base DN**: `dc=tisck,dc=local`
* **Users OU**: `ou=users,dc=tisck,dc=local`
* **Groups OU**: `ou=groups,dc=tisck,dc=local`

### Example User Entry
```ldif
dn: cn=recon-lead,ou=users,dc=tisck,dc=local
objectClass: user
objectClass: organizationalPerson
objectClass: inetOrgPerson
cn: recon-lead
mail: recon-lead@tisck.local
memberOf: cn=TISCK_RECON,ou=groups,dc=tisck,dc=local
```

### Example Tactical Group Entry
```ldif
dn: cn=TISCK_INTEL,ou=groups,dc=tisck,dc=local
objectClass: group
objectClass: groupOfNames
cn: TISCK_INTEL
member: cn=analyst1,ou=users,dc=tisck,dc=local
```

---

## 3. Service Account and Bind Configuration

Legacy clients authenticate using dedicated bind service accounts:

* **Bind DN**: `cn=ldapservice,ou=users,dc=tisck,dc=local`
* **Search Filter for Authentication**: `(&(objectClass=inetOrgPerson)(cn=%s))`
* **Group Membership Filter**: `(&(objectClass=groupOfNames)(member=%d))`

### Verification via ldapsearch (Loopback Only)
```bash
# Query directory over local interface
ldapsearch -H ldap://127.0.0.1:389 \
  -x \
  -D "cn=ldapservice,ou=users,dc=tisck,dc=local" \
  -w "SERVICE_ACCOUNT_PASSWORD" \
  -b "dc=tisck,dc=local" "(cn=TISCK_*)"
```

---

## 4. Credential Rotation & Revocation

1. Bind service account passwords must be generated with high entropy (`32+` characters) via `scripts/generate-identity-secrets.sh`.
2. Disabling or locking an operator's account in Authentik immediately invalidates LDAP bind queries for that identity.
3. Access tokens between `identity-ldap` and `identity-server` use Authentik internal service tokens configured via `AUTHENTIK_TOKEN`.
