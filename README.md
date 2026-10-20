# TISCK — Tactical Intelligence and Secure Communication Kit

TISCK is an offline-first, self-hosted deployment platform for situational awareness, Cursor-on-Target (CoT) tracking, and tactical video feeds. It adapts the **CloudTAK** (v13.109.3) geospatial platform into a self-contained, air-gapped system optimized for operational deployment in **Ethiopia and the Horn of Africa**.

---

## Key Features

- **100% Cloud-Independent**: Zero runtime dependencies on AWS (SecretsManager, STS, SQS, CloudFormation, Lambda, CloudWatch, ECR). Operates cleanly with `AWS_EC2_METADATA_DISABLED=true`.
- **Integrated Object Storage**: Powered by single-node **Garage v2.4.1**, an ultra-lightweight S3-compatible engine running with persistent Docker volumes.
- **Offline Geospatial Basemaps**: Fully local vector and raster map serving via PMTiles without contacting external CDNs or commercial map APIs.
- **Tactical Media Streaming**: Embedded **MediaMTX** supporting RTSP, WebRTC, RTMP, HLS, and SRT drone/bodycam feeds.
- **Hardened Edge Port Isolation**: Ingress endpoints accessible to tactical mesh clients on `0.0.0.0`, while database and administrative interfaces remain locked down to `127.0.0.1`.

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
  │   └─────────────┬────────────┘               └──────────────────────────────┘     │
  │                 │                                           ▲                     │
  │                 │                                           │                     │
  │   ┌─────────────▼────────────┐               ┌──────────────┴───────────────┐     │
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

### 3. Launch Services
```bash
docker compose up -d
```

### 4. Initialize Garage Object Store
Run the initialization script once upon initial startup to configure the cluster layout, create the S3 access key, and provision the `ASSET_BUCKET`:

- **Linux / WSL**:
  ```bash
  bash scripts/init-garage.sh
  ```
- **Windows (PowerShell)**:
  ```powershell
  .\scripts\init-garage.ps1
  ```

### 5. Access the Platform
- **CloudTAK Web UI**: `http://<HOST_IP>:5000`
- **PMTiles Tile Server**: `http://<HOST_IP>:5002`
- **Video Streams**: `rtsp://<HOST_IP>:8554/<stream_name>` or `http://<HOST_IP>:8889/<stream_name>`
