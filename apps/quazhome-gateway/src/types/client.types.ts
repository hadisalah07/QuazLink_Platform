export type DeviceType = 'light' | 'climate' | 'scene' | 'switch' | 'media_player';

export interface TvDeviceItem {
  entityId: string;
  name: string;
  type: DeviceType;
  icon: string;
  state: string;           // 'on' | 'off' | 'cool' | 'idle' | 'unavailable'
  isOn: boolean;
  brightness?: number;     // 0 - 100
  currentTemp?: number;
  targetTemp?: number;
  minTemp?: number;
  maxTemp?: number;
  accentColor?: string;
}

export interface TvGroup {
  id: string;
  name: string;
  icon: string;
  entities: TvDeviceItem[];
}

export interface TvQuickMenuResponse {
  success: boolean;
  timestamp: number;
  title: string;
  theme: {
    accentColor: string;
    secondaryColor: string;
    backgroundColor: string;
  };
  groups: TvGroup[];
}

export interface DeviceToggleRequest {
  entityId: string;
}

export interface ClimateSetTempRequest {
  entityId: string;
  temperature: number;
}

export interface SceneTriggerRequest {
  sceneId: string;
}
