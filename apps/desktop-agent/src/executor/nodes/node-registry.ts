import { IPlatformNode } from './base-node';
import { FacebookNode } from './facebook-node';
import { InstagramNode } from './instagram-node';
import { WhatsAppNode } from './whatsapp-node';
import { MacroCache } from '../macro-cache';

export class PlatformNodeRegistry {
  private nodes: Map<string, IPlatformNode> = new Map();

  constructor(macroCache: MacroCache) {
    this.registerNode(new FacebookNode(macroCache));
    this.registerNode(new InstagramNode(macroCache));
    this.registerNode(new WhatsAppNode(macroCache));
  }

  public registerNode(node: IPlatformNode): void {
    this.nodes.set(node.platform.toLowerCase(), node);
  }

  public getNode(platform: string): IPlatformNode {
    const key = (platform || '').toLowerCase().trim();
    const node = this.nodes.get(key);
    if (!node) {
      throw new Error(
        `[PlatformNodeRegistry] Platform '${platform}' is not supported or has no isolated node. Available: ${Array.from(
          this.nodes.keys()
        ).join(', ')}`
      );
    }
    return node;
  }

  public hasNode(platform: string): boolean {
    return this.nodes.has((platform || '').toLowerCase().trim());
  }

  public getSupportedPlatforms(): string[] {
    return Array.from(this.nodes.keys());
  }
}
