# Proposal: Integrate Official TAK Server (tak-infra) into TISCK

## Why

TISCK currently operates CloudTAK as a self-hosted geospatial awareness and video streaming platform, but tactical field operators require full compatibility with official TAK Server capabilities—specifically ATAK/WinTAK Cursor-on-Target (CoT) streams over TLS (port 8089), administrative management over HTTPS (port 8443), client X.509 certificate enrollment (port 8446), and tactical Mission Package exchange. The upstream `tak-infra` repository provides an official TAK Server container implementation, but it is tightly bound to AWS infrastructure (CloudFormation, Secrets Manager, S3 Files, ECR, Route53, and AWS Root CA). 

Porting `tak-infra` into TISCK as a standalone, self-hosted Docker Compose environment eliminates all AWS dependencies while leveraging TISCK's already deployed **Garage S3** object storage and PostGIS infrastructure.

## What Changes

- **Self-Hosted tak-infra Docker Compose**: Provide a standalone `docker-compose.yml` and `.env.example` inside `tak-infra/` with a bundled PostgreSQL/PostGIS database and isolated network, while connecting to `cloudtak-net` to reach Garage S3 (`store:3900`).
- **AWS Secrets Manager & Cloud Dependency Removal**: Refactor `tak-infra/start` to eliminate AWS Secrets Manager CLI commands (`aws secretsmanager get-secret-value` and `put-secret-value`), replacing them with local Docker volume persistence (`/opt/tak/certs`) and automated internal Root/Intermediate CA generation on initial boot.
- **Deployed Garage S3 Integration**: Implement a lightweight Node.js S3 synchronization utility using `@aws-sdk/client-s3` (with path-style addressing and custom endpoint support) to synchronize `CoreConfig.xml`, certificates, and tactical Mission Packages with the deployed Garage S3 instance, falling back gracefully to local volumes if Garage is temporarily unreachable.
- **Automated Bucket Provisioning**: Extend `cloudtak/scripts/init-garage.ps1` and `init-garage.sh` to provision the `tak-server` bucket and configure permissions for `cloudtak-key`.
- **Optional LDAP & Offline Auth**: Refactor `tak-infra/CoreConfig.ts` to make LDAP optional, removing mandatory AWS Root CA downloads and supporting TAK Server internal database/cert authentication by default, with optional integration into Authentik's LDAP Outpost.
- **Offline TLS & Opt-in Let's Encrypt**: Default HTTPS connectors to internal TAK CA / self-signed certificates, gating Let's Encrypt / Certbot behind `ENABLE_LETSENCRYPT=false`.
- **Hybrid Docker Build**: Update `tak-infra/Dockerfile` to detect and use local `takserver-docker-*.zip` archives from the build context for air-gapped environments, falling back to upstream download only if absent, and remove `awscli`.

## Capabilities

### New Capabilities
- `official-tak-server`: Standalone, self-hosted deployment of official TAK Server (v5.6) with internal CA generation, local PostGIS database, configurable port isolation, and automated startup provisioning.

### Modified Capabilities
- `garage-object-storage`: Support TAK Server configuration, certificate backup, and tactical mission package storage on the deployed Garage S3 service via dedicated bucket provisioning.
- `tak-certificate-enrollment`: Support TAK client certificate signing requests (CSRs) and enrollment endpoints (`/Marti/api/tls/signClient/v2`) powered by the self-hosted TAK CA.
- `self-hosted-deployment`: Update the infrastructure boundary to incorporate `tak-infra` as a self-hosted, decoupled Compose deployment within TISCK, eliminating all AWS runtime dependencies.

## Impact

- **Codebase**: New `docker-compose.yml`, `.env.example`, and Node.js S3 sync utility in `tak-infra/`; refactored `tak-infra/start`, `tak-infra/Dockerfile`, and `tak-infra/CoreConfig.ts`; updated `cloudtak/scripts/init-garage.*`.
- **Runtime Dependencies**: Zero external AWS runtime services; connects over `cloudtak-net` to `store:3900` (Garage).
- **Network Ports**: Exposes TAK client ports `8089` (CoT TLS), `8443` (Web UI/REST), and `8446` (Cert Enrollment) on `0.0.0.0`; database and admin ports isolated to internal network.
