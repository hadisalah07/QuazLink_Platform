export interface HaEntityAttributes {
  friendly_name?: string;
  brightness?: number;
  temperature?: number;
  current_temperature?: number;
  target_temp_high?: number;
  target_temp_low?: number;
  hvac_modes?: string[];
  hvac_action?: string;
  unit_of_measurement?: string;
  icon?: string;
  [key: string]: any;
}

export interface HaEntityState {
  entity_id: string;
  state: string;
  attributes: HaEntityAttributes;
  last_changed: string;
  last_updated: string;
}

export interface HaServiceResponse {
  context?: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}
