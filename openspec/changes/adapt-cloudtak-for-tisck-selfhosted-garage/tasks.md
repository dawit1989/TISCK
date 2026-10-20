# Tasks

## 1. Audit and AWS Runtime Decoupling

- [x] 1.1 Guard `fetchSecret()` in `cloudtak/api/common/config.ts` so when `CLOUDTAK_Mode === 'docker-compose'`, it reads `SigningSecret` from environment directly without calling AWS SecretsManager, verified by inspecting the code path and running unit tests
- [x] 1.2 Guard `fetchArnPrefix()` in `cloudtak/api/common/config.ts` so AWS STS is not called in docker-compose mode, verified by inspecting code and ensuring no STS `GetCallerIdentity` call is executed
- [x] 1.3 Ensure `cloudtak/api/common/etl-events.ts` and queue helpers do not fail on boot when AWS SQS is not configured, verified by verifying the queue URL fallback in docker-compose mode
- [x] 1.4 Add `AWS_EC2_METADATA_DISABLED=true` to all container definitions in `cloudtak/docker-compose.yml` to prevent IMDS timeout latency on air-gapped systems, verified by checking compose environment variables

## 2. Docker Compose & Container Independence

- [x] 2.1 Replace `ghcr.io/dfpc-coe/media-infra:v9.10.0` in `cloudtak/docker-compose.yml` with upstream `bluenviron/mediamtx` image, verified by inspecting `cloudtak/docker-compose.yml` and testing container configuration syntax
- [x] 2.2 Add container health checks for PostGIS (`pg_isready`) and Garage S3 API readiness in `cloudtak/docker-compose.yml`, verified by validating compose config with `docker compose config`
- [x] 2.3 Implement the port binding matrix in `cloudtak/docker-compose.yml`: bind public tactical ingress (API 5000, Tiles 5002, MediaMTX 8554/8889) to `0.0.0.0`, while restricting PostGIS (5432) and Garage (3900/3903) to `127.0.0.1`, verified by checking port mapping definitions

## 3. Garage Object Storage Validation

- [x] 3.1 Verify S3 client endpoint (`AWS_S3_Endpoint`) and `forcePathStyle: true` configuration in `cloudtak/api/common/aws/s3.ts`, `cloudtak/tasks/pmtiles/lib/s3.ts`, and `cloudtak/tasks/events/src/s3.ts`, verified by reviewing client options
- [x] 3.2 Validate bucket initialization and lifecycle scripts for Garage in `cloudtak/garage.toml` / scripts, verified by inspecting bucket creation logic for required buckets (`ASSET_BUCKET`, etc.)
- [x] 3.3 Validate PMTiles range request handling against Garage object storage, verified by inspecting the byte-range request logic in `cloudtak/tasks/pmtiles`

## 4. Offline Assets and Deployment Verification

- [x] 4.1 Audit web client in `cloudtak/app/` for external font, CDN, and tile references, verified by grep and ensuring assets are bundled locally
- [x] 4.2 Document deployment procedure, environment variables, and offline Horn of Africa coverage coordinates in `README.md` and `cloudtak/.env.example`, verified by reviewing documentation accuracy
- [x] 4.3 Validate end-to-end OpenSpec change compliance and planning completeness with `openspec validate adapt-cloudtak-for-tisck-selfhosted-garage`, verified by clean command exit code 0

## Workflow follow-up

- Review and approve the OpenSpec change proposal, specs, design, and tasks.
- Proceed to implementation via OpenSpec apply workflow.
