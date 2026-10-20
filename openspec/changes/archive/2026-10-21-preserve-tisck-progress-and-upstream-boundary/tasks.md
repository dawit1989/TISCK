# Tasks: Preserve TISCK Progress and Establish Upstream CloudTAK Boundary

## 1. Stage A — Inventory and Protection Baseline

- [x] 1.1 Document and verify persistent Docker volumes (`postgis-data`, `garage-meta`, `garage-data`, `identity-cache-data`, `authentik-media`, `authentik-templates`), database schemas, and credentials to ensure no re-initialization occurs
- [x] 1.2 Run and verify the non-destructive OIDC unit and URL validation tests (`npm test test/oidc-url-validation.test.ts`)
- [x] 1.3 Run and verify signing secret validation tests (`npm test test/tisck-signing-secret.test.ts`)
- [x] 1.4 Run and verify tactical group mapping unit tests (`npm test test/tisck-tactical-groups.test.ts`)
- [x] 1.5 Verify that the repository working tree is clean and recorded at commit `6d549cd` with upstream version pinned to `v13.102.4`

## 2. Stage B — Architectural Boundary Definition

- [x] 2.1 Formalize the 5-tier architecture in repository documentation (`docs/architecture/upstream-boundary.md`), defining explicit rules separating Upstream CloudTAK, TISCK Deployment, TISCK Integration, TISCK Test, and External Services
- [x] 2.2 Codify the upstream source preservation policy into developer guidelines, prohibiting in-place edits to `cloudtak/api`, `cloudtak/app`, and `cloudtak/tasks` when configuration or external scripts suffice
- [x] 2.3 Document the upstream synchronization protocol (`docs/UPSTREAM-SYNC.md`) establishing how future CloudTAK upstream releases are merged using 3-way git branches and conflict review

## 3. Stage C — Safe Configuration Opportunities

- [x] 3.1 Audit `cloudtak/docker-compose.yml` to ensure all TISCK parameters and tactical defaults are externalized to `.env` or `.env.identity` with secure defaults
- [x] 3.2 Ensure health checks and restart policies for stateful services (`postgis`, `store`, `identity-server`, `identity-cache`) are non-destructive and preserve data across daemon restarts
- [x] 3.3 Validate that `init-garage.ps1` and `bootstrap-authentik.ps1` scripts operate idempotently without resetting existing buckets or user accounts

## 4. Stage D — Replaceable Patch Evaluation and Staging

- [x] 4.1 Conduct an evidence-based review of `cloudtak/api/common/config.ts` to identify if any docker-compose mode guards can be driven by upstream environment variables without code modification
- [x] 4.2 Define isolated, branch-based experimental test harnesses to prototype candidate patch retirements without affecting the production branch
- [x] 4.3 Document regression test gates required before any candidate patch retirement is submitted for review

## 5. Stage E — Upstream Maintenance and Upgrade Governance

- [x] 5.1 Document the step-by-step procedure for upgrading CloudTAK beyond v13.102.4 while preserving TISCK's Docker Compose, Garage S3, Authentik OIDC, and MediaMTX layers
- [x] 5.2 Integrate end-to-end browser login verification (`cloudtak/scripts/e2e-browser-login.mjs`) into pre-upgrade and post-upgrade qualification checklists
- [x] 5.3 Verify requirement traceability alignment using `tisck-traceability` skill to ensure full compliance across all 6 architecture pillars

## Workflow follow-up

- Archive the change after project review requirements and task verifications are satisfied.
- Validate that main specifications reflect the updated architectural boundary.
