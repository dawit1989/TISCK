import test from 'node:test';
import assert from 'node:assert';
import AuthentikProvider from '../stateless/lib/authentik-provider.js';

test('AuthentikProvider: resolves direct token from AUTHENTIK_API_TOKEN without AWS Secrets Manager', async () => {
    const origUrl = process.env.AUTHENTIK_URL;
    const origArn = process.env.AUTHENTIK_API_TOKEN_SECRET_ARN;
    const origToken = process.env.AUTHENTIK_API_TOKEN;

    try {
        process.env.AUTHENTIK_URL = 'http://identity-server:9000';
        process.env.AUTHENTIK_API_TOKEN = 'test-direct-token-offline-12345';
        delete process.env.AUTHENTIK_API_TOKEN_SECRET_ARN;

        const fakeConfig = {} as any;
        const provider = await AuthentikProvider.init(fakeConfig);

        assert.equal(provider.configured, true);
        assert.equal(provider.directToken, 'test-direct-token-offline-12345');

        const authResult = await provider.auth();
        assert.equal(authResult.token, 'test-direct-token-offline-12345');
        assert.ok(authResult.expires > new Date());
    } finally {
        if (origUrl !== undefined) process.env.AUTHENTIK_URL = origUrl; else delete process.env.AUTHENTIK_URL;
        if (origArn !== undefined) process.env.AUTHENTIK_API_TOKEN_SECRET_ARN = origArn; else delete process.env.AUTHENTIK_API_TOKEN_SECRET_ARN;
        if (origToken !== undefined) process.env.AUTHENTIK_API_TOKEN = origToken; else delete process.env.AUTHENTIK_API_TOKEN;
    }
});

test('AuthentikProvider: throws 500 when neither direct token nor ARN configured', async () => {
    const origUrl = process.env.AUTHENTIK_URL;
    const origArn = process.env.AUTHENTIK_API_TOKEN_SECRET_ARN;
    const origToken = process.env.AUTHENTIK_API_TOKEN;

    try {
        process.env.AUTHENTIK_URL = 'http://identity-server:9000';
        delete process.env.AUTHENTIK_API_TOKEN;
        delete process.env.AUTHENTIK_API_TOKEN_SECRET_ARN;

        const fakeConfig = {} as any;
        await assert.rejects(
            async () => await AuthentikProvider.init(fakeConfig),
            /AUTHENTIK_API_TOKEN or AUTHENTIK_API_TOKEN_SECRET_ARN not configured/,
        );
    } finally {
        if (origUrl !== undefined) process.env.AUTHENTIK_URL = origUrl; else delete process.env.AUTHENTIK_URL;
        if (origArn !== undefined) process.env.AUTHENTIK_API_TOKEN_SECRET_ARN = origArn; else delete process.env.AUTHENTIK_API_TOKEN_SECRET_ARN;
        if (origToken !== undefined) process.env.AUTHENTIK_API_TOKEN = origToken; else delete process.env.AUTHENTIK_API_TOKEN;
    }
});
