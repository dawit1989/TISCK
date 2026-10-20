# Spec Delta

## Purpose

TISCK operates as a fully self-hosted Docker Compose deployment, eliminating all mandatory dependencies on AWS infrastructure, the excluded infrastructure repositories, and internet connectivity for core operations.

## ADDED Requirements

### Requirement: Application starts without AWS credentials
The TISCK application SHALL start successfully when no AWS credentials, AWS environment variables (other than `AWS_REGION` which may default), or AWS IAM roles are present.

#### Scenario: Clean startup without AWS credentials
- **WHEN** TISCK is started with `CLOUDTAK_Mode=docker-compose` and no `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or AWS IAM role configured
- **THEN** all services (api, tiles, events, retention, postgis, store, media) reach a healthy state within 120 seconds

#### Scenario: No AWS SecretsManager call in docker-compose mode
- **WHEN** `CLOUDTAK_Mode=docker-compose` and `SigningSecret` is set in the environment
- **THEN** the application SHALL NOT attempt to contact AWS Secrets Manager and SHALL use the provided `SigningSecret` value directly

### Requirement: No dependency on excluded infrastructure repositories
TISCK SHALL NOT require `auth-infra`, `tak-infra`, or `media-infra` repositories to be cloned, built, or deployed.

#### Scenario: Startup without excluded repos
- **WHEN** TISCK is deployed on a host that has never cloned `auth-infra`, `tak-infra`, or `media-infra`
- **THEN** all services start and the web UI is accessible at the configured `API_URL`

#### Scenario: Media service uses upstream image
- **WHEN** docker-compose services are started
- **THEN** the media service SHALL use an upstream MediaMTX image or a TISCK-maintained image, not `ghcr.io/dfpc-coe/media-infra`

### Requirement: Self-contained Docker Compose deployment
TISCK SHALL deploy all required services via a single `docker compose up` invocation from the repository root.

#### Scenario: All services defined in Compose
- **WHEN** `docker compose config --services` is run
- **THEN** the output SHALL include at minimum: api, tiles, events, postgis, store (Garage), and a media service

#### Scenario: Persistent state survives restart
- **WHEN** all services are stopped with `docker compose stop` and restarted with `docker compose up -d`
- **THEN** PostgreSQL data, Garage objects, and application configuration SHALL be preserved

### Requirement: Health checks for stateful services
The Compose configuration SHALL define health checks for PostGIS and Garage.

#### Scenario: PostGIS health check
- **WHEN** the postgis service is running
- **THEN** Docker reports its health status via a `pg_isready` or equivalent check

#### Scenario: Garage health check
- **WHEN** the store (Garage) service is running
- **THEN** Docker reports its health status based on S3 API port readiness

### Requirement: Administrative ports bound to localhost
Database, object store administration, and internal service ports SHALL NOT be exposed to external network interfaces by default.

#### Scenario: PostGIS port binding
- **WHEN** docker-compose services are running
- **THEN** PostgreSQL port 5432 is bound to `127.0.0.1` only

#### Scenario: Garage admin port binding
- **WHEN** docker-compose services are running
- **THEN** Garage admin API port 3903 SHALL NOT be exposed outside the Docker network
