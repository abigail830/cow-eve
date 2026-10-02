import type { RouteDefinition } from "eve/channels";
import {
  createPlatformRouteContext,
  type PlatformRouteContext,
} from "./platform-route-context.js";
import { registerAgentsRoutes } from "./routes/register-agents-routes.js";
import { registerArtifactRoutes } from "./routes/register-artifact-routes.js";
import { registerAttachmentRoutes } from "./routes/register-attachment-routes.js";
import { registerAuthRoutes } from "./routes/register-auth-routes.js";
import { registerIntegrationRoutes } from "./routes/register-integration-routes.js";
import { registerChatRoutes } from "./routes/register-chat-routes.js";
import { registerHealthRoutes } from "./routes/register-health-routes.js";
import { registerMemoryRoutes } from "./routes/register-memory-routes.js";
import { registerParseInternalRoutes } from "./routes/register-parse-internal-routes.js";
import { registerProjectRoutes } from "./routes/register-project-routes.js";
import { registerScheduleRoutes } from "./routes/register-schedule-routes.js";
import { registerSettingsRoutes } from "./routes/register-settings-routes.js";
import { registerWorkspaceRoutes } from "./routes/register-workspace-routes.js";

export {
  createPlatformRouteContext,
  type PlatformRouteContext,
  type PlatformSessionAuth,
} from "./platform-route-context.js";

/** All Platform REST routes for Eve channels (single registration entry). */
export function registerPublicApiRoutes(
  ctx: PlatformRouteContext = createPlatformRouteContext(),
): RouteDefinition[] {
  return [
    ...registerAuthRoutes(ctx),
    ...registerHealthRoutes(ctx),
    ...registerAgentsRoutes(ctx),
    ...registerSettingsRoutes(ctx),
    ...registerIntegrationRoutes(ctx),
    ...registerMemoryRoutes(ctx),
    ...registerChatRoutes(ctx),
    ...registerScheduleRoutes(ctx),
    ...registerProjectRoutes(ctx),
    ...registerAttachmentRoutes(ctx),
    ...registerArtifactRoutes(ctx),
    ...registerWorkspaceRoutes(ctx),
    ...registerParseInternalRoutes(ctx),
  ];
}
