import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

export type TestResultStatus = 'PASSED' | 'FAILED' | 'NOT_RUN' | 'BLOCKED';

export interface TestExecutionRecord {
    tier: 'tier1_unit' | 'tier2_compose_smoke' | 'tier3_live_integration' | 'tier4_persistence';
    testId: string;
    description: string;
    status: TestResultStatus;
    durationMs: number;
    errorDetails?: string;
}

export interface CandidateTestSummary {
    candidateTag: string;
    candidateSha: string;
    executedAt: string;
    overallOutcome: 'QUALIFIED' | 'BLOCKED';
    counts: {
        passed: number;
        failed: number;
        notRun: number;
        blocked: number;
    };
    records: TestExecutionRecord[];
}

export function executeCommand(
    cmd: string,
    cwd: string,
    timeoutMs = 60000,
): { success: boolean; durationMs: number; output: string; error?: string } {
    const start = Date.now();
    try {
        const output = execSync(cmd, {
            cwd,
            encoding: 'utf8',
            timeout: timeoutMs,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        return {
            success: true,
            durationMs: Date.now() - start,
            output,
        };
    } catch (err: unknown) {
        const anyErr = err as { stdout?: string; stderr?: string; message?: string };
        const combined = `${anyErr.stdout || ''}\n${anyErr.stderr || ''}\n${anyErr.message || ''}`.trim();
        return {
            success: false,
            durationMs: Date.now() - start,
            output: combined,
            error: combined,
        };
    }
}

export function runCandidateTestMatrix(opts: {
    candidateTag: string;
    candidateSha: string;
    skipLive?: boolean;
    projectName?: string;
    apiContainer?: string;
}): CandidateTestSummary {
    const records: TestExecutionRecord[] = [];
    const apiDir = path.join(REPO_ROOT, 'cloudtak/api');
    const hasLocalNodeModules = fs.existsSync(path.join(apiDir, 'node_modules'));
    const candidateContainer = opts.apiContainer || process.env.API_CONTAINER || (opts.projectName ? `${opts.projectName}-api-1` : 'cloudtak-api-1');

    let runInContainer = false;
    if (!hasLocalNodeModules) {
        const probe = executeCommand(`docker ps --filter name=${candidateContainer} --format "{{.Names}}"`, REPO_ROOT);
        if (probe.success && probe.output.includes(candidateContainer)) {
            runInContainer = true;
        }
    }

    // -------------------------------------------------------------------------
    // Tier 1: Unit & Invariant Tests
    // -------------------------------------------------------------------------
    const tier1Tests = [
        { id: 'oidc-url-validation', file: 'test/oidc-url-validation.test.ts', desc: 'Dual-homed OIDC URL resolution and RFC 7519 ID token validation', requiresAppDeps: true },
        { id: 'tisck-signing-secret', file: 'test/tisck-signing-secret.test.ts', desc: '32-character signing secret and docker-compose security guard enforcement', requiresAppDeps: true },
        { id: 'tisck-tactical-groups', file: 'test/tisck-tactical-groups.test.ts', desc: 'Tactical group claims parsing and least-privilege role assignment', requiresAppDeps: false },
        { id: 'upstream-version-pin', file: 'test/upstream-version-pin.test.ts', desc: 'Upstream version consistency and moving-branch rejection', requiresAppDeps: false },
        { id: 'upstream-discover-release', file: 'test/upstream-discover-release.test.ts', desc: 'Release discovery, tag peeling, and deduplication', requiresAppDeps: false },
        { id: 'upstream-assess-compatibility', file: 'test/upstream-assess-compatibility.test.ts', desc: 'Static compatibility analysis, DDL migration scanner, and collision detector', requiresAppDeps: false },
    ];

    for (const t of tier1Tests) {
        let res: { success: boolean; durationMs: number; output: string; error?: string };
        if (t.requiresAppDeps && runInContainer) {
            res = executeCommand(`docker exec ${candidateContainer} npx tsx --test ${t.file}`, REPO_ROOT);
        } else {
            res = executeCommand(`npx tsx --test ${t.file}`, apiDir);
        }

        records.push({
            tier: 'tier1_unit',
            testId: t.id,
            description: t.desc,
            status: res.success ? 'PASSED' : 'FAILED',
            durationMs: res.durationMs,
            errorDetails: res.success ? undefined : res.error,
        });
    }

    // -------------------------------------------------------------------------
    // Tier 2: Compose Configuration & Container Syntax Smoke
    // -------------------------------------------------------------------------
    const composeCandidateFile = path.join(REPO_ROOT, 'cloudtak/docker-compose.test-candidate.yml');
    const composeCheck = executeCommand(`docker compose -f ${composeCandidateFile} config`, REPO_ROOT);
    records.push({
        tier: 'tier2_compose_smoke',
        testId: 'compose-candidate-config-validation',
        description: 'Validation of isolated candidate sandbox Compose configuration syntax',
        status: composeCheck.success ? 'PASSED' : 'FAILED',
        durationMs: composeCheck.durationMs,
        errorDetails: composeCheck.success ? undefined : composeCheck.error,
    });

    // -------------------------------------------------------------------------
    // Tier 3: Live Authentik Integration & Browser E2E Authentication
    // -------------------------------------------------------------------------
    if (opts.skipLive) {
        records.push({
            tier: 'tier3_live_integration',
            testId: 'authentik-provider-direct-token',
            description: 'Live Authentik service account creation via direct token',
            status: 'BLOCKED',
            durationMs: 0,
            errorDetails: 'Skipped: Live sandbox containers not initialized (--skip-live requested)',
        });
        records.push({
            tier: 'tier3_live_integration',
            testId: 'e2e-browser-login',
            description: 'Headless browser end-to-end OIDC authentication flow',
            status: 'BLOCKED',
            durationMs: 0,
            errorDetails: 'Skipped: Live sandbox containers not initialized (--skip-live requested)',
        });
    } else {
        // Check if candidate Authentik container is responding
        const probe = executeCommand('docker compose -f cloudtak/docker-compose.test-candidate.yml ps --format json', REPO_ROOT);
        const hasLiveStack = probe.success && probe.output.includes('identity-server');

        if (!hasLiveStack) {
            records.push({
                tier: 'tier3_live_integration',
                testId: 'authentik-live-integration',
                description: 'Live Authentik tactical group synchronization',
                status: 'BLOCKED',
                durationMs: 0,
                errorDetails: 'Candidate sandbox containers not running. Start sandbox with docker compose -f cloudtak/docker-compose.test-candidate.yml up -d',
            });
            records.push({
                tier: 'tier3_live_integration',
                testId: 'e2e-browser-login',
                description: 'Headless browser end-to-end OIDC authentication flow',
                status: 'BLOCKED',
                durationMs: 0,
                errorDetails: 'Candidate sandbox containers not running. Start sandbox with docker compose -f cloudtak/docker-compose.test-candidate.yml up -d',
            });
        } else {
            const authTest = executeCommand('npx tsx --test test/authentik-provider-direct-token.test.ts', apiDir);
            records.push({
                tier: 'tier3_live_integration',
                testId: 'authentik-provider-direct-token',
                description: 'Live Authentik service account creation via direct token',
                status: authTest.success ? 'PASSED' : 'FAILED',
                durationMs: authTest.durationMs,
                errorDetails: authTest.success ? undefined : authTest.error,
            });

            const browserTest = executeCommand('node cloudtak/scripts/e2e-browser-login.mjs', REPO_ROOT);
            records.push({
                tier: 'tier3_live_integration',
                testId: 'e2e-browser-login',
                description: 'Headless browser end-to-end OIDC authentication flow',
                status: browserTest.success ? 'PASSED' : 'FAILED',
                durationMs: browserTest.durationMs,
                errorDetails: browserTest.success ? undefined : browserTest.error,
            });
        }
    }

    // -------------------------------------------------------------------------
    // Tier 4: Persistence Verification
    // -------------------------------------------------------------------------
    if (opts.skipLive) {
        records.push({
            tier: 'tier4_persistence',
            testId: 'verify-persistence',
            description: 'Container restart and OIDC discovery persistence recovery',
            status: 'BLOCKED',
            durationMs: 0,
            errorDetails: 'Skipped: Live sandbox containers not initialized (--skip-live requested)',
        });
    } else {
        const probe = executeCommand('docker compose -f cloudtak/docker-compose.test-candidate.yml ps --format json', REPO_ROOT);
        const hasLiveStack = probe.success && probe.output.includes('identity-server');
        if (!hasLiveStack) {
            records.push({
                tier: 'tier4_persistence',
                testId: 'verify-persistence',
                description: 'Container restart and OIDC discovery persistence recovery',
                status: 'BLOCKED',
                durationMs: 0,
                errorDetails: 'Candidate sandbox containers not running.',
            });
        } else {
            const persistTest = executeCommand('node cloudtak/scripts/verify-persistence.mjs', REPO_ROOT);
            records.push({
                tier: 'tier4_persistence',
                testId: 'verify-persistence',
                description: 'Container restart and OIDC discovery persistence recovery',
                status: persistTest.success ? 'PASSED' : 'FAILED',
                durationMs: persistTest.durationMs,
                errorDetails: persistTest.success ? undefined : persistTest.error,
            });
        }
    }

    const passed = records.filter(r => r.status === 'PASSED').length;
    const failed = records.filter(r => r.status === 'FAILED').length;
    const notRun = records.filter(r => r.status === 'NOT_RUN').length;
    const blocked = records.filter(r => r.status === 'BLOCKED').length;

    // Must have zero failures to qualify
    const overallOutcome = failed === 0 ? 'QUALIFIED' : 'BLOCKED';

    return {
        candidateTag: opts.candidateTag,
        candidateSha: opts.candidateSha,
        executedAt: new Date().toISOString(),
        overallOutcome,
        counts: { passed, failed, notRun, blocked },
        records,
    };
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
    const args = process.argv.slice(2);
    let candidateTag = 'v13.102.4';
    let candidateSha = '19ed703003436efc36cd3440e0b6a5358f8d3098';
    let outputJson = '';
    let skipLive = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--candidate-tag' && args[i + 1]) candidateTag = args[++i];
        else if (args[i] === '--candidate-sha' && args[i + 1]) candidateSha = args[++i];
        else if (args[i] === '--output-json' && args[i + 1]) outputJson = args[++i];
        else if (args[i] === '--skip-live') skipLive = true;
    }

    try {
        console.log(`[Candidate Runner] Executing test qualification matrix for ${candidateTag} (${candidateSha})...`);
        const summary = runCandidateTestMatrix({ candidateTag, candidateSha, skipLive });

        if (outputJson) {
            fs.writeFileSync(path.resolve(REPO_ROOT, outputJson), JSON.stringify(summary, null, 2), 'utf8');
            console.log(`[Candidate Runner] Wrote test results to ${outputJson}`);
        }

        console.log(`\n======================================================`);
        console.log(`Candidate Qualification Matrix: ${summary.overallOutcome}`);
        console.log(`Passed: ${summary.counts.passed} | Failed: ${summary.counts.failed} | Blocked: ${summary.counts.blocked} | Not Run: ${summary.counts.notRun}`);
        console.log(`======================================================`);
        for (const r of summary.records) {
            const mark = r.status === 'PASSED' ? '✅' : r.status === 'FAILED' ? '❌' : '⏸️';
            console.log(`${mark} [${r.tier}] ${r.testId}: ${r.status} (${r.durationMs}ms)`);
            if (r.errorDetails) {
                console.log(`   Details: ${r.errorDetails.split('\n')[0]}`);
            }
        }

        if (summary.overallOutcome === 'BLOCKED') {
            process.exit(1);
        } else {
            process.exit(0);
        }
    } catch (err) {
        console.error(`❌ Test Runner Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
}
