import { redisDocuments } from "@upstash/agentkit-eve/memory";
import { defineMemory } from "eve/memory";
import { byPrincipal } from "eve/memory/scope";
import { fileMemory } from "eve/memory/file";

/** Cross-agent user preferences (global), scoped per authenticated principal. */
export default defineMemory({
  description:
    "Global user preferences and durable settings that apply across all FDE Desk agents.",
  provider: fileMemory({
    backend: redisDocuments({ prefix: "agentkit:memoryFile:preferences" }),
  }),
  scope: byPrincipal,
});
