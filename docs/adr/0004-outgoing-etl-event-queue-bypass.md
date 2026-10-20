# ADR 0004: Outgoing ETL Event Queue Bypass and Local Event Delivery Gap

- **Status**: Partially Implemented
- **Date**: 2026-10-20
- **Authors**: TISCK Engineering Team

---

## Context

CloudTAK includes an asynchronous ETL pipeline (`tasks/events`) designed to process uploaded geospatial files (KML, GPX, Shapefiles, MBTiles) and convert them to vector tiles and GeoJSON layers. In AWS environments, the API publishes task notifications to an Amazon Simple Queue Service (SQS) FIFO queue via `cloudtak/api/common/etl-events.ts` and `@aws-sdk/client-sqs`.

In self-hosted mode, if SQS queue URLs and permissions are missing:
1. `queueUrl()` attempts to query AWS STS for an ARN prefix.
2. `submit()` fails with an AWS SDK credential/network error or invalid URL error.
3. The API worker can throw uncaught exceptions during layer mutations.

---

## Decision

1. **Default `noetlevents` in Docker Compose**: In `cloudtak/api/common/config.ts`, set `noetlevents = true` by default whenever `CLOUDTAK_Mode === 'docker-compose'`.
2. **Submit Guard in `etl-events.ts`**: In `cloudtak/api/common/etl-events.ts`, update `submit()` to immediately return if `this.config.noetlevents === true`:
   ```typescript
   if (this.config.noetlevents) {
       return;
   }
   ```
3. **Core CoT Processing Separation**: Core Cursor-on-Target (CoT) tactical positioning, chat, and sensor telemetry do not use SQS; they are ingested directly via the API's WebSocket and REST endpoints and stored in PostGIS.

---

## Consequences

### Positive
- Completely eliminates crashes and AWS SQS client timeouts in self-hosted mode.
- Core tactical situational awareness (live tracks, CoT markers, chat) operates without degradation.

### Negative / Neutral
- **Remaining Gap**: Outgoing ETL layer conversion events are not queued to a local broker. Uploading a complex raw spatial layer requiring background conversion by `cloudtak-events` will not automatically trigger background processing without manual intervention or a local broker.

---

## Conflict with OpenSpec Requirements

> [!WARNING]
> **OpenSpec Delta Specification Discrepancy**:
> - **OpenSpec Requirement** (`external-dependency-removal/spec.md`, lines 23–26):
>   *"WHEN CoT messages and sensor events are posted to the API in docker-compose mode, THEN the events are processed via internal EventEmitter, WebSockets, or local persistence without requiring SQS queue URLs or SQS SendMessage permissions."*
> - **Code Reality**: CoT events are indeed processed via WebSockets and local database persistence. However, layer ETL events are dropped (`noetlevents: true`).
> - **Resolution Plan**: A local event delivery mechanism (e.g. PostgreSQL `LISTEN`/`NOTIFY`, Redis, or Node.js in-process EventEmitter bridge to the events worker) is **Proposed** for a subsequent change. For the baseline, the SQS bypass is Accepted as a stabilizing measure.

---

## OpenSpec Traceability

- **Change**: `adapt-cloudtak-for-tisck-selfhosted-garage`
- **Capability Specs**:
  - `openspec/changes/adapt-cloudtak-for-tisck-selfhosted-garage/specs/external-dependency-removal/spec.md`:
    - Requirement: `Elimination of mandatory AWS SQS dependency`
    - Scenario: `Event ingestion without SQS`
- **Tasks**: Task 1.3 in `tasks.md`.

---

## Verification Evidence

1. **Source Inspection**: Inspected `cloudtak/api/common/config.ts` lines 205–210:
   ```typescript
   this.noetlevents = Boolean(process.env.ETL_EVENTS_NOOP || process.env.CLOUDTAK_Mode === 'docker-compose');
   ```
   Inspected `cloudtak/api/common/etl-events.ts` line 48:
   ```typescript
   if (this.config.noetlevents) {
       return;
   }
   ```
2. **Runtime Verification**: Started the API service and verified in container logs that no SQS connection errors, queue URL errors, or STS lookups occurred during boot or health check pings.
3. **Status Justification**: Marked as **Partially Implemented** because suppressing SQS errors is verified, but an offline local replacement queue has not yet been implemented.
