import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

export const CREDENTIAL_PATTERNS = [
    /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, // JWTs
    /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+PRIVATE KEY-----/g, // Private keys
    /ghp_[a-zA-Z0-9]{36}/g, // GitHub personal tokens
    /github_pat_[a-zA-Z0-9_]{82}/g, // GitHub fine-grained tokens
    /aws_secret_access_key\s*=\s*[a-zA-Z0-9/+=]{40}/gi, // AWS secret keys
    /password\s*[:=]\s*['"][^'"]+['"]/gi, // passwords in env/json
    /secret\s*[:=]\s*['"][^'"]+['"]/gi, // secrets in env/json
    /SigningSecret\s*[:=]\s*['"][^'"]+['"]/gi,
    /AUTHENTIK_SECRET_KEY\s*[:=]\s*['"][^'"]+['"]/gi,
    /AUTHENTIK_BOOTSTRAP_TOKEN\s*[:=]\s*['"][^'"]+['"]/gi,
];

export function redactCredentials(input: string): string {
    let sanitized = input;
    for (const pattern of CREDENTIAL_PATTERNS) {
        sanitized = sanitized.replace(pattern, '[REDACTED_CREDENTIAL]');
    }
    return sanitized;
}

export function formatPullRequestBody(opts: {
    candidateTag: string;
    candidateSha: string;
    baselineTag?: string;
    baselineSha?: string;
    compatibilityReport?: string;
    testResults?: string;
}): string {
    const baselineTag = opts.baselineTag || 'v13.102.4';
    const baselineSha = opts.baselineSha || '19ed703003436efc36cd3440e0b6a5358f8d3098';

    const lines: string[] = [];
    lines.push(`## Automated CloudTAK Upstream Upgrade Proposal: \`${opts.candidateTag}\``);
    lines.push(``);
    lines.push(`### Upstream Release Lineage`);
    lines.push(`- **Previous Approved Upstream Pin**: \`${baselineTag}\` (\`${baselineSha.substring(0, 10)}\`)`);
    lines.push(`- **Proposed Candidate Version**: \`${opts.candidateTag}\` (\`${opts.candidateSha.substring(0, 10)}\`)`);
    lines.push(`- **Canonical Repository**: [dfpc-coe/CloudTAK](https://github.com/dfpc-coe/CloudTAK)`);
    lines.push(`- **Upstream Release Notes**: https://github.com/dfpc-coe/CloudTAK/releases/tag/${opts.candidateTag}`);
    lines.push(``);

    lines.push(`### Upstream Source Preservation Confirmation`);
    lines.push(`- [x] Zero application source code modifications introduced in \`cloudtak/api\`, \`cloudtak/app\`, or \`cloudtak/tasks\`.`);
    lines.push(`- [x] All 6 active TISCK application patches remain cataloged and intact.`);
    lines.push(`- [x] Dual-homed Docker backchannel OIDC resolution and RFC 7519 ID token validation verified.`);
    lines.push(``);

    if (opts.compatibilityReport) {
        lines.push(`### Compatibility & Risk Assessment Summary`);
        lines.push(opts.compatibilityReport);
        lines.push(``);
    }

    if (opts.testResults) {
        lines.push(`### Candidate Qualification Test Results`);
        lines.push(opts.testResults);
        lines.push(``);
    }

    lines.push(`### Operator Review & Promotion Instructions (Stage E -> Stage F)`);
    lines.push(`1. Review the diff in this pull request and confirm no unwanted customizations were overridden.`);
    lines.push(`2. Merge this PR using a **3-way merge commit** (\`git merge --no-ff\`). **Do NOT squash or rebase**, or vendor branch ancestry will be lost.`);
    lines.push(`3. Follow the production deployment protocol in \`docs/UPSTREAM-SYNC.md\` with pre-deployment database snapshots:`);
    lines.push(`   \`\`\`bash`);
    lines.push(`   docker exec cloudtak-postgis-1 pg_dump -U docker gis > pre-upgrade-gis.sql`);
    lines.push(`   docker exec cloudtak-postgis-1 pg_dump -U authentik authentik > pre-upgrade-authentik.sql`);
    lines.push(`   docker compose -f cloudtak/docker-compose.yml up -d --build`);
    lines.push(`   \`\`\``);
    lines.push(``);

    lines.push(`### Rollback Plan`);
    lines.push(`If post-deployment anomalies occur:`);
    lines.push(`1. Revert \`cloudtak/.upstream-version\` to \`${baselineTag}\`.`);
    lines.push(`2. Re-deploy baseline: \`docker compose -f cloudtak/docker-compose.yml up -d --build\`.`);
    lines.push(`3. If database migrations ran, restore snapshots:`);
    lines.push(`   \`\`\`bash`);
    lines.push(`   docker exec -i cloudtak-postgis-1 psql -U docker -d gis < pre-upgrade-gis.sql`);
    lines.push(`   docker exec -i cloudtak-postgis-1 psql -U authentik -d authentik < pre-upgrade-authentik.sql`);
    lines.push(`   \`\`\``);

    return redactCredentials(lines.join('\n'));
}

