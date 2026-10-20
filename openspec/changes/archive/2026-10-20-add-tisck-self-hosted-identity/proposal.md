# Proposal

## Why

TISCK requires an offline-capable, sovereign identity foundation to authenticate tactical operators and automate access across the common operating picture (CloudTAK) and future TAK services in austere environments. Currently, CloudTAK relies on external OIDC providers and AWS Secrets Manager for token retrieval, creating critical startup and operational dependencies that fail in air-gapped or disconnected deployments. Deploying self-hosted Authentik with local OIDC and optional LDAP compatibility provides a unified, disconnected identity source that enforces least privilege, supports tactical teams, and establishes a secure boundary for TAK client certificate enrollment.

## What Changes

- **Self-Hosted Authentik Deployment**: Deploy pinned Authentik server, background worker, and Redis cache containers orchestrated via Docker Compose, isolated within an internal network without internet or public cloud dependencies.
- **Offline Secrets Provisioning**: Eliminate AWS Secrets Manager dependencies by configuring local environment and file-based secret provisioning for Authentik (`AUTHENTIK_SECRET_KEY`, bootstrap tokens) and CloudTAK (`AUTHENTIK_API_TOKEN`).
- **Tactical Group Mapping**: Establish standard TISCK tactical groups (`TISCK_INTEL`, `TISCK_RECON`, `TISCK_COMMAND`, `TISCK_ISR`) and map them to OIDC claims for role assignment and application authorization.
- **CloudTAK Native OIDC Integration**: Connect CloudTAK's native in-app OIDC Authorization Code engine to the self-hosted Authentik provider, preserving break-glass local administrator login (`LOCAL_ONLY_ACCOUNTS`) and fail-closed security during IdP outages.
- **Decouple CloudTAK AuthentikProvider from AWS**: Remove the hardcoded `@aws-sdk/client-secrets-manager` fetch in `AuthentikProvider.auth()`, allowing direct token injection via `AUTHENTIK_API_TOKEN` in self-hosted mode.
- **Optional LDAP Outpost Compatibility**: Define an optional, loopback-restricted LDAP Outpost interface for legacy tactical systems and services requiring LDAP bind authentication, without imposing LDAP on OIDC-native components.
- **TAK Certificate Enrollment Boundary**: Define an explicit integration boundary and interface contract for TAK client X.509 certificate enrollment (CSR generation, `/Marti/api/tls/config`, `/Marti/api/tls/signClient/v2`, and token exchange), decoupling identity verification from TAK Server CA implementation.
- **Offline Backup and Disaster Recovery**: Specify offline container image bundle procedures (`docker save`/`docker load`), database backup (`pg_dump`), and break-glass administrative recovery flows.

## Capabilities

### New Capabilities

- `self-hosted-identity`: Self-hosted, offline-capable identity provider (Authentik) providing OIDC authentication, group membership claims, administrative bootstrapping, MFA policies, and optional LDAP Outpost compatibility without external cloud dependencies.
- `tak-certificate-enrollment`: Integration boundary and protocol contract for TAK client X.509 certificate enrollment, verification, and revocation across OIDC/bearer token exchange and CA workflows.

### Modified Capabilities

- `self-hosted-deployment`: Extends Docker Compose orchestration to include Authentik server, worker, Redis cache, and internal identity routing with strict localhost binding for admin interfaces and health check definitions.
- `external-dependency-removal`: Replaces AWS Secrets Manager requirement in `AuthentikProvider.auth()` (`AUTHENTIK_API_TOKEN_SECRET_ARN`) with direct environment variable / local secret support (`AUTHENTIK_API_TOKEN`).

## Impact

- **Docker Compose**: `cloudtak/docker-compose.yml` (or an overlay compose file) adds `identity-server`, `identity-worker`, `identity-cache` (Redis), and optional `identity-ldap` services.
- **CloudTAK API**: `cloudtak/api/stateless/lib/authentik-provider.ts` updated to accept `AUTHENTIK_API_TOKEN` directly instead of querying AWS Secrets Manager.
- **Environment Configuration**: `cloudtak/.env.example` updated with Authentik connection variables, bootstrap tokens, and TISCK tactical group definitions.
- **ADR Log**: ADRs 0009, 0010, 0011, and 0012 added to record architectural decisions for identity, OIDC, LDAP, and TAK enrollment boundaries.
- **Offline Operations**: Documented runbook for pre-caching container images and executing air-gapped backups.
