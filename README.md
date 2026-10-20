# TISCK — Tactical Intelligence and Secure Communication Kit

TISCK is an offline-first, self-hosted deployment platform for situational awareness, Cursor-on-Target (CoT) tracking, and tactical video feeds. It adapts the **CloudTAK** (v13.109.3) geospatial platform into a self-contained, air-gapped system optimized for operational deployment in **Ethiopia and the Horn of Africa**.

---

## Key Features

- **100% Cloud-Independent**: Zero runtime dependencies on AWS (SecretsManager, STS, SQS, CloudFormation, Lambda, CloudWatch, ECR). Operates cleanly with `AWS_EC2_METADATA_DISABLED=true`.
- **Self-Hosted Identity Foundation**: Offline-first **Authentik 2024.12** identity provider with Redis 7.4 task cache, dedicated PostgreSQL database, OIDC tactical group claims, TOTP MFA, and optional LDAP Outpost.
- **Integrated Object Storage**: Powered by single-node **Garage v2.4.1**, an ultra-lightweight S3-compatible engine running with persistent Docker volumes.
- **Offline Geospatial Basemaps**: Fully local vector and raster map serving via PMTiles without contacting external CDNs or commercial map APIs.
- **Tactical Media Streaming**: Embedded **MediaMTX** supporting RTSP, WebRTC, RTMP, HLS, and SRT drone/bodycam feeds.
- **Hardened Edge Port Isolation**: Ingress endpoints accessible to tactical mesh clients on `0.0.0.0`, while database, cache, identity admin, and storage interfaces remain locked down to `127.0.0.1`.

---

## System Architecture

```
                    ┌───────────────────────────────────────────────┐
                    │  Field Devices (ATAK, WinTAK, Web Operators)  │
                    └───────────────────────┬───────────────────────┘
                                            │ LAN / Tactical Mesh (0.0.0.0)
  ┌─────────────────────────────────────────▼─────────────────────────────────────────┐
  │ Docker Compose Network (cloudtak-net)                                             │
  │                                                                                   │
  │   ┌──────────────────────────┐               ┌──────────────────────────────┐     │
  │   │  api (:5000)             │──────────────▶│  postgis (:5432)             │     │
  │   │  Web UI + REST + CoT     │               │  PostgreSQL 17 + PostGIS     │     │
  │   │  (Bound to 0.0.0.0:5000) │               │  (Bound to 127.0.0.1:5432)   │     │
  │   └──────┬──────────┬────────┘               └──────────────┬───────────────┘     │
  │          │          │                                       │                     │
  │          │ OIDC Auth│                                       │                     │
  │          │          ▼                                       │                     │
  │          │   ┌──────────────────────────┐                   │                     │
  │          │   │  identity-server (:9000) │───────────────────┤ (authentik db)      │
  │          │   │  Authentik 2024.12       │                   │                     │
  │          │   │  (Bound to 127.0.0.1)    │                   │                     │
  │          │   └─────────────┬────────────┘                   │                     │
  │          │                 │                                │                     │
  │          │                 ├────────────────┐               │                     │
  │          │                 ▼                ▼               │                     │
  │          │   ┌────────────────────────┐  ┌────────────────┐ │                     │
  │          │   │  identity-worker       │  │ identity-cache │ │                     │
  │          │   │  Background tasks      │  │ Redis 7.4      │ │                     │
  │          │   └────────────────────────┘  └────────────────┘ │                     │
  │          │                                                  │                     │
  │   ┌──────▼───────────────────┐               ┌──────────────┴───────────────┐     │
  │   │  tiles (:5002)           │               │  retention                   │     │
  │   │  PMTiles Server          │               │  Data retention worker       │     │
  │   │  (Bound to 0.0.0.0:5002) │               └──────────────────────────────┘     │
  │   └─────────────┬────────────┘                                                    │
  │                 │                                                                 │
  │                 │ S3 Range Requests                                               │
  │                 ▼                                                                 │
  │   ┌──────────────────────────┐               ┌──────────────────────────────┐     │
  │   │  store (:3900, :3903)    │               │  media (:8554, :8889, :1935) │     │
  │   │  Garage S3 Object Store  │               │  MediaMTX Video Relays       │     │
  │   │  (Bound to 127.0.0.1)    │               │  (Bound to 0.0.0.0)          │     │
  │   └──────────────────────────┘               └──────────────────────────────┘     │
  └───────────────────────────────────────────────────────────────────────────────────┘
```

---

## Network Interface & Port Binding Matrix

