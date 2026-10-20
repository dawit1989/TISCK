# TISCK Architecture Decision Records (ADRs)

This directory documents the architectural decisions made for the **Tactical Intelligence and Secure Communication Kit (TISCK)**, adapting CloudTAK into an offline-first, self-hosted deployment for field operations in Ethiopia and the Horn of Africa.

## Decision Log

| ADR | Title | Status | Linked OpenSpec Change / Capability | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- |
| [0001](0001-aws-runtime-decoupling.md) | AWS Runtime Decoupling (SecretsManager, STS, IMDS) | **Accepted** | `adapt-cloudtak-for-tisck-selfhosted-garage`<br>• `external-dependency-removal`<br>• `self-hosted-deployment` | Live container boot logs verify 0 calls to SecretsManager/STS; `SigningSecret` validated; `AWS_EC2_METADATA_DISABLED=true` verified. |
| [0002](0002-upstream-mediamtx-video-streaming.md) | Upstream MediaMTX Container for Tactical Video | **Accepted** | `adapt-cloudtak-for-tisck-selfhosted-garage`<br>• `external-dependency-removal`<br>• `self-hosted-deployment` | Pinned `bluenviron/mediamtx:1.11.3-ffmpeg` running in Docker; API (:9997) and RTSP (:8554) listeners verified. |
| [0003](0003-garage-s3-object-storage.md) | Single-Node Garage S3 Storage Engine | **Accepted** | `adapt-cloudtak-for-tisck-selfhosted-garage`<br>• `garage-object-storage` | Full live S3 test suite (`test_garage_s3.py`) passed: PUT, GET, HEAD, 206 Range requests, List, Auth failure, Delete, and Restart persistence. |
| [0004](0004-outgoing-etl-event-queue-bypass.md) | Outgoing ETL Event Queue Bypass & Local Delivery Gap | **Partially Implemented** | `adapt-cloudtak-for-tisck-selfhosted-garage`<br>• `external-dependency-removal` | AWS SQS bypass via `noetlevents: true` verified (prevents crash), but local in-memory/EventEmitter delivery broker is **Proposed / Unimplemented**. |
| [0005](0005-offline-geospatial-assets-and-pmtiles.md) | Offline Geospatial Asset Bundling & PMTiles Basemaps | **Partially Implemented** | `adapt-cloudtak-for-tisck-selfhosted-garage`<br>• `offline-operation` | Local web asset bundling verified (0 external CDN requests); PMTiles container verified on :5002; field basemap `.pmtiles` archive pre-seeding is **Proposed**. |
| [0006](0006-network-interface-and-port-binding-matrix.md) | Dual Network Interface & Port Binding Isolation | **Accepted** | `adapt-cloudtak-for-tisck-selfhosted-garage`<br>• `self-hosted-deployment` | Netstat & Docker port inspect verified `0.0.0.0` for tactical ingress and `127.0.0.1` for internal/admin services. Host port conflicts mitigated via `.env`. |
| [0007](0007-self-contained-docker-compose-deployment.md) | Self-Contained Docker Compose Deployment | **Accepted** | `adapt-cloudtak-for-tisck-selfhosted-garage`<br>• `self-hosted-deployment` | Single `docker compose up -d` boots all 7 core services without external `auth-infra`, `tak-infra`, or `media-infra` repositories. |
| [0008](0008-horn-of-africa-geospatial-baseline-and-tactical-groups.md) | Horn of Africa Baseline & Tactical Groups | **Accepted** | `adapt-cloudtak-for-tisck-selfhosted-garage`<br>• `offline-operation` | Live API query (`GET /api/config`) verified center `[38.7578, 9.0222]`, zoom `6`, metric speed units (`km/h`), and database groups populated. |

---

## Status Definitions

- **Accepted**: Decision is finalized, fully implemented in source code, and verified by empirical runtime test execution.
- **Partially Implemented**: Architectural direction is agreed upon and initial blocking issues resolved (e.g. cloud crash prevented), but runtime capabilities remain incomplete or unverified.
- **Proposed**: Decision is under review or planned for future implementation; no runtime verification exists.
- **Superseded**: Replaced by a subsequent decision.
- **Rejected**: Considered but declined.

---

## OpenSpec Traceability

All ADRs in this directory directly map to the OpenSpec change:
- **Change ID**: `adapt-cloudtak-for-tisck-selfhosted-garage`
- **Location**: `openspec/changes/adapt-cloudtak-for-tisck-selfhosted-garage/`
- **Specifications**:
  - `external-dependency-removal/spec.md`
  - `garage-object-storage/spec.md`
  - `offline-operation/spec.md`
  - `self-hosted-deployment/spec.md`
