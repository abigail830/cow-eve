import { redisMemory } from "@upstash/agentkit-eve/memory";
import { defineMemory } from "eve/memory";
import { byPrincipal } from "eve/memory/scope";

export default defineMemory({
  description:
    "Remember durable preferences and facts about the authenticated caller across sessions.",
  provider: redisMemory({
    topK: 5,
    prefix: "agentkit:memorySlot:omni",
    indexName: "agentkit_memorySlot",
  }),
  scope: byPrincipal,
});
