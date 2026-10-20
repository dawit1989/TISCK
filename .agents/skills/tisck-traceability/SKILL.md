---
name: tisck-traceability
description: Audits and maintains end-to-end TISCK requirement traceability across the six architecture pillars, repository source code, OpenSpec proposals/specifications/tasks, and actual test evidence. Use whenever the user asks for traceability, a traceability matrix, pillar compliance, implementation status, requirements coverage, or evidence of completion for TISCK.
---

# TISCK Traceability Skill

## Purpose

Create or update an evidence-based traceability matrix for TISCK. Trace every relevant capability from the product specification through OpenSpec requirements and tasks to actual repository implementation and test evidence.

This is a repository-audit skill, not an implementation skill. By default, update traceability artifacts only; do not modify application code, specifications, task status, infrastructure, or tests merely to make the matrix look complete.

## Invocation

Use this skill when the user asks to:
- create, refresh, review, or export TISCK traceability;
- check whether the six TISCK pillars are followed;
- map requirements to code, OpenSpec, tests, or acceptance evidence;
- report implementation/compliance status for TISCK.

The user may invoke it explicitly as `/tisck-traceability`.

## Sources of truth and precedence

Inspect the current workspace on every invocation. Do not reuse status claims from a previous conversation as though they are current evidence.

Use sources in this order:
1. Current working tree and Git diff/status.
2. Current OpenSpec configuration, main specs, active changes, proposals, designs, and task lists.
3. Source code, deployment configuration, tests, CI workflows, build scripts, and test output.
4. Repository documentation and recorded architecture decisions.
5. User-provided product specification and requirements.
6. Prior traceability reports, only as a baseline to compare and refresh.

If sources conflict, record the conflict and identify the source that is authoritative for the particular claim. Do not silently choose the more optimistic claim.

## Repository safety

1. Start with `git status --short --branch` and inspect existing diffs. Preserve all existing user changes.
2. Find repository-specific instructions (for example `AGENTS.md`, `GEMINI.md`, or equivalent) and follow them.
3. Discover the installed OpenSpec version and repository conventions before assuming paths or commands.
4. Do not install dependencies, run destructive commands, commit, push, deploy, or modify remote infrastructure.
5. Do not change application code, tests, product requirements, OpenSpec specifications, or task checkboxes during a traceability-only run.
6. If a traceability artifact already exists, inspect its diff and update it carefully. Do not overwrite unrelated user edits.
7. Do not run potentially expensive, network-dependent, destructive, or environment-changing tests without authorization. Prefer existing documented local test commands and safe checks.

## TISCK product scope: six pillars

Map requirements and implementation against all six pillars. Preserve the names and intent below unless a newer approved product specification supersedes them.

### Pillar A — Identity and Zero-Touch Enrollment
- Authentik, OIDC, and LDAP Outpost where justified and supported.
- TISCK identity groups: `TISCK_INTEL`, `TISCK_RECON`, `TISCK_COMMAND`, `TISCK_ISR`.
- Internal certificate authority and certificate lifecycle.
- TAK client identity/enrollment, renewal, revocation, and audit.
- Do not assume LDAP integration automatically issues certificates or proves zero-touch enrollment. Verify the actual selected TAK implementation and version.

### Pillar B — Sovereign Object Storage and Offline Cartography
- Garage S3-compatible object storage.
- Buckets: `tisck-assets`, `tisck-basemaps`, `tisck-intel-vault` where approved/currently configured.
- S3 endpoint, bucket initialization, credentials and policy, upload/download/list/head/delete, required range requests, PMTiles retrieval, persistence, backup and recovery.
- PostGIS, MapLibre GL, PMTiles, offline vector maps, imagery and elevation assets.
- Do not equate source inspection with runtime compatibility tests.

### Pillar C — TAK Core Messaging
- Selected TAK Server or OpenTAKServer deployment and configuration.
- CoT connectivity and event distribution.
- Relevant REST/admin interfaces and configured ports.
- Authentication, TLS/mTLS where supported, authorization, client compatibility, persistence, and offline behavior.
- Treat port numbers and enrollment paths as claims to verify against the selected server/version and actual configuration.

