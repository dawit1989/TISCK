# Design

## Context

CloudTAK was architected primarily for AWS cloud deployments with an optional development mode (`CLOUDTAK_Mode=docker-compose`). While the repository includes a Docker Compose stack with Garage v2.4.1, certain critical runtime code paths unconditionally call AWS services (such as SecretsManager and STS) or reference proprietary infrastructure containers (`ghcr.io/dfpc-coe/media-infra`).

TISCK adapts this codebase into an offline-first, self-contained deployment suitable for field deployment in Ethiopia and the Horn of Africa. The changes must decouple runtime operations from AWS while preserving the existing database schema, TAK Protocol v1/v2 protobuf handlers, CoT messaging, REST APIs, and Vue web client.

## Goals / Non-Goals

**Goals:**
- Provide a 100% self-hosted, offline-first execution path via `docker-compose.yml`.
- Ensure Garage v2.4.1 reliably handles all object storage workflows (assets, PMTiles, packages) using standard S3 API compatibility.
- Ensure runtime services boot cleanly with no AWS credentials, IAM metadata requests, or outbound WAN connectivity.
- Replace `media-infra` with upstream standard MediaMTX while keeping configuration seamless.
- Harden container networking by binding internal database and admin ports to `127.0.0.1`.

**Non-Goals:**
- Replacing or rewriting CloudTAK's core API (Express / TypeScript), database (PostGIS), or frontend (Vue 3 / Vite).
- Modifying TAK protocol parsers or Cursor-on-Target serialization logic.
- Building custom tile rendering engines (PMTiles format with local S3 storage is already supported by the tiles service).
- Supporting distributed multi-datacenter replication in this change (single-node Garage with Docker volume persistence is sufficient for TISCK baseline).

## Decisions

### 1. Guard AWS SDK Invocations by Mode
- **Decision**: In `api/common/config.ts`, `fetchSecret()` checks `CLOUDTAK_Mode === 'docker-compose'`. If true and `SigningSecret` is set in the environment, it returns the secret immediately without instantiating or querying AWS SecretsManager. Similarly, `fetchArnPrefix()` returns a fallback prefix or is bypassed in docker-compose mode.
- **Alternatives considered**:
  - *Mock AWS endpoint (e.g. LocalStack)*: Adds heavy memory and CPU overhead; unnecessary since CloudTAK already uses environment variables for most configuration in docker-compose mode.
  - *Refactoring all configuration loading*: Higher regression risk than surgical guards at the secret/ARN retrieval points.

### 2. Standard Upstream MediaMTX Container
- **Decision**: Replace `ghcr.io/dfpc-coe/media-infra:v9.10.0` in `docker-compose.yml` with `bluenviron/mediamtx:latest-ffmpeg` (or pinned stable tag), mounting the local `mediamtx.yml` configuration.
- **Alternatives considered**:
  - *Retaining `media-infra`*: Relies on an external dfpc-coe repository and container registry that may be inaccessible in offline environments or modified upstream.

### 3. Garage S3 Endpoint & Path-Style Access Configuration
- **Decision**: Retain Garage v2.4.1 as configured in `docker-compose.yml` and `garage.toml`. Configure the AWS S3 SDK clients in `api/common/aws/s3.ts`, `tasks/pmtiles/lib/s3.ts`, and `tasks/events/src/s3.ts` with:
  - `endpoint: process.env.AWS_S3_Endpoint` (e.g. `http://store:3900`)
  - `forcePathStyle: true`
  - Explicit dummy/local credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) from environment variables.
- **Alternatives considered**:
  - *MinIO*: Heavier resource footprint and AGPLv3 licensing considerations compared to Garage's lightweight Rust binary and minimal RAM requirements.

### 4. CoT Event Queue and Local Processing
- **Decision**: For docker-compose mode, route CoT events directly to the database and internal WebSockets / EventEmitters rather than pushing through AWS SQS. In `api/common/etl-events.ts`, guard the queue publication logic when `CLOUDTAK_Mode=docker-compose`.
- **Alternatives considered**:
  - *RabbitMQ / Redis queue*: Adds unnecessary container operational complexity when PostgreSQL and in-memory pub/sub handle expected tactical unit loads.

### 5. Local Asset Bundling and Basemap Coverage
- **Decision**: Serve PMTiles basemaps from the local Garage bucket via the existing `tasks/pmtiles` service. Web frontend assets (fonts, icons) are bundled directly in the Vite application build rather than referenced from external CDNs.
- **Alternatives considered**:
  - *External WMS/XYZ tile services*: Incompatible with air-gapped and austere tactical deployments.

## Risks / Trade-offs

- **[Risk] AWS SDK v3 timeout delays on boot**: In some environments, the AWS SDK attempts to contact the EC2 Instance Metadata Service (IMDS at 169.254.169.254) when credentials are missing, causing 10-30s boot delays.
  - **Mitigation**: Ensure `AWS_EC2_METADATA_DISABLED=true` is set in the environment for all services in `docker-compose.yml`.
- **[Risk] Garage S3 API compatibility quirks**: Garage implements a subset of the S3 API and does not support all advanced S3 features (e.g., bucket policies, tagging, select object content).
  - **Mitigation**: CloudTAK only uses standard GET, PUT, DELETE, LIST (v2), HEAD, and Range requests, all of which are fully supported by Garage.
- **[Risk] Media streaming protocol differences**: Different versions of MediaMTX may change YAML configuration syntax.
  - **Mitigation**: Validate the `mediamtx.yml` configuration against the selected MediaMTX image version before finalizing.

## Migration Plan

1. Clone or update repository files in place.
2. Ensure `.env` is initialized with `CLOUDTAK_Mode=docker-compose`, `SigningSecret`, and Garage credentials.
3. Verify `garage.toml` is present and runs bucket initialization on first launch.
4. Run `docker compose up -d` and inspect container logs to verify clean boot without AWS timeouts.
5. In case of rollback, previous docker-compose configurations can be restored via Git.
