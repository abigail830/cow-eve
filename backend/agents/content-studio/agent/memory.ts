import { defineMemory } from "eve/memory";
import { fileMemory } from "eve/memory/file";
import { byPrincipal } from "eve/memory/scope";

export default defineMemory({
  description:
    "Remember durable writing preferences, brand notes, and document style facts for this caller.",
  provider: fileMemory(),
  scope: byPrincipal,
});
