# ADR 0006: Dual Network Interface and Port Binding Isolation Matrix

- **Status**: Accepted
- **Date**: 2026-10-20
- **Authors**: TISCK Engineering Team

---

## Context

In tactical deployments, TISCK servers are attached to local Wi-Fi hotspots, ad-hoc mesh radios (e.g. Silvus, TrellisWare), or tactical LAN switches. Field operators (ATAK Android, WinTAK, browser-based command posts) connect to the server across this local network.

Exposing raw database ports (`5432`), object store data/admin ports (`3900`, `3903`), or media control APIs (`9997`) to the entire tactical network creates severe security vulnerabilities:
1. Untrusted or compromised LAN endpoints could execute direct PostgreSQL queries or brute-force database credentials.
2. Direct access to object storage circumvents API access-control lists.
3. Administrative APIs could be manipulated to reconfigure streaming pipelines or storage layouts.

Additionally, deployment host machines may already run other TAK or database services (such as OpenTAKServer or local PostgreSQL), leading to port collisions if host ports are hardcoded.

---

## Decision

1. **Dual Network Interface Binding Policy**:
   - **Tactical LAN Ingress (`0.0.0.0`)**: Services intended for field clients are bound to all interfaces:
     - `api`: `0.0.0.0:5000:5000` (Web UI, REST API, WebSockets)
     - `tiles`: `0.0.0.0:5002:5002` (PMTiles map tile server)
     - `media`: `0.0.0.0:8554:8554` (RTSP), `0.0.0.0:8889:8889` (WebRTC), `0.0.0.0:1935:1935` (RTMP), `0.0.0.0:8888:8888` (HLS)
   - **Internal & Administrative Isolation (`127.0.0.1`)**: Data stores and management interfaces are restricted strictly to loopback:
     - `postgis`: `127.0.0.1:${POSTGRES_PORT:-5432}:5432`
     - `store` (Garage): `127.0.0.1:3900:3900` (S3 API), `127.0.0.1:3903:3903` (Admin API)
     - `media` (MediaMTX API): `127.0.0.1:${MEDIA_PORT_API:-9997}:9997`
2. **Host Port Collision Mitigation**:
   - Environment variables `POSTGRES_PORT` and `MEDIA_PORT_API` are supported in `.env` to allow host port remapping (e.g., mapping PostGIS to host port `5435` and Media API to `19997` when OpenTAKServer is running on the same host) without modifying container-internal ports or network aliases.

---

## Consequences

### Positive
- Strict network perimeter defense: untrusted tactical LAN devices cannot access database or admin APIs directly.
- Field devices (ATAK, WinTAK, browsers) seamlessly connect to mapping and video feeds.
- Prevents deployment failures caused by port collisions on multi-role edge servers.

### Negative / Neutral
- Operators performing CLI maintenance or database backups on the host machine must access loopback ports or use `docker compose exec`.

---

## OpenSpec Traceability

- **Change**: `adapt-cloudtak-for-tisck-selfhosted-garage`
- **Capability Specs**:
  - `openspec/changes/adapt-cloudtak-for-tisck-selfhosted-garage/specs/self-hosted-deployment/spec.md`:
    - Requirement: `Network interface isolation and port binding`
    - Scenario: `Public ingress service port bindings`
    - Scenario: `PostGIS port binding`
    - Scenario: `Garage admin and S3 port binding`
- **Tasks**: Task 2.3 in `tasks.md`.

---

## Verification Evidence

1. **Port Binding Inspection**: Inspected `docker-compose.yml` port mappings:
   ```yaml
   ports:
     - "0.0.0.0:5000:5000"          # API
     - "0.0.0.0:5002:5002"          # Tiles
     - "0.0.0.0:8554:8554"          # Media RTSP
     - "0.0.0.0:8889:8889"          # Media WebRTC
     - "127.0.0.1:${POSTGRES_PORT:-5432}:5432" # PostGIS
     - "127.0.0.1:3900:3900"        # Garage S3
     - "127.0.0.1:3903:3903"        # Garage Admin
     - "127.0.0.1:${MEDIA_PORT_API:-9997}:9997" # Media API
   ```
2. **Live Container Network Verification**: Executed `docker compose ps` on active stack; verified `cloudtak-postgis-1` and `cloudtak-store-1` are bound only to `127.0.0.1`, while `cloudtak-api-1` and `cloudtak-tiles-1` listen on `0.0.0.0`.
3. **Collision Mitigation Verification**: Verified host stack running with `POSTGRES_PORT=5435` alongside an active OpenTAKServer instance on `5432` with zero port conflicts.
