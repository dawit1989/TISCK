# garage-object-storage Specification Delta

## MODIFIED Requirements

### Requirement: Bucket initialization
The Garage deployment SHALL automatically create the configured bucket on first startup.

#### Scenario: Default bucket created automatically
- **WHEN** Garage starts with `GARAGE_DEFAULT_BUCKET` set
- **THEN** the bucket SHALL exist and be accessible for S3 operations without manual intervention

#### Scenario: TAK Server bucket provisioning
- **WHEN** the Garage initialization script runs
- **THEN** it creates the dedicated `tak-server` bucket and grants read and write permissions to the configured access key

## ADDED Requirements

### Requirement: TAK Server configuration and package synchronization
The system SHALL support bidirectional synchronization of TAK Server CoreConfig, certificates, and tactical mission packages against the deployed Garage S3 service.

#### Scenario: Sync CoreConfig from Garage
- **WHEN** TAK Server boots with S3 integration enabled and an existing CoreConfig exists in the `tak-server` bucket
- **THEN** the sync utility downloads the canonical CoreConfig prior to server initialization

#### Scenario: Graceful fallback when Garage is unreachable
- **WHEN** TAK Server starts and the Garage S3 endpoint is unavailable
- **THEN** the system logs a warning and proceeds using local volume storage without crashing
