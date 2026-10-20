# Proposal: Preserve TISCK Progress and Establish Upstream CloudTAK Boundary

## Why

TISCK has established a functional, proven, self-hosted tactical deployment of CloudTAK (v13.102.4) with offline OIDC authentication, Garage S3 object storage, PostGIS spatial data, and MediaMTX video streaming. The objective is to preserve all existing working functionality, architecture, persistent data, and credentials while establishing an explicit boundary between upstream CloudTAK application code and TISCK-owned deployment, integration, and operational assets.

Rather than rebuilding, rolling back, or performing risky in-place code rewrites, this change institutes an upstream preservation policy, inventories all existing source patches, establishes non-destructive validation harnesses, and defines a disciplined, phased migration path to reduce upstream code coupling safely without destabilizing operational capabilities.

## What Changes

- **Preserve Verified Operational Baselines**: Formally codify the retention of working OIDC login, token validation, session refresh, Authentik integration, tactical group mapping, Garage S3 persistence, and container lifecycle behaviors. Always recognize that while upstream CloudTAK possesses built-in OIDC SSO concepts, its configuration model is database/UI-driven (`oidc::*` settings) and its backchannel network assumptions require a flat DNS space rather than dual-homed Docker service names.
- **Upstream Boundary & Architecture Definition**: Explicitly delineate the five-tier architectural boundary: Upstream CloudTAK, TISCK Deployment Layer, TISCK Integration Layer, TISCK Test Harnesses, and External Support Services.
- **Upstream Source Customization Inventory & Classification**: Categorize all existing modifications across `cloudtak/` into documented upstream configurations, external deployment settings, TISCK-owned tooling, replaceable patches, and essential retained patches.
- **Upstream Preservation & Upgrade Policy**: Establish engineering policies and protocols for upstream synchronization (v13.102.4 baseline) that forbid modifying upstream source code when equivalent configuration or external integration hooks exist.
- **Stage A through Stage E Migration Roadmap**: Document a staged execution strategy that prioritizes regression protection, test verification, boundary definition, and incremental configuration migration over immediate code elimination.
- **Regression Test Matrix & Rollback Safeguards**: Establish explicit pre-flight verification requirements and rollback procedures for all deployment layers to protect persistent volumes, encryption keys, and active user directories.

## Capabilities

### New Capabilities
- `upstream-boundary-preservation`: Governs the boundary separation, upstream synchronization mechanics, customization classification, and source preservation policies between upstream CloudTAK and TISCK extensions.

### Modified Capabilities
- `self-hosted-deployment`: Updates deployment requirements to mandate architectural separation of TISCK configuration and integration layers from upstream CloudTAK application artifacts, preserving persistent state across updates.

## Impact

- **Affected Code & Layout**: Documents upstream boundary rules for `cloudtak/api`, `cloudtak/app`, `cloudtak/tasks`, and separates them logically from `cloudtak/docker-compose.yml`, `cloudtak/scripts/`, and root documentation.
- **APIs & Protocols**: Guarantees zero disruption to existing OIDC `/login/oidc`, `/login/oidc/callback`, `/login/refresh`, `/logout`, Authentik API, and Garage S3 endpoints.
- **Dependencies & State**: Protects existing Docker volumes (`postgis-data`, `garage-meta`, `garage-data`, `identity-cache-data`, `authentik-media`, `authentik-templates`), signing secrets, and certificates from re-initialization or destruction.
- **External Repositories**: Strictly reinforces independence from `dfpc-coe/auth-infra`, `dfpc-coe/tak-infra`, and `dfpc-coe/media-infra`.
