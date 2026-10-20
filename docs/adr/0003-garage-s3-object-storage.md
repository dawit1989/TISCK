# ADR 0003: Single-Node Garage S3 Object Storage Engine

- **Status**: Accepted
- **Date**: 2026-10-20
- **Authors**: TISCK Engineering Team

---

## Context

CloudTAK stores user uploads, TAK mission packages, icon sets, data sync files, and geospatial PMTiles archives in S3-compatible object storage. In AWS deployments, this relies on Amazon S3. For field deployments in the Horn of Africa, an embedded, self-hosted, lightweight S3-compatible engine is required.

Alternative engines like MinIO require substantial memory/CPU overhead (often >500MB RAM at idle) and carry licensing considerations. [Garage](https://garagehq.deuxfleurs.fr/) is an open-source (AGPLv3), highly efficient S3-compatible distributed storage engine written in Rust with minimal memory footprint (<30MB RAM idle) and native support for chunked storage and HTTP byte-range requests.

---

## Decision

1. **Storage Engine**: Deploy single-node **Garage v2.4.1** via Docker Compose (`cloudtak-store-1`).
2. **Persistence**: Store all metadata and data chunks on dedicated Docker volumes (`store_data` mounted at `/var/lib/garage/data` and `/var/lib/garage/meta`).
3. **S3 SDK Compatibility**:
   - Set `AWS_S3_Endpoint=http://store:3900` in service containers.
   - Configure AWS SDK S3 clients in `cloudtak/api/common/aws/s3.ts`, `cloudtak/tasks/pmtiles/lib/s3.ts`, and `cloudtak/tasks/events/src/s3.ts` with `forcePathStyle: true`.
4. **Initialization Automation**:
   - Provide `cloudtak/scripts/init-garage.sh` (POSIX) and `init-garage.ps1` (Windows PowerShell) to automate layout assignment (`garage layout assign -z local -c 100G`), layout commit, access key generation (`cloudtak-key`), and default asset bucket provisioning (`cloudtak`).
5. **Network Lockdown**: Bind Garage S3 data API (`:3900`) and Admin API (`:3903`) to `127.0.0.1` on the host, ensuring clients access assets only through authenticated API and Tiles proxies.

---

## Consequences

### Positive
- Extremely low memory footprint ideal for rugged tactical field servers and vehicle kits.
- Full support for HTTP 206 Partial Content byte-range requests required for PMTiles map rendering.
- Robust data durability across container restarts.

### Negative / Neutral
- Garage implements a targeted subset of the Amazon S3 API (bucket policies, lifecycle expirations, and object tagging are either partial or unsupported); CloudTAK must not rely on unsupported enterprise S3 features.

---

## OpenSpec Traceability

- **Change**: `adapt-cloudtak-for-tisck-selfhosted-garage`
- **Capability Specs**:
  - `openspec/changes/adapt-cloudtak-for-tisck-selfhosted-garage/specs/garage-object-storage/spec.md`:
    - Requirement: `Object upload and download via Garage`
    - Requirement: `Object listing and metadata retrieval`
    - Requirement: `Object deletion`
    - Requirement: `PMTiles range request support`
    - Requirement: `Garage persistence across restarts`
    - Requirement: `Configurable S3 endpoint and credentials`
    - Requirement: `Bucket initialization`
  - `openspec/changes/adapt-cloudtak-for-tisck-selfhosted-garage/specs/self-hosted-deployment/spec.md`:
    - Requirement: `Health checks for stateful services` (Garage)
- **Tasks**: Tasks 3.1, 3.2, 3.3 in `tasks.md`.

---

## Verification Evidence

1. **Initialization Script Execution**: Executed `init-garage.ps1` against live container. Successfully applied layout configuration, created access key `cloudtak-key` (`GK...`), and created bucket `cloudtak`.
2. **Empirical S3 Operations Suite**: Executed `test_garage_s3.py` against `http://127.0.0.1:3900` using AWS SigV4 authentication:
   - **Bucket Listing**: Confirmed bucket `cloudtak` exists.
   - **Object Upload (PUT)**: Uploaded `tisck-test/verification.txt` containing `TISCK Offline Tactical Platform Verification Payload`. Response: HTTP 200.
   - **Metadata Retrieval (HEAD)**: Retrieved headers; confirmed content length `58` bytes and custom metadata `x-amz-meta-test: tisck-verified`. Response: HTTP 200.
   - **Byte-Range Retrieval (GET Range: bytes=0-4)**: Retrieved byte slice. Response: HTTP 206 Partial Content returning exactly `b'TISCK'`.
   - **Prefix Listing (GET ?prefix=tisck-test/)**: Successfully listed `tisck-test/verification.txt`. Response: HTTP 200.
   - **Auth Failure Test**: Issued request with invalid secret key. Garage correctly rejected request with HTTP 403 Forbidden.
   - **Restart Persistence**: Stopped and restarted `cloudtak-store-1` via `docker restart`. Re-queried `tisck-test/verification.txt`; verified full 58-byte payload remained intact.
   - **Object Deletion (DELETE)**: Deleted object. Subsequent HEAD request returned HTTP 404 Not Found.