### Pillar D — Web Common Operating Picture
- Existing `dfpc-coe/CloudTAK` application adapted for TISCK.
- Preserve existing useful web COP capabilities.
- Self-hosted configuration, local identity integration, maps/assets, API behavior, mission/operational graphics and supported TAK integration.
- Check for external runtime assets and internet requirements.

### Pillar E — Persistent Intelligence ETL Runtime
- Existing upstream ETL code versus proposed TISCK `@tisck/etl-runtime` must be distinguished.
- Proposed Bun/TypeScript workers, `@tak-ps/node-tak`, `@tak-ps/node-cot`, and `bun:sqlite`.
- Persistent deduplication, source provenance, freshness, retry/recovery, and CoT publication.
- Relevant sources may include ACLED, NASA FIRMS, ADS-B, maritime AIS and other approved feeds.
- Verify actual feed adapters, build targets, dependencies, credentials, and delivery paths. An existing ETL directory does not prove the proposed TISCK runtime is implemented.

### Pillar F — Tactical Video and Sensor Ingestion
- MediaMTX and required RTSP/WebRTC/HLS flows.
- Existing `dfpc-coe/media-infra` wrapper must not be a TISCK runtime dependency.
- Verify what the wrapper provided before assessing the upstream MediaMTX replacement.
- Check stream access, authentication/authorization, configuration, health, network exposure, and CloudTAK/TAK-client integration.
- Do not treat container startup as proof of end-to-end media integration.

## Non-negotiable architecture constraints

Check traceability against these TISCK constraints:
- No mandatory AWS/Azure/GCP runtime infrastructure or credentials.
- No operational dependency on `dfpc-coe/auth-infra`, `dfpc-coe/tak-infra`, or `dfpc-coe/media-infra`.
- Garage is the intended self-hosted object store; an AWS SDK may remain only as a compatible client library when required operations work against Garage.
- No public commercial CA dependency for TISCK's internal trust chain.
- Offline core workflows must not require public map tiles, styles, fonts, glyphs, identity endpoints, telemetry, or package registries at runtime.
- External feeds cannot refresh during outages; show freshness and retain last-known data according to policy.
- Do not claim air-gap readiness, zero-touch enrollment, high availability, security compliance, or full S3 compatibility without suitable evidence.

## Workflow

### 1. Discover repository and OpenSpec

Inspect:
- repository tree and current Git state;
- OpenSpec config, main specifications, active changes and relevant archived changes;
- all six pillars in source, configuration, tests and docs;
- Docker Compose, container/build files, environment examples and scripts;
- test commands and CI workflows;
- existing traceability artifacts.

Use repository search and code navigation. Do not infer files exist merely because they were named in an earlier conversation. Record missing paths as “not found in current checkout”.

### 2. Build a requirement inventory

For each pillar, extract atomic requirements from the current approved product spec and active OpenSpec specs. Prefer exact stable requirement IDs where available. Otherwise, assign a traceability-only ID such as `A-ID-001`, `B-STORE-002`, `C-COT-003`, `D-COP-001`, `E-ETL-001`, or `F-VIDEO-001`; label these clearly as report IDs, not OpenSpec IDs.

For every requirement, record:
- Pillar and capability.
- Requirement ID and concise requirement statement.
- Source document and exact heading/line, if available.
- OpenSpec spec/capability and requirement/scenario reference.
- OpenSpec task reference, if one exists.
- Implementation path(s) with symbol/config key and line number where feasible.
- Test file, test name, command, and actual result, if available.
- Evidence quality/source and verification date.
- Status, gap, and next action.

A requirement with no OpenSpec mapping is an explicit traceability gap. A requirement with no test evidence is not considered verified merely because a task checkbox is marked complete.

### 3. Classify implementation status

