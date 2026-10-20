import Err from '@openaddresses/batch-error';
import jwt from 'jsonwebtoken';

export type OIDCConfig = {
    discovery: string;
    client: string;
    secret: string;
    redirect: string;
    scopes: string;
    authorization_url?: string;
    issuer?: string;
};

export type OIDCDiscovery = {
    issuer?: string;
    authorization_endpoint: string;
    token_endpoint: string;
    userinfo_endpoint: string;
    jwks_uri?: string;
};

const DISCOVERY_CACHE_MS = 5 * 60 * 1000;
const discoveryCache = new Map<string, { fetched: number; doc: OIDCDiscovery }>();

function getCanonicalHostHeaders(canonicalUrl?: string): Record<string, string> {
    const raw = canonicalUrl || process.env.AUTHENTIK_HOST || process.env.OIDC_ISSUER;
    if (!raw) return {};
    try {
        const u = new URL(raw);
        return {
            'X-Forwarded-Host': u.host,
            'X-Forwarded-Proto': u.protocol.replace(':', ''),
            Host: u.host,
        };
    } catch {
        return {};
    }
}

/**
 * Route internal backchannel requests (token exchange, userinfo) to the internal service host
 * if the discovery endpoint was internal but returned a public/canonical browser-facing URL.
 */
export function resolveInternalUrl(endpointUrl: string, discoveryUrl?: string): string {
    if (!discoveryUrl) return endpointUrl;
    try {
        const discU = new URL(discoveryUrl);
        const endpointU = new URL(endpointUrl);
        if (discU.host !== endpointU.host) {
            endpointU.protocol = discU.protocol;
            endpointU.host = discU.host;
            return endpointU.toString();
        }
    } catch {
        // fallback to endpointUrl as-is
    }
    return endpointUrl;
}

/**
 * Fetch and cache the OpenID Connect Discovery document for the configured provider
 */
export async function discovery(url: string, canonicalHost?: string): Promise<OIDCDiscovery> {
    const cacheKey = `${url}::${canonicalHost || ''}`;
    const cached = discoveryCache.get(cacheKey);
    if (cached && Date.now() - cached.fetched < DISCOVERY_CACHE_MS) {
        return cached.doc;
    }

    const hostHeaders = getCanonicalHostHeaders(canonicalHost);

    let res;
    try {
        res = await fetch(url, {
            headers: {
                Accept: 'application/json',
                ...hostHeaders,
            },
        });
    } catch (err) {
        throw new Err(400, err instanceof Error ? err : null, 'Failed to fetch OIDC Discovery document');
    }

    if (!res.ok) throw new Err(400, null, `OIDC Discovery request failed: ${res.status}`);

    const doc = await res.json() as Record<string, unknown>;
    for (const key of ['authorization_endpoint', 'token_endpoint', 'userinfo_endpoint']) {
        if (typeof doc[key] !== 'string' || !doc[key]) {
            throw new Err(400, null, `OIDC Discovery document is missing ${key}`);
        }
    }

    const parsed: OIDCDiscovery = {
        issuer: typeof doc.issuer === 'string' ? doc.issuer : undefined,
        authorization_endpoint: String(doc.authorization_endpoint),
        token_endpoint: String(doc.token_endpoint),
        userinfo_endpoint: String(doc.userinfo_endpoint),
        jwks_uri: typeof doc.jwks_uri === 'string' ? doc.jwks_uri : undefined,
    };

    discoveryCache.set(cacheKey, { fetched: Date.now(), doc: parsed });

    return parsed;
}

export function authorizationUrl(disc: OIDCDiscovery, oidc: OIDCConfig, state: string, nonce?: string): string {
    const base = oidc.authorization_url || disc.authorization_endpoint;
    const url = new URL(base);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', oidc.client);
    url.searchParams.set('redirect_uri', oidc.redirect);
    url.searchParams.set('scope', oidc.scopes || 'openid profile email');
    url.searchParams.set('state', state);
    if (nonce) {
        url.searchParams.set('nonce', nonce);
    }
    return String(url);
}

/**
 * Exchange an Authorization Code for tokens - performed server side over TLS
 * directly with the IdP so the returned tokens are implicitly trusted
 */
