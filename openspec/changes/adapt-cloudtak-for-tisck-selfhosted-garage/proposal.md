# Proposal

## Why

TISCK (Tactical Intelligence and Secure Communication Kit) requires a self-hosted, offline-first deployment of the CloudTAK geospatial situational awareness platform for use in Ethiopia and the Horn of Africa. The upstream CloudTAK application (v13.109.3, AGPL-3.0) has a mature docker-compose deployment path using Garage v2.4.1 as its S3-compatible object store, but its runtime code still contains mandatory AWS service dependencies (SecretsManager, STS, SQS, CloudFormation, Lambda, CloudWatch, ECR) and references the excluded `media-infra` container image. These must be audited, classified, and removed or replaced so TISCK can start and operate without AWS credentials, AWS infrastructure, or the three excluded infrastructure repositories (`auth-infra`, `tak-infra`, `media-infra`).

## What Changes

- **Audit and classify every AWS SDK import** in `api/`, `tasks/`, and root configuration files into: runtime-required for docker-compose mode, AWS-only (used only when `CLOUDTAK_Mode=AWS`), or test-only.
- **Remove mandatory AWS runtime dependencies** that prevent startup in docker-compose mode without AWS credentials — specifically `fetchSecret()` (SecretsManager), `fetchArnPrefix()` (STS), SQS queue URL construction, and CloudFormation/Lambda/ECR/CloudWatch modules.
- **Replace the `media-infra` container image** (`ghcr.io/dfpc-coe/media-infra:v9.10.0`) in docker-compose.yml with a direct upstream MediaMTX image, preserving the configuration contract.
- **Validate Garage integration** for all S3 operations: bucket initialization, upload, download, listing, head, delete, range requests, persistence across restarts, and authentication failure behavior.
- **Establish the TISCK self-hosted deployment configuration** by adapting the existing docker-compose.yml — not creating a parallel deployment — with explicit local endpoints, no cloud dependencies, and health checks.
- **Identify and document offline-first requirements** for map tiles, fonts, styles, and authentication — no runtime internet dependency for core workflows.
- **Preserve all existing application functionality** that operates correctly in docker-compose mode. No unnecessary rewrites.

## Capabilities

### New Capabilities

- `self-hosted-deployment`: TISCK operates as a fully self-hosted Docker Compose deployment without requiring AWS infrastructure, the excluded repositories, or internet connectivity for core operations.
- `garage-object-storage`: All S3-compatible object storage operations (upload, download, list, head, delete, range requests, PMTiles serving) work correctly against Garage with explicit local endpoints and credentials.
- `external-dependency-removal`: The application starts and operates in docker-compose mode without AWS credentials, AWS Secrets Manager, AWS STS, AWS SQS, AWS CloudFormation, AWS Lambda, or any of the three excluded infrastructure repositories.
- `offline-operation`: Core TISCK workflows (map rendering, CoT messaging, asset management, authentication) function without internet connectivity when local assets are present.

### Modified Capabilities

_None — this is the initial TISCK spec baseline; there are no existing specs to modify._

## Impact

- **docker-compose.yml**: Replace `media-infra` image reference; add health checks; bind admin ports to localhost.
- **api/common/config.ts**: `fetchSecret()` must gracefully fall back to `SigningSecret` env var in docker-compose mode (lines 181, 266-277). `fetchArnPrefix()` (STS) must not be called in docker-compose mode (lines 246-263).
- **api/common/etl-events.ts**: `queueUrl()` constructs an AWS SQS URL using `fetchArnPrefix()` (line 58-59) — must be stubbed or replaced in docker-compose mode.
- **api/common/aws/queue.ts**: SQS client — runtime dependency only when ETL outgoing events are enabled and CLOUDTAK_Mode=AWS.
- **api/stateless/lib/aws/cloudformation.ts**: Full CloudFormation CRUD — AWS-mode only, never reached in docker-compose mode.
- **api/stateless/lib/aws/lambda.ts, ecr.ts, alarm.ts, lambda-logs.ts**: AWS-mode only runtime modules for Layer deployment/monitoring.
- **api/common/aws/s3.ts, tasks/pmtiles/lib/s3.ts, tasks/events/src/s3.ts**: S3 clients already support custom endpoints via `AWS_S3_Endpoint` — these are Garage-compatible and need validation, not replacement.
- **cloudformation/**: Templates — deployment tooling only, not a runtime dependency. Preserve for upstream compatibility.
- **.env.example**: Already configured for Garage. Needs documentation of TISCK-specific values.
- **garage.toml**: Single-node Garage configuration already present and functional for development.
- **cloudtak.sh**: Already has Garage RPC secret generation, legacy MinIO migration, and docker-compose management. Preserve.
