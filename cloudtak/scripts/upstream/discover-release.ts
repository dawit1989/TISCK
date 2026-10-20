import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    loadReleaseState,
    recordDiscoveredRelease,
    assertValidReleaseTag,
    assertValidCommitSha,
    loadApprovedVersionTag,
    RELEASE_STATE_FILE,
} from './version-pin.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

export const CANONICAL_UPSTREAM_URL = 'https://github.com/dfpc-coe/CloudTAK.git';

export interface DiscoveredRelease {
    tag: string;
    commitSha: string;
    peeledSha?: string;
    isPeeled: boolean;
}

export interface DiscoveryOutcome {
    status: 'new_release' | 'already_approved' | 'already_discovered' | 'no_releases_found';
    tag?: string;
    commitSha?: string;
    message: string;
    candidateRelease?: DiscoveredRelease;
}

export function parseLsRemoteOutput(output: string): DiscoveredRelease[] {
    const lines = output.trim().split('\n').filter(Boolean);
    const tagMap = new Map<string, { tagSha: string; peeledSha?: string }>();

    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 2) continue;
        const sha = parts[0];
        const ref = parts[1];

        const match = ref.match(/^refs\/tags\/(v[0-9]+(?:\.[0-9]+)*(?:-[a-zA-Z0-9.-]+)?)$/);
        const peeledMatch = ref.match(/^refs\/tags\/(v[0-9]+(?:\.[0-9]+)*(?:-[a-zA-Z0-9.-]+)?)\^\{\}$/);

        if (match) {
            const tag = match[1];
            const existing = tagMap.get(tag) || { tagSha: sha };
            existing.tagSha = sha;
            tagMap.set(tag, existing);
        } else if (peeledMatch) {
            const tag = peeledMatch[1];
            const existing = tagMap.get(tag) || { tagSha: sha };
            existing.peeledSha = sha;
            tagMap.set(tag, existing);
        }
    }

    const results: DiscoveredRelease[] = [];
    for (const [tag, entry] of tagMap.entries()) {
        const effectiveSha = entry.peeledSha || entry.tagSha;
        results.push({
            tag,
            commitSha: effectiveSha,
            peeledSha: entry.peeledSha,
            isPeeled: !!entry.peeledSha,
        });
    }

    // Sort semver-like descending
    results.sort((a, b) => {
        const parseParts = (t: string) => t.replace(/^v/, '').split(/[-.]/).map(n => parseInt(n, 10) || 0);
        const pa = parseParts(a.tag);
        const pb = parseParts(b.tag);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const na = pa[i] || 0;
            const nb = pb[i] || 0;
            if (na !== nb) return nb - na;
        }
        return b.tag.localeCompare(a.tag);
    });

    return results;
}

export function queryUpstreamReleases(repoUrl = CANONICAL_UPSTREAM_URL): DiscoveredRelease[] {
    try {
        const stdout = execSync(`git ls-remote --tags "${repoUrl}"`, {
            encoding: 'utf8',
            timeout: 30000,
        });
        return parseLsRemoteOutput(stdout);
    } catch (err) {
        throw new Error(`Failed to query upstream releases from ${repoUrl}: ${err instanceof Error ? err.message : String(err)}`);
    }
}

export function evaluateDiscovery(
    discovered: DiscoveredRelease[],
    statePath = RELEASE_STATE_FILE,
    manualTag?: string,
    manualSha?: string,
): DiscoveryOutcome {
    const state = loadReleaseState(statePath);
    const approvedTag = state.approvedUpstream.tag;

    let target: DiscoveredRelease | undefined;

    if (manualTag) {
        assertValidReleaseTag(manualTag);
        if (manualSha) {
            assertValidCommitSha(manualSha);
            target = { tag: manualTag, commitSha: manualSha, isPeeled: false };
        } else {
            target = discovered.find(d => d.tag === manualTag);
            if (!target) {
                throw new Error(`Specified manual tag '${manualTag}' not found in upstream repository tags`);
            }
        }
    } else {
        target = discovered[0];
    }

    if (!target) {
        return {
            status: 'no_releases_found',
            message: 'No matching upstream releases discovered',
        };
    }

    // Check if matches approved version
    if (target.tag === approvedTag || target.commitSha === state.approvedUpstream.commitSha) {
        return {
            status: 'already_approved',
            tag: target.tag,
            commitSha: target.commitSha,
            message: `Discovered release ${target.tag} matches currently approved baseline (${approvedTag}) - no upgrade needed.`,
            candidateRelease: target,
        };
    }

    // Check if already in discoveredReleases ledger
    const alreadyDiscovered = state.discoveredReleases.some(r => r.tag === target?.tag && r.commitSha === target?.commitSha);
    if (alreadyDiscovered) {
        return {
            status: 'already_discovered',
            tag: target.tag,
            commitSha: target.commitSha,
            message: `Release ${target.tag} (${target.commitSha}) has already been discovered and recorded - deduplicated.`,
            candidateRelease: target,
        };
    }

    // Check if active candidate matches
    if (state.activeCandidate && state.activeCandidate.tag === target.tag) {
        return {
            status: 'already_discovered',
            tag: target.tag,
            commitSha: target.commitSha,
            message: `Release ${target.tag} is currently active candidate in stage '${state.activeCandidate.stage}' - deduplicated.`,
            candidateRelease: target,
        };
    }

    return {
        status: 'new_release',
        tag: target.tag,
        commitSha: target.commitSha,
        message: `New upstream release detected: ${target.tag} (${target.commitSha})`,
        candidateRelease: target,
    };
}

export function executeDiscovery(opts: {
    repoUrl?: string;
    feedFile?: string;
    statePath?: string;
    manualTag?: string;
    manualSha?: string;
    dryRun?: boolean;
}): DiscoveryOutcome {
    const statePath = opts.statePath || RELEASE_STATE_FILE;
    let releases: DiscoveredRelease[];

    if (opts.feedFile) {
        const feedRaw = fs.readFileSync(opts.feedFile, 'utf8');
        releases = parseLsRemoteOutput(feedRaw);
    } else {
        releases = queryUpstreamReleases(opts.repoUrl || CANONICAL_UPSTREAM_URL);
    }

    const outcome = evaluateDiscovery(releases, statePath, opts.manualTag, opts.manualSha);

    if (outcome.status === 'new_release' && !opts.dryRun && outcome.tag && outcome.commitSha) {
        recordDiscoveredRelease(outcome.tag, outcome.commitSha, `https://github.com/dfpc-coe/CloudTAK/releases/tag/${outcome.tag}`, statePath);
    }

    return outcome;
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
    const args = process.argv.slice(2);
    let manualTag: string | undefined;
    let manualSha: string | undefined;
    let feedFile: string | undefined;
    let dryRun = false;
    let jsonOutput = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--tag' && args[i + 1]) manualTag = args[++i];
        else if (args[i] === '--commit' && args[i + 1]) manualSha = args[++i];
        else if (args[i] === '--feed-file' && args[i + 1]) feedFile = args[++i];
        else if (args[i] === '--dry-run') dryRun = true;
        else if (args[i] === '--json') jsonOutput = true;
    }

    try {
        const result = executeDiscovery({ manualTag, manualSha, feedFile, dryRun });
        if (jsonOutput) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log(`[Discovery] Status: ${result.status}`);
            console.log(`[Discovery] ${result.message}`);
            if (result.candidateRelease) {
                console.log(`[Discovery] Candidate: ${result.candidateRelease.tag} (${result.candidateRelease.commitSha})`);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(`❌ Discovery Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
}
