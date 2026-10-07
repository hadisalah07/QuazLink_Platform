import { PosDatabase } from '../database/connection.js';

export interface AppSettingMap {
  [key: string]: string;
}

export class SettingsService {
  private db: PosDatabase;

  private defaultSettings: Record<string, string> = {
    enable_shifts: 'false', // Default is false (optional) as requested!
    enable_serials: 'true',
    enable_ai_ad: 'true',
    enable_whatsapp: 'true',
    enable_credit_ledgers: 'true',
    store_name: 'كويزلينك ستور للإلكترونيات والكمبيوتر',
    store_phone: '01000000000',
    store_address: 'القاهرة، مصر',
    receipt_footer: 'البضاعة المباعة ترد وتستبدل خلال 14 يوماً وفقاً لقانون حماية المستهلك',
    printer_width: '80mm',
    vat_enabled: 'true',
    vat_percentage: '14',
    cloud_sync_enabled: 'true',
    cloud_sync_interval_mins: '15',
    cloud_api_endpoint: 'https://api.quazlink.com/v1/pos',
    cloud_auto_backup: 'true',
  };

  constructor(db: PosDatabase) {
    this.db = db;
    this.initDefaultSettings();
  }

  private initDefaultSettings(): void {
    const existing = this.getAllSettings();
    for (const [key, val] of Object.entries(this.defaultSettings)) {
      if (existing[key] === undefined) {
        this.setSetting(key, val);
      }
    }
  }

  public getAllSettings(): Record<string, string> {
    const rows = this.db.queryAll<{ setting_key: string; setting_value: string }>(
      'SELECT setting_key, setting_value FROM app_settings'
    );
    const map: Record<string, string> = {};
    for (const r of rows) {
      map[r.setting_key] = r.setting_value;
    }
    return map;
  }

  public getSetting(key: string, defaultValue = ''): string {
    const row = this.db.queryOne<{ setting_value: string }>(
      'SELECT setting_value FROM app_settings WHERE setting_key = ?',
      [key]
    );
    return row ? row.setting_value : (this.defaultSettings[key] ?? defaultValue);
  }

  public setSetting(key: string, value: string): void {
    this.db.run(
      `INSERT INTO app_settings (setting_key, setting_value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = datetime('now')`,
      [key, String(value)]
    );
  }

  public updateMultipleSettings(settings: Record<string, any>): Record<string, string> {
    this.db.transaction(() => {
      for (const [k, v] of Object.entries(settings)) {
        this.setSetting(k, String(v));
      }
    });
    return this.getAllSettings();
  }
}
