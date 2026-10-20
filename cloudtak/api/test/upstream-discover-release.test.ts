import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
    parseLsRemoteOutput,
    evaluateDiscovery,
    executeDiscovery,
} from '../../scripts/upstream/discover-release.ts';
import type { UpstreamReleaseState } from '../../scripts/upstream/version-pin.ts';

const SAMPLE_LS_REMOTE_OUTPUT = `
fd45dcc5134da4e3d6dba0b92db4565148b2d467\trefs/tags/v13.102.4
19ed703003436efc36cd3440e0b6a5358f8d3098\trefs/tags/v13.102.4^{}
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\trefs/tags/v13.103.0
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\trefs/tags/v13.103.0^{}
cccccccccccccccccccccccccccccccccccccccc\trefs/tags/v13.101.0^{}
`;

test('discover-release: parses ls-remote output and extracts peeled commit SHAs', () => {
    const releases = parseLsRemoteOutput(SAMPLE_LS_REMOTE_OUTPUT);
    assert.strictEqual(releases.length, 3);

    // Should be sorted semver descending: v13.103.0, v13.102.4, v13.101.0
    assert.strictEqual(releases[0].tag, 'v13.103.0');
    assert.strictEqual(releases[0].commitSha, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    assert.strictEqual(releases[0].isPeeled, true);

    assert.strictEqual(releases[1].tag, 'v13.102.4');
    assert.strictEqual(releases[1].commitSha, '19ed703003436efc36cd3440e0b6a5358f8d3098');

    assert.strictEqual(releases[2].tag, 'v13.101.0');
});

test('discover-release: handles already_approved and new_release transitions with deduplication', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tisck-disc-test-'));
    const tmpStateFile = path.join(tmpDir, 'upstream-release-state.json');
    const tmpFeedFile = path.join(tmpDir, 'mock-feed.txt');

    try {
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

        // Test with only approved version in feed
        fs.writeFileSync(tmpFeedFile, `19ed703003436efc36cd3440e0b6a5358f8d3098\trefs/tags/v13.102.4^{}\n`, 'utf8');
        const approvedRes = executeDiscovery({ feedFile: tmpFeedFile, statePath: tmpStateFile });
        assert.strictEqual(approvedRes.status, 'already_approved');
        assert.strictEqual(approvedRes.tag, 'v13.102.4');

        // Test with new version v13.103.0
        fs.writeFileSync(tmpFeedFile, SAMPLE_LS_REMOTE_OUTPUT, 'utf8');
        const newRes = executeDiscovery({ feedFile: tmpFeedFile, statePath: tmpStateFile });
        assert.strictEqual(newRes.status, 'new_release');
        assert.strictEqual(newRes.tag, 'v13.103.0');
        assert.strictEqual(newRes.commitSha, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');

        // Verify it was recorded in state file
        const stateAfter = JSON.parse(fs.readFileSync(tmpStateFile, 'utf8')) as UpstreamReleaseState;
        assert.strictEqual(stateAfter.discoveredReleases.length, 1);
        assert.strictEqual(stateAfter.discoveredReleases[0].tag, 'v13.103.0');

        // Test deduplication on re-discovery
        const dupRes = executeDiscovery({ feedFile: tmpFeedFile, statePath: tmpStateFile });
        assert.strictEqual(dupRes.status, 'already_discovered');
        assert.strictEqual(dupRes.tag, 'v13.103.0');

        // Test manual tag parameterization
        const manualRes = executeDiscovery({
            feedFile: tmpFeedFile,
            statePath: tmpStateFile,
            manualTag: 'v13.102.4',
        });
        assert.strictEqual(manualRes.status, 'already_approved');
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});
