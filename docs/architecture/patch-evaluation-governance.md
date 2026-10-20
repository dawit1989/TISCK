# Stage D: Replaceable Patch Evaluation & Retirement Governance

## 1. Objective

To provide an evidence-based, test-gated methodology for evaluating whether existing TISCK source modifications in `cloudtak/` can eventually be replaced by native upstream CloudTAK configuration without sacrificing offline reliability or security.

---

## 2. Evidence-Based Review: `cloudtak/api/common/config.ts`

### Current Customization in `config.ts`:
```typescript
if (process.env.CLOUDTAK_Mode === 'docker-compose') {
    process.env.StackName = process.env.StackName || 'tisck';
    // 32-character minimum signing secret validation & placeholder rejection
    // Bypass PostGIS SSL certificate verification for local database connections
    // Set noetlevents = true to prevent SQS queue crashes
}
```

### Can this be replaced by native upstream configuration in v13.102.4?
* **Verdict**: **NO — Not in v13.102.4.**
* **Evidence**:
  1. Upstream CloudTAK v13.102.4 assumes AWS Secrets Manager unless `StackName === 'test'`. If `CLOUDTAK_Mode === 'docker-compose'` is removed, `Config.envInit()` will attempt to call `@aws-sdk/client-secrets-manager` on startup and throw an unhandled rejection because no AWS credentials exist in an offline environment.
  2. Upstream defaults `noetlevents` to `false`. Without the guard, `ETLEvents.submit()` attempts to resolve AWS STS caller identity and post to non-existent AWS SQS queues.
  3. Upstream enforces SSL connection to PostgreSQL with `{ rejectUnauthorized: false }`. In local Docker Compose over internal bridge networks, PostGIS operates without TLS; removing the bypass triggers SSL connection negotiation failures.

**Recommendation**: Retain this patch in `config.ts` until an upstream release officially introduces native standalone / non-AWS execution flags.

---

## 3. Isolated Branch-Based Testing Protocol for Candidate Patch Retirement

Whenever a candidate patch is proposed for retirement:

1. **Isolation Requirement**:
   - Never edit the `main` branch directly.
   - Create an isolated experimental branch: `git checkout -b experiment/retire-<patch-name>`.

2. **Pre-Flight Test Baseline**:
   - Run the full suite inside the active container:
     ```bash
     docker exec cloudtak-api-1 npx tsx --test test/oidc-url-validation.test.ts
     docker exec cloudtak-api-1 npx tsx --test test/tisck-signing-secret.test.ts
     docker exec cloudtak-api-1 npx tsx --test test/tisck-tactical-groups.test.ts
     ```

3. **Controlled Modification & Dual-Homed Validation**:
   - Apply the proposed configuration-driven alternative.
   - Re-test against running services. Specifically verify that the dual-homed backchannel URL resolution (`localhost:9000` vs `identity-server:9000`) remains functional.

4. **Regression Gate & Approval**:
   - If any automated test or the CDP browser E2E test fails, the patch removal is immediately rejected and the branch discarded.
   - Patch retirement requires explicit sign-off with recorded test run logs.
