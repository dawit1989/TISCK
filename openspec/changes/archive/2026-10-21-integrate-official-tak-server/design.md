# Design: Integrate Official TAK Server (tak-infra) into TISCK

## Context

See `proposal.md` for background and operational motivation. TISCK deploys CloudTAK (API, UI, PMTiles, PostGIS, MediaMTX, Authentik, and Garage S3) as an offline-first system. Upstream `tak-infra` packages TAK Server (takserver-docker-5.6) but is coupled to AWS CloudFormation, AWS Secrets Manager, AWS S3 Files POSIX storage, and mandatory LDAP with AWS Root CA fetches.

## Goals / Non-Goals

**Goals:**
- Provide a decoupled, self-hosted Docker Compose stack in `tak-infra/` that runs TAK Server 5.6 and an independent, dedicated PostGIS database (`tak-db`).
- Replace all AWS Secrets Manager and S3 Files logic with local volume persistence and automatic internal Root/Intermediate CA generation.
- Integrate with TISCK's deployed Garage S3 (`store:3900`) on `cloudtak-net` to synchronize `CoreConfig.xml`, certificates, and tactical mission packages.
- Support Authenticated Certificate Auto-Enrollment on port 8446 with immediate signing upon successful authentication against Authentik LDAP Outpost.
- Generate automated scannable QR codes and ATAK/WinTAK Data Packages (`enrollment.zip`) uploaded to Garage S3 and viewable in the terminal.
- Support air-gapped/offline Docker builds with local archive detection.

**Non-Goals:**
- Modifying CloudTAK core services or changing upstream CloudTAK API code.
- Merging the `tak-infra` services directly into `cloudtak/docker-compose.yml` (they remain intentionally decoupled).
- Deleting CloudFormation templates (preserved for upstream sync reference).

## Decisions

### 1. Decoupled Docker Compose Environment
- **Decision**: Standalone `tak-infra/docker-compose.yml` connected to an internal bridge network (`tak-net`) for database isolation and attached to `cloudtak-net` as an external network.
- **Rationale**: Isolates TAK Server lifecycles, avoids port collisions on PostgreSQL 5432, and keeps CloudTAK independently runnable.
- **Alternatives Considered**: 
  - *Merging into primary `cloudtak/docker-compose.yml`*: Rejected to avoid increasing base TISCK startup overhead for operators not using official TAK Server.

### 2. Dedicated Independent PostgreSQL (tak-db) Architecture
- **Decision**: Deploy an independent PostgreSQL container `tak-db` using `postgis/postgis:17-3.5` on the internal `tak-net` network, persisting data to `tak-db-data`.
  - **Readiness & Orchestration**: Define a `pg_isready` health check on `tak-db` and configure `tak-server` with `depends_on: { tak-db: { condition: service_healthy } }` so `SchemaManager.jar` only runs against a fully healthy database.
  - **Extensions Initialization**: Mount an initialization script (`/docker-entrypoint-initdb.d/init-tak-db.sql`) to enable `postgis` and `uuid-ossp` extensions automatically.
  - **High-Throughput Performance**: Configure `shm_size: 256m` and PostgreSQL command flags (`-c max_connections=200 -c shared_buffers=256MB`) tailored for high Cursor-on-Target write rates.
  - **Environment & URL Assembly**: Expose granular environment variables (`POSTGRES_HOST=tak-db`, `POSTGRES_PORT=5432`, `POSTGRES_DB=takserver`, `POSTGRES_USER=tak`, `POSTGRES_PASSWORD`), automatically assembling `PostgresURL` for `CoreConfig.ts` while allowing manual URL overrides.
- **Rationale**: Completely isolates TAK Server's high-frequency transactions and schema migrations from TISCK's PostGIS database (`gis`), eliminating cross-service interference and port conflicts on 5432.
- **Alternatives Considered**: 
  - *Sharing TISCK's existing PostGIS database*: Rejected due to schema migration conflicts, distinct permission models, and resource contention during high CoT throughput.

### 3. Local Volume Persistence & Auto CA Generation
- **Decision**: Persist `/opt/tak/certs` and `/opt/tak/data` via Docker named volumes or bind mounts. Modify `start` to detect existing CA files locally; if absent, invoke `makeRootCa.sh` and `makeCert.sh` locally without calling AWS Secrets Manager.
- **Rationale**: Completely removes `awscli` and Secrets Manager IAM dependencies while generating cryptographic trust chains on first boot.
- **Alternatives Considered**: 
  - *External secrets container (Vault)*: Rejected as unnecessary operational overhead for an air-gapped appliance.

