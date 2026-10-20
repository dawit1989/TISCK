# Tasks

## 1. Milestone 1: Repository Baseline, Vendor Seeding & Version Pinning

- [x] 1.1 Seed the `vendor/upstream` branch at approved release `v13.102.4` (resolved commit SHA `19ed703003436efc36cd3440e0b6a5358f8d3098`) using `cloudtak/scripts/sync-upstream.sh --seed v13.102.4`, verifying `git rev-parse vendor/upstream` resolves the pristine tree
- [x] 1.2 Codify `cloudtak/config/upstream-release-state.json` initializing `approvedUpstream`, `currentlyDeployed`, and `lastKnownGood` to `v13.102.4`, verifying JSON schema validation
- [x] 1.3 Create evidence-based `cloudtak/config/tisck-customization-manifest.json` cataloging all 6 application patch areas, Compose configurations, scripts, and test harnesses from git diff, verifying path references against the working tree
- [x] 1.4 Implement version state utility `cloudtak/scripts/upstream/version-pin.ts` asserting consistency between `cloudtak/.upstream-version` and `upstream-release-state.json`, verifying unit tests covering state queries and moving-branch rejection

## 2. Milestone 2: Release Discovery & Deduplication

- [ ] 2.1 Implement upstream discovery engine `cloudtak/scripts/upstream/discover-release.ts` that fetches tags and commit SHAs from `https://github.com/dfpc-coe/CloudTAK.git` via git ls-remote or GitHub API, verifying discovery against a mock release feed
- [ ] 2.2 Add candidate deduplication and manual parameterization (`--tag <tag>`, `--commit <sha>`) to `discover-release.ts`, verifying that already-tracked releases exit with code 0 and an informational log without duplicate branch creation
- [ ] 2.3 Implement GitHub Actions workflow definition `.github/workflows/upstream-maintenance.yml` supporting recurring cron schedules and `workflow_dispatch` manual triggers, verifying workflow syntax against actionlint or YAML schema validation

## 3. Milestone 3: Compatibility Report & Customization Collision Detection

- [ ] 3.1 Implement diff analysis engine `cloudtak/scripts/upstream/assess-compatibility.ts` computing tree diffs between `vendor/upstream` and candidate refs, verifying AST/regex detection of authentication and OIDC modifications
- [ ] 3.2 Add database migration scanner to `assess-compatibility.ts` inspecting `cloudtak/api/migrations/` for DDL statements (flagging DROP TABLE, DROP COLUMN, ALTER COLUMN TYPE as HIGH risk), verifying test fixtures with destructive vs additive migrations
- [ ] 3.3 Add customization collision detector to `assess-compatibility.ts` matching diff hunks against `tisck-customization-manifest.json`, verifying collision alerts when TISCK patches are modified
- [ ] 3.4 Implement report formatter in `assess-compatibility.ts` generating `compatibility-report.json` and human-readable `COMPATIBILITY-REPORT.md` with risk indicator scores and confidence classifications, verifying markdown output

## 4. Milestone 4: Isolated Candidate Test Environment

- [ ] 4.1 Construct isolated CI Compose configuration `cloudtak/docker-compose.test-candidate.yml` with unique network `tisck-ci-net`, disposable storage volumes, synthetic secrets, and non-conflicting loopback port bindings, verifying `docker compose config` syntax
- [ ] 4.2 Parameterize test harnesses (`cloudtak/scripts/e2e-browser-login.mjs` and `cloudtak/scripts/verify-persistence.mjs`) to accept dynamic Compose project names (`-p`), synthetic env files, and dynamic Chromium executable resolution (`CHROME_BIN`/`EDGE_PATH`), verifying local dry-run invocation
- [ ] 4.3 Implement candidate test runner `cloudtak/scripts/upstream/run-candidate-tests.ts` executing test tiers (Tier 1 unit tests, Tier 2 API smoke tests, Tier 3 live Authentik integration & browser E2E, Tier 4 persistence), verifying categorized test output (`PASSED`, `FAILED`, `NOT_RUN`, `BLOCKED`)
- [ ] 4.4 Verify that candidate test execution runs in an isolated container namespace with zero mount points, network traffic, or state modifications to active production volumes (`postgis-data`, `authentik-media`, `garage-data`)

## 5. Milestone 5: Approval-Gated PR & Diagnostic Issue Generation

- [ ] 5.1 Implement candidate branch builder `cloudtak/scripts/upstream/prepare-candidate.ts` integrating `sync-upstream.sh` 3-way merge logic to create `candidate/upstream-<tag>` from `vendor/upstream`, verifying branch creation without modifying `main`
- [ ] 5.2 Implement PR and issue publisher `cloudtak/scripts/upstream/publish-proposal.ts` that opens candidate PRs on qualification success and creates triage issues on validation failure, verifying structured markdown generation
- [ ] 5.3 Implement secret redaction filter in `publish-proposal.ts` scanning PR descriptions, issue bodies, and attached logs for tokens, passwords, and private keys, verifying synthetic credential leak tests

## 6. Milestone 6: End-to-End Workflow Validation & Operational Documentation

- [ ] 6.1 Update Upstream Synchronization Runbook in `docs/UPSTREAM-SYNC.md` with the 6-stage lifecycle governance (Stages A–F), maintainer 3-way merge instructions, and squash/rebase prohibition, verifying document links and procedures
- [ ] 6.2 Author production deployment and disaster rollback guide `docs/architecture/upstream-rollback-runbook.md` documenting verified `pg_dump` snapshot commands, image rollback, and health checks, verifying procedure against staging deployment
- [ ] 6.3 Update TISCK Six-Pillar Traceability Matrix in `docs/traceability/tisck-pillar-traceability.md` to reflect `upstream-release-lifecycle` capability requirements and test gates, verifying end-to-end matrix consistency
- [ ] 6.4 Execute end-to-end dry-run simulation of the release automation pipeline using a controlled upstream test tag, verifying generated compatibility report, test logs, candidate branch, and PR payload

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result and synchronized main specs.
