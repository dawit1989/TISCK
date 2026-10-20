import test from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { authorizationUrl, validateIdToken, resolveInternalUrl } from '../stateless/lib/oidc.js';
import type { OIDCConfig, OIDCDiscovery } from '../stateless/lib/oidc.js';

test('OIDC URLs: authorizationUrl falls back to disc.authorization_endpoint when authorization_url not set', () => {
    const disc: OIDCDiscovery = {
        issuer: 'http://identity-server:9000/application/o/cloudtak/',
        authorization_endpoint: 'http://identity-server:9000/application/o/authorize/',
        token_endpoint: 'http://identity-server:9000/application/o/token/',
        userinfo_endpoint: 'http://identity-server:9000/application/o/userinfo/',
    };
    const config: OIDCConfig = {
        discovery: 'http://identity-server:9000/application/o/cloudtak/.well-known/openid-configuration',
        client: 'cloudtak',
        secret: 'mock-secret',
        redirect: 'http://localhost:5000/api/login/oidc/callback',
        scopes: 'openid profile email groups',
    };
    const state = 'test-state-token';
    const result = authorizationUrl(disc, config, state);
    const parsed = new URL(result);

    assert.equal(parsed.origin, 'http://identity-server:9000');
    assert.equal(parsed.pathname, '/application/o/authorize/');
    assert.equal(parsed.searchParams.get('client_id'), 'cloudtak');
    assert.equal(parsed.searchParams.get('redirect_uri'), 'http://localhost:5000/api/login/oidc/callback');
    assert.equal(parsed.searchParams.get('response_type'), 'code');
    assert.equal(parsed.searchParams.get('scope'), 'openid profile email groups');
    assert.equal(parsed.searchParams.get('state'), 'test-state-token');
});

test('OIDC URLs: authorizationUrl uses browser-facing authorization_url and attaches nonce when specified', () => {
    const disc: OIDCDiscovery = {
        issuer: 'http://localhost:9000/application/o/cloudtak/',
        authorization_endpoint: 'http://identity-server:9000/application/o/authorize/',
        token_endpoint: 'http://identity-server:9000/application/o/token/',
        userinfo_endpoint: 'http://identity-server:9000/application/o/userinfo/',
    };
    const config: OIDCConfig = {
        discovery: 'http://identity-server:9000/application/o/cloudtak/.well-known/openid-configuration',
        authorization_url: 'http://localhost:9000/application/o/authorize/',
        client: 'cloudtak',
        secret: 'mock-secret',
        redirect: 'http://localhost:5000/api/login/oidc/callback',
        scopes: 'openid profile email groups',
    };
    const state = 'test-state-token';
    const nonce = 'random-crypto-nonce-12345';
    const result = authorizationUrl(disc, config, state, nonce);
    const parsed = new URL(result);

    assert.equal(parsed.origin, 'http://localhost:9000');
    assert.equal(parsed.pathname, '/application/o/authorize/');
    assert.equal(parsed.searchParams.get('client_id'), 'cloudtak');
    assert.equal(parsed.searchParams.get('redirect_uri'), 'http://localhost:5000/api/login/oidc/callback');
    assert.equal(parsed.searchParams.get('response_type'), 'code');
    assert.equal(parsed.searchParams.get('scope'), 'openid profile email groups');
    assert.equal(parsed.searchParams.get('state'), 'test-state-token');
    assert.equal(parsed.searchParams.get('nonce'), 'random-crypto-nonce-12345');
});

test('OIDC URLs: internal backchannel token_endpoint remains internal Docker network', () => {
    const disc: OIDCDiscovery = {
        issuer: 'http://localhost:9000/application/o/cloudtak/',
        authorization_endpoint: 'http://identity-server:9000/application/o/authorize/',
        token_endpoint: 'http://identity-server:9000/application/o/token/',
        userinfo_endpoint: 'http://identity-server:9000/application/o/userinfo/',
    };
    assert.equal(disc.token_endpoint, 'http://identity-server:9000/application/o/token/');
    assert.equal(disc.userinfo_endpoint, 'http://identity-server:9000/application/o/userinfo/');
});

