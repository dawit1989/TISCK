# ADR 0001: AWS Runtime Decoupling for Self-Hosted Deployments

- **Status**: Accepted
- **Date**: 2026-10-20
- **Authors**: TISCK Engineering Team

---

## Context

CloudTAK was originally designed for AWS ECS Fargate environments. In its original codebase, critical startup and configuration routines unconditionally invoked AWS runtime services:
1. `fetchSecret()` in `cloudtak/api/common/config.ts` invoked AWS SecretsManager to retrieve the JWT signing secret.
2. `fetchArnPrefix()` in `cloudtak/api/common/config.ts` invoked AWS STS (`GetCallerIdentityCommand`) to determine the AWS Account ID and partition for constructing Amazon Resource Names (ARNs).
3. Container runtimes without AWS credentials attempted to query the Amazon EC2 Instance Metadata Service (IMDS at `169.254.169.254`), hanging for 10–30 seconds before timing out.

For TISCK's air-gapped and field operations in Ethiopia and the Horn of Africa, no internet connectivity, AWS credentials, or IAM roles are present. Running without credentials would cause the application to crash on boot or incur significant operational latency.

---

## Decision

We decouple CloudTAK from AWS runtime services in `CLOUDTAK_Mode=docker-compose` mode as follows:

1. **SecretsManager Bypass**: In `cloudtak/api/common/config.ts`, `fetchSecret()` checks if `CLOUDTAK_Mode === 'docker-compose'`. If true, it returns `process.env.SigningSecret` directly without initializing the `@aws-sdk/client-secrets-manager` client.
2. **SigningSecret Validation**: `SigningSecret` must be explicitly defined in `.env` (or environment) and must not use insecure default placeholders. The secret is never logged in plaintext.
3. **STS Bypass**: In `cloudtak/api/common/config.ts`, `fetchArnPrefix()` detects `docker-compose` mode and returns a synthetic ARN prefix (`arn:local:tisck:local:000000000000:`) without invoking `@aws-sdk/client-sts`.
4. **IMDS Probe Disabling**: In `cloudtak/docker-compose.yml`, `AWS_EC2_METADATA_DISABLED=true` is injected into all container definitions (`api`, `tiles`, `events`, `retention`) to immediately abort IMDS link-local lookups.
5. **Preservation of CloudFormation & Cloud Modules**: CloudFormation templates and AWS-mode-only files (`cloudtak/api/stateless/lib/aws/cloudformation.ts`, `lambda.ts`, `alarm.ts`, etc.) are retained untouched in the repository to maintain upstream tracking compatibility, but are entirely isolated from the self-hosted execution path.

---

## Consequences

### Positive
- The application boots in under 10 seconds with zero AWS credentials configured.
- No network traffic is directed to AWS endpoints or `169.254.169.254`.
- Upstream Git merge compatibility is maintained by avoiding wholesale deletions of AWS CDK/CloudFormation modules.

### Negative / Neutral
- Operators must generate and supply a secure `SigningSecret` in `.env` before booting the stack.

---

## OpenSpec Traceability

- **Change**: `adapt-cloudtak-for-tisck-selfhosted-garage`
- **Capability Specs**:
  - `openspec/changes/adapt-cloudtak-for-tisck-selfhosted-garage/specs/external-dependency-removal/spec.md`:
    - Requirement: `AWS SDK call isolation`
    - Scenario: `SecretsManager bypass`
    - Scenario: `STS ARN prefix resolution bypass`
  - `openspec/changes/adapt-cloudtak-for-tisck-selfhosted-garage/specs/self-hosted-deployment/spec.md`:
    - Requirement: `Application starts without AWS credentials`
    - Scenario: `Clean startup without AWS credentials`
    - Scenario: `No AWS SecretsManager call in docker-compose mode`
- **Tasks**: Tasks 1.1, 1.2, 1.4 in `tasks.md`.

---

## Verification Evidence

1. **Static Analysis**: Verified `cloudtak/api/common/config.ts` lines 181–277 contain guards for `CLOUDTAK_Mode === 'docker-compose'` returning `process.env.SigningSecret` and mock ARN prefix.
2. **Live Runtime Boot**: Verified via `docker compose logs api` that the API boots cleanly:
   ```text
   ok - initialized config: docker-compose
   ok - initialized database
   ok - initialized Server
   ok - listening on port 5000
   ```
   No `GetSecretValueCommand` or `GetCallerIdentityCommand` errors were emitted.
3. **API Auth Verification**: Sent authenticated HTTP request `GET /api/config` with Bearer token signed using `SigningSecret`. Request succeeded with HTTP 200 and returned tactical configuration.
4. **IMDS Inspection**: Verified `AWS_EC2_METADATA_DISABLED=true` inside container environment via `docker compose exec api env`.
