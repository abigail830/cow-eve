import type { ModelCatalog } from "./model-settings.entity";

export interface ModelSettingsRepository {
  load(): Promise<ModelCatalog>;
  save(catalog: ModelCatalog): Promise<ModelCatalog>;
}
