import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import JSZip from 'jszip';
import QRCode from 'qrcode';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { pathToFileURL } from 'node:url';

export async function generateEnrollment(takdir: string = '/opt/tak') {
    const domain = process.env.HostedDomain || 'localhost';
    const cotPort = process.env.TAK_COT_PORT || '8089';
    const certPort = process.env.TAK_CERT_PORT || '8446';
    const outputDir = path.join(takdir, 'certs', 'enrollment');

    await fsp.mkdir(outputDir, { recursive: true });

    const caPath = path.join(takdir, 'certs', 'files', 'ca.pem');
    let caContent = '';
    if (fs.existsSync(caPath)) {
        caContent = await fsp.readFile(caPath, 'utf-8');
    }

    // 1. Build server.pref XML
    const serverPref = `<?xml version='1.0' standalone='yes'?>
<preferences>
  <preference version="1" name="cot_streams">
    <entry key="count" class="java.lang.Integer">1</entry>
    <entry key="description0" class="java.lang.String">TISCK TAK Server</entry>
    <entry key="enabled0" class="java.lang.Boolean">true</entry>
    <entry key="connectString0" class="java.lang.String">${domain}:${cotPort}:ssl</entry>
    <entry key="caLocation0" class="java.lang.String">certs/ca.pem</entry>
    <entry key="caPassword0" class="java.lang.String">atakatak</entry>
    <entry key="enrollForCertificate0" class="java.lang.Boolean">true</entry>
    <entry key="enrollForCertificateUrl0" class="java.lang.String">https://${domain}:${certPort}/Marti/api/tls/config</entry>
  </preference>
  <preference version="1" name="certificate_enrollment">
    <entry key="certificateEnrollmentServer" class="java.lang.String">${domain}</entry>
    <entry key="certificateEnrollmentPort" class="java.lang.Integer">${certPort}</entry>
    <entry key="certificateEnrollmentUseHttps" class="java.lang.Boolean">true</entry>
  </preference>
</preferences>
`;

    // 2. Build MANIFEST/manifest.xml
    const manifestXml = `<MissionPackageManifest version="2">
  <Configuration>
    <Parameter name="name" value="TISCK-TAK-Enrollment"/>
    <Parameter name="uid" value="tisck-enrollment"/>
  </Configuration>
  <Contents>
    <Content zipEntry="certs/ca.pem" ignore="false"/>
    <Content zipEntry="server.pref" ignore="false"/>
  </Contents>
</MissionPackageManifest>
`;

    // 3. Assemble enrollment.zip
    const zip = new JSZip();
    zip.file('MANIFEST/manifest.xml', manifestXml);
    zip.file('server.pref', serverPref);
    if (caContent) {
        zip.file('certs/ca.pem', caContent);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const zipFilePath = path.join(outputDir, 'enrollment.zip');
    await fsp.writeFile(zipFilePath, zipBuffer);
    console.log(`ok - Enrollment - Generated Data Package at ${zipFilePath}`);

    // 4. Generate QR code payload and image
    const qrPayload = JSON.stringify({
        version: 1,
        name: 'TISCK TAK Server',
        server: `${domain}:${cotPort}:ssl`,
        enrollmentUrl: `https://${domain}:${certPort}/Marti/api/tls/config`,
        auth: 'ldap'
    });

    const qrFilePath = path.join(outputDir, 'enrollment-qr.png');
    await QRCode.toFile(qrFilePath, qrPayload, {
        errorCorrectionLevel: 'M',
        width: 400
    });
    console.log(`ok - Enrollment - Generated QR Code image at ${qrFilePath}`);

    // 5. Upload to Garage S3 if configured
    if (process.env.S3_ENABLED !== 'false' && process.env.AWS_S3_Endpoint) {
        try {
            const client = new S3Client({
                endpoint: process.env.AWS_S3_Endpoint,
                region: process.env.AWS_REGION || 'garage',
                forcePathStyle: process.env.AWS_S3_ForcePathStyle !== 'false',
                credentials: {
                    accessKeyId: process.env.AWS_S3_AccessKeyId || 'cloudtak-key',
                    secretAccessKey: process.env.AWS_S3_SecretAccessKey || ''
                }
            });
            const bucket = process.env.S3_BUCKET || 'tak-server';

            await client.send(new PutObjectCommand({
                Bucket: bucket,
                Key: 'enrollment/enrollment.zip',
                Body: zipBuffer,
                ContentType: 'application/zip'
            }));

            const qrBuffer = await fsp.readFile(qrFilePath);
            await client.send(new PutObjectCommand({
                Bucket: bucket,
                Key: 'enrollment/enrollment-qr.png',
                Body: qrBuffer,
                ContentType: 'image/png'
            }));

            console.log(`ok - Enrollment - Synced enrollment package and QR to s3://${bucket}/enrollment/`);
        } catch (err: any) {
            console.warn(`warn - Enrollment - Failed to sync to Garage S3: ${err.message}`);
        }
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const takdir = process.env.TAK_DIR || '/opt/tak';
    await generateEnrollment(takdir);
}