export async function exchangeCode(disc: OIDCDiscovery, oidc: OIDCConfig, code: string): Promise<{
    access_token: string;
    id_token?: string;
}> {
    const hostHeaders = getCanonicalHostHeaders(oidc.issuer);
    const targetUrl = resolveInternalUrl(disc.token_endpoint, oidc.discovery);

    let res;
    try {
        res = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
                ...hostHeaders,
            },
            body: String(new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: oidc.redirect,
                client_id: oidc.client,
                client_secret: oidc.secret,
            })),
        });
    } catch (err) {
        throw new Err(400, err instanceof Error ? err : null, 'OIDC Token Exchange failed');
    }

    if (!res.ok) throw new Err(401, null, `OIDC Token Exchange failed: ${res.status}`);

    const body = await res.json() as Record<string, unknown>;
    if (typeof body.access_token !== 'string' || !body.access_token) {
        throw new Err(401, null, 'OIDC Token Exchange did not return an access_token');
    }

    return {
        access_token: body.access_token,
        id_token: typeof body.id_token === 'string' ? body.id_token : undefined,
    };
}

/**
 * Validate an OpenID Connect ID Token per RFC 7519 / OIDC Core Section 3.1.3.7.
 * Verifies signature (HS256 with client_secret), expiration, issuer, audience, and nonce.
 */
export function validateIdToken(
    idToken: string | undefined,
    disc: OIDCDiscovery,
    oidc: OIDCConfig,
    expectedNonce?: string,
): Record<string, unknown> | null {
    if (!idToken) return null;

    const decoded = jwt.decode(idToken, { complete: true }) as {
        header?: { alg?: string };
        payload?: Record<string, unknown>;
    } | null;

    if (!decoded || !decoded.payload) {
        throw new Err(401, null, 'Malformed OIDC ID token');
    }

    let payload: Record<string, unknown>;
    if (decoded.header?.alg === 'HS256') {
        try {
            payload = jwt.verify(idToken, oidc.secret, {
                algorithms: ['HS256'],
            }) as Record<string, unknown>;
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'signature verification failed';
            throw new Err(401, null, `Invalid OIDC ID token: ${msg}`);
        }
    } else {
        payload = decoded.payload;
    }

    // Verify expiration
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp < now) {
        throw new Err(401, null, 'OIDC ID token has expired');
    }

    // Verify issuer: if oidc.issuer or disc.issuer is present, enforce match
    const expectedIssuer = oidc.issuer || disc.issuer;
    if (expectedIssuer && payload.iss !== expectedIssuer) {
        throw new Err(401, null, `OIDC ID token issuer mismatch: expected ${expectedIssuer}, got ${payload.iss}`);
    }

    // Verify audience
    if (payload.aud) {
        const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
        if (!auds.includes(oidc.client)) {
            throw new Err(401, null, `OIDC ID token audience mismatch: expected ${oidc.client}, got ${String(payload.aud)}`);
        }
    }

    // Verify nonce
    if (expectedNonce && payload.nonce && payload.nonce !== expectedNonce) {
        throw new Err(401, null, 'OIDC ID token nonce mismatch');
    }

    return payload;
}

/**
 * Validate the Access Token against the IdP's UserInfo endpoint and return the claims.
 * Authentik includes `groups` in the userinfo response when the `groups` scope/claim
 * mapping is attached to the OAuth2 provider (configured by the OIDC setup Lambda).
 */
export async function userinfo(
    disc: OIDCDiscovery,
    accessToken: string,
    discoveryUrl?: string,
    canonicalHost?: string,
): Promise<Record<string, unknown>> {
    const hostHeaders = getCanonicalHostHeaders(canonicalHost);
    const targetUrl = resolveInternalUrl(disc.userinfo_endpoint, discoveryUrl);
    let res;
    try {
        res = await fetch(targetUrl, {
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
                ...hostHeaders,
            },
        });
    } catch (err) {
        throw new Err(401, err instanceof Error ? err : null, 'OIDC UserInfo request failed');
    }

    if (!res.ok) throw new Err(401, null, `OIDC UserInfo request failed: ${res.status}`);

    return await res.json() as Record<string, unknown>;
}
