# upstream-release-lifecycle Specification

## Purpose

Establishes an automated, repeatable lifecycle for discovering upstream CloudTAK releases, assessing compatibility against TISCK extensions, validating candidates in isolated test environments, and preparing auditable upgrade proposals.

## Requirements

### Requirement: Authoritative upstream release discovery
The system SHALL monitor the authoritative upstream CloudTAK repository (`https://github.com/dfpc-coe/CloudTAK.git`) via scheduled automation and manual invocation to discover new releases and commit SHAs without altering active deployments.

#### Scenario: Scheduled discovery of new release tag
- **WHEN** a scheduled upstream check executes and encounters a newly published upstream release tag on the canonical repository
- **THEN** the system records the release tag, resolved commit SHA, publication timestamp, and release notes without modifying the approved upstream pin or running deployment

#### Scenario: Manual trigger for specific release or commit
- **WHEN** an operator manually triggers the discovery workflow specifying a target upstream tag or commit SHA
- **THEN** the system resolves the target reference against the canonical upstream repository and initiates candidate evaluation for that specific commit

#### Scenario: Duplicate release deduplication
- **WHEN** a discovered release tag and commit SHA match an existing candidate branch, open pull request, or the currently approved version
- **THEN** the system skips redundant branch creation and logs an informational notice that the release is already tracked

### Requirement: Multi-state explicit upstream version pinning
The system SHALL maintain explicit, reproducible records of upstream versions across five distinct lifecycle states and prohibit unpinned or moving references, anchoring the approved tag in `cloudtak/.upstream-version`.

#### Scenario: Approved upstream pin preservation
- **WHEN** release discovery or compatibility assessment completes
- **THEN** the approved upstream pin recorded in `cloudtak/.upstream-version` remains unchanged until explicit operator approval

#### Scenario: State differentiation enforcement
- **WHEN** candidate tracking records are inspected
- **THEN** the system distinguishes Currently Deployed (`cloudtak/.env`), Approved Upstream (`cloudtak/.upstream-version`), Newly Discovered, Candidate Under Validation, and Last Known-Good Release

#### Scenario: Prohibition of moving branches
- **WHEN** an upstream version pin is configured or evaluated
- **THEN** the system rejects moving branch names such as `main`, `master`, or `latest` and requires an exact immutable release tag and resolved commit SHA

### Requirement: Automated compatibility and impact assessment
The system SHALL perform automated diff analysis between the candidate release and the approved baseline to generate a categorized compatibility report before candidate testing, treating static scans as risk indicators.

#### Scenario: Identification of sensitive subsystem changes
- **WHEN** upstream changes between the approved pin and candidate release touch authentication, OIDC, database migrations, Dockerfiles, or API routing
- **THEN** the system flags affected subsystems and classifies their risk severity (High, Medium, Low) and detection confidence in the compatibility report

#### Scenario: Detection of overlaps with TISCK customizations
- **WHEN** an upstream change alters lines or files modified by TISCK customizations (including `oidc.ts`, `config.ts`, `login.ts`, `etl-events.ts`, or `authentik-provider.ts`)
- **THEN** the system identifies the conflict boundary, highlights the customization at risk, and recommends whether manual review or automated vendor merging is required

#### Scenario: Breaking change and deprecation gating
- **WHEN** upstream introduces removed configuration keys, deprecated interfaces, breaking API contract changes, or mandatory cloud dependencies
- **THEN** the assessment flags the candidate as requiring investigation or blocks automated pull request progression with detailed diagnostic rationale

### Requirement: TISCK configuration and customization preservation
The system SHALL verify that TISCK-owned Compose declarations, environment variable overrides, dual-homed OIDC routing, and security postures remain intact across candidate releases.

#### Scenario: Dual-homed OIDC contract verification
- **WHEN** candidate application code or configuration is evaluated
- **THEN** the system verifies that browser-facing endpoints (`localhost:9000` / public ingress) and internal Docker backchannel endpoints (`identity-server:9000`) remain isolated and correctly resolved

#### Scenario: Upstream configuration change detection
- **WHEN** upstream modifies configuration loading mechanisms or environment variable names
- **THEN** the system produces a remediation report and proposed configuration bridge rather than silently editing working TISCK code

### Requirement: Isolated candidate validation execution
The system SHALL build and test candidate releases in an isolated CI execution environment that prevents any mutation or exposure of production databases, storage volumes, credentials, or network services.

#### Scenario: Ephemeral environment isolation
- **WHEN** candidate validation tests execute
- **THEN** the test environment utilizes unique Compose project identifiers (`-p`), ephemeral containers, isolated virtual networks, disposable PostGIS instances, and synthetic test credentials completely partitioned from production

#### Scenario: Comprehensive qualification test gates
- **WHEN** a candidate release undergoes automated validation
- **THEN** the test pipeline executes Compose validation, container startup, CloudTAK API smoke checks, TISCK OIDC unit and live regression tests, browser login/refresh/logout journeys, invalid-token rejection, and persistent restart tests

#### Scenario: Test reporting taxonomy
- **WHEN** candidate qualification tests execute
- **THEN** each test outcome is explicitly reported in one of four standardized categories: PASSED, FAILED, NOT_RUN, or BLOCKED by unavailable infrastructure

#### Scenario: Identity test fidelity distinction
- **WHEN** identity and OIDC tests are reported
- **THEN** the report distinguishes unit and mock token validations from live Authentik integration tests and browser-driven CDP authentication flows

#### Scenario: Test failure diagnostic reporting
- **WHEN** any candidate qualification test fails
- **THEN** the pipeline halts candidate promotion, marks the candidate as failed, and generates an issue or report with reproducible logs, stack traces, and failure categorization

### Requirement: Reviewable upgrade proposal pull request
The system SHALL generate an auditable, reviewable pull request for passing candidate releases that aggregates all validation artifacts, changelogs, and rollback procedures.

#### Scenario: Pull request generation for qualified candidate
- **WHEN** a candidate release passes all automated compatibility and validation test gates
- **THEN** the system creates a candidate branch and opens a reviewable pull request containing exact commit SHAs, upstream changelogs, test execution summaries, migration impact assessments, and rollback procedures

#### Scenario: Credential sanitization in proposals
- **WHEN** candidate pull requests, reports, or test logs are generated
- **THEN** the system verifies that no live credentials, private certificates, generated secrets, or production data exports are included in the branch or pull request body

### Requirement: Staged release governance policy
The system SHALL enforce a six-stage lifecycle (Stage A: Detect, Stage B: Analyze, Stage C: Test, Stage D: Prepare, Stage E: Approve, Stage F: Deploy) where production deployment requires explicit operator authorization.

#### Scenario: Production deployment gate enforcement
- **WHEN** an upgrade pull request is prepared and passes CI checks
- **THEN** the system prohibits automated deployment to the active production environment and requires an explicit, authenticated maintainer approval action

#### Scenario: Pre-deployment backup and rollback prerequisite
- **WHEN** an approved upgrade is authorized for production deployment (Stage F)
- **THEN** the deployment workflow verifies pre-deployment database and volume snapshots, validates health check endpoints, and provisions an automated rollback plan
