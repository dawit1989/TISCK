# Upstream CloudTAK Synchronization & Preservation Runbook

## 1. Overview

TISCK maintains an isolated copy of CloudTAK under `cloudtak/` pinned to version `v13.102.4` (recorded in `cloudtak/.upstream-version`). This runbook governs how upstream updates from [`dfpc-coe/CloudTAK`](https://github.com/dfpc-coe/CloudTAK) are evaluated and synchronized without overwriting TISCK's self-hosted deployment and integration assets.

---

## 2. Pinned Upstream Lineage & Architectural Constraints

Upstream CloudTAK was architected as an AWS cloud-native application relying on AWS Secrets Manager, ALB headers for authentication, and AWS SQS for event queues. 

A central architectural condition governs this relationship:
> **Upstream CloudTAK DOES have built-in OIDC SSO concepts, but its configuration model is database/UI-driven (`oidc::*` settings), and its backchannel network assumptions assume a flat DNS space rather than dual-homed Docker service names.**

TISCK bridges this by maintaining:
- Dual-homed Docker URL rewriting in `cloudtak/api/stateless/lib/oidc.ts`.
- Environment-driven configuration via `docker-compose.yml`.
- Self-hosted Authentik attribute synchronization and TAK client certificate locking in `cloudtak/api/stateless/routes/login.ts`.

---

## 3. Upstream Synchronization Protocol (Stage E)

### Step 1: Upstream Release Assessment
Before initiating a sync:
1. Review the upstream release notes for changes to authentication, database schemas, and S3 storage.
2. Confirm whether upstream has added native non-AWS configuration flags that could replace TISCK Type 4 patches.

### Step 2: 3-Way Git Merge via Vendor Branch
To ensure no TISCK customization is silently deleted:
1. Maintain a pristine upstream branch (`vendor/upstream`) containing unmodified upstream `api/`, `app/`, and `tasks/`.
2. Fetch the target upstream release tag (e.g. `v13.103.0`) into `vendor/upstream`.
3. Create a dedicated sync branch: `git checkout -b sync/upstream-v13.103.0`.
4. Perform a 3-way merge:
   ```bash
   git merge vendor/upstream
   ```
5. Resolve conflicts locally:
   - For TISCK-owned files (`docker-compose.yml`, `scripts/*`, `.env*`, `docs/*`): Keep TISCK versions ("ours").
   - For patched upstream files (`oidc.ts`, `login.ts`, `config.ts`): Verify that dual-homed resolution and 32-char secret enforcement are preserved.

### Step 3: Qualification Test Gates
Before merging any sync branch into `main`:
1. Execute unit verification tests:
   ```bash
   docker exec cloudtak-api-1 npx tsx --test test/oidc-url-validation.test.ts
   docker exec cloudtak-api-1 npx tsx --test test/tisck-signing-secret.test.ts
   docker exec cloudtak-api-1 npx tsx --test test/tisck-tactical-groups.test.ts
   ```
2. Execute browser end-to-end authentication:
   ```bash
   node cloudtak/scripts/e2e-browser-login.mjs
   ```
3. Verify persistent volume integrity:
   ```bash
   node cloudtak/scripts/verify-persistence.mjs
   ```
4. Update `cloudtak/.upstream-version` with the newly approved tag.
