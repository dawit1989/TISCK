# Tasks: Integrate Official TAK Server (tak-infra)

## 1. Garage S3 & Identity Provisioning

- [x] 1.1 Update `cloudtak/scripts/init-garage.ps1` and `init-garage.sh` to provision the `tak-server` bucket and grant read/write access to `cloudtak-key`, verifying via `/garage bucket list`
- [x] 1.2 Update `cloudtak/docker-compose.yml` and `.env.identity.example` to ensure `identity-ldap` runs with required outpost configuration on `cloudtak-net`
- [x] 1.3 Create `tak-infra/.env.example` defining database parameters (`POSTGRES_HOST=tak-db`, `POSTGRES_PORT=5432`, `POSTGRES_DB=takserver`, `POSTGRES_USER=tak`), port configuration, Garage S3 credentials (`AWS_S3_Endpoint=http://store:3900`), and Authentik LDAP parameters (`LDAP_HOST=identity-ldap`, `LDAP_PORT=389`), verifying all required environment variables are documented

## 2. Independent PostgreSQL Database Setup

- [x] 2.1 Create `tak-infra/conf/init-tak-db.sql` to initialize `postgis` and `uuid-ossp` extensions automatically upon database creation
- [x] 2.2 Configure `tak-db` service in `tak-infra/docker-compose.yml` with `image: postgis/postgis:17-3.5`, `shm_size: 256m`, performance flags (`-c max_connections=200 -c shared_buffers=256MB`), `pg_isready` healthcheck, and persistent volume `tak-db-data` on isolated network `tak-net`
- [x] 2.3 Verify `tak-db` syntax and isolation using `docker compose -f tak-infra/docker-compose.yml config` to confirm no host port binding on 5432

## 3. CoreConfig & Authentik LDAP Refactor

- [x] 3.1 Refactor `tak-infra/CoreConfig.ts` to support Authentik LDAP Outpost (`ldap://identity-ldap:389`), setting `roleAttribute: memberOf`, while making LDAP optional if environment variables are omitted and eliminating external Amazon Root CA fetches
- [x] 3.2 Update `tak-infra/CoreConfig.ts` and `tak-infra/start` to automatically construct `PostgresURL` from structured environment variables (`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`) when `PostgresURL` is not directly provided
- [x] 3.3 Verify `tak-infra/CoreConfig.ts` passes compilation (`npm run check` in `tak-infra`) and successfully generates `<auth><ldap>` when Authentik parameters are present

## 4. Container Entrypoint & Secret Lifecycle Refactor

- [x] 4.1 Refactor `tak-infra/start` to remove all AWS Secrets Manager CLI invocations (`aws secretsmanager get-secret-value` and `put-secret-value`) and replace them with local volume checks in `/opt/tak/certs`
- [x] 4.2 Ensure initial boot certificate generation executes `/opt/tak/certs/cert-metadata.sh`, `makeRootCa.sh`, and `makeCert.sh` locally when certificates are not detected, verifying ca.pem, ca-trusted.pem, and keystores are written directly to the certs volume
- [x] 4.3 Add `ENABLE_LETSENCRYPT` toggle to `tak-infra/start` defaulting to `false`, bypassing certbot background requests in offline/air-gapped operations
- [x] 4.4 Update `tak-infra/Dockerfile` to remove `awscli`, add local check for `takserver-docker-*.zip` in build context before attempting remote download, and remove legacy port 9000/9001 exposures

## 5. Garage S3 Synchronization & Auto-Enrollment QR Utility

- [x] 5.1 Implement `tak-infra/src/s3-sync.ts` using `@aws-sdk/client-s3` supporting custom endpoints and path-style addressing to sync `CoreConfig.xml` and certificates on startup
- [x] 5.2 Implement `tak-infra/bin/generate-enrollment.ts` to construct `enrollment.zip` (with `manifest.xml`, `server.pref`, and CA certificates) and `enrollment-qr.png`, uploading them to Garage S3 (`tak-server/enrollment/`)
- [x] 5.3 Implement `tak-infra/bin/show-qr.ts` (using `qrcode-terminal` or ANSI output) allowing operators to display the scannable enrollment QR code directly in the terminal
- [x] 5.4 Integrate `s3-sync.ts` and enrollment package generation into `tak-infra/start` lifecycle hooks

## 6. Docker Compose Orchestration & Verification

- [x] 6.1 Finalize `tak-infra/docker-compose.yml` defining the `tak-server` service with healthcheck dependency on `tak-db`, volume persistence, and attachment to `cloudtak-net` as an external network
- [x] 6.2 Validate complete stack configuration with `docker compose -f tak-infra/docker-compose.yml config` and verify port mappings (8089, 8443, 8446)
- [x] 6.3 Document deployment, volume persistence, QR pairing, and verification commands in `tak-infra/README.md` and TISCK deployment documentation
