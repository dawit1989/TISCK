import { test } from 'node:test';
import assert from 'node:assert';
import * as fsp from 'node:fs/promises';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { build } from '../CoreConfig.js';
import { generateEnrollment } from '../bin/generate-enrollment.js';
import { syncPull, syncPush } from '../src/s3-sync.js';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import * as xmljs from 'xml-js';

const S3_ENDPOINT = process.env.AWS_S3_Endpoint || 'http://127.0.0.1:3900';
const S3_BUCKET = process.env.S3_BUCKET || 'tak-server';
const ACCESS_KEY = process.env.AWS_S3_AccessKeyId || 'GK9271da3b9f4bab9872cc88da';
const SECRET_KEY = process.env.AWS_S3_SecretAccessKey || 'ee6b428c2ee78c6af64ed8e1a43aa2ca8e14ddcccac5800f45c17b7d72bc83a5';

test('E2E: TAK Infrastructure & Deployed Garage S3 Integration', async (t) => {
    const testDir = await fsp.mkdtemp(path.join(tmpdir(), 'tak-e2e-'));
    const tmpWorkingDir = await fsp.mkdtemp(path.join(tmpdir(), 'tmp-e2e-'));
    const certsDir = path.join(testDir, 'certs', 'files');
    await fsp.mkdir(certsDir, { recursive: true });

    // Mock initial CA certificates for test
    await fsp.writeFile(path.join(certsDir, 'ca.pem'), '-----BEGIN CERTIFICATE-----\nMOCK_CA\n-----END CERTIFICATE-----\n');
    await fsp.writeFile(path.join(certsDir, 'intermediate-ca-signing.jks'), 'MOCK_KEYSTORE');

    t.after(async () => {
        await Promise.all([
            fsp.rm(testDir, { recursive: true, force: true }),
            fsp.rm(tmpWorkingDir, { recursive: true, force: true })
        ]);
    });

    // 1. Test CoreConfig Generation in Offline / Internal Mode
    await t.test('1. CoreConfig Generator - Internal Auth Mode', async () => {
        const canonicalConfigDir = path.join(testDir, 'config');
        await build({
            version: 'takserver-docker-5.6-RELEASE-2',
            tmpdir: tmpWorkingDir,
            takdir: testDir,
            domain: 'localhost',
            stackName: 'TAKServer',
            configDir: canonicalConfigDir,
            skipKeystoreValidation: true,
            postgres: {
                username: 'tak',
                password: 'atakatak',
                url: 'postgresql://tak-db:5432/takserver'
            }
        });

        const configPath = path.join(canonicalConfigDir, 'CoreConfig.xml');
        assert.ok(fs.existsSync(configPath), 'CoreConfig.xml should exist');

        const xmlContent = await fsp.readFile(configPath, 'utf-8');
        const parsed = xmljs.xml2js(xmlContent, { compact: true }) as any;

        assert.strictEqual(parsed.Configuration.auth.ldap, undefined, 'LDAP should be omitted in internal mode');
        assert.strictEqual(parsed.Configuration.auth._attributes.default, 'file', 'Auth default should be file');
        assert.strictEqual(parsed.Configuration.repository.connection._attributes.url, 'jdbc:postgresql://tak-db:5432/takserver');
    });

    // 2. Test CoreConfig Generation in Authentik LDAP Mode
    await t.test('2. CoreConfig Generator - Authentik LDAP Mode', async () => {
        const canonicalConfigDir = path.join(testDir, 'config-ldap');
        await build({
            version: 'takserver-docker-5.6-RELEASE-2',
            tmpdir: tmpWorkingDir,
            takdir: testDir,
            domain: 'localhost',
            stackName: 'TAKServer',
            configDir: canonicalConfigDir,
            skipKeystoreValidation: true,
            postgres: {
                username: 'tak',
                password: 'atakatak',
                url: 'postgresql://tak-db:5432/takserver'
            },
            ldap: {
                dn: 'dc=ldap,dc=goauthentik,dc=io',
                secureUrl: 'ldap://identity-ldap:389',
                serviceUser: 'cn=akadmin,ou=users,dc=ldap,dc=goauthentik,dc=io',
                serviceUserPassword: 'password123'
            }
        });

        const configPath = path.join(canonicalConfigDir, 'CoreConfig.xml');
        const xmlContent = await fsp.readFile(configPath, 'utf-8');
        const parsed = xmljs.xml2js(xmlContent, { compact: true }) as any;

        assert.ok(parsed.Configuration.auth.ldap, 'LDAP block should exist');
        assert.strictEqual(parsed.Configuration.auth.ldap._attributes.url, 'ldap://identity-ldap:389');
        assert.strictEqual(parsed.Configuration.auth.ldap._attributes.roleAttribute, 'memberOf', 'roleAttribute must be memberOf');
    });

    // 3. Test Dual QR Code and ATAK Data Package Generation
    await t.test('3. ATAK Enrollment Package & QR Code Generation', async () => {
        process.env.HostedDomain = 'localhost';
        process.env.TAK_COT_PORT = '8089';
        process.env.TAK_CERT_PORT = '8446';
        process.env.AWS_S3_Endpoint = S3_ENDPOINT;
        process.env.S3_BUCKET = S3_BUCKET;
        process.env.AWS_S3_AccessKeyId = ACCESS_KEY;
        process.env.AWS_S3_SecretAccessKey = SECRET_KEY;
        process.env.AWS_REGION = 'garage';
        process.env.AWS_S3_ForcePathStyle = 'true';

        await generateEnrollment(testDir);

        const zipPath = path.join(testDir, 'certs', 'enrollment', 'enrollment.zip');
        const qrPath = path.join(testDir, 'certs', 'enrollment', 'enrollment-qr.png');

        assert.ok(fs.existsSync(zipPath), 'enrollment.zip must be generated');
        assert.ok(fs.existsSync(qrPath), 'enrollment-qr.png must be generated');

        const zipStat = await fsp.stat(zipPath);
        assert.ok(zipStat.size > 500, 'enrollment.zip must have valid size');
    });

    // 4. Test Live Garage S3 Synchronization (Push and Pull)
    await t.test('4. Live Garage S3 Push & Pull Sync', async () => {
        // Copy CoreConfig.xml to testDir root
        await fsp.copyFile(path.join(testDir, 'config', 'CoreConfig.xml'), path.join(testDir, 'CoreConfig.xml'));

        // Perform Push
        await syncPush(testDir);

        // Verify objects in Garage S3
        const s3 = new S3Client({
            endpoint: S3_ENDPOINT,
            region: 'garage',
            forcePathStyle: true,
            credentials: {
                accessKeyId: ACCESS_KEY,
                secretAccessKey: SECRET_KEY
            }
        });

        const list = await s3.send(new ListObjectsV2Command({
            Bucket: S3_BUCKET
        }));

        assert.ok(list.Contents && list.Contents.length > 0, 'Garage tak-server bucket should contain objects');
        const keys = list.Contents.map(c => c.Key);
        console.log('   Garage S3 Objects in tak-server bucket:', keys);

        assert.ok(keys.includes('config/CoreConfig.xml'), 'CoreConfig.xml must be uploaded to S3');
        assert.ok(keys.some(k => k?.startsWith('enrollment/')), 'Enrollment artifacts must be uploaded to S3');

        // Test Pull into clean directory
        const pullDir = await fsp.mkdtemp(path.join(tmpdir(), 'tak-pull-'));
        try {
            await syncPull(pullDir);
            assert.ok(fs.existsSync(path.join(pullDir, 'CoreConfig.xml')), 'Pulled CoreConfig.xml must exist');
            assert.ok(fs.existsSync(path.join(pullDir, 'certs', 'files', 'ca.pem')), 'Pulled ca.pem must exist');
        } finally {
            await fsp.rm(pullDir, { recursive: true, force: true });
        }
    });
});
