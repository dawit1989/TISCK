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

### Requirement: Release validation boundary isolation
The system SHALL execute all candidate qualification, upgrade simulation, and automated regression testing within a sandboxed execution boundary that strictly isolates test environments from active production networks, databases, persistent storage, and credentials.

#### Scenario: Ephemeral CI test containment
- **WHEN** candidate validation tests run in automated workflows
- **THEN** tests execute against ephemeral container networks and disposable storage volumes with zero network connectivity or shared mount points to the active production deployment

#### Scenario: Synthetic credential enforcement
- **WHEN** qualification tests execute OIDC authentication and API authorization checks
- **THEN** tests use isolated synthetic test credentials and test identity providers without reading or logging production secrets, keys, or certificates

### Requirement: Patch collision and retirement gating
The system SHALL evaluate any candidate upstream commit modifying files touched by TISCK patches against documented customization baselines, prohibiting automatic retirement of source patches without verified configuration equivalence.

#### Scenario: Automated patch overlap detection
- **WHEN** an upstream release modifies a file containing a TISCK customization (such as `oidc.ts` or `config.ts`)
- **THEN** the system generates an overlap alert in the compatibility assessment and requires explicit manual review before staging a vendor merge

#### Scenario: Preservation of unreplaced security guards
- **WHEN** candidate validation runs without native configuration equivalents for signing secret validation or offline PostGIS TLS bypass
- **THEN** the system enforces retention of TISCK patch guards and halts promotion if patches are silently dropped

