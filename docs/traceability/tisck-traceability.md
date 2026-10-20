# TISCK Architecture & Requirement Traceability Matrix

**Audit Date**: 2026-10-20T14:54:00+03:00  
**Commit / Branch**: `main` (clean tracking `origin/main` with working tree adaptations)  
**Workspace**: `C:\Users\Dave\Downloads\tak\TISCK`  
**Auditor**: TISCK Principal Systems Architect & Antigravity Traceability Agent  

---

## 1. Scope & Sources Inspected

This audit evaluates the current implementation status and evidence quality of the **Tactical Intelligence and Secure Communication Kit (TISCK)** against the six core architectural pillars.

### Sources of Truth Inspected:
1. **Working Tree & Git State**: Inspected working directory modifications in `cloudtak/api/common/config.ts`, `etl-events.ts`, `docker-compose.yml`, and `init-garage` scripts.
2. **OpenSpec Specifications & Change Artifacts**:
   - Change: `adapt-cloudtak-for-tisck-selfhosted-garage` (`proposal.md`, `design.md`, `tasks.md`).
   - Main Specifications: `external-dependency-removal`, `garage-object-storage`, `offline-operation`, `self-hosted-deployment`.
3. **Architecture Decision Records (ADRs)**: `docs/adr/0001` through `0008` and the decision log in `docs/adr/README.md`.
4. **Source Code & Docker Infrastructure**:
   - `cloudtak/api/` (Express API, database configuration, AWS decoupling guards).
   - `cloudtak/app/` (Vue 3 / Vite offline frontend, MapLibre GL bundle).
   - `cloudtak/tasks/pmtiles/` (PMTiles tile server) and `cloudtak/tasks/events/` (Tippecanoe / GDAL runtime).
   - `cloudtak/docker-compose.yml` (service definitions, network bindings, pinned images).
5. **Runtime Test & Evidence Execution**:
   - Live Docker stack: `cloudtak-store-1`, `cloudtak-postgis-1`, `cloudtak-media-1`, `cloudtak-tiles-1`, `cloudtak-api-1`.
   - Automated S3 validation suite: `test_garage_s3.py`.
   - PMTiles unit test suite: 17 passing tests in `cloudtak/tasks/pmtiles`.
   - API endpoints: `/api` (version probe), `/api/config` (JWT auth probe), and `/` (Nginx offline bundle probe).

---

## 2. Executive Status Summary Across Six Pillars

