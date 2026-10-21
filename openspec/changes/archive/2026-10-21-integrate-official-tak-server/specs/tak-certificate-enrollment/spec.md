# tak-certificate-enrollment Specification Delta

## MODIFIED Requirements

### Requirement: Candidate endpoint and port verification
Integration endpoints and network ports for TAK certificate enrollment SHALL be verified against and served by the self-hosted TAK Server runtime configuration.

#### Scenario: Enrollment endpoint configuration
- **WHEN** configuring TAK client enrollment services
- **THEN** the system targets explicitly defined REST endpoints (`/Marti/api/tls/config` and `/Marti/api/tls/signClient/v2`) over verified HTTPS connections

#### Scenario: Candidate port verification
- **WHEN** deploying enrollment networking
- **THEN** proposed candidate ports (including port 8446) are treated as configurable parameters verified against actual TAK Server runtime configuration

#### Scenario: Self-hosted enrollment listener
- **WHEN** TAK Server starts with CoreConfig.xml
- **THEN** connector cert_https is actively bound to port 8446 with clientAuth="false" enabling initial client CSR enrollment over HTTPS

## ADDED Requirements

### Requirement: Authenticated client auto-enrollment
The system SHALL automatically sign and return X.509 client certificates on port 8446 upon successful authentication against Authentik LDAP or internal credentials without manual admin queueing.

#### Scenario: Immediate certificate issuance on valid authentication
- **WHEN** an ATAK client submits a CSR to `/Marti/api/tls/signClient/v2` with valid Authentik operator credentials
- **THEN** the server immediately signs the CSR using the Intermediate CA and returns the client certificate and truststore without administrator approval

#### Scenario: Enrollment refusal on invalid credentials
- **WHEN** an ATAK client submits a CSR with invalid credentials
- **THEN** the server rejects the request with HTTP 401 Unauthorized and issues no certificate

### Requirement: QR-based dual enrollment provisioning
The system SHALL generate an ATAK/WinTAK enrollment Data Package (.zip) containing connection preferences and CA certificates, along with a scannable QR code, synchronized to Garage S3.

#### Scenario: Automated enrollment package generation
- **WHEN** TAK Server finishes initial CA and CoreConfig generation
- **THEN** the system generates `enrollment.zip` and `enrollment-qr.png` and uploads them to the `tak-server/enrollment/` prefix in Garage S3

#### Scenario: Terminal QR display for immediate field pairing
- **WHEN** an operator runs the enrollment display utility
- **THEN** the system prints an ASCII/ANSI QR code directly in the terminal for rapid scanning by ATAK devices
