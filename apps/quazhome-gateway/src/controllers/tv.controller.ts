import { FastifyReply, FastifyRequest } from 'fastify';
import { haService } from '../services/homeAssistant.service.js';
import { TvDeviceItem, TvGroup, TvQuickMenuResponse } from '../types/client.types.js';
import tvConfig from '../config/tv-devices.json' with { type: 'json' };

export async function getTvQuickMenuHandler(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<TvQuickMenuResponse> {
  const haStates = await haService.getAllStates();

  const groups: TvGroup[] = tvConfig.groups.map(group => {
    const entities: TvDeviceItem[] = group.entities.map(cfgEntity => {
      const haState = haStates.get(cfgEntity.entityId);
      
      const rawState = haState?.state ?? 'off';
      const isOn = rawState === 'on' || rawState === 'cool' || rawState === 'heat';
      
      // Calculate brightness percentage if light
      let brightness: number | undefined = undefined;
      if (cfgEntity.type === 'light' && haState?.attributes.brightness) {
        brightness = Math.round((haState.attributes.brightness / 255) * 100);
      }

      // Climate temperatures
      let currentTemp: number | undefined = undefined;
      let targetTemp: number | undefined = undefined;
      if (cfgEntity.type === 'climate') {
        currentTemp = haState?.attributes.current_temperature ?? 24;
        targetTemp = haState?.attributes.temperature ?? 22;
      }

      return {
        entityId: cfgEntity.entityId,
        name: cfgEntity.name,
        type: cfgEntity.type as any,
        icon: cfgEntity.icon,
        state: rawState,
        isOn,
        brightness,
        currentTemp,
        targetTemp,
        minTemp: (cfgEntity as any).minTemp,
        maxTemp: (cfgEntity as any).maxTemp,
        accentColor: (cfgEntity as any).accentColor
      };
    });

    return {
      id: group.id,
      name: group.name,
      icon: group.icon,
      entities
    };
  });

  return {
    success: true,
    timestamp: Date.now(),
    title: tvConfig.title,
    theme: tvConfig.theme,
    groups
  };
}
