import type { ModelSettings } from "./model-settings.entity";

export interface ModelSettingsRepository {
  load(): Promise<ModelSettings>;
  save(settings: ModelSettings): Promise<ModelSettings>;
}
