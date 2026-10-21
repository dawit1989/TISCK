import qrcodeTerminal from 'qrcode-terminal';
import { pathToFileURL } from 'node:url';

export function showTerminalQr() {
    const domain = process.env.HostedDomain || 'localhost';
    const cotPort = process.env.TAK_COT_PORT || '8089';
    const certPort = process.env.TAK_CERT_PORT || '8446';

    const qrPayload = JSON.stringify({
        version: 1,
        name: 'TISCK TAK Server',
        server: `${domain}:${cotPort}:ssl`,
        enrollmentUrl: `https://${domain}:${certPort}/Marti/api/tls/config`,
        auth: 'ldap'
    });

    console.log('\n============================================================');
    console.log('       TISCK TAK Server - ATAK Client Enrollment QR         ');
    console.log('============================================================\n');
    console.log(`Server Address  : ${domain}:${cotPort}`);
    console.log(`Enrollment Port : ${certPort}`);
    console.log(`Enrollment URL  : https://${domain}:${certPort}/Marti/api/tls/config\n`);

    qrcodeTerminal.generate(qrPayload, { small: true });

    console.log('\nScan this QR code using the ATAK camera or "Import Package" to configure.\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    showTerminalQr();
}
