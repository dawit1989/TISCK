# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Orchestration of self-hosted identity services
The Compose configuration SHALL include services for the self-hosted identity provider server, worker, and cache.

#### Scenario: Identity services in Compose configuration
- **WHEN** `docker compose config --services` is executed with identity services enabled
- **THEN** the output includes identity-server, identity-worker, and identity-cache services

#### Scenario: Stateful identity volume persistence
- **WHEN** the identity services are restarted via `docker compose stop` and `docker compose up -d`
- **THEN** user directories, authentication flows, and configuration data are preserved across restarts
