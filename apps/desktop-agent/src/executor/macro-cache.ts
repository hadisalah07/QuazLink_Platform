import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface MacroAction {
  action: 'click' | 'type' | 'upload' | 'done' | 'fail' | 'navigate';
  selector?: string;
  value?: string;
  url?: string;
}

export interface MacroRecording {
  platform: string;
  version: number;
  recordedAt: number;
  steps: MacroAction[];
}

export class MacroCache {
  private macrosDir: string;

  constructor() {
    const baseDir = path.join(os.homedir(), '.quazlink');
    this.macrosDir = path.join(baseDir, 'macros');
    
    if (!fs.existsSync(this.macrosDir)) {
      fs.mkdirSync(this.macrosDir, { recursive: true });
    }
  }

  private getMacroPath(platform: string): string {
    return path.join(this.macrosDir, `${platform}_publish.json`);
  }

  public getMacro(platform: string): MacroRecording | null {
    const macroPath = this.getMacroPath(platform);
    if (!fs.existsSync(macroPath)) {
      return null;
    }
    
    try {
      const data = fs.readFileSync(macroPath, 'utf8');
      return JSON.parse(data) as MacroRecording;
    } catch (e) {
      console.error(`❌ Failed to read macro for ${platform}:`, e);
      return null;
    }
  }

  public saveMacro(platform: string, steps: MacroAction[]): void {
    const macroPath = this.getMacroPath(platform);
    
    // Check existing to increment version
    let version = 1;
    const existing = this.getMacro(platform);
    if (existing) {
      version = (existing.version || 0) + 1;
    }

    const recording: MacroRecording = {
      platform,
      version,
      recordedAt: Date.now(),
      steps,
    };

    try {
      fs.writeFileSync(macroPath, JSON.stringify(recording, null, 2), 'utf8');
      console.log(`✅ Saved Macro for ${platform} (v${version}) with ${steps.length} steps.`);
    } catch (e) {
      console.error(`❌ Failed to save macro for ${platform}:`, e);
    }
  }

  public deleteMacro(platform: string): void {
    const macroPath = this.getMacroPath(platform);
    if (fs.existsSync(macroPath)) {
      try {
        fs.unlinkSync(macroPath);
        console.log(`🗑️ Deleted cached macro for ${platform}`);
      } catch (e) {}
    }
  }
}
