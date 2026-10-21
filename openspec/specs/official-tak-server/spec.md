# official-tak-server Specification

## Purpose

Enables running the official TAK Server release in a self-hosted, offline Docker environment with local database persistence, internal CA generation, and configurable network port isolation.

## Requirements

### Requirement: Self-hosted TAK Server orchestration
The system SHALL provide a dedicated Docker Compose configuration in tak-infra to run official TAK Server alongside a bundled PostgreSQL/PostGIS database on an isolated bridge network.

#### Scenario: Standalone stack startup
- **WHEN** the operator starts the tak-infra stack via docker compose up
- **THEN** the bundled PostGIS database and TAK Server containers initialize successfully without cloud dependencies

#### Scenario: Database isolation
- **WHEN** the tak-infra services are running
- **THEN** the bundled PostgreSQL container is isolated to the internal Docker network and does not conflict with host port 5432

### Requirement: Independent PostgreSQL database orchestration
The system SHALL provide an independent PostgreSQL container with PostGIS extensions, performance optimizations, and health checks dedicated to TAK Server.

#### Scenario: Database readiness coordination
- **WHEN** the tak-infra Compose services start
- **THEN** TAK Server blocks execution of SchemaManager until tak-db reports healthy via pg_isready

#### Scenario: Extension initialization
- **WHEN** tak-db initializes for the first time
- **THEN** PostGIS and uuid-ossp extensions are automatically created in the takserver database

#### Scenario: High-throughput performance tuning
- **WHEN** tak-db starts
- **THEN** it allocates at least 256MB shared memory and sets connection limits suited for high-rate Cursor-on-Target ingestion

### Requirement: Authentik LDAP Outpost authentication and group mapping
The system SHALL authenticate connecting TAK clients against Authentik's LDAP Outpost on cloudtak-net and map Authentik tactical groups to TAK Server channels.

#### Scenario: User authentication against Authentik LDAP
- **WHEN** a client submits credentials matching an active Authentik operator account
- **THEN** TAK Server successfully authenticates the user via LDAP search and bind to `ldap://identity-ldap:389`

#### Scenario: Dynamic tactical group-to-channel mapping
- **WHEN** an authenticated user connects
- **THEN** TAK Server extracts the user's `memberOf` group attributes and assigns corresponding tactical channel subscriptions

### Requirement: Automated internal CA generation
The system SHALL generate an internal Root CA and Intermediate CA keypair and truststores on first container boot if certificates do not exist.

#### Scenario: Initial certificate generation
- **WHEN** the TAK Server container starts without pre-existing certificates in the certs volume
- **THEN** the startup script executes internal CA generation scripts and writes ca.pem, ca-trusted.pem, and truststores to the persistent volume

#### Scenario: Certificate reuse across restarts
- **WHEN** the container restarts with existing CA files in the certs volume
- **THEN** the startup script reuses existing certificates without regenerating or overwriting them

### Requirement: Offline TLS operation
The system SHALL operate TLS/HTTPS endpoints using internal self-signed certificates by default and avoid mandatory Let's Encrypt renewal calls.

#### Scenario: Default offline HTTPS operation
- **WHEN** the server starts with ENABLE_LETSENCRYPT unset or false
- **THEN** the HTTPS web and certificate enrollment connectors use the internal self-signed keystore and do not execute external certbot requests

#### Scenario: Configurable Let's Encrypt opt-in
- **WHEN** ENABLE_LETSENCRYPT is explicitly set to true and a public domain is configured
- **THEN** the system executes the background Certbot renewal workflow

### Requirement: Tactical ingress port mapping
The system SHALL bind configurable tactical client and administrative ingress ports to all interfaces for mesh reachability.

#### Scenario: Port binding configuration
- **WHEN** the service starts with environment port configurations
- **THEN** ports 8089 (CoT TLS), 8443 (Web Admin), and 8446 (Cert Enrollment) bind to 0.0.0.0 while management APIs remain locked down