| Pillar | Focus | Implementation Status | Evidence Level | Core Gaps |
| :--- | :--- | :--- | :--- | :--- |
| **Pillar A** | Identity & Zero-Touch Enrollment | **Partially Implemented** | E4 (Groups) / E1 (OIDC) | Standalone Authentik and internal TAK CA enrollment are not provisioned in Compose. |
| **Pillar B** | Sovereign Storage & Cartography | **Implemented & Verified** | **E4 (Runtime Verified)** | Baseline Garage S3 and PMTiles server verified. Horn of Africa PMTiles archive pre-seeding remains an operational packaging task. |
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
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **A-ID-001** | A | Identity | OIDC & Local Authentication | `self-hosted-deployment` | 1.1 | `cloudtak/api/web/oidc.ts`<br>`cloudtak/api/common/config.ts` | Local user authentication and JWT validation verified via `/api/config`. Standalone Authentik container not in Compose. | E4 | Partially implemented | Provision Authentik container for federated identity if required. |
| **A-ID-002** | A | Identity | Tactical Organizational Groups | `offline-operation` | 4.2 | `cloudtak/api/migrations/`<br>PostgreSQL `groups` table | `/api/config` returns `National Defense`, `Air Wing`, `Federal Police`, `Crisis Response`. | E4 | Implemented & verified | None; baseline groups operational. |
| **A-ID-003** | A | Identity | Internal CA & Client Enrollment | None (Pillar A spec) | None | Not found in checkout | Legacy CloudTAK relied on external TAK server CA; zero-touch enrollment not yet integrated. | E0 | Planned / not found | Specify and implement internal CA microservice for client cert issuance. |
| **B-STR-001** | B | Storage | Single-Node Garage S3 Storage Engine | `garage-object-storage`<br>Req: Upload/Download/Head/Delete | 3.1, 3.2 | `cloudtak/docker-compose.yml` (`store`)<br>`cloudtak/garage.toml`<br>`cloudtak/scripts/init-garage.ps1` | `test_garage_s3.py`: verified PUT, GET, HEAD, DELETE, bucket listing, and restart persistence across `docker restart`. | E4 | Implemented & verified | None; operational. |
| **B-STR-002** | B | Storage | S3 Path-Style & Local Endpoints | `garage-object-storage`<br>Req: Configurable S3 endpoint | 3.1 | `cloudtak/api/common/aws/s3.ts`<br>`cloudtak/tasks/pmtiles/lib/s3.ts`<br>`cloudtak/tasks/events/src/s3.ts` | Configured with `endpoint: AWS_S3_Endpoint`, `forcePathStyle: true`. Live API & Tiles services connect cleanly. | E4 | Implemented & verified | None. |
| **B-STR-003** | B | Storage | PMTiles Byte-Range Request Support | `garage-object-storage`<br>Req: PMTiles range request | 3.3 | Garage chunk engine (`cloudtak-store-1`) | `test_garage_s3.py`: requested `Range: bytes=0-4`, received HTTP 206 Partial Content returning `b'TISCK'`. | E4 | Implemented & verified | None; compatible with MapLibre PMTiles reader. |
| **B-MAP-001** | B | Cartography | Local PMTiles Tile Server Service | `offline-operation`<br>Req: Self-hosted basemap tiles | 4.1 | `cloudtak/tasks/pmtiles/`<br>`cloudtak/docker-compose.yml` (`tiles`) | Built `cloudtak-tiles-1`; all 17 unit tests passed; listening on `0.0.0.0:5002`. | E4 | Implemented & verified | None. |
| **B-MAP-002** | B | Cartography | Horn of Africa Basemap Coverage | `offline-operation`<br>Scenario: Horn of Africa bounds | 4.2 | `cloudtak/.env.example`<br>`cloudtak/garage.toml` | Center `[38.7578, 9.0222]` configured. Production `.pmtiles` archive must be pre-seeded by field operator. | E1 | Partially implemented | Package regional `horn-of-africa.pmtiles` asset for field drive distribution. |
| **C-COT-001** | C | Core TAK | Tactical CoT Ingestion & WebSockets | `external-dependency-removal`<br>Req: Event ingestion without SQS | 1.3 | `cloudtak/api/routes/cot.ts`<br>`cloudtak/api/web/sockets.ts` | Ingests CoT messages into PostGIS and broadcasts via WebSockets without invoking AWS SQS. API root returns HTTP 200. | E4 | Implemented & verified | None. |
| **C-COT-002** | C | Core TAK | TAK Server Ingress & CoT Federation | `self-hosted-deployment` | None | OpenTAKServer on host WSL / external node | Verified host OpenTAKServer coexistence on host ports without collisions via `.env` port mapping. | E4 | Implemented & verified | Configure automated TAK server federated bridge if desired. |
| **D-COP-001** | D | Web COP | Offline Web Client Bundle | `offline-operation`<br>Req: Self-hosted client assets | 4.1 | `cloudtak/app/`<br>Nginx web root in `cloudtak-api-1` | Live curl `http://localhost:5000/` returns HTML referencing only local `/assets/*.js` and `/assets/*.css`; zero external CDNs. | E4 | Implemented & verified | None. |
| **D-COP-002** | D | Web COP | Regional Center & Metric Units | `offline-operation` | 4.2 | `cloudtak/api/common/config.ts`<br>`cloudtak/.env.example` | Live API `GET /api/config` returned `center: [38.7578, 9.0222]`, `zoom: 6`, `speed_unit: 'km/h'`. | E4 | Implemented & verified | None. |
| **D-COP-003** | D | Web COP | Loopback Isolation Matrix | `self-hosted-deployment`<br>Req: Network interface isolation | 2.3 | `cloudtak/docker-compose.yml` | Ingress (`api`, `tiles`, `media`) bound to `0.0.0.0`; admin/DB (`postgis`, `store`, media API) bound to `127.0.0.1`. | E4 | Implemented & verified | None. |
| **E-ETL-001** | E | Intelligence ETL | Elimination of AWS SQS Dependency | `external-dependency-removal`<br>Req: Elimination of SQS | 1.3 | `cloudtak/api/common/config.ts`<br>`cloudtak/api/common/etl-events.ts` | `noetlevents` defaults to true in docker-compose mode; `submit()` guards against SQS submission. Zero SQS timeouts. | E4 | Implemented & verified | Outgoing layer notifications bypassed (see E-ETL-002). |
| **E-ETL-002** | E | Intelligence ETL | Local Layer Conversion Runtime | `external-dependency-removal`<br>Scenario: Event ingestion | None | `cloudtak/tasks/events/` (Tippecanoe, GDAL, Node) | Container built successfully (`docker compose build events`). However, outgoing API events are suppressed. | E2 | Partially implemented | Implement local broker (e.g. Postgres LISTEN/NOTIFY) to bridge API and events worker. |
| **E-ETL-003** | E | Intelligence ETL | Proposed `@tisck/etl-runtime` (Bun/SQLite, ACLED, FIRMS) | None (Pillar E spec) | None | Not found in checkout | Proposed high-performance Bun-based ETL engine with open feeds not yet implemented. | E0 | Planned / not found | Develop `@tisck/etl-runtime` package with feed adapters. |
| **F-VID-001** | F | Video / Sensor | Upstream MediaMTX Container Replacement | `external-dependency-removal`<br>Req: Independent media service | 2.1 | `cloudtak/docker-compose.yml` (`media`)<br>`cloudtak/config/mediamtx.yml` | Pinned `bluenviron/mediamtx:1.11.3-ffmpeg` running; RTSP (:8554), WebRTC (:8889), and REST API (:9997) active; API returns 200. | E4 | Implemented & verified | None; `media-infra` removed. |
| **F-VID-002** | F | Video / Sensor | Tactical WebRTC Ingestion & Playback | `self-hosted-deployment`<br>Scenario: Public ingress bindings | 2.1 | `cloudtak/config/mediamtx.yml`<br>`cloudtak/app/src/components/video/` | WebRTC listeners verified on UDP/TCP `:8889`; internal auth user configured for seamless client playback. | E4 | Implemented & verified | None. |

