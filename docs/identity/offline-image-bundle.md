# TISCK Offline Container Image Bundling Runbook

## Overview

In austere and disconnected tactical environments (Pillar A & Pillar B), TISCK host hardware operates without an internet gateway or access to external container registries (Docker Hub, GitHub Container Registry `ghcr.io`).

This document details the procedure for exporting, verifying, transporting, and importing all required identity container images.

---

## 1. Pinned Identity Image Inventory

The following pinned container images constitute the TISCK Self-Hosted Identity stack:

| Component | Pinned Image Reference | Architecture | Purpose |
| :--- | :--- | :--- | :--- |
| **Authentik Server** | `ghcr.io/goauthentik/server:2024.12.3` | `linux/amd64` | Web UI, OIDC Provider, REST API |
| **Authentik Worker** | `ghcr.io/goauthentik/server:2024.12.3` | `linux/amd64` | Celery background task worker |
| **Authentik LDAP** | `ghcr.io/goauthentik/ldap:2024.12.3` | `linux/amd64` | Optional LDAP Outpost compatibility |
| **Identity Cache** | `redis:7.4-alpine` | `linux/amd64` | Session state, task broker |
| **PostgreSQL / PostGIS**| `postgis/postgis:17-3.4-alpine` | `linux/amd64` | Persistent identity & GIS store |

---

## 2. Staging Workstation: Image Export Workflow

On an internet-connected staging system prior to field deployment:

### Step 1: Pull Pinned Images
```bash
docker pull ghcr.io/goauthentik/server:2024.12.3
docker pull ghcr.io/goauthentik/ldap:2024.12.3
docker pull redis:7.4-alpine
docker pull postgis/postgis:17-3.4-alpine
```

### Step 2: Export Archive to Tarball
```bash
docker save \
  ghcr.io/goauthentik/server:2024.12.3 \
  ghcr.io/goauthentik/ldap:2024.12.3 \
  redis:7.4-alpine \
  postgis/postgis:17-3.4-alpine \
  | gzip -c > tisck-identity-images-2024.12.3.tar.gz
```

### Step 3: Generate Cryptographic Checksum
```bash
sha256sum tisck-identity-images-2024.12.3.tar.gz > tisck-identity-images-2024.12.3.tar.gz.sha256
```

Transfer `tisck-identity-images-2024.12.3.tar.gz` and `.sha256` to the field deployment medium (e.g. encrypted external USB SSD).

---

## 3. Disconnected Field Host: Image Import Workflow

On the air-gapped field deployment host:

### Step 1: Verify Image Archive Integrity
```bash
sha256sum -c tisck-identity-images-2024.12.3.tar.gz.sha256
```

### Step 2: Load Images into Docker Engine
```bash
docker load -i tisck-identity-images-2024.12.3.tar.gz
```

### Step 3: Verify Loaded Image Catalog
```bash
docker images --filter "reference=*authentik*" --filter "reference=*redis*"
```

Expected output:
```text
REPOSITORY                    TAG            IMAGE ID       CREATED         SIZE
ghcr.io/goauthentik/server    2024.12.3      ...            ...             ...
ghcr.io/goauthentik/ldap      2024.12.3      ...            ...             ...
redis                         7.4-alpine     ...            ...             ...
```

---

## 4. Automation Helper Scripts

TISCK provides helper scripts to automate offline packaging and loading:
- **Bash**: `cloudtak/scripts/offline-image-bundle.sh` (`--export` or `--import <archive>`)
- **PowerShell**: `cloudtak/scripts/offline-image-bundle.ps1` (`-Mode Export` or `-Mode Import`)