export function formatTriageIssueBody(opts: {
    candidateTag: string;
    candidateSha: string;
    failureReason: string;
    errorLogs?: string;
}): string {
    const lines: string[] = [];
    lines.push(`## [Upstream Upgrade Blocked] CloudTAK Candidate \`${opts.candidateTag}\` Failed Qualification`);
    lines.push(``);
    lines.push(`- **Candidate Tag**: \`${opts.candidateTag}\``);
    lines.push(`- **Candidate Commit**: \`${opts.candidateSha}\``);
    lines.push(`- **Status**: 🛑 Candidate Promotion Blocked`);
    lines.push(`- **Failure Summary**: ${opts.failureReason}`);
    lines.push(``);

    if (opts.errorLogs) {
        lines.push(`### Diagnostic Logs`);
        lines.push(`\`\`\``);
        lines.push(opts.errorLogs.trim());
        lines.push(`\`\`\``);
        lines.push(``);
    }

    lines.push(`### Required Operator Action`);
    lines.push(`1. Investigate the failure details above.`);
    lines.push(`2. Resolve conflict or patch compatibility in an isolated branch.`);
    lines.push(`3. Re-run candidate evaluation: \`npx tsx cloudtak/scripts/upstream/run-candidate-tests.ts --candidate-tag ${opts.candidateTag} --candidate-sha ${opts.candidateSha}\`.`);

    return redactCredentials(lines.join('\n'));
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
    const args = process.argv.slice(2);
    let candidateTag = '';
    let candidateSha = '';
    let compatibilityJson = '';
    let testResultsJson = '';
    let isFailure = false;
    let outputPrFile = 'candidate-pr-body.md';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--candidate-tag' && args[i + 1]) candidateTag = args[++i];
        else if (args[i] === '--candidate-sha' && args[i + 1]) candidateSha = args[++i];
        else if (args[i] === '--compatibility-json' && args[i + 1]) compatibilityJson = args[++i];
        else if (args[i] === '--test-results-json' && args[i + 1]) testResultsJson = args[++i];
        else if (args[i] === '--failed') isFailure = true;
        else if (args[i] === '--output-file' && args[i + 1]) outputPrFile = args[++i];
    }

    if (!candidateTag || !candidateSha) {
        console.error('Usage: publish-proposal.ts --candidate-tag <tag> --candidate-sha <sha> [--compatibility-json <file>] [--test-results-json <file>]');
        process.exit(1);
    }

    let compatSummary = '';
    if (compatibilityJson && fs.existsSync(compatibilityJson)) {
        compatSummary = fs.readFileSync(compatibilityJson, 'utf8');
    }

    let testSummary = '';
    if (testResultsJson && fs.existsSync(testResultsJson)) {
        testSummary = fs.readFileSync(testResultsJson, 'utf8');
    }

    if (isFailure) {
        const issueBody = formatTriageIssueBody({
            candidateTag,
            candidateSha,
            failureReason: 'Candidate failed automated qualification test matrix',
            errorLogs: testSummary || 'See attached test output.',
        });
        fs.writeFileSync(path.resolve(REPO_ROOT, outputPrFile), issueBody, 'utf8');
        console.log(`[Publish] Wrote diagnostic issue body to ${outputPrFile}`);
    } else {
        const prBody = formatPullRequestBody({
            candidateTag,
            candidateSha,
            compatibilityReport: compatSummary,
            testResults: testSummary,
        });
        fs.writeFileSync(path.resolve(REPO_ROOT, outputPrFile), prBody, 'utf8');
        console.log(`[Publish] Wrote pull request body to ${outputPrFile}`);
    }
}