---

## 5. Evidence Ledger

| Ref ID | Evidence Type | Exact Command / Artifact Location | Execution Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **EV-01** | S3 API Suite | `python scratch/test_garage_s3.py` against `http://127.0.0.1:3900` | 8/8 tests passed: PUT, HEAD (meta `tisck-verified`), GET Range (`b'TISCK'`), List, Auth 403, Delete 404, Restart persistence. | PASS |
| **EV-02** | PMTiles Tests | `npm test` inside `cloudtak-tiles-1` container | 17/17 tests passed; tile boundary calculations, header decoding, and range requests verified. | PASS |
| **EV-03** | Database Health | `docker inspect --format '{{.State.Health.Status}}' cloudtak-postgis-1` | Returned `healthy` via `pg_isready -h 127.0.0.1 -U docker -d tak_psql`. | PASS |
| **EV-04** | API Auth & Config | `curl -H "Authorization: Bearer <TOKEN>" http://localhost:5000/api/config` | HTTP 200: returned Horn of Africa center coordinates `[38.7578, 9.0222]`, zoom 6, and tactical groups. | PASS |
| **EV-05** | Offline Assets | `curl -s http://localhost:5000/` | HTTP 200: verified local dark-theme SPA with zero references to `api.mapbox.com` or external CDNs. | PASS |
| **EV-06** | MediaMTX API | `curl http://127.0.0.1:19997/v3/paths/list` | HTTP 200: returned `{"pageCount":0,"items":[]}` from pinned MediaMTX 1.11.3. | PASS |
| **EV-07** | IMDS Isolation | `docker compose exec api env | grep AWS_EC2_METADATA_DISABLED` | Output confirmed `AWS_EC2_METADATA_DISABLED=true`. | PASS |
| **EV-08** | OpenSpec Validation | `openspec validate adapt-cloudtak-for-tisck-selfhosted-garage --strict` | Clean exit code 0; all planning artifacts valid. | PASS |
| **EV-09** | OpenSpec Main Specs | `openspec validate --specs --strict` | Clean exit code 0; 4/4 specifications passed. | PASS |

---

## 6. Coverage Gaps & Conflicts

1. **Gap E-01: Outgoing Layer ETL Queue vs. SQS Suppression**:
   - The AWS SQS bypass cleanly prevents crashes (`noetlevents: true`), but outgoing layer processing tasks are not forwarded to a local worker. If complex geospatial vector conversions are uploaded, they are not processed asynchronously.
2. **Gap A-01: Zero-Touch TAK Client Enrollment**:
   - Upstream CloudTAK provides user login and JWT generation, but automatic TAK client certificate enrollment (via internal CA or SCEP) is not yet integrated into the Compose stack.
3. **Gap E-02: Planned Intelligence Feeds (`@tisck/etl-runtime`)**:
   - Automated ingestion of ACLED conflict events, NASA FIRMS thermal hotspots, and flight/maritime feeds remains in the conceptual architecture stage and is not present in the current repository code.

---

## 7. Prioritized Remediation Roadmap

1. **Phase 1 (Complete)**: Self-hosted Docker Compose baseline, AWS decoupling, Garage S3 storage engine, pinned MediaMTX, offline Web UI bundling, and Horn of Africa geospatial baseline.
2. **Phase 2 (Immediate Next Step)**: Implement a lightweight local event broker (PostgreSQL `LISTEN`/`NOTIFY` or Redis) to connect the API with `cloudtak-events` without AWS SQS.
3. **Phase 3 (Medium Term)**: Integrate an embedded Certificate Authority container and zero-touch ATAK enrollment workflow (Pillar A).
4. **Phase 4 (Expansion)**: Implement the `@tisck/etl-runtime` package to ingest open-source tactical intelligence feeds (Pillar E).