### 4. Garage S3 Synchronization via Node.js
- **Decision**: Implement a lightweight synchronization script `s3-sync.ts` in `tak-infra/` using `@aws-sdk/client-s3` configured with `endpoint: AWS_S3_Endpoint`, `region: AWS_REGION`, and `forcePathStyle: true`.
- **Rationale**: Replaces AWS S3 Files POSIX mounting with S3 API sync for `CoreConfig.xml`, certificates, and `/opt/tak/data` mission packages. Seamlessly interfaces with TISCK's deployed Garage instance.
- **Alternatives Considered**: 
  - *FUSE mount (`s3fs-fuse`)*: Rejected due to container privilege requirements (`--cap-add SYS_ADMIN`) and instability in air-gapped environments.

### 5. Automated Garage Bucket Provisioning
- **Decision**: Update `cloudtak/scripts/init-garage.ps1` and `init-garage.sh` to create the `tak-server` bucket and bind read/write access to `cloudtak-key`.
- **Rationale**: Ensures Garage S3 is immediately ready to accept TAK Server configuration and packages during environment setup.
- **Alternatives Considered**: 
  - *Dedicated access key for TAK Server*: Rejected to keep credential management simple across TISCK.

### 6. Configurable Port Bindings & Conflict Prevention
- **Decision**: Expose TAK client ports (`8089` for CoT TLS, `8443` for Web UI, `8446` for Certs) on `0.0.0.0` with `.env` overrides. Bind bundled PostGIS to internal Docker network only (`tak-net`).
- **Rationale**: Prevents host port collisions with TISCK's PostGIS (5432) or Authentik (9000).

### 7. Authentik LDAP Integration & Group Mapping
- **Decision**: Enable Authentik's LDAP Outpost on `cloudtak-net` (`ldap://identity-ldap:389`). In `CoreConfig.ts`, point `auth.ldap` to `identity-ldap:389` using standard service credentials. Configure `roleAttribute: memberOf` so Authentik tactical groups map to TAK Server channels/missions automatically.
- **Rationale**: Provides unified single-sign-on and RBAC across CloudTAK web operators and ATAK field devices using the offline Authentik identity provider.
- **Alternatives Considered**: 
  - *Internal DB users only*: Rejected because user accounts would have to be redundantly maintained in both Authentik and TAK Server.

### 8. Authenticated Auto-Enrollment & Dual QR Code Provisioning
- **Decision**: Enable certificate auto-enrollment on connector port 8446 (`clientAuth="false"`). On container boot, execute a provisioning script that generates:
  1. An ATAK/WinTAK Data Package (`enrollment.zip`) with `manifest.xml`, server connection preferences (`server.pref` pointing to port 8089/8446), and CA certificates.
  2. A scannable QR code (`enrollment-qr.png`) encoding the enrollment manifest URL.
  3. Uploads both to Garage S3 (`tak-server/enrollment/`) and provides a CLI utility to print the QR code in ASCII format directly to the terminal.
- **Rationale**: Enables zero-touch device provisioning: operators can point their ATAK camera at the screen or terminal to immediately pair with the mesh network.

### 9. Hybrid Docker Image Build
- **Decision**: Update `Dockerfile` to check for `takserver-docker-*.zip` in the local build directory first before attempting remote download. Remove `awscli` installation.
- **Rationale**: Fully supports offline and air-gapped installations while preserving automated builds when connected.

## Risks / Trade-offs

- **[Risk] Multiple PostgreSQL containers running on host** → *Mitigation*: Ensure `tak-db` has no published host port bindings (`ports:` omitted, reachable only on `tak-net:5432`), guaranteeing zero conflict with TISCK's `postgis` container on host port `5432`.
- **[Risk] TAK Server initial schema migration latency** → *Mitigation*: Ensure `tak-db` has adequate shared memory (`shm_size: 256m`) and container health check verifies DB readiness with `pg_isready` before `tak-server` attempts `SchemaManager.jar upgrade`.
- **[Risk] Temporary Garage S3 unavailability** → *Mitigation*: Implement graceful fallback in `s3-sync.ts`: if Garage is unreachable, log warning and use local Docker volume configs directly.
- **[Risk] Port 9000 conflict with Authentik** → *Mitigation*: Remove legacy `EXPOSE 9000` / `9001` mappings from `tak-infra` Docker Compose since TAK Server 5.6 web interface operates on `8443`.
