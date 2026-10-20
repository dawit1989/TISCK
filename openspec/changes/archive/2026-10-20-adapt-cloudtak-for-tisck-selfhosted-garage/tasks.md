# Tasks

## 1. Audit and AWS Runtime Decoupling

- [x] 1.1 Guard `fetchSecret()` in `cloudtak/api/common/config.ts` so when `CLOUDTAK_Mode === 'docker-compose'`, it reads `SigningSecret` from environment directly without calling AWS SecretsManager, verified by inspecting the code path and live container boot logs showing zero SecretsManager calls
- [x] 1.2 Guard `fetchArnPrefix()` in `cloudtak/api/common/config.ts` so AWS STS is not called in docker-compose mode, verified by inspecting code and ensuring no STS `GetCallerIdentity` call is executed
- [x] 1.3 Ensure `cloudtak/api/common/etl-events.ts` and queue helpers do not fail on boot when AWS SQS is not configured, verified by verifying the queue URL fallback and `noetlevents` guard in docker-compose mode
- [x] 1.4 Add `AWS_EC2_METADATA_DISABLED=true` to all container definitions in `cloudtak/docker-compose.yml` to prevent IMDS timeout latency on air-gapped systems, verified by checking compose environment variables and confirming instant container boot without 169.254.169.254 timeouts

## 2. Docker Compose & Container Independence

- [x] 2.1 Replace `ghcr.io/dfpc-coe/media-infra:v9.10.0` in `cloudtak/docker-compose.yml` with upstream pinned `bluenviron/mediamtx:1.11.3-ffmpeg` image, verified by pulling image, launching container, and verifying HTTP REST API on `:9997` and RTSP on `:8554`
- [x] 2.2 Add container health checks for PostGIS (`pg_isready`) and Garage S3 API readiness in `cloudtak/docker-compose.yml`, verified by live Docker container health status reporting `healthy` for both services
- [x] 2.3 Implement the port binding matrix in `cloudtak/docker-compose.yml`: bind public tactical ingress (API 5000, Tiles 5002, MediaMTX 8554/8889) to `0.0.0.0`, while restricting PostGIS (5432) and Garage (3900/3903) to `127.0.0.1`, verified by checking port mapping definitions and testing live network isolation

## 3. Garage Object Storage Validation

- [x] 3.1 Verify S3 client endpoint (`AWS_S3_Endpoint`) and `forcePathStyle: true` configuration in `cloudtak/api/common/aws/s3.ts`, `cloudtak/tasks/pmtiles/lib/s3.ts`, and `cloudtak/tasks/events/src/s3.ts`, verified by reviewing client options
- [x] 3.2 Validate bucket initialization and lifecycle scripts for Garage in `cloudtak/garage.toml` / scripts, verified by running `init-garage.ps1` against live Garage v2.4.1 container, configuring layout, creating key `cloudtak-key`, and creating bucket `cloudtak`
- [x] 3.3 Validate PMTiles range request handling against Garage object storage, verified by executing SigV4 test script `test_garage_s3.py` against live Garage service with PUT, HEAD, GET, byte-range request (`206 Partial Content`), listing, auth failure (`403 Forbidden`), DELETE, and container restart persistence verification

## 4. Offline Assets and Deployment Verification

- [x] 4.1 Audit web client in `cloudtak/app/` for external font, CDN, and tile references, verified by auditing HTML/JS builds and testing web app serving from live Nginx container at `http://localhost:5000`
- [x] 4.2 Document deployment procedure, environment variables, and offline Horn of Africa coverage coordinates in `README.md` and `cloudtak/.env.example`, verified by reviewing documentation accuracy and running live API query returning `38.7578,9.0222` center and zoom `6`
- [x] 4.3 Validate end-to-end OpenSpec change compliance and planning completeness with `openspec validate adapt-cloudtak-for-tisck-selfhosted-garage --strict`, verified by clean command exit code 0

## Workflow follow-up

- Complete verification-first review report.
- Present findings for review before running OpenSpec archive.
