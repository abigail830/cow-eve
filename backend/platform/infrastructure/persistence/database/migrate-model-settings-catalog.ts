import { neon } from "@neondatabase/serverless";
import {
  modelCatalogToStoredPayload,
  modelSettingsPayloadNeedsMigration,
  normalizeModelCatalog,
} from "../../../domain/settings/model-settings.entity.js";

const MODEL_SETTINGS_ID = "model";

export async function migrateModelSettingsCatalog(databaseUrl: string): Promise<void> {
  const sql = neon(databaseUrl);
  const rows = await sql`
    SELECT payload
    FROM platform_settings
    WHERE id = ${MODEL_SETTINGS_ID}
    LIMIT 1
  `;

  if (rows.length === 0) {
    console.log("[db:migrate] model settings: no row (defaults apply on first save)");
    return;
  }

  const payload = rows[0]?.payload;
  if (!modelSettingsPayloadNeedsMigration(payload)) {
    console.log("[db:migrate] model settings: already catalog shape");
    return;
  }

  const catalog = normalizeModelCatalog(payload);
  const toWrite = {
    ...modelCatalogToStoredPayload({
      ...catalog,
      updatedAt: new Date().toISOString(),
    }),
  };

  await sql`
    UPDATE platform_settings
    SET
      payload = ${JSON.stringify(toWrite)}::jsonb,
      updated_at = now()
    WHERE id = ${MODEL_SETTINGS_ID}
  `;

  console.log(
    `[db:migrate] model settings: migrated to catalog (${toWrite.models.length} model(s), default=${toWrite.defaultId})`,
  );
}