| Service | Port(s) | Binding | Description |
| :--- | :--- | :--- | :--- |
| **API & Web UI** | `5000` | `0.0.0.0:5000` | Web situational awareness map, REST API, WebSockets |
| **Tiles Service** | `5002` | `0.0.0.0:5002` | PMTiles vector & raster map tile server |
| **MediaMTX RTSP** | `8554` | `0.0.0.0:8554` | Drone & camera video ingestion |
| **MediaMTX WebRTC** | `8889` | `0.0.0.0:8889` | Low-latency tactical video playback |
| **MediaMTX RTMP / HLS** | `1935`, `8888` | `0.0.0.0:<port>` | Legacy RTMP and HLS streaming |
| **MediaMTX API** | `9997` | `127.0.0.1:9997` | MediaMTX management API (localhost only) |
| **PostGIS Database** | `5432` | `127.0.0.1:5432` | PostgreSQL geospatial DB (localhost only) |
| **Garage S3 Data** | `3900` | `127.0.0.1:3900` | Object storage (proxied via API/Tiles) |
| **Garage Admin API** | `3903` | `127.0.0.1:3903` | Cluster admin & layout API (localhost only) |
| **Authentik HTTP / HTTPS** | `9000`, `9443` | `127.0.0.1:<port>` | Identity provider web UI & OIDC endpoints (localhost only) |
| **Authentik Redis Cache** | `6379` | *Internal Docker Network* | Identity task & session cache (no host binding) |
| **LDAP Outpost (Optional)** | `389`, `636` | `127.0.0.1:<port>` | Optional LDAP compatibility interface (localhost only) |

---

## Horn of Africa Geospatial Coverage

The default configuration centers the viewport on **Addis Ababa** with bounding coverage covering the entire **Horn of Africa**:

- **Center Coordinates**: `38.7578°E, 9.0222°N` (Zoom level: 6)
- **Bounding Box**:
  - Southwest: `32.9°E, 3.3°N` (South Sudan / Kenya border)
  - Northeast: `48.0°E, 15.0°N` (Eritrea / Red Sea / Somalia coast)
- **Basemap Serving**: Place Horn of Africa PMTiles packages (e.g., `ethiopia.pmtiles`, `horn-of-africa.pmtiles`) into the Garage `ASSET_BUCKET` via the Web UI or S3 upload.

---

## Deployment Quickstart

### 1. Prerequisites
- Docker Engine with Docker Compose V2 plugin
- Git / Bash or PowerShell

### 2. Configure Environment
```bash
cd cloudtak
cp .env.example .env
```
Ensure `SigningSecret` is populated with a random 32+ character string.

For self-hosted identity (Authentik), generate cryptographic secrets automatically:
- **Linux / WSL**: `bash scripts/generate-identity-secrets.sh`
- **Windows (PowerShell)**: `.\scripts\generate-identity-secrets.ps1`

> [!TIP]
> If running on a host machine with existing services (e.g. OpenTAKServer or local PostgreSQL), configure `POSTGRES_PORT=5435` and `MEDIA_PORT_API=19997` in `.env` to prevent host port collisions without changing container-internal networking.

### 3. Launch Services
```bash
docker compose up -d
```

### 4. Initialize Storage & Identity
1. **Initialize Garage Object Store**:
   - Linux: `bash scripts/init-garage.sh`
   - Windows: `.\scripts\init-garage.ps1`

2. **Initialize Authentik Database & Tactical Groups**:
   - Linux: `bash scripts/bootstrap-authentik.sh`
   - Windows: `.\scripts\bootstrap-authentik.ps1`
   This sets up the `authentik` logical PostgreSQL database, provisions the OIDC application provider, and configures the default tactical groups (`TISCK_INTEL`, `TISCK_RECON`, `TISCK_COMMAND`, `TISCK_ISR`).

### 5. Access the Platform
- **CloudTAK Web UI**: `http://<HOST_IP>:5000`
- **Authentik Identity UI**: `http://localhost:9000`
- **PMTiles Tile Server**: `http://<HOST_IP>:5002`
- **Video Streams**: `rtsp://<HOST_IP>:8554/<stream_name>` or `http://<HOST_IP>:8889/<stream_name>`

---

## Identity Operations & Hardening

