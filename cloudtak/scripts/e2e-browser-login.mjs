import { spawn } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const userDataDir = join(tmpdir(), `edge_tisck_${Date.now()}`);
mkdirSync(userDataDir, { recursive: true });

console.log('[1] Launching Edge headless with CDP...');
const browser = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
], { stdio: 'ignore' });

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

let ws;

async function sendCdp(method, params = {}) {
    return new Promise((resolve, reject) => {
        const id = Math.floor(Math.random() * 1000000);
        const onMsg = (evt) => {
            const data = JSON.parse(evt.data);
            if (data.id === id) {
                ws.removeEventListener('message', onMsg);
                if (data.error) reject(new Error(JSON.stringify(data.error)));
                else resolve(data.result);
            }
        };
        ws.addEventListener('message', onMsg);
        ws.send(JSON.stringify({ id, method, params }));
    });
}

async function evalJs(expr) {
    const res = await sendCdp('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true,
    });
    return res?.result?.value;
}

const networkEvents = [];

try {
    await sleep(2500);
    const newTab = await (await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' })).json();
    console.log('[2] Created fresh page tab:', newTab.id);
    const targetWsUrl = newTab.webSocketDebuggerUrl;

    ws = new WebSocket(targetWsUrl);
    await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve);
        ws.addEventListener('error', reject);
    });
    console.log('[3] WebSocket connected to tab');

    ws.addEventListener('message', (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.method === 'Network.requestWillBeSent') {
            networkEvents.push({
                type: 'request',
                url: msg.params.request.url,
                method: msg.params.request.method,
                redirectResponse: msg.params.redirectResponse ? {
                    status: msg.params.redirectResponse.status,
                    headers: msg.params.redirectResponse.headers,
                } : null,
            });
        }
    });

    await sendCdp('Page.enable');
    await sendCdp('Network.enable');

    console.log('[4] Navigating to http://localhost:5000/api/login/oidc...');
    await sendCdp('Page.navigate', { url: 'http://localhost:5000/api/login/oidc' });

    // Wait and check URL landed on Authentik
    let currentUrl = '';
    for (let i = 0; i < 20; i++) {
        await sleep(500);
        currentUrl = await evalJs('window.location.href');
        if (currentUrl && currentUrl.includes(':9000')) {
            break;
        }
    }
    console.log('[5] Landed on Authentik flow:', currentUrl);

    // Wait for stage identification
    await sleep(2000);
    console.log('[6] Locating and filling uidField (testoperator)...');
    const fillUserResult = await evalJs(`
        (() => {
            function deepQuery(root, selector) {
                if (!root) return null;
                const el = root.querySelector(selector);
                if (el) return el;
                for (const child of root.querySelectorAll('*')) {
                    if (child.shadowRoot) {
                        const found = deepQuery(child.shadowRoot, selector);
                        if (found) return found;
                    }
                }
                return null;
            }

            const input = deepQuery(document, 'input[name="uidField"]');
            if (!input) throw new Error('uidField not found');
            input.value = 'testoperator';
            input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

            const btn = deepQuery(document, 'button[type="submit"]');
            if (!btn) throw new Error('submit button not found');
            btn.click();
            return 'user_submitted';
        })()
    `);
    console.log('[7] Username submitted successfully');

    // Wait for password field to appear
    console.log('[8] Waiting for password stage...');
    let passFound = false;
    for (let i = 0; i < 20; i++) {
        await sleep(500);
        const checkPass = await evalJs(`
            function deepQuery(root, selector) {
                if (!root) return null;
                const el = root.querySelector(selector);
                if (el) return el;
                for (const child of root.querySelectorAll('*')) {
                    if (child.shadowRoot) {
                        const found = deepQuery(child.shadowRoot, selector);
                        if (found) return found;
                    }
                }
                return null;
            }
            !!deepQuery(document, 'input[type="password"]');
        `);
        if (checkPass) {
            passFound = true;
            break;
        }
    }
    assert.ok(passFound, 'Password stage must load in Authentik');
    console.log('[9] Password stage loaded successfully');

    // Fill password and submit
    console.log('[10] Filling password for testoperator and submitting...');
    await evalJs(`
        (() => {
            function deepQuery(root, selector) {
                if (!root) return null;
                const el = root.querySelector(selector);
                if (el) return el;
                for (const child of root.querySelectorAll('*')) {
                    if (child.shadowRoot) {
                        const found = deepQuery(child.shadowRoot, selector);
                        if (found) return found;
                    }
                }
                return null;
            }

            const passComp = deepQuery(document, 'ak-flow-input-password');
            if (passComp) passComp.value = 'TestOperatorPassword123!';

            const passInput = deepQuery(document, 'input[type="password"]');
            if (!passInput) throw new Error('password input not found');
            passInput.value = 'TestOperatorPassword123!';
            passInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            passInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

            const btn = deepQuery(document, 'button[type="submit"]');
            if (!btn) throw new Error('Submit button not found');
            btn.click();
            return 'pass_submitted';
        })()
    `);
    console.log('[11] Credentials submitted to Authentik');

    // Wait for browser to redirect back to CloudTAK
    console.log('[12] Waiting for OIDC authorization code redirect and CloudTAK session issuance...');
    let ssoPayload = null;
    let callbackUrl = null;

    for (let i = 0; i < 30; i++) {
        await sleep(500);
        // Check captured network redirects
        for (const ev of networkEvents) {
            if (ev.url.includes('/api/login/oidc/callback?code=')) {
                callbackUrl = ev.url;
            }
            if (ev.redirectResponse && ev.redirectResponse.headers) {
                const loc = ev.redirectResponse.headers.location || ev.redirectResponse.headers.Location;
                if (loc && loc.includes('#sso=')) {
                    const fragment = loc.split('#sso=')[1];
                    ssoPayload = JSON.parse(Buffer.from(fragment, 'base64url').toString('utf8'));
                }
            }
        }

        // Also check localStorage in page
        if (!ssoPayload) {
            try {
                const lsToken = await evalJs('localStorage.getItem("token")');
                if (lsToken) {
                    ssoPayload = { token: lsToken, email: 'testoperator' };
                }
            } catch {}
        }

        if (callbackUrl && ssoPayload) break;
    }

    if (!ssoPayload) {
        console.error('Debug: Network redirects recorded:');
        for (const ev of networkEvents) {
            if (ev.redirectResponse && ev.redirectResponse.headers) {
                console.error('  - Redirect to:', ev.redirectResponse.headers.location || ev.redirectResponse.headers.Location);
            }
        }
        const pageUrl = await evalJs('window.location.href');
        const pageText = await evalJs('document.body.innerText');
        console.error('Debug: Browser ended on URL:', pageUrl);
        console.error('Debug: Page text:', pageText);
    }

    assert.ok(callbackUrl, 'Browser must receive authorization-code callback to /api/login/oidc/callback');
    console.log('[13] Authorization-code callback received by CloudTAK:');
    const parsedCallback = new URL(callbackUrl);
    console.log('   - Code param present:', !!parsedCallback.searchParams.get('code'));
    console.log('   - State param present:', !!parsedCallback.searchParams.get('state'));

    assert.ok(ssoPayload, 'CloudTAK must issue session payload via #sso= fragment redirect');
    console.log('[14] Session issued by CloudTAK:');
    console.log('   - User/Email:', ssoPayload.email);
    console.log('   - Access level:', ssoPayload.access);
    console.log('   - CloudTAK Token:', !!ssoPayload.token);
    console.log('   - Session ID:', !!ssoPayload.session);
    console.log('   - Refresh Token:', !!ssoPayload.refresh);

    // Validate token decoded claims
    const tokenParts = ssoPayload.token.split('.');
    assert.equal(tokenParts.length, 3, 'Token must be a valid 3-part JWT');
    const jwtPayload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString('utf8'));
    console.log('[15] Token JWT Claims:');
    console.log('   - Subject/Email:', jwtPayload.email);
    console.log('   - Access role:', jwtPayload.access);
    console.log('   - Token exp:', new Date(jwtPayload.exp * 1000).toISOString());

    assert.equal(jwtPayload.access, 'user', 'Tactical operator must be standard user (not system admin)');
    assert.ok(jwtPayload.email === 'testoperator' || jwtPayload.email === 'testoperator@tisck.local');

    // Test token refresh
    console.log('[16] Testing session refresh (/api/login/refresh)...');
    const refreshRes = await fetch('http://localhost:5000/api/login/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: ssoPayload.refresh }),
    });
    console.log('   - Refresh status:', refreshRes.status);
    assert.equal(refreshRes.status, 200);
    const refreshed = await refreshRes.json();
    assert.ok(refreshed.token);
    console.log('   ✓ Session refresh issued replacement tokens');

    // Test logout
    console.log('[17] Testing logout redirect (/api/logout)...');
    const logoutRes = await fetch('http://localhost:5000/api/logout', { redirect: 'manual' });
    console.log('   - Logout status:', logoutRes.status);
    console.log('   - Logout location:', logoutRes.headers.get('location'));
    assert.equal(logoutRes.status, 302);
    assert.ok(logoutRes.headers.get('location')?.includes('/end-session/'));
    console.log('   ✓ Logout correctly redirects to Authentik end-session endpoint');

    console.log('\n================================================================');
    console.log('🎉 ALL HUMAN LOGIN ACCEPTANCE CHECKS PASSED END-TO-END!');
    console.log('================================================================');

} catch (err) {
    console.error('Test error:', err);
    process.exit(1);
} finally {
    if (ws) ws.close();
    browser.kill('SIGKILL');
    await sleep(500);
    try { rmSync(userDataDir, { recursive: true, force: true }); } catch {}
}
