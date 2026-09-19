import { redisMemory } from "@upstash/agentkit-eve/memory";
import { defineMemory } from "eve/memory";
import { byPrincipal } from "eve/memory/scope";

export default defineMemory({
  description:
    "Remember durable writing preferences, brand voice, and facts about the authenticated caller across sessions.",
  provider: redisMemory({ topK: 5 }),
  scope: byPrincipal,
});
