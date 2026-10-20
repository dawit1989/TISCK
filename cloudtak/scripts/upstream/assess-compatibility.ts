import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

export const MANIFEST_FILE = path.join(REPO_ROOT, 'cloudtak/config/tisck-customization-manifest.json');

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AssessmentFinding {
    domain: 'authentication_oidc' | 'database_migration' | 'configuration_env' | 'customization_collision' | 'api_contracts';
    severity: Severity;
    confidence: Confidence;
    title: string;
    description: string;
    filePath?: string;
    lineHunk?: string;
    recommendation: string;
}

export interface CompatibilityReport {
    timestamp: string;
    baselineApprovedTag: string;
    candidateTag: string;
    candidateSha: string;
    riskSummary: {
        high: number;
        medium: number;
        low: number;
        info: number;
        overallRecommendation: 'PROCEED_TO_TEST' | 'INVESTIGATE_BEFORE_PROMOTING' | 'BLOCKED';
    };
    modifiedFilesCount: number;
    findings: AssessmentFinding[];
    collisionDetails: Array<{
        customizationId: string;
        filePath: string;
        risk: string;
    }>;
}

export function scanMigrationText(sqlText: string, fileName: string): AssessmentFinding[] {
    const findings: AssessmentFinding[] = [];
    const normalized = sqlText.toUpperCase();

    if (/DROP\s+TABLE/i.test(normalized)) {
        findings.push({
            domain: 'database_migration',
            severity: 'HIGH',
            confidence: 'HIGH',
            title: `Irreversible Migration: DROP TABLE in ${fileName}`,
            description: `Migration contains 'DROP TABLE' statement which permanently destroys persistent database schema and data.`,
            filePath: fileName,
            recommendation: 'Verify table deprecation plan and ensure verified pre-upgrade database backup before Stage F deploy.',
        });
    }

    if (/DROP\s+COLUMN/i.test(normalized)) {
        findings.push({
            domain: 'database_migration',
            severity: 'HIGH',
            confidence: 'HIGH',
            title: `Irreversible Migration: DROP COLUMN in ${fileName}`,
            description: `Migration contains 'DROP COLUMN' statement which cannot be rolled back without restoring from backup.`,
            filePath: fileName,
            recommendation: 'Ensure database snapshot exists before running candidate migrations.',
        });
    }

    if (/ALTER\s+COLUMN.*TYPE/i.test(normalized) || /ALTER\s+TABLE.*ALTER.*TYPE/i.test(normalized)) {
        findings.push({
            domain: 'database_migration',
            severity: 'MEDIUM',
            confidence: 'HIGH',
            title: `Column Type Mutation in ${fileName}`,
            description: `Migration alters column data types, which may cause conversion errors or data truncations on existing tables.`,
            filePath: fileName,
            recommendation: 'Execute migration dry-run on copy of production schema in CI sandbox.',
        });
    }

    if (/RENAME\s+COLUMN/i.test(normalized) || /RENAME\s+TO/i.test(normalized)) {
        findings.push({
            domain: 'database_migration',
            severity: 'HIGH',
            confidence: 'HIGH',
            title: `Schema Rename in ${fileName}`,
            description: `Migration renames table or column, breaking queries relying on the old schema name.`,
            filePath: fileName,
            recommendation: 'Check that TISCK queries and ETL workers do not reference renamed identifiers.',
        });
    }

    return findings;
}

