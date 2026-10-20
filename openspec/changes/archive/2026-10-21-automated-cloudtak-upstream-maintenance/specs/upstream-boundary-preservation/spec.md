# Spec Delta

## ADDED Requirements

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
