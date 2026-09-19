import { defineMemory } from "eve/memory";
import { fileMemory } from "eve/memory/file";
import { byPrincipal } from "eve/memory/scope";

export default defineMemory({
  description:
    "Remember durable preferences and facts about the authenticated caller across sessions.",
  provider: fileMemory(),
  scope: byPrincipal,
});