Detailed operational guides for the identity stack are available under [`docs/identity/`](docs/identity/):
- [**Disaster Recovery & Break-Glass Runbook**](docs/identity/disaster-recovery.md): Local emergency logins, CLI password resets, and automated backup/restore (`backup-identity.sh` / `.ps1`).
- [**Offline Image Bundle Guide**](docs/identity/offline-image-bundle.md): Pre-caching pinned container images (`authentik:2024.12.0`, `redis:7.4-alpine`) for air-gapped transport.
- [**LDAP Outpost Setup Guide**](docs/identity/ldap-outpost-guide.md): Optional internal-only directory bridge for legacy TAK integrations.
- [**TAK Certificate Enrollment Boundary**](docs/identity/tak-enrollment-boundary.md): Interface specifications for future X.509 client certificate issuance against internal CAs.

---

## Architecture Decision Records (ADRs)

Key architectural decisions are documented under [`docs/adr/`](docs/adr/README.md):

- [**ADR 0001**](docs/adr/0001-aws-runtime-decoupling.md): AWS Runtime Decoupling (SecretsManager, STS, IMDS) — *Accepted*
- [**ADR 0002**](docs/adr/0002-upstream-mediamtx-video-streaming.md): Upstream MediaMTX Container Replacement — *Accepted*
- [**ADR 0003**](docs/adr/0003-garage-s3-object-storage.md): Single-Node Garage S3 Storage Engine — *Accepted*
- [**ADR 0004**](docs/adr/0004-outgoing-etl-event-queue-bypass.md): Outgoing ETL Event Queue Bypass & Local Delivery Gap — *Partially Implemented*
- [**ADR 0005**](docs/adr/0005-offline-geospatial-assets-and-pmtiles.md): Offline Geospatial Asset Bundling & PMTiles Basemaps — *Partially Implemented*
- [**ADR 0006**](docs/adr/0006-network-interface-and-port-binding-matrix.md): Dual Network Interface & Port Binding Isolation — *Accepted*
- [**ADR 0007**](docs/adr/0007-self-contained-docker-compose-deployment.md): Self-Contained Docker Compose Deployment — *Accepted*
- [**ADR 0008**](docs/adr/0008-horn-of-africa-geospatial-baseline-and-tactical-groups.md): Horn of Africa Geospatial Baseline & Tactical Groups — *Accepted*
- [**ADR 0009**](docs/adr/0009-authentik-self-hosted-identity-provider.md): Authentik as the Self-Hosted Identity Provider — *Accepted*
- [**ADR 0010**](docs/adr/0010-oidc-application-authentication-and-group-mapping.md): OIDC Application Authentication and Tactical Group Mapping — *Accepted*
- [**ADR 0011**](docs/adr/0011-ldap-outpost-as-optional-compatibility-interface.md): LDAP Outpost as an Optional Internal Compatibility Interface — *Accepted*
- [**ADR 0012**](docs/adr/0012-tak-certificate-enrollment-integration-boundary.md): TAK Certificate Enrollment Integration Boundary — *Accepted*

---

## Requirement Traceability & Pillar Compliance

Full requirement-to-code-and-evidence traceability across all six TISCK architecture pillars is maintained under `docs/traceability/`:

- [**Traceability Report & Full Matrix**](docs/traceability/tisck-traceability.md)
- [**Machine-Readable Matrix (CSV)**](docs/traceability/tisck-traceability.csv)

### Traceability Audit Skill
The workspace includes an automated audit skill located at [`.agents/skills/tisck-traceability/SKILL.md`](.agents/skills/tisck-traceability/SKILL.md). In Antigravity, re-run audits anytime by issuing:
```text
/tisck-traceability
```

---

## OpenSpec Specifications

Baseline behavior contracts are cataloged in [`openspec/specs/`](openspec/specs/):
- [`external-dependency-removal`](openspec/specs/external-dependency-removal/spec.md): Elimination of AWS SecretsManager, STS, SQS, and excluded infrastructure repos.
- [`garage-object-storage`](openspec/specs/garage-object-storage/spec.md): Garage S3 CRUD, byte-range requests, path-style addressing, and persistence.
- [`offline-operation`](openspec/specs/offline-operation/spec.md): Air-gapped basemaps, offline UI asset bundling, and Horn of Africa coverage.
- [`self-hosted-deployment`](openspec/specs/self-hosted-deployment/spec.md): Compose orchestration, health checks, and dual network interface isolation.
- [`self-hosted-identity`](openspec/specs/self-hosted-identity/spec.md): Authentik server, worker, cache orchestration, tactical groups, TOTP MFA, and fail-closed security.
- [`tak-certificate-enrollment`](openspec/specs/tak-certificate-enrollment/spec.md): TAK client CSR generation, CA REST endpoints, validity verification, and port 8446 verification.

