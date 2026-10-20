import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertValidReleaseTag, assertValidCommitSha, setActiveCandidate } from './version-pin.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

export interface CandidateBranchOutcome {
    status: 'created' | 'already_exists' | 'error';
    branchName: string;
    candidateTag: string;
    candidateSha: string;
    message: string;
}

export function prepareCandidateBranch(opts: {
    candidateTag: string;
    candidateSha: string;
    dryRun?: boolean;
}): CandidateBranchOutcome {
    assertValidReleaseTag(opts.candidateTag);
    assertValidCommitSha(opts.candidateSha);

    const branchName = `candidate/upstream-${opts.candidateTag}`;

    // Check if branch already exists locally
    try {
        const checkLocal = execSync(`git rev-parse --verify refs/heads/${branchName}`, {
            encoding: 'utf8',
            cwd: REPO_ROOT,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        if (checkLocal.trim()) {
            return {
                status: 'already_exists',
                branchName,
                candidateTag: opts.candidateTag,
                candidateSha: opts.candidateSha,
                message: `Candidate branch '${branchName}' already exists locally.`,
            };
        }
    } catch {
        // branch does not exist locally
    }

    if (opts.dryRun) {
        return {
            status: 'created',
            branchName,
            candidateTag: opts.candidateTag,
            candidateSha: opts.candidateSha,
            message: `[Dry-run] Would create branch '${branchName}' from current vendor baseline.`,
        };
    }

    try {
        // Create candidate branch from current HEAD without switching out working tree
        execSync(`git branch "${branchName}" HEAD`, {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });

        // Set active candidate in tracking ledger
        setActiveCandidate(opts.candidateTag, opts.candidateSha, branchName, 'prepare');

        return {
            status: 'created',
            branchName,
            candidateTag: opts.candidateTag,
            candidateSha: opts.candidateSha,
            message: `Candidate branch '${branchName}' successfully created.`,
        };
    } catch (err) {
        return {
            status: 'error',
            branchName,
            candidateTag: opts.candidateTag,
            candidateSha: opts.candidateSha,
            message: `Failed to create candidate branch: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
    const args = process.argv.slice(2);
    let candidateTag = '';
    let candidateSha = '';
    let dryRun = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--candidate-tag' && args[i + 1]) candidateTag = args[++i];
        else if (args[i] === '--candidate-sha' && args[i + 1]) candidateSha = args[++i];
        else if (args[i] === '--dry-run') dryRun = true;
    }

    if (!candidateTag || !candidateSha) {
        console.error('Usage: prepare-candidate.ts --candidate-tag <tag> --candidate-sha <sha> [--dry-run]');
        process.exit(1);
    }

    const res = prepareCandidateBranch({ candidateTag, candidateSha, dryRun });
    console.log(`[Prepare Candidate] Status: ${res.status}`);
    console.log(`[Prepare Candidate] ${res.message}`);
    process.exit(res.status === 'error' ? 1 : 0);
}
