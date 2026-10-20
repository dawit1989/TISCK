import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import {
    scanMigrationText,
    detectCustomizationCollisions,
    scanDiffContent,
    assessCompatibility,
    formatReportMarkdown,
} from '../../scripts/upstream/assess-compatibility.ts';

test('assess-compatibility: scans migration text and flags irreversible DDL operations', () => {
    const destructiveSql = `
        ALTER TABLE users DROP COLUMN phone;
        DROP TABLE legacy_missions;
        ALTER TABLE layers ALTER COLUMN config TYPE jsonb;
        ALTER TABLE tasks RENAME TO jobs;
    `;
    const findings = scanMigrationText(destructiveSql, '20261021_migration.sql');
    assert.strictEqual(findings.length, 4);

    const dropTable = findings.find(f => f.title.includes('DROP TABLE'));
    assert.ok(dropTable);
    assert.strictEqual(dropTable.severity, 'HIGH');

    const dropCol = findings.find(f => f.title.includes('DROP COLUMN'));
    assert.ok(dropCol);
    assert.strictEqual(dropCol.severity, 'HIGH');

    const typeMut = findings.find(f => f.title.includes('Type Mutation'));
    assert.ok(typeMut);
    assert.strictEqual(typeMut.severity, 'MEDIUM');

    const rename = findings.find(f => f.title.includes('Rename'));
    assert.ok(rename);
    assert.strictEqual(rename.severity, 'HIGH');
});

test('assess-compatibility: ignores non-destructive migration statements', () => {
    const safeSql = `
        CREATE TABLE IF NOT EXISTS new_feature (id serial primary key, name text);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
        CREATE INDEX idx_users_email ON users(email);
    `;
    const findings = scanMigrationText(safeSql, '20261021_safe.sql');
    assert.strictEqual(findings.length, 0);
});

test('assess-compatibility: detects customization collisions against manifest', () => {
    const modifiedFiles = [
        'cloudtak/api/stateless/lib/oidc.ts',
        'cloudtak/api/common/config.ts',
        'cloudtak/unrelated/path.ts',
    ];

    const result = detectCustomizationCollisions(modifiedFiles);
    assert.strictEqual(result.collisions.length, 2);
    assert.ok(result.collisions.some(c => c.customizationId === 'patch-oidc-dual-homed-and-id-token'));
    assert.ok(result.collisions.some(c => c.customizationId === 'patch-config-docker-compose-guards'));

    const highFindings = result.findings.filter(f => f.severity === 'HIGH');
    assert.strictEqual(highFindings.length, 2);
});

test('assess-compatibility: scans diff content for authentication and AWS SDK changes', () => {
    const diff = `
diff --git a/cloudtak/api/stateless/lib/oidc.ts b/cloudtak/api/stateless/lib/oidc.ts
--- a/cloudtak/api/stateless/lib/oidc.ts
+++ b/cloudtak/api/stateless/lib/oidc.ts
@@ -10,3 +10,4 @@
- const token_endpoint = disc.token_endpoint;
+ const token_endpoint = resolveUrl(disc.token_endpoint);
+ import AWS from '@aws-sdk/client-secrets-manager';
    `;
    const findings = scanDiffContent(diff);
    assert.ok(findings.some(f => f.domain === 'authentication_oidc'));
    assert.ok(findings.some(f => f.domain === 'configuration_env'));
});

test('assess-compatibility: formats comprehensive markdown report', () => {
    const report = assessCompatibility({
        candidateRef: 'HEAD',
        candidateTag: 'v13.103.0',
        candidateSha: '3333333333333333333333333333333333333333',
        mockChangedFiles: ['cloudtak/api/stateless/lib/oidc.ts'],
        mockDiffText: 'token_endpoint modified in oidc.ts',
    });

    assert.strictEqual(report.candidateTag, 'v13.103.0');
    assert.strictEqual(report.riskSummary.overallRecommendation, 'INVESTIGATE_BEFORE_PROMOTING');

    const md = formatReportMarkdown(report);
    assert.ok(md.includes('# CloudTAK Upstream Compatibility Assessment Report'));
    assert.ok(md.includes('v13.103.0'));
    assert.ok(md.includes('Customization Collisions Detected'));
    assert.ok(md.includes('patch-oidc-dual-homed-and-id-token'));
});