Use exactly one primary status per matrix row:
- **Implemented & verified** — code/config exists and relevant automated or repeatable acceptance tests actually passed; record the evidence.
- **Implemented, runtime unverified** — code/config is present but adequate runtime/integration evidence is missing.
- **Partially implemented** — only some required behavior is present or verification covers only a subset.
- **Specified only** — requirement/design exists but implementation was not found.
- **Planned / not found** — neither implementation nor an approved detailed implementation plan was found in the current checkout.
- **Blocked** — progress depends on a missing decision, dependency, hardware, environment, credential, or external service; record the blocker.
- **Not applicable / explicitly out of scope** — only when an approved source explicitly says so; cite that decision.

Do not use an overall green/complete status when key subrequirements are missing.

### 4. Classify evidence quality

Use these evidence labels:
- **E0 — Claim only:** prior conversation, unchecked narrative, or unsupported assertion.
- **E1 — Source/config inspection:** exact code/config location found; behavior not executed.
- **E2 — Static/config validation:** linter, type check, Compose config validation, OpenSpec validation, or static check passed.
- **E3 — Automated behavior test:** unit or integration test executed and passed; include command, test name, and result.
- **E4 — Acceptance/runtime test:** repeatable end-to-end scenario executed in a representative deployment; include environment assumptions, command/steps and artifact/log reference.

An OpenSpec validation success validates OpenSpec structure, not application runtime behavior. `docker compose config` validates configuration rendering, not service functionality. Explicitly preserve these distinctions.

### 5. Inspect actual tests and test results

Search for relevant tests and CI steps. If it is safe and practical, run existing non-destructive tests relevant to the requested traceability audit. Record exact commands and exit results. If a test is not run, say “not run”; never infer that it passed because it exists or because a task is checked.

Do not run or fabricate production network tests. Do not use real sensitive operational datasets for tests.

### 6. Generate or update outputs

Default output locations:
- `docs/traceability/tisck-traceability.md` — human-readable overview and full matrix.
- `docs/traceability/tisck-traceability.csv` — machine-readable requirement-level rows.

If a repository already has a preferred traceability location or report format, follow it and document the location used. Create an XLSX workbook only when the needed tooling is already available or the user specifically requests it.

The Markdown report must contain:
1. Audit date/time and commit/branch or worktree identifier.
2. Scope and sources inspected.
3. Executive status summary for pillars A–F.
4. Pillar status table.
5. Detailed requirement-level traceability matrix.
6. Evidence ledger with exact source paths, test commands/results, and limitations.
7. Coverage gaps: requirements without specs, code, tests, or actual result evidence.
8. Conflicts between product spec, OpenSpec, implementation, and documentation.
9. Prioritized remediation actions.
10. Limitations: inaccessible files, unavailable tooling, tests not run, dirty working tree, or incomplete repository discovery.

Recommended Markdown columns:
`Trace ID | Pillar | Capability | Requirement | Product spec reference | OpenSpec spec/scenario | OpenSpec task | Implementation evidence | Test/evidence | Evidence level | Status | Gap/next action`.

Recommended CSV columns should mirror the detailed matrix. Escape commas, quotes, and line breaks correctly.

### 7. Compare with the previous report

If a previous report exists, compare it with the current audit and summarize meaningful differences:
- status changed;
- implementation or tests added/removed;
- requirements changed;
- new or resolved gaps;
- evidence that became stale.

Do not carry a previous “verified” status forward without checking whether its evidence still applies to the current commit.

### 8. Validate report quality

Before finishing:
- Ensure all six pillars are present, even if there is no implementation.
- Ensure each claimed implemented capability points to actual repository evidence.
- Ensure each “verified” claim points to a test actually run or reliable recorded acceptance artifact.
- Check every referenced path exists in the current checkout.
- Distinguish product requirement IDs from report-only trace IDs.
- Identify orphaned requirements and orphaned implementation (code with no requirement/test mapping).
- Ensure summary counts match the detailed rows.
- Run format or simple consistency checks when available.
- Review `git diff -- docs/traceability` and preserve any user work.

## Output style

Be direct and evidence-based. State “not found” when you cannot find something. Do not invent requirement IDs, file paths, line numbers, tests, output, or passing status. Prefer precise links to files and symbols over vague statements.

The key question is not merely “does code exist?” It is “can each approved TISCK requirement be traced to implementation and convincing verification evidence?”
