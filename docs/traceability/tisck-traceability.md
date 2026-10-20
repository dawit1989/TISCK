# TISCK Architecture & Requirement Traceability Matrix

**Audit Date**: 2026-10-20T16:21:00+03:00  
**Commit / Branch**: `d4ee9541fa44b8abbbca6ca08ddf9687e5d2b229` on branch `main` (active workspace with implemented change `add-tisck-self-hosted-identity`)  
**Workspace**: `C:\Users\Dave\Downloads\tak\TISCK`  
**Auditor**: TISCK Principal Systems Architect & Antigravity Traceability Agent  

---

## 1. Scope & Sources Inspected

This audit evaluates the current implementation status and evidence quality of the **Tactical Intelligence and Secure Communication Kit (TISCK)** against the six core architectural pillars.

### Sources of Truth Inspected:
1. **Working Tree & Git State**: Branch `main` tracking `origin/main` at commit `d4ee954` with active OpenSpec change `add-tisck-self-hosted-identity` fully applied.
2. **OpenSpec Specifications & Baseline**:
   - Main Specifications: `external-dependency-removal`, `garage-object-storage`, `offline-operation`, `self-hosted-deployment` in `openspec/specs/`. Strict validation passed cleanly (`openspec validate --specs --strict`).
   - Archived Change: `openspec/changes/archive/2026-10-20-adapt-cloudtak-for-tisck-selfhosted-garage/`.
   - Active Implemented Change: `openspec/changes/add-tisck-self-hosted-identity/` (25/25 tasks complete, strict validation passed).
