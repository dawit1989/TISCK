# Spec Delta

## Purpose

Defines the integration boundary, authentication protocols, and lifecycle verification for enrolling and renewing TAK client X.509 certificates against an internal Certificate Authority.

## ADDED Requirements

### Requirement: TAK client CSR signing interface
The system SHALL support generating client cryptographic keypairs, constructing Certificate Signing Requests (CSRs), and obtaining signed certificates from the designated TAK CA.

#### Scenario: CSR generation with required subject attributes
- **WHEN** certificate enrollment is initiated for an authenticated identity
- **THEN** the system generates a private key and CSR populated with organizational attributes (O, OU) matching TAK CA configuration

#### Scenario: Signed certificate retrieval
- **WHEN** the CSR is submitted to the TAK CA signing endpoint with valid credentials
- **THEN** the CA returns an X.509 client certificate and root CA trust chain

### Requirement: Identity-mediated certificate enrollment
Certificate issuance SHALL be authenticated using verified operator identity claims from the identity provider.

#### Scenario: Token-authenticated enrollment
- **WHEN** a client initiates enrollment using an OIDC access token or JWT assertion
- **THEN** the CA verifies the token against the identity provider before signing the certificate

#### Scenario: Identity-bound certificate subject
- **WHEN** the signed certificate is issued
- **THEN** the certificate Common Name (CN) corresponds directly to the authenticated operator username

### Requirement: Certificate lifecycle and validity verification
The system SHALL monitor certificate validity and renew certificates approaching expiration or rejected due to revocation.

#### Scenario: Expiration threshold renewal
- **WHEN** an authenticated user logs in and their client certificate expires within 7 days
- **THEN** the system automatically executes enrollment renewal to issue a refreshed certificate

#### Scenario: Revocation detection and recovery
- **WHEN** a client certificate is probed against the TAK service and rejected as invalid or revoked
- **THEN** the system marks the credential for immediate re-enrollment upon next valid authentication

### Requirement: Candidate endpoint and port verification
Integration endpoints and network ports for TAK certificate enrollment SHALL be validated against server configuration rather than assumed defaults.

#### Scenario: Enrollment endpoint configuration
- **WHEN** configuring TAK client enrollment services
- **THEN** the system targets explicitly defined REST endpoints (`/Marti/api/tls/config` and `/Marti/api/tls/signClient/v2`) over verified HTTPS connections

#### Scenario: Candidate port verification
- **WHEN** deploying enrollment networking
- **THEN** proposed candidate ports (including port 8446) are treated as configurable parameters verified against actual TAK Server runtime configuration
