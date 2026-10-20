import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

export const UPSTREAM_VERSION_FILE = path.join(REPO_ROOT, 'cloudtak/.upstream-version');
export const RELEASE_STATE_FILE = path.join(REPO_ROOT, 'cloudtak/config/upstream-release-state.json');

export interface UpstreamReleaseState {
    schemaVersion: string;
    approvedUpstream: {
        tag: string;
        commitSha: string;
        approvedAt: string;
        sourceRepo: string;
    };
    currentlyDeployed: {
        tag: string;
        commitSha: string;
        deployedAt: string;
    };
    lastKnownGood: {
        tag: string;
        commitSha: string;
        recordedAt?: string;
    };
    discoveredReleases: Array<{
        tag: string;
        commitSha: string;
        publishedAt?: string;
        discoveredAt: string;
        releaseNotesUrl?: string;
        status: 'pending_analysis' | 'analyzed' | 'candidate_testing' | 'pr_opened' | 'rejected' | 'approved';
    }>;
    activeCandidate: {
        tag: string;
        commitSha: string;
        branch: string;
        stage: 'analyze' | 'test' | 'prepare' | 'approve' | 'deploy';
        startedAt: string;
    } | null;
}

export const FORBIDDEN_MOVING_BRANCHES = ['main', 'master', 'latest', 'head', 'develop', 'dev'];

export function assertValidReleaseTag(tag: string): void {
    if (!tag || typeof tag !== 'string' || tag.trim().length === 0) {
        throw new Error('Release tag must be a non-empty string');
    }
    const normalized = tag.trim().toLowerCase();
    if (FORBIDDEN_MOVING_BRANCHES.includes(normalized)) {
        throw new Error(`Moving branch '${tag}' is forbidden as an upstream release tag; an exact immutable tag is required`);
    }
}

export function assertValidCommitSha(sha: string): void {
    if (!sha || !/^[0-9a-f]{40}$/i.test(sha.trim())) {
        throw new Error(`Invalid commit SHA '${sha}': expected 40-character hexadecimal string`);
    }
}

export function loadReleaseState(statePath = RELEASE_STATE_FILE): UpstreamReleaseState {
    if (!fs.existsSync(statePath)) {
        throw new Error(`Release state file not found at: ${statePath}`);
    }
    const raw = fs.readFileSync(statePath, 'utf8');
    return JSON.parse(raw) as UpstreamReleaseState;
}