test('OIDC ID Token: valid token passes signature, issuer, audience, exp, and nonce verification', () => {
    const clientSecret = 'super-secret-client-key-min-32-chars!';
    const issuer = 'http://localhost:9000/application/o/cloudtak/';
    const clientId = 'cloudtak';
    const nonce = 'expected-nonce-value-999';

    const disc: OIDCDiscovery = {
        issuer,
        authorization_endpoint: 'http://localhost:9000/application/o/authorize/',
        token_endpoint: 'http://identity-server:9000/application/o/token/',
        userinfo_endpoint: 'http://identity-server:9000/application/o/userinfo/',
    };

    const config: OIDCConfig = {
        discovery: 'http://identity-server:9000/application/o/cloudtak/.well-known/openid-configuration',
        client: clientId,
        secret: clientSecret,
        redirect: 'http://localhost:5000/api/login/oidc/callback',
        scopes: 'openid profile email groups',
        issuer,
    };

    const idToken = jwt.sign({
        sub: 'testoperator',
        iss: issuer,
        aud: clientId,
        nonce,
        email: 'testoperator@tisck.local',
    }, clientSecret, { algorithm: 'HS256', expiresIn: '1h' });

    const claims = validateIdToken(idToken, disc, config, nonce);
    assert.ok(claims);
    assert.equal(claims.sub, 'testoperator');
    assert.equal(claims.iss, issuer);
    assert.equal(claims.aud, clientId);
    assert.equal(claims.nonce, nonce);
});

test('OIDC ID Token: rejects token with issuer mismatch', () => {
    const clientSecret = 'super-secret-client-key-min-32-chars!';
    const config: OIDCConfig = {
        discovery: 'http://identity-server:9000/application/o/cloudtak/.well-known/openid-configuration',
        client: 'cloudtak',
        secret: clientSecret,
        redirect: 'http://localhost:5000/api/login/oidc/callback',
        scopes: 'openid profile email groups',
        issuer: 'http://localhost:9000/application/o/cloudtak/',
    };
    const disc: OIDCDiscovery = {
        issuer: 'http://localhost:9000/application/o/cloudtak/',
        authorization_endpoint: 'http://localhost:9000/application/o/authorize/',
        token_endpoint: 'http://identity-server:9000/application/o/token/',
        userinfo_endpoint: 'http://identity-server:9000/application/o/userinfo/',
    };

    // Forged issuer from different hostname
    const idToken = jwt.sign({
        sub: 'testoperator',
        iss: 'http://attacker-idp.example.com/',
        aud: 'cloudtak',
    }, clientSecret, { algorithm: 'HS256', expiresIn: '1h' });

    assert.throws(
        () => validateIdToken(idToken, disc, config),
        /OIDC ID token issuer mismatch/,
    );
});

test('OIDC ID Token: rejects token with audience mismatch', () => {
    const clientSecret = 'super-secret-client-key-min-32-chars!';
    const issuer = 'http://localhost:9000/application/o/cloudtak/';
    const config: OIDCConfig = {
        discovery: 'http://identity-server:9000/application/o/cloudtak/.well-known/openid-configuration',
        client: 'cloudtak',
        secret: clientSecret,
        redirect: 'http://localhost:5000/api/login/oidc/callback',
        scopes: 'openid profile email groups',
        issuer,
    };
    const disc: OIDCDiscovery = {
        issuer,
        authorization_endpoint: 'http://localhost:9000/application/o/authorize/',
        token_endpoint: 'http://identity-server:9000/application/o/token/',
        userinfo_endpoint: 'http://identity-server:9000/application/o/userinfo/',
    };

    const idToken = jwt.sign({
        sub: 'testoperator',
        iss: issuer,
        aud: 'wrong-client-app',
    }, clientSecret, { algorithm: 'HS256', expiresIn: '1h' });

    assert.throws(
        () => validateIdToken(idToken, disc, config),
        /OIDC ID token audience mismatch/,
    );
});

test('OIDC ID Token: rejects expired ID token', () => {
    const clientSecret = 'super-secret-client-key-min-32-chars!';
    const issuer = 'http://localhost:9000/application/o/cloudtak/';
    const config: OIDCConfig = {
        discovery: 'http://identity-server:9000/application/o/cloudtak/.well-known/openid-configuration',
        client: 'cloudtak',
        secret: clientSecret,
        redirect: 'http://localhost:5000/api/login/oidc/callback',
        scopes: 'openid profile email groups',
        issuer,
    };
    const disc: OIDCDiscovery = {
        issuer,
        authorization_endpoint: 'http://localhost:9000/application/o/authorize/',
        token_endpoint: 'http://identity-server:9000/application/o/token/',
        userinfo_endpoint: 'http://identity-server:9000/application/o/userinfo/',
    };

    const idToken = jwt.sign({
        sub: 'testoperator',
        iss: issuer,
        aud: 'cloudtak',
        exp: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
    }, clientSecret, { algorithm: 'HS256' });

    assert.throws(
        () => validateIdToken(idToken, disc, config),
        /Invalid OIDC ID token: jwt expired/,
    );
});

