# external-dependency-removal Specification

## Purpose

TISCK operates in self-hosted docker-compose mode without AWS credentials, without AWS runtime services (Secrets Manager, STS, SQS, CloudFormation, Lambda, CloudWatch, ECR), and without the three excluded infrastructure repositories (`auth-infra`, `tak-infra`, `media-infra`).

## Requirements

### Requirement: AWS SDK call isolation
Calls to AWS runtime services SHALL NOT be executed when `CLOUDTAK_Mode=docker-compose`.

#### Scenario: SecretsManager bypass
- **WHEN** the application starts up in docker-compose mode and reads JWT signing secrets
- **THEN** it SHALL use the environment variable `SigningSecret` directly without initializing or calling the AWS SecretsManager client

#### Scenario: STS ARN prefix resolution bypass
- **WHEN** the application initializes ETL event routing or queue configuration in docker-compose mode
- **THEN** it SHALL NOT invoke `fetchArnPrefix()` or AWS STS `GetCallerIdentityCommand`

#### Scenario: Authentik API token resolution bypass
- **WHEN** the application initializes AuthentikProvider in docker-compose mode with `AUTHENTIK_API_TOKEN` set
- **THEN** it SHALL use the direct token value without initializing or invoking the AWS SecretsManager client

### Requirement: Elimination of mandatory AWS SQS dependency
The API and event tasks SHALL NOT require active AWS SQS queues to boot or handle CoT event ingestion.

#### Scenario: Event ingestion without SQS
- **WHEN** CoT messages and sensor events are posted to the API in docker-compose mode
- **THEN** the events are processed via internal EventEmitter, WebSockets, or local persistence without requiring SQS queue URLs or SQS SendMessage permissions

### Requirement: Independent media streaming service
Video and RTSP/WebRTC feeds SHALL be serviced by a standard MediaMTX container instead of `ghcr.io/dfpc-coe/media-infra`.

#### Scenario: Video stream ingestion and distribution
- **WHEN** video sources connect to the media server via RTSP or WebRTC
- **THEN** MediaMTX routes and transcodes the stream according to local configuration without contacting proprietary dfpc-coe infrastructure
