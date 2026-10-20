# Spec Delta

## Purpose

Provides a self-hosted, offline-capable identity provider based on Authentik to manage users, tactical groups, credentials, and OIDC/LDAP authentication in disconnected environments.

## ADDED Requirements

### Requirement: Disconnected identity service startup
The identity provider server and background worker SHALL start and reach healthy operating status without external internet access or public cloud dependencies.

#### Scenario: Offline container boot
- **WHEN** Authentik server and worker containers are started on an isolated network with no route to the public internet
- **THEN** the services initialize database schemas, start web and task listeners, and report healthy status within 120 seconds

#### Scenario: Pinned container execution
- **WHEN** container images are loaded from pre-cached offline archive files
- **THEN** all identity services start using pinned image digests without querying remote container registries

### Requirement: Tactical group claims and role mapping
The identity provider SHALL maintain standard TISCK tactical groups and include verified group memberships in standard OIDC claims.

#### Scenario: Tactical group assignment
- **WHEN** an operator is assigned to TISCK tactical groups (`TISCK_INTEL`, `TISCK_RECON`, `TISCK_COMMAND`, or `TISCK_ISR`)
- **THEN** the user's group memberships are persisted in the identity store and reflected in administrative directory listings

#### Scenario: OIDC groups claim delivery
- **WHEN** an authenticated client exchanges an authorization code and requests the UserInfo endpoint with `groups` scope
- **THEN** the response payload contains a `groups` array listing all assigned TISCK tactical groups and administrative roles

### Requirement: Local secret bootstrapping and recovery
The identity provider SHALL bootstrap administrative access and operational secrets from local configuration and provide an offline recovery mechanism.

#### Scenario: Local secret initialization
- **WHEN** the identity stack initializes with `AUTHENTIK_SECRET_KEY` and bootstrap environment variables
- **THEN** initial administrator accounts and API tokens are created without external cloud Secrets Manager calls

#### Scenario: Break-glass administrative recovery
- **WHEN** an administrator invokes the offline CLI recovery tool on the identity server container
- **THEN** a temporary administrative login URL or password reset token is issued directly via local console

### Requirement: Disconnected authentication and MFA policy
The identity provider SHALL enforce security policies and multi-factor authentication using mechanisms that function entirely without internet connectivity.

#### Scenario: Offline TOTP authentication
- **WHEN** an operator authenticates with username, password, and standard RFC 6238 time-based one-time password (TOTP)
- **THEN** the identity provider validates the token against local system clock time without contacting external verification servers

#### Scenario: Authentication session revocation
- **WHEN** an administrator or user revokes an active session or disables a user account
- **THEN** subsequent token refresh and userinfo requests for that session are immediately rejected

### Requirement: Optional LDAP Outpost compatibility interface
The identity provider SHALL optionally support an LDAP Outpost interface restricted to internal networks for legacy client compatibility.

#### Scenario: LDAP bind authentication
- **WHEN** an authorized client performs an LDAP bind using valid directory credentials
- **THEN** the LDAP Outpost authenticates the bind request and returns directory attributes matching the user's groups

#### Scenario: Loopback and network restriction
- **WHEN** the LDAP Outpost is deployed
- **THEN** LDAP ports (389, 636) are bound strictly to `127.0.0.1` or internal Docker networks, preventing external perimeter exposure

### Requirement: Fail-closed outage behavior
Downstream applications integrated with the identity provider SHALL fail closed when the identity service is unreachable, prohibiting unauthorized access.

#### Scenario: Identity provider outage rejection
- **WHEN** the identity provider service is stopped or unreachable and an unauthenticated client requests access
- **THEN** downstream applications reject the login request with an error and do not allow unauthenticated session creation

#### Scenario: Local break-glass account exception
- **WHEN** the identity provider is offline and a designated emergency break-glass account logs in via local credentials
- **THEN** the application validates credentials against its local store and permits administrative emergency access
