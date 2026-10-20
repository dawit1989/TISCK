# self-hosted-deployment Specification

## Purpose

TISCK operates as a fully self-hosted Docker Compose deployment, eliminating all mandatory dependencies on AWS infrastructure, the excluded infrastructure repositories, and internet connectivity for core operations.

## Requirements

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
The Compose configuration SHALL define health checks for PostGIS, Garage, and Identity services.

#### Scenario: PostGIS health check
- **WHEN** the postgis service is running
- **THEN** Docker reports its health status via a `pg_isready` or equivalent check

#### Scenario: Garage health check
- **WHEN** the store (Garage) service is running
- **THEN** Docker reports its health status based on S3 API port readiness

#### Scenario: Identity services health check
- **WHEN** the identity-server and identity-cache services are running
- **THEN** Docker reports their health status via HTTP endpoint probe and redis-cli ping

### Requirement: Network interface isolation and port binding
Public tactical ingress services SHALL be accessible across the local network (`0.0.0.0`), while database, object store administration, and internal service ports SHALL NOT be exposed to external network interfaces by default (`127.0.0.1` or internal Docker network).

#### Scenario: Public ingress service port bindings
- **WHEN** docker-compose services are running
- **THEN** the API service (port 5000), Tiles service (port 5002), and Media streaming ports (8554, 8889, 1935) SHALL be bound to `0.0.0.0` to permit LAN tactical client connectivity

#### Scenario: PostGIS port binding
- **WHEN** docker-compose services are running
- **THEN** PostgreSQL port 5432 SHALL be bound to `127.0.0.1` only

#### Scenario: Garage admin and S3 port binding
- **WHEN** docker-compose services are running
- **THEN** Garage admin API port 3903 and S3 data port 3900 SHALL be bound to `127.0.0.1` only or kept strictly internal to the Docker network, with all client tile and asset access proxied through the API and Tiles services

#### Scenario: Identity service port binding
- **WHEN** docker-compose identity services are running
- **THEN** Authentik administrative and LDAP compatibility ports SHALL be bound to `127.0.0.1` or kept internal to the Docker network, with tactical client authentication routed via reverse proxy or designated ingress

### Requirement: Orchestration of self-hosted identity services
The Compose configuration SHALL include services for the self-hosted identity provider server, worker, and cache.

#### Scenario: Identity services in Compose configuration
- **WHEN** `docker compose config --services` is executed with identity services enabled
- **THEN** the output includes identity-server, identity-worker, and identity-cache services

#### Scenario: Stateful identity volume persistence
- **WHEN** the identity services are restarted via `docker compose stop` and `docker compose up -d`
- **THEN** user directories, authentication flows, and configuration data are preserved across restarts

### Requirement: Architectural isolation of TISCK assets from upstream code
The Docker Compose deployment configuration and operational scripts SHALL remain logically and functionally partitioned from upstream CloudTAK application source code.

#### Scenario: Compose configuration independence
- **WHEN** environment variables, networking, or container port bindings are adjusted
- **THEN** changes are applied entirely within `docker-compose.yml` or `.env` files without requiring rebuilds or patches to upstream application source trees

#### Scenario: Preservation of persistent application state
- **WHEN** services are restarted, redeployed, or upgraded
- **THEN** PostgreSQL databases (`postgis-data`), Garage S3 buckets (`garage-meta`, `garage-data`), Authentik identity state (`identity-cache-data`, `authentik-media`), and secrets are preserved without data loss or re-initialization

