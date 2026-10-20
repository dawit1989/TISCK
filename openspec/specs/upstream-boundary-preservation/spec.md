# upstream-boundary-preservation Specification

## Purpose

Defines policies and architectural boundaries that preserve upstream CloudTAK application code integrity while isolating TISCK deployment configurations, integrations, and operational extensions.

## Requirements

### Requirement: Upstream source preservation policy
Modifications to upstream CloudTAK application source code in `cloudtak/api`, `cloudtak/app`, and `cloudtak/tasks` SHALL NOT be introduced when functionality can be achieved via documented configuration, environment variables, or external deployment integrations.

#### Scenario: Configuration alternative available
- **WHEN** a required operational behavior can be configured through CloudTAK environment variables or Compose settings
- **THEN** the system adopts the configuration mechanism and leaves upstream application source files unmodified

#### Scenario: Existing patch justification requirement
- **WHEN** an existing upstream source modification is evaluated for removal or modification
- **THEN** an evidence-based impact assessment and test validation plan MUST be completed before modifying or removing the patch

### Requirement: OIDC architectural constraints and dual-homed network boundary
System planning and OIDC evaluation SHALL recognize that upstream CloudTAK possesses built-in OIDC SSO concepts, but its configuration model is database and UI-driven (`oidc::*` settings) and its backchannel network assumptions require a flat DNS space rather than dual-homed Docker service names.

#### Scenario: Architectural evaluation condition
- **WHEN** evaluating upstream CloudTAK OIDC capabilities against TISCK requirements
- **THEN** planning models SHALL treat upstream's database-driven `oidc::*` settings and flat-DNS backchannel network assumptions as explicit architectural constraints requiring dual-homed backchannel translation and automated environment bootstrapping

#### Scenario: Preservation of working dual-homed OIDC integration
- **WHEN** operating the self-hosted containerized deployment
- **THEN** the system SHALL preserve the proven dual-homed network routing, ID token validation, and environment-driven OIDC configurations until a native configuration-only migration is independently proven and approved

### Requirement: Five-tier architectural boundary enforcement
The system SHALL organize components into five distinct tiers with unidirectional dependencies: Upstream CloudTAK, TISCK Deployment Layer, TISCK Integration Layer, TISCK Test Harness, and External Support Services.

#### Scenario: Deployment layer isolation
- **WHEN** Compose definitions, environment files, or container port mappings are modified
- **THEN** the modifications remain confined to TISCK-owned files (`docker-compose.yml`, `.env*`, `scripts/`) without altering upstream source directories

#### Scenario: Runtime dependency exclusion
- **WHEN** services are initialized in docker-compose mode
- **THEN** the system executes without runtime dependencies on external AWS services or excluded infrastructure repositories (`auth-infra`, `tak-infra`, `media-infra`)

### Requirement: Non-destructive test verification baseline
The system SHALL require automated regression test suites to execute non-destructively against running deployments without purging persistent volumes or re-running database initialization scripts.

#### Scenario: Pre-flight regression verification
- **WHEN** validating OIDC authentication or system integrity
- **THEN** tests execute without altering existing database tables, encryption keys, or user credentials
