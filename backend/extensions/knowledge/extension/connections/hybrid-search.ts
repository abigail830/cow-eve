import { defineDynamic } from "eve/connections";

/** User-scoped hybrid-search MCP is registered from omni agent/connections/hybrid-search.ts */
export default defineDynamic({
  events: {
    "session.started": () => null,
  },
});
