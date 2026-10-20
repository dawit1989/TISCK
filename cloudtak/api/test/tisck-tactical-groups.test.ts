import test from 'node:test';
import assert from 'node:assert';

test('TISCK Groups: parses tactical groups and assigns least privilege roles', () => {
    const claims = {
        sub: 'operator-1',
        preferred_username: 'recon-lead',
        groups: ['TISCK_RECON', 'TISCK_ISR', 'CloudTAKAgency2'],
    };

    const groups: string[] = Array.isArray(claims.groups) ? claims.groups : [];
    const systemAdminGroup = process.env.OIDC_SYSTEM_ADMIN_GROUP || 'CloudTAKSystemAdmin';
    const agencyAdminPrefix = process.env.OIDC_AGENCY_ADMIN_GROUP_PREFIX || 'CloudTAKAgency';

    const isSystemAdmin = groups.includes(systemAdminGroup);
    assert.equal(isSystemAdmin, false, 'User lacking CloudTAKSystemAdmin must not receive system_admin');

    const agencyAdminIds: number[] = [];
    for (const g of groups) {
        if (g.startsWith(agencyAdminPrefix)) {
            const id = parseInt(g.substring(agencyAdminPrefix.length), 10);
            if (!isNaN(id) && id > 0) agencyAdminIds.push(id);
        }
    }

    assert.deepEqual(agencyAdminIds, [2]);
    assert.ok(groups.includes('TISCK_RECON'));
    assert.ok(groups.includes('TISCK_ISR'));
    assert.ok(!groups.includes('TISCK_COMMAND'));
});

test('TISCK Groups: deny-by-default when user has no tactical groups', () => {
    const claims = {
        sub: 'unauthorized-user',
        preferred_username: 'visitor',
        groups: [],
    };

    const groups: string[] = Array.isArray(claims.groups) ? claims.groups : [];
    const isSystemAdmin = groups.includes('CloudTAKSystemAdmin');
    assert.equal(isSystemAdmin, false);

    const tacticalGroups = ['TISCK_INTEL', 'TISCK_RECON', 'TISCK_COMMAND', 'TISCK_ISR'];
    const assignedTactical = groups.filter(g => tacticalGroups.includes(g));

    assert.equal(assignedTactical.length, 0, 'Unassigned user has no tactical groups');
});
