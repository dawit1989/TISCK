import test from 'node:test';
import assert from 'node:assert';
import { discovery, userinfo } from '../stateless/lib/oidc.js';

const AUTHENTIK_URL = process.env.AUTHENTIK_URL || 'http://identity-server:9000';
const OIDC_DISCOVERY_URL = process.env.OIDC_DISCOVERY_URL || `${AUTHENTIK_URL}/application/o/cloudtak/.well-known/openid-configuration`;
const CLIENT_ID = process.env.OIDC_CLIENT_ID || 'cloudtak';
const CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || '';

test('Live Authentik: Discovery endpoint returns valid OIDC metadata', async () => {
    const disc = await discovery(OIDC_DISCOVERY_URL);
    assert.ok(disc.authorization_endpoint, 'Must have authorization_endpoint');
    assert.ok(disc.token_endpoint, 'Must have token_endpoint');
    assert.ok(disc.userinfo_endpoint, 'Must have userinfo_endpoint');

    const res = await fetch(OIDC_DISCOVERY_URL);
    assert.equal(res.status, 200);
    const json = await res.json() as Record<string, unknown>;
    assert.ok(json.issuer, 'Issuer must be defined');
    assert.ok(Array.isArray(json.scopes_supported), 'scopes_supported must be an array');
    assert.ok((json.scopes_supported as string[]).includes('groups'), 'scopes_supported must include groups');
    assert.ok((json.scopes_supported as string[]).includes('openid'), 'scopes_supported must include openid');
});

test('Live Authentik: Token endpoint rejects invalid client secret', async () => {
    const disc = await discovery(OIDC_DISCOVERY_URL);
    const res = await fetch(disc.token_endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: CLIENT_ID,
            client_secret: 'invalid-nonexistent-secret',
        }).toString(),
    });

    assert.ok([400, 401].includes(res.status), `Invalid client secret must be rejected with 400 or 401 (got ${res.status})`);
    const data = await res.json() as Record<string, unknown>;
    assert.ok(['invalid_client', 'invalid_grant'].includes(data.error as string), `Error should be invalid_client or invalid_grant, got: ${String(data.error)}`);
});

test('Live Authentik: Token endpoint issues token for valid client credentials', async () => {
    assert.ok(CLIENT_SECRET, 'OIDC_CLIENT_SECRET must be set for live test');
    const disc = await discovery(OIDC_DISCOVERY_URL);
    const res = await fetch(disc.token_endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            scope: 'openid profile email groups',
        }).toString(),
    });

    assert.equal(res.status, 200, 'Token request must succeed with 200');
    const tokenData = await res.json() as Record<string, unknown>;
    assert.ok(tokenData.access_token, 'Response must include access_token');
    assert.equal(tokenData.token_type, 'Bearer');

    // Test UserInfo with valid token
    const claims = await userinfo(disc, String(tokenData.access_token));
    assert.ok(claims.sub, 'Claims must include sub');
    assert.ok('groups' in claims, 'Claims must include groups claim');
});

test('Live Authentik: UserInfo endpoint rejects invalid / forged bearer tokens', async () => {
    const disc = await discovery(OIDC_DISCOVERY_URL);
    await assert.rejects(
        async () => await userinfo(disc, 'forged.tampered.token'),
        /OIDC UserInfo request failed: 401/,
    );
});

test('Live Authentik: Tactical operational groups are provisioned in Authentik', async () => {
    const bootstrapToken = process.env.AUTHENTIK_API_TOKEN || process.env.AUTHENTIK_BOOTSTRAP_TOKEN;
    assert.ok(bootstrapToken, 'Bootstrap token must be available');

    const res = await fetch(`${AUTHENTIK_URL}/api/v3/core/groups/`, {
        headers: {
            Authorization: `Bearer ${bootstrapToken}`,
            Accept: 'application/json',
        },
    });

    assert.equal(res.status, 200);
    const data = await res.json() as { results: Array<{ name: string }> };
    const groupNames = data.results.map(g => g.name);

    for (const expected of ['TISCK_INTEL', 'TISCK_RECON', 'TISCK_COMMAND', 'TISCK_ISR', 'CloudTAKSystemAdmin']) {
        assert.ok(groupNames.includes(expected), `Group ${expected} must exist in Authentik`);
    }
});