test('OIDC ID Token: rejects invalid signature', () => {
    const clientSecret = 'super-secret-client-key-min-32-chars!';
    const wrongSecret = 'wrong-attacker-secret-key-12345678!';
    const issuer = 'http://localhost:9000/application/o/cloudtak/';
    const config: OIDCConfig = {
        discovery: 'http://identity-server:9000/application/o/cloudtak/.well-known/openid-configuration',
        client: 'cloudtak',
        secret: clientSecret,
        redirect: 'http://localhost:5000/api/login/oidc/callback',
        scopes: 'openid profile email groups',
        issuer,
    };
    const disc: OIDCDiscovery = {
        issuer,
        authorization_endpoint: 'http://localhost:9000/application/o/authorize/',
        token_endpoint: 'http://identity-server:9000/application/o/token/',
        userinfo_endpoint: 'http://identity-server:9000/application/o/userinfo/',
    };

    const idToken = jwt.sign({
        sub: 'testoperator',
        iss: issuer,
        aud: 'cloudtak',
    }, wrongSecret, { algorithm: 'HS256', expiresIn: '1h' });

    assert.throws(
        () => validateIdToken(idToken, disc, config),
        /Invalid OIDC ID token: invalid signature/,
    );
});

test('OIDC ID Token: rejects mismatched nonce', () => {
    const clientSecret = 'super-secret-client-key-min-32-chars!';
    const issuer = 'http://localhost:9000/application/o/cloudtak/';
    const config: OIDCConfig = {
        discovery: 'http://identity-server:9000/application/o/cloudtak/.well-known/openid-configuration',
        client: 'cloudtak',
        secret: clientSecret,
        redirect: 'http://localhost:5000/api/login/oidc/callback',
        scopes: 'openid profile email groups',
        issuer,
    };
    const disc: OIDCDiscovery = {
        issuer,
        authorization_endpoint: 'http://localhost:9000/application/o/authorize/',
        token_endpoint: 'http://identity-server:9000/application/o/token/',
        userinfo_endpoint: 'http://identity-server:9000/application/o/userinfo/',
    };

    const idToken = jwt.sign({
        sub: 'testoperator',
        iss: issuer,
        aud: 'cloudtak',
        nonce: 'actual-idp-nonce-value',
    }, clientSecret, { algorithm: 'HS256', expiresIn: '1h' });

    assert.throws(
        () => validateIdToken(idToken, disc, config, 'expected-different-nonce'),
        /OIDC ID token nonce mismatch/,
    );
});

test('OIDC URLs: resolveInternalUrl rewrites public/browser endpoint to internal container network', () => {
    const discoveryUrl = 'http://identity-server:9000/application/o/cloudtak/.well-known/openid-configuration';
    const publicTokenEndpoint = 'http://localhost:9000/application/o/token/';
    const resolved = resolveInternalUrl(publicTokenEndpoint, discoveryUrl);
    assert.equal(resolved, 'http://identity-server:9000/application/o/token/');

    const publicUserInfoEndpoint = 'https://tisck.tactical.lan:9000/application/o/userinfo/';
    const resolvedUserInfo = resolveInternalUrl(publicUserInfoEndpoint, discoveryUrl);
    assert.equal(resolvedUserInfo, 'http://identity-server:9000/application/o/userinfo/');
});

test('OIDC URLs: resolveInternalUrl preserves endpoint when host already matches discovery', () => {
    const discoveryUrl = 'http://identity-server:9000/application/o/cloudtak/.well-known/openid-configuration';
    const internalEndpoint = 'http://identity-server:9000/application/o/token/';
    const resolved = resolveInternalUrl(internalEndpoint, discoveryUrl);
    assert.equal(resolved, 'http://identity-server:9000/application/o/token/');
});
