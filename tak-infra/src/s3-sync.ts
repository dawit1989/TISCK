import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    S3Client,
    HeadBucketCommand,
    CreateBucketCommand,
    GetObjectCommand,
    PutObjectCommand,
    ListObjectsV2Command
} from '@aws-sdk/client-s3';

function getS3Client(): { client: S3Client, bucket: string } | null {
    if (process.env.S3_ENABLED === 'false') {
        return null;
    }

    const endpoint = process.env.AWS_S3_Endpoint || 'http://store:3900';
    const region = process.env.AWS_REGION || 'garage';
    const bucket = process.env.S3_BUCKET || 'tak-server';
    const accessKeyId = process.env.AWS_S3_AccessKeyId || 'cloudtak-key';
    const secretAccessKey = process.env.AWS_S3_SecretAccessKey || '';

    if (!endpoint) {
        return null;
    }

    const client = new S3Client({
        endpoint,
        region,
        forcePathStyle: process.env.AWS_S3_ForcePathStyle !== 'false',
        credentials: {
            accessKeyId,
            secretAccessKey
        }
    });

    return { client, bucket };
}

async function ensureBucket(client: S3Client, bucket: string) {
    try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (err: any) {
        if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
            console.log(`ok - S3 - Bucket '${bucket}' does not exist, creating...`);
            await client.send(new CreateBucketCommand({ Bucket: bucket }));
            console.log(`ok - S3 - Bucket '${bucket}' created successfully`);
        } else {
            throw err;
        }
    }
}

async function pullFile(client: S3Client, bucket: string, key: string, destPath: string) {
    try {
        const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (response.Body) {
            await fsp.mkdir(path.dirname(destPath), { recursive: true });
            const byteArray = await response.Body.transformToByteArray();
            await fsp.writeFile(destPath, byteArray);
            console.log(`ok - S3 - Pulled s3://${bucket}/${key} -> ${destPath}`);
        }
    } catch (err: any) {
        if (err.name !== 'NoSuchKey' && err.$metadata?.httpStatusCode !== 404) {
            console.warn(`warn - S3 - Failed to pull ${key}: ${err.message}`);
        }
    }
}

async function pushFile(client: S3Client, bucket: string, key: string, srcPath: string) {
    try {
        if (!fs.existsSync(srcPath)) {
            return;
        }
        const body = await fsp.readFile(srcPath);
        await client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body
        }));
        console.log(`ok - S3 - Pushed ${srcPath} -> s3://${bucket}/${key}`);
    } catch (err: any) {
        console.warn(`warn - S3 - Failed to push ${key}: ${err.message}`);
    }
}

async function pushDirectory(client: S3Client, bucket: string, s3Prefix: string, localDir: string) {
    if (!fs.existsSync(localDir)) {
        return;
    }

    const entries = await fsp.readdir(localDir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(localDir, entry.name);
        const s3Key = path.posix.join(s3Prefix, entry.name);

        if (entry.isDirectory()) {
            await pushDirectory(client, bucket, s3Key, fullPath);
        } else if (entry.isFile()) {
            await pushFile(client, bucket, s3Key, fullPath);
        }
    }
}

async function pullPrefix(client: S3Client, bucket: string, s3Prefix: string, localDir: string) {
    try {
        const response = await client.send(new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: s3Prefix
        }));

        if (!response.Contents) {
            return;
        }

        for (const item of response.Contents) {
            if (!item.Key || item.Key.endsWith('/')) {
                continue;
            }
            const relativePath = path.posix.relative(s3Prefix, item.Key);
            const targetPath = path.join(localDir, relativePath);
            await pullFile(client, bucket, item.Key, targetPath);
        }
    } catch (err: any) {
        console.warn(`warn - S3 - Failed to list prefix ${s3Prefix}: ${err.message}`);
    }
}

export async function syncPull(takdir: string = '/opt/tak') {
    const s3 = getS3Client();
    if (!s3) {
        console.log('ok - S3 - S3 integration disabled or unconfigured, skipping pull');
        return;
    }

    try {
        await ensureBucket(s3.client, s3.bucket);
        console.log(`ok - S3 - Pulling configurations and certs from bucket '${s3.bucket}'`);
        await pullFile(s3.client, s3.bucket, 'config/CoreConfig.xml', path.join(takdir, 'CoreConfig.xml'));
        await pullPrefix(s3.client, s3.bucket, 'certs/', path.join(takdir, 'certs', 'files'));
    } catch (err: any) {
        console.warn(`warn - S3 - S3 pull skipped: ${err.message}`);
    }
}

export async function syncPush(takdir: string = '/opt/tak') {
    const s3 = getS3Client();
    if (!s3) {
        console.log('ok - S3 - S3 integration disabled or unconfigured, skipping push');
        return;
    }

    try {
        await ensureBucket(s3.client, s3.bucket);
        console.log(`ok - S3 - Pushing configurations, certs, and packages to bucket '${s3.bucket}'`);
        await pushFile(s3.client, s3.bucket, 'config/CoreConfig.xml', path.join(takdir, 'CoreConfig.xml'));
        await pushDirectory(s3.client, s3.bucket, 'certs', path.join(takdir, 'certs', 'files'));

        const dataDir = path.join(takdir, 'data');
        if (fs.existsSync(dataDir)) {
            await pushDirectory(s3.client, s3.bucket, 'data', dataDir);
        }
    } catch (err: any) {
        console.warn(`warn - S3 - S3 push skipped: ${err.message}`);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const action = process.argv[2] || 'pull';
    const takdir = process.env.TAK_DIR || '/opt/tak';

    if (action === 'pull') {
        await syncPull(takdir);
    } else if (action === 'push') {
        await syncPush(takdir);
    } else {
        console.error(`Unknown action: ${action}. Use 'pull' or 'push'`);
        process.exit(1);
    }
}
