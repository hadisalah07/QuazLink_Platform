import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { encrypt, decrypt } from '../lib/crypto';

const router = Router();

export const TV_LATEST_VERSION = '1.1.5';
export const TV_MIN_REQUIRED_VERSION = '1.0.0';
export const TV_RELEASE_DATE = '2026-11-18';
export const TV_RELEASE_NOTES = `• إعادة تصميم الواجهة بالكامل لتطابق منصة QuazLink (Platform Dark Glassmorphism).
• كروت الأجهزة بنمط الأوبسيديان الداكن مع أيقونات ومؤشرات تحكم أنيقة.
• أزرار زمردية مضيئة (Emerald Action Buttons) فائقة التباين والوضوح على شاشات العرض والبروجيكتور.`;

// Storage paths for persistent TV device configs
const STORAGE_DIR = process.env.DATA_DIR || path.join(__dirname, '../../../data');
const CONFIG_FILE = path.join(STORAGE_DIR, 'tv_devices.json');

interface TvDeviceConfig {
  deviceToken: string;
  name: string;
  haUrl: string;
  encryptedHaToken: string;
  pairedAt: string;
  lastSeenAt: string;
  ipAddress?: string;
  appVersion?: string;
  selectedEntities?: string[]; // IDs of entities selected to display on TV
}

interface PairingSession {
  code: string;
  secret: string;
  expiresAt: number;
  status: 'pending' | 'paired' | 'expired';
  deviceToken?: string;
  haUrl?: string;
}

const activeSessions = new Map<string, PairingSession>();

// Ensure storage directory and file exist
function getSavedDevices(): Record<string, TvDeviceConfig> {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('[TV] Error reading tv_devices.json:', err);
  }
  return {};
}

function saveDevice(config: TvDeviceConfig) {
  try {
    const devices = getSavedDevices();
    devices[config.deviceToken] = config;
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(devices, null, 2), 'utf-8');
  } catch (err) {
    console.error('[TV] Error saving tv device config:', err);
  }
}

function findDeviceByToken(token?: string): TvDeviceConfig | null {
  if (!token) return null;
  const devices = getSavedDevices();
  return devices[token] || null;
}

/**
 * 1. POST /api/tv/pair/init
 * TV requests a new pairing session. Returns pairing code + QR URL.
 */
