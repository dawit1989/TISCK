# Spec Delta

## ADDED Requirements

### Requirement: Architectural isolation of TISCK assets from upstream code
The Docker Compose deployment configuration and operational scripts SHALL remain logically and functionally partitioned from upstream CloudTAK application source code.

#### Scenario: Compose configuration independence
- **WHEN** environment variables, networking, or container port bindings are adjusted
- **THEN** changes are applied entirely within `docker-compose.yml` or `.env` files without requiring rebuilds or patches to upstream application source trees

#### Scenario: Preservation of persistent application state
- **WHEN** services are restarted, redeployed, or upgraded
- **THEN** PostgreSQL databases (`postgis-data`), Garage S3 buckets (`garage-meta`, `garage-data`), Authentik identity state (`identity-cache-data`, `authentik-media`), and secrets are preserved without data loss or re-initialization
