import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
    assertValidReleaseTag,
    assertValidCommitSha,
    verifyConsistency,
    loadReleaseState,
    recordDiscoveredRelease,
    setActiveCandidate,
    clearActiveCandidate,
    approveCandidate,
    FORBIDDEN_MOVING_BRANCHES,
    type UpstreamReleaseState,
} from '../../scripts/upstream/version-pin.ts';

test('version-pin: validates repository consistency between .upstream-version and release-state.json', () => {
    const res = verifyConsistency();
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.approvedTag, 'v13.102.4');
    assert.strictEqual(res.commitSha, '19ed703003436efc36cd3440e0b6a5358f8d3098');
});

test('version-pin: rejects moving branches (main, master, latest, HEAD)', () => {
    for (const moving of FORBIDDEN_MOVING_BRANCHES) {
        assert.throws(
            () => assertValidReleaseTag(moving),
            /Moving branch '.*' is forbidden as an upstream release tag/,
        );
        assert.throws(
            () => assertValidReleaseTag(moving.toUpperCase()),
            /Moving branch '.*' is forbidden as an upstream release tag/,
        );
    }
});

test('version-pin: accepts valid release tags', () => {
    assert.doesNotThrow(() => assertValidReleaseTag('v13.102.4'));
    assert.doesNotThrow(() => assertValidReleaseTag('v13.103.0-rc1'));
    assert.doesNotThrow(() => assertValidReleaseTag('release-2026-10'));
});

test('version-pin: validates 40-char hexadecimal commit SHA', () => {
    assert.doesNotThrow(() => assertValidCommitSha('19ed703003436efc36cd3440e0b6a5358f8d3098'));
    assert.throws(() => assertValidCommitSha('not-a-sha'), /Invalid commit SHA/);
    assert.throws(() => assertValidCommitSha('19ed7030'), /Invalid commit SHA/);
    assert.throws(() => assertValidCommitSha('19ed703003436efc36cd3440e0b6a5358f8d309z'), /Invalid commit SHA/);
});

test('version-pin: state transitions using temporary test files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tisck-ver-test-'));
    const tmpVersionFile = path.join(tmpDir, '.upstream-version');
    const tmpStateFile = path.join(tmpDir, 'upstream-release-state.json');

    try {
        fs.writeFileSync(tmpVersionFile, 'v13.102.4\n', 'utf8');
        const initialState: UpstreamReleaseState = {
            schemaVersion: '1.0.0',
            approvedUpstream: {
                tag: 'v13.102.4',
                commitSha: '19ed703003436efc36cd3440e0b6a5358f8d3098',
                approvedAt: '2026-10-21T01:00:00Z',
                sourceRepo: 'https://github.com/dfpc-coe/CloudTAK.git',
            },
            currentlyDeployed: {
                tag: 'v13.102.4',
                commitSha: '19ed703003436efc36cd3440e0b6a5358f8d3098',
                deployedAt: '2026-10-21T01:00:00Z',
            },
            lastKnownGood: {
                tag: 'v13.102.4',
                commitSha: '19ed703003436efc36cd3440e0b6a5358f8d3098',
            },
            discoveredReleases: [],
            activeCandidate: null,
        };
        fs.writeFileSync(tmpStateFile, JSON.stringify(initialState, null, 2), 'utf8');

        // Record discovered release
        const candidateSha = '2222222222222222222222222222222222222222';
        const rec = recordDiscoveredRelease('v13.103.0', candidateSha, 'https://example.com', tmpStateFile);
        assert.strictEqual(rec.status, 'recorded');
        assert.strictEqual(rec.release.tag, 'v13.103.0');

        // Deduplication test
        const dup = recordDiscoveredRelease('v13.103.0', candidateSha, undefined, tmpStateFile);
        assert.strictEqual(dup.status, 'already_known');

        // Set active candidate
        setActiveCandidate('v13.103.0', candidateSha, 'candidate/upstream-v13.103.0', 'test', tmpStateFile);
        let updated = loadReleaseState(tmpStateFile);
        assert.ok(updated.activeCandidate);
        assert.strictEqual(updated.activeCandidate?.tag, 'v13.103.0');
        assert.strictEqual(updated.activeCandidate?.stage, 'test');

        // Approve candidate
        approveCandidate('v13.103.0', candidateSha, tmpVersionFile, tmpStateFile);
        const approvedVersionTag = fs.readFileSync(tmpVersionFile, 'utf8').trim();
        assert.strictEqual(approvedVersionTag, 'v13.103.0');

        updated = loadReleaseState(tmpStateFile);
        assert.strictEqual(updated.approvedUpstream.tag, 'v13.103.0');
        assert.strictEqual(updated.approvedUpstream.commitSha, candidateSha);
        assert.strictEqual(updated.lastKnownGood.tag, 'v13.102.4');
        assert.strictEqual(updated.lastKnownGood.commitSha, '19ed703003436efc36cd3440e0b6a5358f8d3098');
        assert.strictEqual(updated.activeCandidate, null);

        // Consistency check on approved state
        const verifyRes = verifyConsistency(tmpVersionFile, tmpStateFile);
        assert.strictEqual(verifyRes.valid, true);
        assert.strictEqual(verifyRes.approvedTag, 'v13.103.0');
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});