router.post('/pair/init', (req, res) => {
  try {
    // Generate 6-char clean alphanumeric code, e.g. QL-4821
    const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
    const code = `QL-${randomHex}`;
    const secret = crypto.randomBytes(16).toString('hex');
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

    const session: PairingSession = {
      code,
      secret,
      expiresAt,
      status: 'pending',
    };

    activeSessions.set(code, session);

    // Clean up expired sessions
    for (const [key, sess] of activeSessions.entries()) {
      if (sess.expiresAt < Date.now()) {
        activeSessions.delete(key);
      }
    }

    const qrUrl = `https://app.quazlink.site/tv/pair?code=${code}`;

    res.json({
      success: true,
      code,
      secret,
      qrUrl,
      expiresInSeconds: 900,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 2. GET /api/tv/pair/status
 * TV polls to see if mobile has authorized this session.
 */
router.get('/pair/status', (req, res) => {
  try {
    const code = String(req.query.code || '').trim().toUpperCase();
    const secret = String(req.query.secret || '').trim();

    const session = activeSessions.get(code);
    if (!session || session.secret !== secret) {
      return res.status(404).json({ error: 'Pairing session not found or secret mismatch' });
    }

    if (session.expiresAt < Date.now()) {
      session.status = 'expired';
      return res.json({ status: 'expired' });
    }

    if (session.status === 'paired' && session.deviceToken) {
      return res.json({
        status: 'paired',
        deviceToken: session.deviceToken,
        haUrl: session.haUrl,
      });
    }

    res.json({ status: 'pending' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 3. POST /api/tv/pair/test-ha
 * Mobile calls to test Home Assistant connectivity before saving.
 */
router.post('/pair/test-ha', async (req, res) => {
  try {
    let { haUrl, haToken } = req.body;
    if (!haUrl || !haToken) {
      return res.status(400).json({ error: 'يرجى إدخال رابط Home Assistant ورمز الوصول (Token)' });
    }

    haUrl = haUrl.trim().replace(/\/+$/, '');
    if (!haUrl.startsWith('http://') && !haUrl.startsWith('https://')) {
      haUrl = 'https://' + haUrl;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const testRes = await fetch(`${haUrl}/api/`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${haToken.trim()}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (testRes.ok) {
      const data: any = await testRes.json().catch(() => ({}));
      return res.json({
        success: true,
        message: 'تم الاتصال بسيرفر Home Assistant بنجاح! 🚀',
        haMessage: data.message || 'API running',
      });
    } else {
      return res.status(400).json({
        success: false,
        error: `رفض Home Assistant الاتصال (كود ${testRes.status}). تأكد من صحة الرمز (Long-Lived Token).`,
      });
    }
  } catch (err: any) {
    res.status(502).json({
      success: false,
      error: `تعذر الوصول إلى دومين Home Assistant (${err.message}). تأكد من إمكانية الوصول إلى الرابط عبر الإنترنت.`,
    });
  }
});

/**
 * 4. POST /api/tv/pair/authorize
 * Mobile calls this to approve TV pairing with Home Assistant credentials.
 */
router.post('/pair/authorize', async (req, res) => {
  try {
    let { code, haUrl, haToken, tvName = 'Living Room TV' } = req.body;
    code = String(code || '').trim().toUpperCase();

    const session = activeSessions.get(code);
    if (!session) {
      return res.status(404).json({ error: 'كود الاقتران غير صالح أو منتهي الصلاحية' });
    }

    if (!haUrl || !haToken) {
      return res.status(400).json({ error: 'بيانات Home Assistant مطلوبة' });
    }

    haUrl = haUrl.trim().replace(/\/+$/, '');
    if (!haUrl.startsWith('http://') && !haUrl.startsWith('https://')) {
      haUrl = 'https://' + haUrl;
    }

    // Verify Home Assistant connection
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const testRes = await fetch(`${haUrl}/api/`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${haToken.trim()}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!testRes.ok) {
      return res.status(400).json({ error: 'فشل التحقق من صحة توكن Home Assistant' });
    }

    // Generate unique deviceToken for this TV
    const deviceToken = 'tv_' + crypto.randomBytes(16).toString('hex');
    const encryptedHaToken = encrypt(haToken.trim());

    // Save TV device config
    saveDevice({
      deviceToken,
      name: tvName,
      haUrl,
      encryptedHaToken,
      pairedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      ipAddress: req.ip || '',
      selectedEntities: [], // Default to all until user customizes
    });

    // Update active session so TV picks it up on next poll
    session.status = 'paired';
    session.deviceToken = deviceToken;
    session.haUrl = haUrl;

    res.json({
      success: true,
      message: 'تم ربط التلفزيون بـ Home Assistant بنجاح! ✨',
      deviceToken,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 5. GET /api/tv/updates
 * In-App OTA Update Checker for QuazHome TV Client
 */
router.get('/updates', (req, res) => {
  try {
    const clientVersion = String(req.query.currentVersion || '1.0.0').replace(/^v/i, '').trim();
    const isNewer = compareVersions(TV_LATEST_VERSION, clientVersion) > 0;

    res.json({
      success: true,
      hasUpdate: isNewer,
      currentVersion: clientVersion,
      latestVersion: TV_LATEST_VERSION,
      minRequiredVersion: TV_MIN_REQUIRED_VERSION,
      releaseName: `QuazHome TV v${TV_LATEST_VERSION} (Official Edition)`,
      releaseNotes: TV_RELEASE_NOTES,
      downloadUrl: `https://app.quazlink.site/downloads/QuazHomeTV.apk?v=${TV_LATEST_VERSION}`,
      publishedAt: new Date(TV_RELEASE_DATE).toISOString(),
      mandatory: false,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 6. POST /api/tv/heartbeat
 * TV telemetry and online heartbeat
 */
router.post('/heartbeat', (req, res) => {
  try {
    const deviceToken = String(req.headers['x-device-token'] || req.body.deviceToken || '');
    const { appVersion } = req.body;

    const device = findDeviceByToken(deviceToken);
    if (device) {
      device.lastSeenAt = new Date().toISOString();
      if (appVersion) device.appVersion = appVersion;
      device.ipAddress = req.ip;
      saveDevice(device);
    }

    res.json({ success: true, timestamp: Date.now() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Helper to fetch states from Home Assistant for a TV
 */
async function getHaClient(deviceToken?: string) {
  const device = findDeviceByToken(deviceToken);
  if (!device) return null;
  const haToken = decrypt(device.encryptedHaToken);
  return {
    device,
    haUrl: device.haUrl,
    haToken,
  };
}

/**
 * 7. GET /api/tv/devices
 * List all paired TVs for management portal
 */
router.get('/devices', (req, res) => {
  try {
    const devices = getSavedDevices();
    const list = Object.values(devices).map((d) => ({
      deviceToken: d.deviceToken,
      name: d.name,
      haUrl: d.haUrl,
      pairedAt: d.pairedAt,
      lastSeenAt: d.lastSeenAt,
      ipAddress: d.ipAddress,
      appVersion: d.appVersion,
      selectedCount: (d.selectedEntities || []).length,
    }));
    res.json({ success: true, devices: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 8. GET /api/tv/devices/:token/entities
 * Fetches all Home Assistant entities for customization, with selected state
 */
router.get('/devices/:token/entities', async (req, res) => {
  try {
    const { token } = req.params;
    const ha = await getHaClient(token);
    if (!ha) {
      return res.status(404).json({ error: 'شاشة التلفزيون غير موجودة أو تم إلغاء ربطها' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const statesRes = await fetch(`${ha.haUrl}/api/states`, {
      headers: {
        Authorization: `Bearer ${ha.haToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!statesRes.ok) {
      throw new Error(`Home Assistant returned HTTP ${statesRes.status}`);
    }

    const rawStates: any[] = await statesRes.json();
    const selectedList = ha.device.selectedEntities || [];

    const entities: any[] = [];
    for (const item of rawStates) {
      const entityId: string = item.entity_id || '';
      const friendlyName = item.attributes?.friendly_name || entityId;
      const state = String(item.state || '').toLowerCase();
      const isOn = state === 'on';

      let type: string | null = null;
      let category = 'other';
      let icon = 'power';

      if (entityId.startsWith('light.')) {
        type = 'light';
        category = 'lights';
        icon = 'lamp';
      } else if (entityId.startsWith('switch.')) {
        type = 'switch';
        category = 'switches';
        icon = 'switch';
      } else if (entityId.startsWith('climate.')) {
        type = 'climate';
        category = 'climate';
        icon = 'ac';
      } else if (entityId.startsWith('scene.')) {
        type = 'scene';
        category = 'scenes';
        icon = 'film';
      }

      // Filter only actionable entities for TV
      if (type) {
        entities.push({
          entityId,
          name: friendlyName,
          type,
          category,
          icon,
          state,
          isOn,
          selected: selectedList.includes(entityId),
          attributes: item.attributes || {},
        });
      }
    }

    res.json({
      success: true,
      tvName: ha.device.name,
      haUrl: ha.haUrl,
      selectedEntities: selectedList,
      totalCount: entities.length,
      selectedCount: selectedList.length,
      entities,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 9. POST /api/tv/devices/:token/customize
 * Save selected entities to appear on TV overlay
 */
router.post('/devices/:token/customize', (req, res) => {
  try {
    const { token } = req.params;
    const { selectedEntities, name } = req.body;

    const device = findDeviceByToken(token);
    if (!device) {
      return res.status(404).json({ error: 'شاشة التلفزيون غير موجودة' });
    }

    if (Array.isArray(selectedEntities)) {
      device.selectedEntities = selectedEntities;
    }
    if (typeof name === 'string' && name.trim()) {
      device.name = name.trim();
    }

    saveDevice(device);

    res.json({
      success: true,
      message: 'تم حفظ تخصيص أزرار وأجهزة التلفزيون بنجاح! ✨',
      selectedCount: (device.selectedEntities || []).length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 10. GET /api/tv/quick-menu
 * Formats Home Assistant entities into QuazHome Quick Menu groups, honoring user customization
 */
router.get('/quick-menu', async (req, res) => {
  try {
    const deviceToken = String(req.headers['x-device-token'] || req.query.token || '');
    const ha = await getHaClient(deviceToken);

    if (!ha) {
      return res.json({
        success: true,
        timestamp: Date.now(),
        title: 'QuazHome (في انتظار الاقتران)',
        groups: [
          {
            id: 'pairing',
            name: 'الاقتران مع Home Assistant',
            icon: 'qrcode',
            entities: [
              {
                entityId: 'tv.pairing_status',
                name: 'امسح الـ QR من الموبايل لتوصيل المنزل الذكي',
                type: 'scene',
                icon: 'qrcode',
                state: 'off',
                isOn: false,
              },
            ],
          },
        ],
      });
    }

    // Fetch real states from Home Assistant OS
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const statesRes = await fetch(`${ha.haUrl}/api/states`, {
      headers: {
        Authorization: `Bearer ${ha.haToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!statesRes.ok) {
      throw new Error(`Home Assistant returned HTTP ${statesRes.status}`);
    }

    const rawStates: any[] = await statesRes.json();
    const selectedList = ha.device.selectedEntities || [];
    const hasCustomSelection = selectedList.length > 0;

    const lightsGroup: any[] = [];
    const climateGroup: any[] = [];
    const scenesGroup: any[] = [];
    const switchesGroup: any[] = [];

    for (const item of rawStates) {
      const entityId: string = item.entity_id || '';

      // If user configured custom entities, strictly filter!
      if (hasCustomSelection && !selectedList.includes(entityId)) {
        continue;
      }

      const friendlyName = item.attributes?.friendly_name || entityId;
      const state = String(item.state || '').toLowerCase();
      const isOn = state === 'on';

      if (entityId.startsWith('light.')) {
        lightsGroup.push({
          entityId,
          name: friendlyName,
          type: 'light',
          icon: 'lamp',
          state,
          isOn,
          brightness: item.attributes?.brightness || null,
        });
      } else if (entityId.startsWith('switch.')) {
        switchesGroup.push({
          entityId,
          name: friendlyName,
          type: 'switch',
          icon: 'switch',
          state,
          isOn,
        });
      } else if (entityId.startsWith('climate.')) {
        climateGroup.push({
          entityId,
          name: friendlyName,
          type: 'climate',
          icon: 'ac',
          state: item.attributes?.hvac_action || state,
          isOn: state !== 'off',
          currentTemp: item.attributes?.current_temperature || 24.0,
          targetTemp: item.attributes?.temperature || 22.0,
          minTemp: item.attributes?.min_temp || 16.0,
          maxTemp: item.attributes?.max_temp || 30.0,
        });
      } else if (entityId.startsWith('scene.')) {
        scenesGroup.push({
          entityId,
          name: friendlyName,
          type: 'scene',
          icon: 'film',
          state: 'off',
          isOn: false,
        });
      }
    }

    const groups: any[] = [];
    if (lightsGroup.length > 0) {
      groups.push({ id: 'lights', name: 'الإضاءة', icon: 'lamp', entities: lightsGroup });
    }
    if (switchesGroup.length > 0) {
      groups.push({ id: 'switches', name: 'المفاتيح والأجهزة', icon: 'switch', entities: switchesGroup });
    }
    if (climateGroup.length > 0) {
      groups.push({ id: 'climate', name: 'التكييف والمناخ', icon: 'ac', entities: climateGroup });
    }
    if (scenesGroup.length > 0) {
      groups.push({ id: 'scenes', name: 'السيناريوهات', icon: 'film', entities: scenesGroup });
    }

    res.json({
      success: true,
      timestamp: Date.now(),
      title: ha.device.name || 'QuazHome Smart TV',
      groups,
    });
  } catch (err: any) {
    console.error('[TV] Quick Menu error:', err.message);
    res.json({
      success: true,
      timestamp: Date.now(),
      title: 'QuazHome (Offline Fallback)',
      groups: [
        {
          id: 'lights',
          name: 'الإضاءة (Offline Fallback)',
          icon: 'lamp',
          entities: [
            {
              entityId: 'light.living_room',
              name: 'إضاءة الصالة',
              type: 'light',
              icon: 'lamp',
              state: 'off',
              isOn: false,
            },
          ],
        },
        {
          id: 'climate',
          name: 'التكييف',
          icon: 'ac',
          entities: [
            {
              entityId: 'climate.ac',
              name: 'تكييف الصالة',
              type: 'climate',
              icon: 'ac',
              state: 'cool',
              isOn: true,
              currentTemp: 24.0,
              targetTemp: 22.0,
              minTemp: 18.0,
              maxTemp: 30.0,
            },
          ],
        },
      ],
    });
  }
});

/**
 * 11. POST /api/tv/device/toggle
 * Toggles a light or switch in Home Assistant
 */
router.post('/device/toggle', async (req, res) => {
  try {
    const deviceToken = String(req.headers['x-device-token'] || req.query.token || req.body.token || '');
    const { entityId } = req.body;
    if (!entityId) return res.status(400).json({ error: 'entityId is required' });

    const ha = await getHaClient(deviceToken);
    if (!ha) {
      return res.json({ success: true, entityId, newState: 'toggled_demo' });
    }

    const domain = entityId.split('.')[0] || 'light';
    const haRes = await fetch(`${ha.haUrl}/api/services/${domain}/toggle`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ha.haToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ entity_id: entityId }),
    });

    res.json({
      success: haRes.ok,
      entityId,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 12. POST /api/tv/device/climate/set-temp
 * Sets AC temperature in Home Assistant
 */
router.post('/device/climate/set-temp', async (req, res) => {
  try {
    const deviceToken = String(req.headers['x-device-token'] || req.query.token || req.body.token || '');
    const { entityId, temperature } = req.body;
    if (!entityId || temperature === undefined) {
      return res.status(400).json({ error: 'entityId and temperature are required' });
    }

    const ha = await getHaClient(deviceToken);
    if (!ha) {
      return res.json({ success: true, entityId, temperature });
    }

    const haRes = await fetch(`${ha.haUrl}/api/services/climate/set_temperature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ha.haToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entity_id: entityId,
        temperature: Number(temperature),
      }),
    });

    res.json({ success: haRes.ok });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 13. POST /api/tv/device/scene/trigger
 * Triggers a scene in Home Assistant
 */
router.post('/device/scene/trigger', async (req, res) => {
  try {
    const deviceToken = String(req.headers['x-device-token'] || req.query.token || req.body.token || '');
    const { sceneId } = req.body;
    if (!sceneId) return res.status(400).json({ error: 'sceneId is required' });

    const ha = await getHaClient(deviceToken);
    if (!ha) {
      return res.json({ success: true, sceneId });
    }

    const haRes = await fetch(`${ha.haUrl}/api/services/scene/turn_on`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ha.haToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ entity_id: sceneId }),
    });

    res.json({ success: haRes.ok });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function compareVersions(v1: string, v2: string): number {
  const p1 = v1.split('.').map((n) => parseInt(n, 10) || 0);
  const p2 = v2.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const n1 = p1[i] ?? 0;
    const n2 = p2[i] ?? 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

export default router;