export function saveReleaseState(state: UpstreamReleaseState, statePath = RELEASE_STATE_FILE): void {
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

export function loadApprovedVersionTag(versionPath = UPSTREAM_VERSION_FILE): string {
    if (!fs.existsSync(versionPath)) {
        throw new Error(`Upstream version file not found at: ${versionPath}`);
    }
    return fs.readFileSync(versionPath, 'utf8').trim();
}

export function saveApprovedVersionTag(tag: string, versionPath = UPSTREAM_VERSION_FILE): void {
    assertValidReleaseTag(tag);
    fs.writeFileSync(versionPath, tag.trim() + '\n', 'utf8');
}

export function verifyConsistency(
    versionPath = UPSTREAM_VERSION_FILE,
    statePath = RELEASE_STATE_FILE,
): { valid: boolean; approvedTag: string; commitSha: string; message: string } {
    const rawTag = loadApprovedVersionTag(versionPath);
    assertValidReleaseTag(rawTag);

    const state = loadReleaseState(statePath);
    assertValidReleaseTag(state.approvedUpstream.tag);
    assertValidCommitSha(state.approvedUpstream.commitSha);

    if (rawTag !== state.approvedUpstream.tag) {
        throw new Error(
            `Inconsistent upstream version: '${versionPath}' has '${rawTag}' but '${statePath}' has '${state.approvedUpstream.tag}'`,
        );
    }

    return {
        valid: true,
        approvedTag: rawTag,
        commitSha: state.approvedUpstream.commitSha,
        message: `Consistent: Approved upstream is ${rawTag} (${state.approvedUpstream.commitSha})`,
    };
}

export function recordDiscoveredRelease(
    tag: string,
    commitSha: string,
    releaseNotesUrl?: string,
    statePath = RELEASE_STATE_FILE,
): { status: 'recorded' | 'already_known'; release: UpstreamReleaseState['discoveredReleases'][0] } {
    assertValidReleaseTag(tag);
    assertValidCommitSha(commitSha);

    const state = loadReleaseState(statePath);
    const existing = state.discoveredReleases.find(r => r.tag === tag || r.commitSha === commitSha);
    if (existing) {
        return { status: 'already_known', release: existing };
    }

    const newEntry: UpstreamReleaseState['discoveredReleases'][0] = {
        tag: tag.trim(),
        commitSha: commitSha.trim(),
        discoveredAt: new Date().toISOString(),
        releaseNotesUrl,
        status: 'pending_analysis',
    };

    state.discoveredReleases.push(newEntry);
    saveReleaseState(state, statePath);
    return { status: 'recorded', release: newEntry };
}

export function setActiveCandidate(
    tag: string,
    commitSha: string,
    branch: string,
    stage: UpstreamReleaseState['activeCandidate']['stage'] = 'analyze',
    statePath = RELEASE_STATE_FILE,
): void {
    assertValidReleaseTag(tag);
    assertValidCommitSha(commitSha);

    const state = loadReleaseState(statePath);
    state.activeCandidate = {
        tag: tag.trim(),
        commitSha: commitSha.trim(),
        branch: branch.trim(),
        stage,
        startedAt: new Date().toISOString(),
    };
    saveReleaseState(state, statePath);
}

export function clearActiveCandidate(statePath = RELEASE_STATE_FILE): void {
    const state = loadReleaseState(statePath);
    state.activeCandidate = null;
    saveReleaseState(state, statePath);
}

export function approveCandidate(
    tag: string,
    commitSha: string,
    versionPath = UPSTREAM_VERSION_FILE,
    statePath = RELEASE_STATE_FILE,
): void {
    assertValidReleaseTag(tag);
    assertValidCommitSha(commitSha);

    const state = loadReleaseState(statePath);
    state.lastKnownGood = {
        tag: state.approvedUpstream.tag,
        commitSha: state.approvedUpstream.commitSha,
        recordedAt: new Date().toISOString(),
    };

    state.approvedUpstream = {
        tag: tag.trim(),
        commitSha: commitSha.trim(),
        approvedAt: new Date().toISOString(),
        sourceRepo: state.approvedUpstream.sourceRepo || 'https://github.com/dfpc-coe/CloudTAK.git',
    };

    state.activeCandidate = null;

    const discovered = state.discoveredReleases.find(r => r.tag === tag);
    if (discovered) {
        discovered.status = 'approved';
    }

    saveReleaseState(state, statePath);
    saveApprovedVersionTag(tag, versionPath);
}

// CLI handler
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
    const args = process.argv.slice(2);
    const command = args[0] || '--verify';

    try {
        switch (command) {
            case '--verify': {
                const res = verifyConsistency();
                console.log(`✅ ${res.message}`);
                break;
            }
            case '--get-approved': {
                const state = loadReleaseState();
                console.log(JSON.stringify(state.approvedUpstream, null, 2));
                break;
            }
            case '--get-deployed': {
                const state = loadReleaseState();
                console.log(JSON.stringify(state.currentlyDeployed, null, 2));
                break;
            }
            case '--get-last-known-good': {
                const state = loadReleaseState();
                console.log(JSON.stringify(state.lastKnownGood, null, 2));
                break;
            }
            case '--record-discovered': {
                const tag = args[1];
                const sha = args[2];
                const url = args[3];
                const res = recordDiscoveredRelease(tag, sha, url);
                console.log(`Status: ${res.status}`);
                console.log(JSON.stringify(res.release, null, 2));
                break;
            }
            case '--set-candidate': {
                const tag = args[1];
                const sha = args[2];
                const branch = args[3] || `candidate/upstream-${tag}`;
                setActiveCandidate(tag, sha, branch);
                console.log(`Active candidate set: ${tag} (${sha}) on branch ${branch}`);
                break;
            }
            case '--clear-candidate': {
                clearActiveCandidate();
                console.log('Active candidate cleared.');
                break;
            }
            case '--approve-candidate': {
                const tag = args[1];
                const sha = args[2];
                approveCandidate(tag, sha);
                console.log(`Candidate approved: ${tag} (${sha})`);
                break;
            }
            default:
                console.error(`Unknown option: ${command}`);
                process.exit(1);
        }
    } catch (err) {
        console.error(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
}
