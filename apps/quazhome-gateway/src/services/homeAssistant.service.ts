import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env.js';
import { HaEntityState } from '../types/ha.types.js';

class HomeAssistantService {
  private client: AxiosInstance;
  private stateCache: Map<string, HaEntityState> = new Map();
  private lastFetchTime: number = 0;
  private readonly CACHE_TTL_MS = 3000; // 3 seconds cache

  constructor() {
    this.client = axios.create({
      baseURL: env.HA_BASE_URL.replace(/\/$/, ''),
      timeout: 3000,
      headers: {
        'Authorization': `Bearer ${env.HA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Fetch all states from Home Assistant (with brief caching)
   */
  async getAllStates(forceRefresh = false): Promise<Map<string, HaEntityState>> {
    const now = Date.now();
    if (!forceRefresh && this.stateCache.size > 0 && (now - this.lastFetchTime < this.CACHE_TTL_MS)) {
      return this.stateCache;
    }

    try {
      const response = await this.client.get<HaEntityState[]>('/api/states');
      const newCache = new Map<string, HaEntityState>();
      for (const entity of response.data) {
        newCache.set(entity.entity_id, entity);
      }
      this.stateCache = newCache;
      this.lastFetchTime = now;
      return this.stateCache;
    } catch (error: any) {
      console.warn(`[HA Service] Warning: Failed to fetch states from HA (${error.message}). Returning cached or mock fallback.`);
      return this.stateCache;
    }
  }

  /**
   * Get single entity state
   */
  async getEntityState(entityId: string): Promise<HaEntityState | null> {
    const states = await this.getAllStates();
    if (states.has(entityId)) {
      return states.get(entityId)!;
    }

    try {
      const response = await this.client.get<HaEntityState>(`/api/states/${encodeURIComponent(entityId)}`);
      this.stateCache.set(entityId, response.data);
      return response.data;
    } catch {
      return null;
    }
  }

  /**
   * Toggle light or switch
   */
  async toggleDevice(entityId: string): Promise<{ success: boolean; newState?: string }> {
    const domain = entityId.split('.')[0] || 'homeassistant';
    
    // Invert state optimistically in cache if available
    const existing = this.stateCache.get(entityId);
    let optimisticState = 'on';
    if (existing) {
      optimisticState = existing.state === 'on' ? 'off' : 'on';
      existing.state = optimisticState;
      this.stateCache.set(entityId, existing);
    }

    try {
      await this.client.post(`/api/services/${domain}/toggle`, {
        entity_id: entityId
      });
      return { success: true, newState: optimisticState };
    } catch (error: any) {
      console.error(`[HA Service] Error toggling ${entityId}:`, error.message);
      // Revert cache if failed
      if (existing) {
        existing.state = optimisticState === 'on' ? 'off' : 'on';
      }
      throw new Error(`Failed to toggle device ${entityId}: ${error.message}`);
    }
  }

  /**
   * Set target climate temperature
   */
  async setClimateTemperature(entityId: string, temperature: number): Promise<{ success: boolean; targetTemp: number }> {
    try {
      await this.client.post('/api/services/climate/set_temperature', {
        entity_id: entityId,
        temperature
      });

      // Update cache
      const existing = this.stateCache.get(entityId);
      if (existing) {
        existing.attributes.temperature = temperature;
        this.stateCache.set(entityId, existing);
      }

      return { success: true, targetTemp: temperature };
    } catch (error: any) {
      console.error(`[HA Service] Error setting temp for ${entityId}:`, error.message);
      throw new Error(`Failed to set temperature: ${error.message}`);
    }
  }

  /**
   * Trigger a scene
   */
  async triggerScene(sceneId: string): Promise<{ success: boolean }> {
    try {
      await this.client.post('/api/services/scene/turn_on', {
        entity_id: sceneId
      });
      return { success: true };
    } catch (error: any) {
      console.error(`[HA Service] Error triggering scene ${sceneId}:`, error.message);
      throw new Error(`Failed to trigger scene: ${error.message}`);
    }
  }

  /**
   * Test connection to Home Assistant
   */
  async ping(): Promise<{ connected: boolean; message: string }> {
    try {
      const response = await this.client.get('/api/');
      return { connected: true, message: response.data.message || 'Connected to Home Assistant API' };
    } catch (error: any) {
      return { connected: false, message: error.message };
    }
  }
}

export const haService = new HomeAssistantService();
