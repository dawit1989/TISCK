import test from 'node:test';
import assert from 'node:assert';
import Config from '../common/config.js';

const pgConn = process.env.POSTGRES || 'postgres://docker:docker@postgis:5432/gis';

const baseArgs = {
    postgres: pgConn,
    hubUrl: 'http://localhost:5002',
    silent: true,
    noevents: true,
    noetlevents: true,
    nocache: true,
};

function restoreEnv(key: string, val: string | undefined): void {
    if (val !== undefined) {
        process.env[key] = val;
    } else {
        delete process.env[key];
    }
}

test('SigningSecret: rejects "coe-wildland-fire" in docker-compose mode even in test environment', async () => {
    const origMode = process.env.CLOUDTAK_Mode;
    const origSecret = process.env.SigningSecret;
    const origStack = process.env.StackName;
    const origNodeEnv = process.env.NODE_ENV;

    try {
        process.env.CLOUDTAK_Mode = 'docker-compose';
        process.env.SigningSecret = 'coe-wildland-fire';
        process.env.StackName = 'test';
        process.env.NODE_ENV = 'test';

        await assert.rejects(
            async () => await Config.envInit(baseArgs),
            /SigningSecret environment variable cannot use insecure default or placeholder in docker-compose mode/,
        );
    } finally {
        restoreEnv('CLOUDTAK_Mode', origMode);
        restoreEnv('SigningSecret', origSecret);
        restoreEnv('StackName', origStack);
        restoreEnv('NODE_ENV', origNodeEnv);
    }
});

test('SigningSecret: rejects placeholder string in docker-compose mode', async () => {
    const origMode = process.env.CLOUDTAK_Mode;
    const origSecret = process.env.SigningSecret;

    try {
        process.env.CLOUDTAK_Mode = 'docker-compose';
        process.env.SigningSecret = 'CHANGE_ME_TO_A_SECURE_RANDOM_STRING_MIN_32_CHARS';

        await assert.rejects(
            async () => await Config.envInit(baseArgs),
            /SigningSecret environment variable cannot use insecure default or placeholder in docker-compose mode/,
        );
    } finally {
        restoreEnv('CLOUDTAK_Mode', origMode);
        restoreEnv('SigningSecret', origSecret);
    }
});

test('SigningSecret: rejects short secrets (< 32 chars) in docker-compose mode', async () => {
    const origMode = process.env.CLOUDTAK_Mode;
    const origSecret = process.env.SigningSecret;

    try {
        process.env.CLOUDTAK_Mode = 'docker-compose';
        process.env.SigningSecret = 'short_secret_under_32_chars';

        await assert.rejects(
            async () => await Config.envInit(baseArgs),
            /SigningSecret environment variable must be at least 32 characters/,
        );
    } finally {
        restoreEnv('CLOUDTAK_Mode', origMode);
        restoreEnv('SigningSecret', origSecret);
    }
});

test('SigningSecret: accepts valid secure string (>= 32 chars) in docker-compose mode', async () => {
    const origMode = process.env.CLOUDTAK_Mode;
    const origSecret = process.env.SigningSecret;

    try {
        process.env.CLOUDTAK_Mode = 'docker-compose';
        process.env.SigningSecret = 'this_is_a_very_secure_random_signing_secret_for_tisck_testing_123';

        const config = await Config.envInit(baseArgs);
        assert.equal(config.SigningSecret, 'this_is_a_very_secure_random_signing_secret_for_tisck_testing_123');
        if (config.pg) {
            await config.pg.end();
        }
    } finally {
        restoreEnv('CLOUDTAK_Mode', origMode);
        restoreEnv('SigningSecret', origSecret);
    }
});

test('SigningSecret: missing secret in production docker-compose mode throws', async () => {
    const origMode = process.env.CLOUDTAK_Mode;
    const origSecret = process.env.SigningSecret;

    try {
        process.env.CLOUDTAK_Mode = 'docker-compose';
        delete process.env.SigningSecret;

        await assert.rejects(
            async () => await Config.envInit(baseArgs),
            /SigningSecret environment variable must be set to a secure random string/,
        );
    } finally {
        restoreEnv('CLOUDTAK_Mode', origMode);
        restoreEnv('SigningSecret', origSecret);
    }
});
