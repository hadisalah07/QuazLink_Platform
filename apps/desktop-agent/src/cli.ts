import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { RunnerWSClient } from './client/ws-client';

const CONFIG_DIR = path.join(os.homedir(), '.quazlink');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface LocalConfig {
  serverUrl: string;
  deviceToken?: string;
  pairingToken?: string;
  keepAwake?: boolean;
}

function loadConfig(): LocalConfig {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch {}
  }
  return {
    serverUrl: process.env.CLOUD_GATEWAY_URL || 'wss://api.quazlink.site',
    keepAwake: true,
  };
}

function saveConfig(cfg: LocalConfig) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

async function main() {
  console.clear();
  console.log('\x1b[36m%s\x1b[0m', '=====================================================');
  console.log('\x1b[36m%s\x1b[0m', '   🚀 QuazLink Local Desktop Automation Runner       ');
  console.log('\x1b[36m%s\x1b[0m', '   Zero-Ban • Zero-Proxy • Military-Grade Secure Node');
  console.log('\x1b[36m%s\x1b[0m', '=====================================================\n');

  let config = loadConfig();
  const cliPairingArg = process.argv[2];

  if (cliPairingArg && cliPairingArg.startsWith('QL-')) {
    config.pairingToken = cliPairingArg.trim();
    saveConfig(config);
    console.log(`🔑 Using pairing code from argument: \x1b[32m${config.pairingToken}\x1b[0m\n`);
  }

  if (!config.deviceToken && !config.pairingToken) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const pairingCode = await new Promise<string>((resolve) => {
      rl.question('🔑 Enter Pairing Code from QuazLink Settings (e.g. QL-ABC123): ', (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    });

    if (pairingCode) {
      config.pairingToken = pairingCode;
      saveConfig(config);
    }
  }

  console.log(`🌐 Gateway: \x1b[34m${config.serverUrl}\x1b[0m`);
  console.log(`💻 Local Machine: \x1b[35m${os.hostname()} (${os.platform()} ${os.arch()})\x1b[0m`);
  console.log(`🛡️ Encryption: \x1b[32mZero-Trust HMAC-SHA256 Signed Channel\x1b[0m\n`);

  const client = new RunnerWSClient(config.serverUrl, {
    token: config.deviceToken,
    pairingToken: config.pairingToken,
    onStatusChange: (status, info) => {
      if (status === 'online') {
        console.log('\x1b[32m%s\x1b[0m', '🟢 [STATUS] Machine is ONLINE & READY to receive jobs!');
        if (info?.deviceToken) {
          config.deviceToken = info.deviceToken;
          config.pairingToken = undefined;
          saveConfig(config);
          console.log('\x1b[32m%s\x1b[0m', `✅ [PAIRING] Device permanently paired to your account!`);
        }
      } else {
        console.log('\x1b[31m%s\x1b[0m', '🔴 [STATUS] Machine is Offline. Reconnecting...');
      }
    },
  });

  client.connect();

  console.log('\x1b[90m%s\x1b[0m', 'Listening for incoming automation tasks from Cloud... Press Ctrl+C to stop.\n');
}

main().catch((err) => {
  console.error('Fatal Runner Error:', err);
});
