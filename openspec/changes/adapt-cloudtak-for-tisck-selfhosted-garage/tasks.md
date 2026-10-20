# Tasks

## 1. Audit and AWS Runtime Decoupling

- [ ] 1.1 Guard `fetchSecret()` in `api/common/config.ts` so when `CLOUDTAK_Mode === 'docker-compose'`, it reads `SigningSecret` from environment directly without calling AWS SecretsManager, verified by inspecting the code path and running unit tests
- [ ] 1.2 Guard `fetchArnPrefix()` in `api/common/config.ts` so AWS STS is not called in docker-compose mode, verified by inspecting code and ensuring no STS `GetCallerIdentity` call is executed
- [ ] 1.3 Ensure `api/common/etl-events.ts` and queue helpers do not fail on boot when AWS SQS is not configured, verified by verifying the queue URL fallback in docker-compose mode
- [ ] 1.4 Add `AWS_EC2_METADATA_DISABLED=true` to all container definitions in `docker-compose.yml` to prevent IMDS timeout latency on air-gapped systems, verified by checking compose environment variables

## 2. Docker Compose & Container Independence

- [ ] 2.1 Replace `ghcr.io/dfpc-coe/media-infra:v9.10.0` in `docker-compose.yml` with upstream `bluenviron/mediamtx` image, verified by inspecting `docker-compose.yml` and testing container configuration syntax
- [ ] 2.2 Add container health checks for PostGIS (`pg_isready`) and Garage S3 API readiness in `docker-compose.yml`, verified by validating compose config with `docker compose config`
- [ ] 2.3 Restrict database and admin ports in `docker-compose.yml` by binding PostGIS (5432) and Garage admin to `127.0.0.1`, verified by checking port mapping definitions

## 3. Garage Object Storage Validation

- [ ] 3.1 Verify S3 client endpoint (`AWS_S3_Endpoint`) and `forcePathStyle: true` configuration in `api/common/aws/s3.ts`, `tasks/pmtiles/lib/s3.ts`, and `tasks/events/src/s3.ts`, verified by reviewing client options
- [ ] 3.2 Validate bucket initialization and lifecycle scripts for Garage in `cloudtak.sh` / `garage.toml`, verified by inspecting bucket creation logic for required buckets (`ASSET_BUCKET`, etc.)
- [ ] 3.3 Validate PMTiles range request handling against Garage object storage, verified by inspecting the byte-range request logic in `tasks/pmtiles`

## 4. Offline Assets and Deployment Verification

- [ ] 4.1 Audit web client in `app/` for external font, CDN, and tile references, verified by grep and ensuring assets are bundled locally
- [ ] 4.2 Document deployment procedure, environment variables, and offline Horn of Africa coverage coordinates in `README.md` and `.env.example`, verified by reviewing documentation accuracy
- [ ] 4.3 Validate end-to-end OpenSpec change compliance and planning completeness with `openspec validate adapt-cloudtak-for-tisck-selfhosted-garage`, verified by clean command exit code 0

## Workflow follow-up

- Review and approve the OpenSpec change proposal, specs, design, and tasks.
- Proceed to implementation via OpenSpec apply workflow.
