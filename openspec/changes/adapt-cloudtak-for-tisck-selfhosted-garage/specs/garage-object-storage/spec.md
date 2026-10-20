# Spec Delta

## Purpose

All S3-compatible object storage operations in TISCK work correctly against Garage with explicit local endpoints, configurable credentials, and validated behavior for every operation the application performs.

## ADDED Requirements

### Requirement: Object upload and download via Garage
The application SHALL successfully upload and download objects to/from Garage using the AWS S3 SDK with a custom endpoint.

#### Scenario: Upload a file to Garage
- **WHEN** the API receives a file upload (e.g., asset, icon set, profile file)
- **THEN** the file SHALL be stored in Garage under the configured `ASSET_BUCKET` and retrievable via a subsequent download request

#### Scenario: Download a previously uploaded file
- **WHEN** the API requests a previously uploaded object by key
- **THEN** the response SHALL contain the identical byte content that was uploaded

### Requirement: Object listing and metadata retrieval
The application SHALL list objects by prefix and retrieve object metadata (HEAD) from Garage.

#### Scenario: List objects by prefix
- **WHEN** the application lists objects with prefix `connection/1/`
- **THEN** Garage returns all objects whose keys start with that prefix

#### Scenario: Head request returns metadata
- **WHEN** the application sends a HEAD request for an existing object
- **THEN** Garage returns content-length, content-type, and last-modified metadata

### Requirement: Object deletion
The application SHALL delete individual objects and objects by prefix from Garage.

#### Scenario: Delete a single object
- **WHEN** the application deletes an object by exact key
- **THEN** a subsequent GET for that key SHALL return a not-found error

#### Scenario: Recursive delete by prefix
- **WHEN** the application deletes objects with `recurse: true` for a prefix
- **THEN** all objects matching that prefix SHALL be removed

### Requirement: Multipart upload support
Large file uploads SHALL use the S3 multipart upload protocol via `@aws-sdk/lib-storage` Upload.

#### Scenario: Upload a file larger than 5MB
- **WHEN** a file exceeding 5MB is uploaded through the API
- **THEN** the upload completes successfully using multipart upload against Garage

### Requirement: PMTiles range request support
PMTiles serving SHALL use HTTP range requests to read tile data from objects stored in Garage.

#### Scenario: PMTiles tile retrieval
- **WHEN** the tiles service receives a tile request for a PMTiles archive stored in Garage
- **THEN** the service SHALL issue a range GET request to Garage and return the tile data

### Requirement: Garage persistence across restarts
Objects stored in Garage SHALL survive service restarts via Docker volume persistence.

#### Scenario: Object survives Garage restart
- **WHEN** an object is uploaded, the Garage container is stopped and restarted
- **THEN** the object SHALL be retrievable with identical content

### Requirement: Configurable S3 endpoint and credentials
S3 endpoint, access key, and secret key SHALL be configurable via environment variables.

#### Scenario: Custom endpoint configuration
- **WHEN** `AWS_S3_Endpoint` is set to `http://store:3900`
- **THEN** all S3 operations SHALL target that endpoint with path-style addressing

#### Scenario: Authentication failure on wrong credentials
- **WHEN** `AWS_S3_AccessKeyId` or `AWS_S3_SecretAccessKey` is incorrect
- **THEN** S3 operations SHALL fail with an authentication error, not silently succeed

### Requirement: Bucket initialization
The Garage deployment SHALL automatically create the configured bucket on first startup.

#### Scenario: Default bucket created automatically
- **WHEN** Garage starts with `GARAGE_DEFAULT_BUCKET` set
- **THEN** the bucket SHALL exist and be accessible for S3 operations without manual intervention
