import test from 'node:test';
import assert from 'node:assert';
import {
    redactCredentials,
    formatPullRequestBody,
    formatTriageIssueBody,
} from '../../scripts/upstream/publish-proposal.ts';
import { prepareCandidateBranch } from '../../scripts/upstream/prepare-candidate.ts';

test('publish-proposal: redacts sensitive credentials and secrets', () => {
    const raw = `
        SigningSecret="my-super-secret-password-12345678"
        AUTHENTIK_SECRET_KEY="super-secret-key-abcdef-12345678"
        token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jV_dummy
        ghp_111111111111111111111111111111111111
    `;
    const redacted = redactCredentials(raw);
    assert.ok(!redacted.includes('my-super-secret-password'));
    assert.ok(!redacted.includes('super-secret-key-abcdef'));
    assert.ok(!redacted.includes('eyJhbGciOiJIUzI1Ni'));
    assert.ok(!redacted.includes('ghp_111111111111111111111111111111111111'));
    assert.ok(redacted.includes('[REDACTED_CREDENTIAL]'));
});

test('publish-proposal: formats pull request body with lineage, rollback, and sanitized metadata', () => {
    const body = formatPullRequestBody({
        candidateTag: 'v13.103.0',
        candidateSha: '4444444444444444444444444444444444444444',
        baselineTag: 'v13.102.4',
        baselineSha: '19ed703003436efc36cd3440e0b6a5358f8d3098',
        compatibilityReport: 'Zero high severity risks.',
        testResults: 'All 7 unit tests passed.',
    });

    assert.ok(body.includes('Automated CloudTAK Upstream Upgrade Proposal: `v13.103.0`'));
    assert.ok(body.includes('**Previous Approved Upstream Pin**: `v13.102.4`'));
    assert.ok(body.includes('**Proposed Candidate Version**: `v13.103.0`'));
    assert.ok(body.includes('Rollback Plan'));
    assert.ok(body.includes('pre-upgrade-gis.sql'));
    assert.ok(body.includes('3-way merge commit'));
});

test('publish-proposal: formats triage issue body when candidate fails qualification', () => {
    const issue = formatTriageIssueBody({
        candidateTag: 'v13.103.0',
        candidateSha: '4444444444444444444444444444444444444444',
        failureReason: 'OIDC URL validation test failed',
        errorLogs: 'Error: Cannot resolve token_endpoint',
    });

    assert.ok(issue.includes('[Upstream Upgrade Blocked] CloudTAK Candidate `v13.103.0` Failed Qualification'));
    assert.ok(issue.includes('🛑 Candidate Promotion Blocked'));
    assert.ok(issue.includes('OIDC URL validation test failed'));
    assert.ok(issue.includes('Required Operator Action'));
});

test('prepare-candidate: dry-run computes candidate branch name without mutating repository', () => {
    const res = prepareCandidateBranch({
        candidateTag: 'v13.103.0',
        candidateSha: '4444444444444444444444444444444444444444',
        dryRun: true,
    });

    assert.strictEqual(res.status, 'created');
    assert.strictEqual(res.branchName, 'candidate/upstream-v13.103.0');
    assert.ok(res.message.includes('[Dry-run]'));
});
