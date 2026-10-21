# self-hosted-deployment Specification Delta

## MODIFIED Requirements

### Requirement: No dependency on excluded infrastructure repositories
TISCK core services SHALL NOT require external cloud-dependent infrastructure repositories, while supporting tak-infra as an optional decoupled self-hosted Compose environment.

#### Scenario: Startup without excluded repos
- **WHEN** TISCK core is deployed on a host that has never cloned `auth-infra` or `media-infra`
- **THEN** all core services start and the web UI is accessible at the configured `API_URL` without requiring TAK Server to run

#### Scenario: Optional decoupled tak-infra deployment
- **WHEN** the operator chooses to run the ported `tak-infra` environment
- **THEN** `tak-infra` operates cleanly in its own self-contained Docker Compose stack without external AWS infrastructure dependencies

#### Scenario: Media service uses upstream image
- **WHEN** docker-compose services are started
- **THEN** the media service SHALL use an upstream MediaMTX image or a TISCK-maintained image, not `ghcr.io/dfpc-coe/media-infra`