export function detectCustomizationCollisions(
    diffFilePaths: string[],
    manifestPath = MANIFEST_FILE,
): { findings: AssessmentFinding[]; collisions: Array<{ customizationId: string; filePath: string; risk: string }> } {
    const findings: AssessmentFinding[] = [];
    const collisions: Array<{ customizationId: string; filePath: string; risk: string }> = [];

    if (!fs.existsSync(manifestPath)) {
        return { findings, collisions };
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const cust of manifest.customizations) {
        const targetPath = cust.filePath.replace(/^\.\//, '');
        const matched = diffFilePaths.some(p => p.includes(targetPath) || targetPath.includes(p));

        if (matched) {
            collisions.push({
                customizationId: cust.id,
                filePath: cust.filePath,
                risk: cust.overlapRisk,
            });

            findings.push({
                domain: 'customization_collision',
                severity: cust.type === 'application_patch' ? 'HIGH' : 'MEDIUM',
                confidence: 'HIGH',
                title: `Customization Collision: ${cust.id}`,
                description: `Upstream changes overlap with TISCK ${cust.type} at ${cust.filePath} (${cust.originalPurpose}).`,
                filePath: cust.filePath,
                recommendation: `Manual merge review required; ensure ${cust.requiredRegressionTests.join(', ') || 'tests'} are executed in CI sandbox.`,
            });
        }
    }

    return { findings, collisions };
}

export function scanDiffContent(diffText: string): AssessmentFinding[] {
    const findings: AssessmentFinding[] = [];

    // Scan for OIDC / Authentication modifications
    if (/oidc\.ts|login\.ts|auth\.ts/i.test(diffText)) {
        if (/token_endpoint|authorization_endpoint|userinfo_endpoint/i.test(diffText)) {
            findings.push({
                domain: 'authentication_oidc',
                severity: 'HIGH',
                confidence: 'HIGH',
                title: 'Upstream OIDC Endpoint Resolution Modified',
                description: 'Upstream diff alters OIDC endpoint resolution logic, which may conflict with TISCK dual-homed backchannel URL rewriting.',
                recommendation: 'Run oidc-url-validation.test.ts and e2e-browser-login.mjs in sandboxed CI.',
            });
        }
        if (/validateIdToken|jwt\.verify|jwt\.sign/i.test(diffText)) {
            findings.push({
                domain: 'authentication_oidc',
                severity: 'HIGH',
                confidence: 'HIGH',
                title: 'OIDC Token Validation Modified',
                description: 'Upstream diff alters JWT validation, signing, or claims verification.',
                recommendation: 'Verify RFC 7519 ID token validation invariants remain satisfied.',
            });
        }
    }

    // Scan for AWS Secrets Manager or cloud dependencies
    if (/@aws-sdk\/client-secrets-manager|@aws-sdk\/client-sqs/i.test(diffText)) {
        findings.push({
            domain: 'configuration_env',
            severity: 'MEDIUM',
            confidence: 'MEDIUM',
            title: 'AWS SDK Dependency Touch',
            description: 'Upstream diff touches AWS SDK clients; verify offline fallback guards (CLOUDTAK_Mode === docker-compose) remain intact.',
            recommendation: 'Confirm that container startup does not attempt AWS STS credential resolution without AWS credentials.',
        });
    }

    return findings;
}

export function assessCompatibility(opts: {
    vendorRef?: string;
    candidateRef: string;
    candidateTag: string;
    candidateSha: string;
    manifestPath?: string;
    mockDiffText?: string;
    mockChangedFiles?: string[];
}): CompatibilityReport {
    const vendorRef = opts.vendorRef || 'vendor/upstream';
    const manifestPath = opts.manifestPath || MANIFEST_FILE;

    let changedFiles: string[] = [];
    let diffText = '';

    if (opts.mockChangedFiles) {
        changedFiles = opts.mockChangedFiles;
        diffText = opts.mockDiffText || '';
    } else {
        try {
            const filesRaw = execSync(`git diff --name-only ${vendorRef} ${opts.candidateRef}`, {
                encoding: 'utf8',
                cwd: REPO_ROOT,
            });
            changedFiles = filesRaw.trim().split('\n').filter(Boolean);

            diffText = execSync(`git diff ${vendorRef} ${opts.candidateRef}`, {
                encoding: 'utf8',
                cwd: REPO_ROOT,
                maxBuffer: 20 * 1024 * 1024,
            });
        } catch (err) {
            throw new Error(`Failed to compute git diff between ${vendorRef} and ${opts.candidateRef}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    const allFindings: AssessmentFinding[] = [];

    // 1. Scan diff content
    allFindings.push(...scanDiffContent(diffText));

    // 2. Scan database migrations
    const migrationFiles = changedFiles.filter(f => f.includes('migrations'));
    for (const mf of migrationFiles) {
        let migrationSql = '';
        if (opts.mockDiffText) {
            migrationSql = opts.mockDiffText;
        } else {
            try {
                migrationSql = execSync(`git show ${opts.candidateRef}:${mf}`, {
                    encoding: 'utf8',
                    cwd: REPO_ROOT,
                });
            } catch {
                migrationSql = '';
            }
        }
        allFindings.push(...scanMigrationText(migrationSql, mf));
    }

    // 3. Detect customization collisions
    const collisionRes = detectCustomizationCollisions(changedFiles, manifestPath);
    allFindings.push(...collisionRes.findings);

    // Compute summary
    const high = allFindings.filter(f => f.severity === 'HIGH').length;
    const medium = allFindings.filter(f => f.severity === 'MEDIUM').length;
    const low = allFindings.filter(f => f.severity === 'LOW').length;
    const info = allFindings.filter(f => f.severity === 'INFO').length;

    let overallRecommendation: CompatibilityReport['riskSummary']['overallRecommendation'] = 'PROCEED_TO_TEST';
    if (high > 0) {
        overallRecommendation = 'INVESTIGATE_BEFORE_PROMOTING';
    }

    return {
        timestamp: new Date().toISOString(),
        baselineApprovedTag: 'v13.102.4',
        candidateTag: opts.candidateTag,
        candidateSha: opts.candidateSha,
        riskSummary: {
            high,
            medium,
            low,
            info,
            overallRecommendation,
        },
        modifiedFilesCount: changedFiles.length,
        findings: allFindings,
        collisionDetails: collisionRes.collisions,
    };
}

export function formatReportMarkdown(report: CompatibilityReport): string {
    const lines: string[] = [];
    lines.push(`# CloudTAK Upstream Compatibility Assessment Report`);
    lines.push(``);
    lines.push(`- **Evaluated At**: \`${report.timestamp}\``);
    lines.push(`- **Approved Baseline**: \`${report.baselineApprovedTag}\``);
    lines.push(`- **Candidate Release**: \`${report.candidateTag}\` (\`${report.candidateSha.substring(0, 10)}\`)`);
    lines.push(`- **Changed Files Count**: ${report.modifiedFilesCount}`);
    lines.push(`- **Overall Recommendation**: **${report.riskSummary.overallRecommendation}**`);
    lines.push(``);
    lines.push(`## Risk Indicator Summary`);
    lines.push(``);
    lines.push(`| Severity | Finding Count |`);
    lines.push(`| :--- | :--- |`);
    lines.push(`| 🔴 High | ${report.riskSummary.high} |`);
    lines.push(`| 🟡 Medium | ${report.riskSummary.medium} |`);
    lines.push(`| 🟢 Low | ${report.riskSummary.low} |`);
    lines.push(`| ℹ️ Info | ${report.riskSummary.info} |`);
    lines.push(``);

    if (report.collisionDetails.length > 0) {
        lines.push(`## Customization Collisions Detected`);
        lines.push(``);
        lines.push(`The following TISCK customizations overlap with upstream changes in this release:`);
        lines.push(``);
        for (const col of report.collisionDetails) {
            lines.push(`- **${col.customizationId}** (\`${col.filePath}\`) — Inherent Risk: \`${col.risk}\``);
        }
        lines.push(``);
    }

    lines.push(`## Detailed Findings`);
    lines.push(``);
    if (report.findings.length === 0) {
        lines.push(`*No high or medium severity risks detected in diff analysis.*`);
    } else {
        for (const f of report.findings) {
            const badge = f.severity === 'HIGH' ? '🔴 HIGH' : f.severity === 'MEDIUM' ? '🟡 MEDIUM' : '🟢 LOW';
            lines.push(`### [${badge}] ${f.title}`);
            lines.push(`- **Domain**: \`${f.domain}\``);
            lines.push(`- **Confidence**: \`${f.confidence}\``);
            if (f.filePath) lines.push(`- **File**: \`${f.filePath}\``);
            lines.push(`- **Details**: ${f.description}`);
            lines.push(`- **Action**: ${f.recommendation}`);
            lines.push(``);
        }
    }

    lines.push(`---`);
    lines.push(`*Assessment generated by TISCK Automated Release Maintenance Lifecycle.*`);
    return lines.join('\n');
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
    const args = process.argv.slice(2);
    let candidateTag = '';
    let candidateSha = '';
    let outputReport = 'COMPATIBILITY-REPORT.md';
    let jsonOutput = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--candidate-tag' && args[i + 1]) candidateTag = args[++i];
        else if (args[i] === '--candidate-sha' && args[i + 1]) candidateSha = args[++i];
        else if (args[i] === '--output-report' && args[i + 1]) outputReport = args[++i];
        else if (args[i] === '--json') jsonOutput = true;
    }

    if (!candidateTag || !candidateSha) {
        console.error('Usage: assess-compatibility.ts --candidate-tag <tag> --candidate-sha <sha> [--output-report <file>] [--json]');
        process.exit(1);
    }

    try {
        const report = assessCompatibility({
            candidateRef: candidateSha,
            candidateTag,
            candidateSha,
        });

        const md = formatReportMarkdown(report);
        fs.writeFileSync(path.resolve(REPO_ROOT, outputReport), md, 'utf8');

        if (jsonOutput) {
            console.log(JSON.stringify(report, null, 2));
        } else {
            console.log(`[Assessment] Generated report at: ${outputReport}`);
            console.log(`[Assessment] Recommendation: ${report.riskSummary.overallRecommendation} (High: ${report.riskSummary.high}, Medium: ${report.riskSummary.medium})`);
        }
    } catch (err) {
        console.error(`❌ Assessment Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
}
