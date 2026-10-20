# Proposal: Automated CloudTAK Upstream Release Maintenance for TISCK

## Why

TISCK maintains an adapted, self-hosted deployment of CloudTAK pinned to upstream release `v13.102.4` (resolved commit `19ed703003436efc36cd3440e0b6a5358f8d3098` from [`dfpc-coe/CloudTAK`](https://github.com/dfpc-coe/CloudTAK.git)) integrated with Authentik OIDC, Garage S3 object storage, PostGIS spatial persistence, and MediaMTX tactical streaming. Upstream CloudTAK continues to evolve actively; without a hardened, automated maintenance lifecycle, evaluating upstream updates is a labor-intensive, error-prone manual process that risks clobbering proven self-hosted customizations or introducing breaking database schema and authentication regressions.

This change establishes an automated, repeatable lifecycle for monitoring upstream CloudTAK releases, executing static compatibility assessments, validating candidate releases in strictly isolated CI environments without touching production data, and generating reviewable, approval-gated upgrade proposals.

## What Changes

- **Authoritative Upstream Pinning & State Ledger**: Codify `cloudtak/.upstream-version` as the single authoritative source of truth for the approved upstream version tag. Introduce a version-controlled companion ledger at `cloudtak/config/upstream-release-state.json` that tracks release metadata and distinguishes five explicit states: Currently Deployed (`cloudtak/.env`), Approved Upstream (`cloudtak/.upstream-version`), Newly Discovered, Candidate Under Validation, and Last Known-Good.
- **Evidence-Based Customization Manifest**: Establish `cloudtak/config/tisck-customization-manifest.json` from the repository git diff, cataloging every TISCK patch across `cloudtak/api` (`oidc.ts`, `config.ts`, `login.ts`, `etl-events.ts`, `authentik-provider.ts`, and router files) with its original purpose, current status, regression test requirements, and configuration replacement criteria.
- **Automated Upstream Release Discovery**: Implement an automated workflow (scheduled cron and manual `workflow_dispatch`) that monitors `https://github.com/dfpc-coe/CloudTAK.git`, resolves immutable commit SHAs for new release tags, records release notes, deduplicates events, and skips redundant candidate branches.
- **Static Compatibility & Collision Risk Assessment**: Introduce a static analysis scanner (`cloudtak/scripts/upstream/assess-compatibility.ts`) that compares upstream candidate trees against the approved vendor base, scanning for changes in authentication/OIDC, database migrations (flagging irreversible DDL operations like column drops or renames), configuration keys, API contracts, and line-level overlaps with the customization manifest, classifying findings as risk indicators with severity and confidence scores.
- **Sandboxed CI Validation Environment**: Construct an isolated test stack (`cloudtak/docker-compose.test-candidate.yml`) utilizing unique project names (`-p tisck-ci-<run_id>`), isolated bridge networks, disposable PostGIS instances, and synthetic non-production credentials, completely partitioned from live production containers, credentials, and named volumes (`postgis-data`, `authentik-media`, `garage-data`).
- **Comprehensive Test Qualification & Reporting**: Execute qualification test suites classifying results explicitly into Passed, Failed, Not run, or Blocked by unavailable infrastructure. Clearly distinguish mocked identity tests (`oidc-url-validation.test.ts`) from live Authentik integration tests (`authentik-live-integration.test.ts`, `e2e-browser-login.mjs`).
- **Reviewable Upgrade Pull Requests & Diagnostic Issues**: Automatically generate pull requests containing exact commit SHAs, changelogs, test execution summaries, migration warnings, and verified rollback runbooks when candidate checks pass; automatically open or update triage issues with reproducible diagnostic logs if candidate checks fail.
- **Approval-Gated Staged Release Policy**: Enforce a strict 6-stage lifecycle (Stage A: Detect, Stage B: Analyze, Stage C: Test, Stage D: Prepare, Stage E: Approve, Stage F: Deploy), mandating maintainer approval via 3-way merge commit for Stage E, while keeping Stage F production deployment a separate, explicitly authorized operator action with verified database snapshots.

## Capabilities

### New Capabilities
- `upstream-release-lifecycle`: Governs automated upstream release monitoring, multi-state version pinning, static compatibility analysis, isolated candidate qualification, pull request generation, staged promotion gates, and rollback automation for CloudTAK releases.

### Modified Capabilities
- `upstream-boundary-preservation`: Extends boundary preservation rules to enforce isolated CI candidate qualification without production credential/database exposure and mandates non-destructive qualification gates before any upstream merge.

## Impact

- **Affected Files & Layout**:
  - `cloudtak/.upstream-version` remains the single authoritative source of truth for the approved upstream version.
  - New configuration files: `cloudtak/config/upstream-release-state.json` and `cloudtak/config/tisck-customization-manifest.json`.
  - New modular maintenance scripts under `cloudtak/scripts/upstream/` and CI workflow `.github/workflows/upstream-maintenance.yml`.
  - Integration with existing vendor merge script `cloudtak/scripts/sync-upstream.sh` (requiring seeding of `vendor/upstream` branch at `v13.102.4`).
  - Documentation runbooks updated in `docs/UPSTREAM-SYNC.md` and `docs/architecture/`.
- **APIs & Protocols**: Zero disruption to production OIDC (`/login/oidc`, `/login/refresh`), Authentik API, or Garage S3 endpoints. Production environments remain completely untouched during release discovery and testing.
- **Security & Secrets**: Release automation operates under least-privilege CI tokens with synthetic credentials; private keys, production passwords, and live database credentials are never exposed in CI, PR bodies, or logs.
- **Dependencies**: Uses Node.js/TypeScript and Docker Compose already present in the repository; no proprietary SaaS dependencies.
