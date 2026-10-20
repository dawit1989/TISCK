# Tasks

## 1. Environment & Secret Provisioning

- [x] 1.1 Create offline identity environment template `cloudtak/.env.identity.example` with Authentik server, worker, redis, and postgres settings, and verify the file parses correctly with expected variable placeholders
- [x] 1.2 Implement local secret generation script `cloudtak/scripts/generate-identity-secrets.sh` (generating `AUTHENTIK_SECRET_KEY`, bootstrap password, and admin API token) and verify it generates 50+ character cryptographic strings without network calls
- [x] 1.3 Update `.gitignore` to ensure `.env.identity` and any generated credential files cannot be committed, and verify with `git check-ignore`

## 2. Docker Compose Identity Architecture

- [x] 2.1 Define `identity-cache` (Redis 7.4-alpine) in Docker Compose with loopback or internal network binding and health check, and verify container startup and `redis-cli ping`
- [x] 2.2 Configure dedicated PostgreSQL database `authentik` and user credentials within the PostGIS instance or dedicated service, and verify database connectivity via `psql`
- [x] 2.3 Define `identity-server` and `identity-worker` services in Docker Compose pinned to `ghcr.io/goauthentik/server:2024.12.3`, binding web port 9000 strictly to `127.0.0.1`, and verify `docker compose config` validation succeeds
- [x] 2.4 Configure persistent Docker volumes (`authentik-media`, `authentik-templates`) and restart policies (`unless-stopped`), and verify volume persistence across container restarts
- [x] 2.5 Document offline container image bundling workflow (`docker save`/`docker load`) in `docs/identity/offline-image-bundle.md` and verify offline load script against local image cache

## 3. CloudTAK AuthentikProvider Decoupling & In-App OIDC

- [x] 3.1 Update `cloudtak/api/stateless/lib/authentik-provider.ts` to read `AUTHENTIK_API_TOKEN` directly from environment before querying AWS Secrets Manager, and verify via unit test that `auth()` resolves without AWS credentials
- [x] 3.2 Configure CloudTAK environment variables (`OIDC_DISCOVERY_URL=http://identity-server:9000/application/o/cloudtak/.well-known/openid-configuration`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`) in `cloudtak/.env.example`, and verify API configuration parsing
- [x] 3.3 Verify OIDC Authorization Code redirect and callback flow between CloudTAK and Authentik via integration test in `cloudtak/api/test/login-oidc.srv.test.ts`
- [x] 3.4 Verify break-glass admin login via `/login?local=true` and `LOCAL_ONLY_ACCOUNTS` when the identity provider is stopped or unreachable

## 4. Tactical Groups, OIDC Scopes & Authorization Mapping

- [x] 4.1 Create Authentik bootstrap automation script `cloudtak/scripts/bootstrap-authentik.sh` to configure the `cloudtak` OAuth2 application, redirect URIs, and custom `groups` scope mapping, and verify API execution against local Authentik
- [x] 4.2 Provision initial TISCK tactical groups (`TISCK_INTEL`, `TISCK_RECON`, `TISCK_COMMAND`, `TISCK_ISR`) and administrative groups in Authentik, and verify group listing via Authentik REST API
- [x] 4.3 Verify that authenticated userinfo responses include the assigned tactical groups array and map correctly to CloudTAK user profile settings (`tak::group`)
- [x] 4.4 Verify deny-by-default authorization: ensure users lacking valid tactical group membership are restricted to unassigned channels in CloudTAK

## 5. Optional LDAP Outpost Interface

- [x] 5.1 Define optional `identity-ldap` service in Docker Compose (`ghcr.io/goauthentik/ldap:2024.12.3`) under compose profile `ldap`, binding ports 389 and 636 strictly to `127.0.0.1`, and verify compose profile parsing
- [x] 5.2 Configure LDAP service account credentials and search base DN (`dc=tisck,dc=local`), and verify bind authentication using `ldapsearch` against loopback
- [x] 5.3 Document LDAP integration guidelines and security boundaries in `docs/identity/ldap-outpost-guide.md`

## 6. TAK Certificate Enrollment Boundary Definition

- [x] 6.1 Formalize TAK Server certificate enrollment interface specification covering `/Marti/api/tls/config` and `/Marti/api/tls/signClient/v2` endpoints in `docs/identity/tak-enrollment-boundary.md`
- [x] 6.2 Document port verification matrix establishing port 8446 as a candidate parameter requiring runtime validation against candidate TAK Server distributions (OpenTAKServer vs TAK Server)
- [x] 6.3 Verify `AuthentikProvider.enrollUserCertificate()` error handling and PostgreSQL advisory lock behavior to ensure failed or concurrent enrollment attempts do not deadlock or strand operator accounts

## 7. Operational Recovery, Backup & Verification

- [x] 7.1 Implement database backup and restore script `cloudtak/scripts/backup-identity.sh` utilizing `pg_dump` and `pg_restore` for the Authentik database, and verify end-to-end backup/restore cycle
- [x] 7.2 Document emergency administrative break-glass recovery runbook using Authentik CLI `manage.py recovery_key` in `docs/identity/disaster-recovery.md` and verify key generation inside container
- [x] 7.3 Run full traceability audit using `/tisck-traceability` to map all Pillar A requirements and verify OpenSpec status across the repository

## Workflow follow-up

- Review and approve ADRs 0009 through 0012.
- Proceed to OpenSpec apply phase upon review approval.