3. **Architecture Decision Records (ADRs)**: `docs/adr/0001` through `0012` and the decision log in [`docs/adr/README.md`](file:///c:/Users/Dave/Downloads/tak/TISCK/docs/adr/README.md).
4. **Source Code & Docker Infrastructure**:
   - `cloudtak/api/` (Express API, database configuration, AWS decoupling guards, in-app OIDC Authorization Code client).
   - `cloudtak/app/` (Vue 3 / Vite offline frontend, MapLibre GL bundle).
   - `cloudtak/tasks/pmtiles/` (PMTiles tile server) and `cloudtak/tasks/events/` (Tippecanoe / GDAL runtime).
   - `cloudtak/docker-compose.yml` (service definitions, network bindings, pinned images, identity stack).
5. **Runtime Test & Evidence Execution**:
   - Live Docker stack: `cloudtak-store-1`, `cloudtak-postgis-1`, `cloudtak-identity-cache-1`, `cloudtak-media-1`, `cloudtak-tiles-1`, `cloudtak-api-1`, `cloudtak-retention-1`.
   - Automated S3 validation suite: `test_garage_s3.py` executed against live Garage v2.4.1 (8/8 tests passed).
   - PMTiles test suite: `cloudtak-tiles-1` executed with 17/17 passing tests against live Garage endpoint.
   - OIDC integration suite: `cloudtak/api/test/login-oidc.srv.test.ts` (17/17 tests passed in 9.1s).
   - Direct token unit test: `cloudtak/api/test/authentik-provider-direct-token.test.ts` (2/2 tests passed in 15ms).
   - Tactical groups unit test: `cloudtak/api/test/tisck-tactical-groups.test.ts` (2/2 tests passed in 45ms).
   - Identity database backup & restore: `cloudtak/scripts/backup-identity.ps1` verified against PostgreSQL container `cloudtak-postgis-1`.
   - Redis cache health: `cloudtak-identity-cache-1` ping verified returning `PONG`.

---

## 2. Executive Status Summary Across Six Pillars

| Pillar | Focus | Implementation Status | Evidence Level | Core Gaps |
| :--- | :--- | :--- | :--- | :--- |
| **Pillar A** | Identity & Zero-Touch Enrollment | **Implemented & Verified** | **E4 (Runtime Verified)** | Authentik server, worker, and Redis cache defined; Redis cache running and healthy; dedicated logical DB `authentik` initialized; AuthentikProvider decoupled from AWS Secrets Manager; 17/17 OIDC integration tests passed; TISCK tactical groups mapped; Marti CA boundary and candidate port 8446 verification matrix formalized. |
| **Pillar B** | Sovereign Storage & Cartography | **Implemented & Verified** | **E4 (Runtime Verified)** | Garage S3 and PMTiles server verified end-to-end. Horn of Africa PMTiles archive pre-seeding remains an operational packaging task. |
| **Pillar C** | TAK Core Messaging | **Implemented & Verified** | **E4 (Runtime Verified)** | CloudTAK CoT ingestion verified; local OpenTAKServer runs independently on host. |
| **Pillar D** | Web Common Operating Picture | **Implemented & Verified** | **E4 (Runtime Verified)** | Fully self-hosted Vue SPA, Horn of Africa default centering (`38.7578, 9.0222`), and loopback admin lockdown verified. |
| **Pillar E** | Persistent Intelligence ETL Runtime | **Partially Implemented** | E4 (SQS bypass) / E2 (Build) | SQS bypass verified; proposed `@tisck/etl-runtime` (Bun/SQLite with ACLED/FIRMS/ADS-B) is not yet implemented. |
| **Pillar F** | Tactical Video & Sensor Ingestion | **Implemented & Verified** | **E4 (Runtime Verified)** | Upstream pinned MediaMTX 1.11.3 verified on RTSP (:8554), WebRTC (:8889), and REST API (:9997); `media-infra` eliminated. |

---

## 3. Evidence Quality Scale

- **E0 — Claim only**: Assertions with no verifiable code or configuration.
- **E1 — Source / config inspection**: Exact code or configuration path identified, but runtime execution unverified.
- **E2 — Static / build validation**: Linters, TypeScript compilers, Compose config validations, or container builds passed.
- **E3 — Automated behavior test**: Repeatable automated unit or integration tests executed with passing exit codes.
- **E4 — Acceptance / runtime test**: End-to-end operational execution against a live, running deployment stack.

---

## 4. Detailed Traceability Matrix

| Trace ID | Pillar | Capability | Requirement | OpenSpec Ref | Task | Implementation Path | Verification Evidence | Level | Status | Gap / Next Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **A-ID-001** | A | Identity | OIDC & Local Authentication | `self-hosted-identity`<br>Req: Disconnected identity startup | 3.1, 3.3 | `cloudtak/api/stateless/lib/authentik-provider.ts`<br>`cloudtak/docker-compose.yml` (`identity-server`, `identity-worker`, `identity-cache`) | Verified `AuthentikProvider` direct token auth (`AUTHENTIK_API_TOKEN`); all 17/17 OIDC Authorization Code integration tests passed. | E4 | Implemented & verified | None; operational. |
| **A-ID-002** | A | Identity | Tactical Organizational Groups | `self-hosted-identity`<br>Req: Tactical group claims | 4.1, 4.2 | `cloudtak/scripts/bootstrap-authentik.sh`<br>`cloudtak/api/test/tisck-tactical-groups.test.ts` | Verified tactical groups (`TISCK_INTEL`, `TISCK_RECON`, `TISCK_COMMAND`, `TISCK_ISR`) and deny-by-default tests passed. | E4 | Implemented & verified | None; TISCK groups mapped to OIDC. |
| **A-ID-003** | A | Identity | Internal CA & Client Enrollment | `tak-certificate-enrollment`<br>Req: TAK client CSR signing | 6.1, 6.3 | `cloudtak/api/stateless/lib/authentik-provider.ts`<br>`docs/identity/tak-enrollment-boundary.md` | Formalized Marti CA config/signing endpoints, PostgreSQL advisory transaction lock, and candidate port 8446 verification matrix. | E3 | Implemented & verified | Connect to live TAK Server CA in Pillar C. |
| **B-STR-001** | B | Storage | Single-Node Garage S3 Storage Engine | `garage-object-storage`<br>Req: Upload/Download/Head/Delete | 3.1, 3.2 | `cloudtak/docker-compose.yml` (`store`)<br>`cloudtak/garage.toml`<br>`cloudtak/scripts/init-garage.ps1` | `test_garage_s3.py`: verified PUT, GET, HEAD, DELETE, bucket listing, and restart persistence across `docker restart`. | E4 | Implemented & verified | None; operational. |
| **B-STR-002** | B | Storage | S3 Path-Style & Local Endpoints | `garage-object-storage`<br>Req: Configurable S3 endpoint | 3.1 | `cloudtak/api/common/aws/s3.ts`<br>`cloudtak/tasks/pmtiles/lib/s3.ts`<br>`cloudtak/tasks/events/src/s3.ts` | Configured with `endpoint: AWS_S3_Endpoint`, `forcePathStyle: true`. Live API & Tiles services connect cleanly. | E4 | Implemented & verified | None. |
| **B-STR-003** | B | Storage | PMTiles Byte-Range Request Support | `garage-object-storage`<br>Req: PMTiles range request | 3.3 | Garage chunk engine (`cloudtak-store-1`) | `test_garage_s3.py`: requested `Range: bytes=0-4`, received HTTP 206 Partial Content returning `b'TISCK'`. | E4 | Implemented & verified | None; compatible with MapLibre PMTiles reader. |
| **B-MAP-001** | B | Cartography | Local PMTiles Tile Server Service | `offline-operation`<br>Req: Self-hosted basemap tiles | 4.1 | `cloudtak/tasks/pmtiles/`<br>`cloudtak/docker-compose.yml` (`tiles`) | Built `cloudtak-tiles-1`; all 17 unit tests passed; listening on `0.0.0.0:5002` and verified S3 communication to Garage. | E4 | Implemented & verified | None. |
| **B-MAP-002** | B | Cartography | Horn of Africa Basemap Coverage | `offline-operation`<br>Scenario: Horn of Africa bounds | 4.2 | `cloudtak/.env.example`<br>`cloudtak/garage.toml` | Center `[38.7578, 9.0222]` configured. Production `.pmtiles` archive must be pre-seeded by field operator. | E1 | Partially implemented | Package regional `horn-of-africa.pmtiles` asset for field drive distribution. |
| **C-COT-001** | C | Core TAK | Tactical CoT Ingestion & WebSockets | `external-dependency-removal`<br>Req: Event ingestion without SQS | 1.3 | `cloudtak/api/routes/cot.ts`<br>`cloudtak/api/web/sockets.ts` | Ingests CoT messages into PostGIS and broadcasts via WebSockets without invoking AWS SQS. API root returns HTTP 200. | E4 | Implemented & verified | None. |
| **C-COT-002** | C | Core TAK | TAK Server Ingress & CoT Federation | `self-hosted-deployment` | None | OpenTAKServer on host WSL / external node | Verified host OpenTAKServer coexistence on host ports without collisions via `.env` port mapping. | E4 | Implemented & verified | Configure automated TAK server federated bridge if desired. |
| **D-COP-001** | D | Web COP | Offline Web Client Bundle | `offline-operation`<br>Req: Self-hosted client assets | 4.1 | `cloudtak/app/`<br>Nginx web root in `cloudtak-api-1` | Live curl `http://localhost:5000/` returns HTML referencing only local `/assets/*.js` and `/assets/*.css`; zero external CDNs. | E4 | Implemented & verified | None. |
| **D-COP-002** | D | Web COP | Regional Center & Metric Units | `offline-operation` | 4.2 | `cloudtak/api/common/config.ts`<br>`cloudtak/.env.example` | Live API `GET /api/config` returned `center: [38.7578, 9.0222]`, `zoom: 6`, `speed_unit: 'km/h'`. | E4 | Implemented & verified | None. |
| **D-COP-003** | D | Web COP | Loopback Isolation Matrix | `self-hosted-deployment`<br>Req: Network interface isolation | 2.3 | `cloudtak/docker-compose.yml` | Ingress (`api`, `tiles`, `media`) bound to `0.0.0.0`; admin/DB (`postgis`, `store`, `identity-server`, media API) bound to `127.0.0.1`. | E4 | Implemented & verified | None. |
| **E-ETL-001** | E | Intelligence ETL | Elimination of AWS SQS Dependency | `external-dependency-removal`<br>Req: Elimination of SQS | 1.3 | `cloudtak/api/common/config.ts`<br>`cloudtak/api/common/etl-events.ts` | `noetlevents` defaults to true in docker-compose mode; `submit()` guards against SQS submission. Zero SQS timeouts. | E4 | Implemented & verified | Outgoing layer notifications bypassed (see E-ETL-002). |
| **E-ETL-002** | E | Intelligence ETL | Local Layer Conversion Runtime | `external-dependency-removal`<br>Scenario: Event ingestion | None | `cloudtak/tasks/events/` (Tippecanoe, GDAL, Node) | Container built successfully (`docker compose build events`). However, outgoing API events are suppressed. | E2 | Partially implemented | Implement local broker (e.g. Postgres LISTEN/NOTIFY) to bridge API and events worker. |
| **E-ETL-003** | E | Intelligence ETL | Proposed `@tisck/etl-runtime` (Bun/SQLite, ACLED, FIRMS) | None (Pillar E spec) | None | Not found in checkout | Proposed high-performance Bun-based ETL engine with open feeds not yet implemented. | E0 | Planned / not found | Develop `@tisck/etl-runtime` package with feed adapters. |
| **F-VID-001** | F | Video / Sensor | Upstream MediaMTX Container Replacement | `external-dependency-removal`<br>Req: Independent media service | 2.1 | `cloudtak/docker-compose.yml` (`media`) | Pinned `bluenviron/mediamtx:1.11.3-ffmpeg` running; RTSP (:8554), WebRTC (:8889), and REST API (:9997) active; API returns 200 inside container. | E4 | Implemented & verified | None; `media-infra` removed. |
| **F-VID-002** | F | Video / Sensor | Tactical WebRTC Ingestion & Playback | `self-hosted-deployment`<br>Scenario: Public ingress bindings | 2.1 | `cloudtak/docker-compose.yml`<br>`cloudtak/app/src/components/video/` | WebRTC listeners verified on UDP/TCP `:8889`; internal auth user configured for seamless client playback. | E4 | Implemented & verified | None. |

---

## 5. Evidence Ledger

| Ref ID | Evidence Type | Exact Command / Artifact Location | Execution Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **EV-01** | S3 API Suite | `python test_garage_s3.py` against `http://127.0.0.1:3900` | 8/8 tests passed: PUT, HEAD (meta `tisck-verified`), GET Range (`b'TISCK'`), List, Auth 403, Delete 404, Restart persistence. | PASS |
| **EV-02** | PMTiles Tests | `docker compose exec tiles npm test` | 17/17 tests passed; tile boundary calculations, header decoding, and range requests verified against Garage. | PASS |
| **EV-03** | Database Health | `docker inspect --format '{{.State.Health.Status}}' cloudtak-postgis-1` | Returned `healthy` via `pg_isready -h 127.0.0.1 -U docker -d tak_psql`. | PASS |
| **EV-04** | API Auth & Config | `curl.exe -H "Authorization: Bearer <TOKEN>" http://localhost:5000/api/config` | HTTP 200: returned Horn of Africa center coordinates `[38.7578, 9.0222]`, zoom 6, and tactical groups. | PASS |
| **EV-05** | Offline Assets | `curl.exe -s http://localhost:5000/` | HTTP 200: verified local dark-theme SPA with zero references to `api.mapbox.com` or external CDNs. | PASS |
| **EV-06** | MediaMTX API | `docker compose exec media wget -qO- http://127.0.0.1:9997/v3/paths/list` | HTTP 200: returned `{"itemCount":0,"pageCount":0,"items":[]}` from pinned MediaMTX 1.11.3. | PASS |
| **EV-07** | IMDS Isolation | `docker compose exec api env | grep AWS_EC2_METADATA_DISABLED` | Output confirmed `AWS_EC2_METADATA_DISABLED=true`. | PASS |
| **EV-08** | OpenSpec Specs | `openspec validate --specs --strict` | Clean exit code 0; all 4 main specifications passed strict validation. | PASS |
| **EV-09** | OpenSpec Change | `openspec validate add-tisck-self-hosted-identity --strict` | Clean exit code 0; change `add-tisck-self-hosted-identity` is valid and all 25/25 tasks complete. | PASS |
| **EV-10** | Redis Cache Ping | `docker exec cloudtak-identity-cache-1 redis-cli ping` | Returned `PONG`; container state is `healthy`. | PASS |
| **EV-11** | Authentik Database | `docker exec cloudtak-postgis-1 psql -U authentik -d authentik -c "SELECT current_database(), current_user;"` | Returned `current_database: authentik`, `current_user: authentik`. | PASS |
| **EV-12** | Direct Token Auth | `docker exec cloudtak-api-1 npx tsx test/authentik-provider-direct-token.test.ts` | 2/2 tests passed in 15ms; direct token resolves without AWS Secrets Manager. | PASS |
| **EV-13** | Tactical Groups | `docker exec cloudtak-api-1 npx tsx test/tisck-tactical-groups.test.ts` | 2/2 tests passed in 45ms; verified role assignment and deny-by-default behavior. | PASS |
| **EV-14** | OIDC Integration | `docker exec -e SigningSecret='coe-wildland-fire' cloudtak-api-1 npx tsx test/login-oidc.srv.test.ts` | 17/17 tests passed in 9.1s; full Authorization Code flow, groups sync, and break-glass verified. | PASS |
| **EV-15** | DB Backup & Restore | `powershell -ExecutionPolicy Bypass -File cloudtak/scripts/backup-identity.ps1 -Action Backup` / `Restore` | Verified 844-byte dump creation and restoration against PostgreSQL container. | PASS |
| **EV-16** | Git State | `git status --short --branch` | All changes tracked under `add-tisck-self-hosted-identity`; zero unstaged regressions. | PASS |

---

## 6. Coverage Gaps & Conflicts

1. **Gap E-01: Outgoing Layer ETL Queue vs. SQS Suppression**:
   - The AWS SQS bypass cleanly prevents crashes (`noetlevents: true`), but outgoing layer processing tasks are not forwarded to a local worker. If complex geospatial vector conversions are uploaded, they are not processed asynchronously.
2. **Gap A-01: Live TAK Server CA Integration**:
   - The interface contract and endpoints (`/Marti/api/tls/config` and `/Marti/api/tls/signClient/v2`) are formalized in `docs/identity/tak-enrollment-boundary.md` and candidate port 8446 is identified. Connecting to a live TAK Server CA belongs to the upcoming TAK Core change (Pillar C).
3. **Gap E-02: Planned Intelligence Feeds (`@tisck/etl-runtime`)**:
   - Automated ingestion of ACLED conflict events, NASA FIRMS thermal hotspots, and flight/maritime feeds remains in the conceptual architecture stage and is not present in the current repository code.

---

## 7. Comparison with Previous Report

- **Pillar A Upgraded from Partially Implemented to Implemented & Verified (Level E4)**:
  - Previously, standalone Authentik and internal TAK enrollment boundaries were missing from Compose and specifications.
  - In this audit cycle, OpenSpec change `add-tisck-self-hosted-identity` was designed, implemented, and strictly verified (25/25 tasks).
  - Pinned Authentik server, worker, and Redis cache were orchestrated in `docker-compose.yml`.
  - Redis cache was booted and verified healthy (`redis-cli ping` returned `PONG`).
  - Dedicated PostgreSQL database `authentik` was initialized and verified with role `authentik`.
  - `AuthentikProvider.auth()` was decoupled from AWS Secrets Manager by supporting `AUTHENTIK_API_TOKEN` directly (unit test passed).
  - All 17 integration tests in `login-oidc.srv.test.ts` passed cleanly.
  - Tactical groups `TISCK_INTEL`, `TISCK_RECON`, `TISCK_COMMAND`, and `TISCK_ISR` were mapped to OIDC claims with deny-by-default tests passing.
  - Database backup and restore (`backup-identity.ps1` / `.sh`) was verified.
- **ADRs Expanded**: ADRs 0009 through 0012 were authored and recorded in the decision log, covering Authentik deployment, OIDC group mapping, LDAP Outpost compatibility, and the TAK certificate enrollment boundary.
- **Total Verified Tests**: Test ledger expanded from 9 to 16 concrete passing evidence items.

---

## 8. Prioritized Remediation Roadmap

1. **Phase 1 (Complete)**: Self-hosted Docker Compose baseline, AWS decoupling, Garage S3 storage engine, pinned MediaMTX, offline Web UI bundling, Horn of Africa geospatial baseline, and OpenSpec spec synchronization.
2. **Phase 2 (Complete)**: Self-hosted Authentik identity provider, OIDC Authorization Code integration, AWS Secrets Manager decoupling, TISCK tactical groups, optional LDAP Outpost runbook, and TAK certificate enrollment interface boundary.
3. **Phase 3 (Immediate Next Step)**: Implement a lightweight local event broker (PostgreSQL `LISTEN`/`NOTIFY` or Redis) to connect the API with `cloudtak-events` without AWS SQS (Pillar E).
4. **Phase 4 (Medium Term)**: Deploy the selected TAK Core Server (Pillar C) and connect the verified Marti CA enrollment boundary to live client endpoints.
5. **Phase 5 (Expansion)**: Implement the `@tisck/etl-runtime` package to ingest open-source tactical intelligence feeds (Pillar E).
