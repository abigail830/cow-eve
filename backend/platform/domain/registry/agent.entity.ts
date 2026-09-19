export type AgentCategory = "omni" | "domain";

export type AgentRegistryEntry = {
  id: string;
  category: AgentCategory;
  displayName: string;
  description: string;
  /** Path under frontend public/, e.g. /agents/content-studio.png */
  avatar: string;
  /** Eve workspace member name; maps to /eve/<id>/v1 when composed */
  eveAgent: string;
  /** Local default base URL when running eve dev --agent <id> */
  defaultDevUrl: string;
};

/**
 * Sidebar catalog. Only agents with a matching agents/<id>/ directory are runnable;
 * others can be added later without UI rewrites.
 */
export const AGENT_REGISTRY: readonly AgentRegistryEntry[] = [
  {
    id: "omni",
    category: "omni",
    displayName: "HaoYu",
    description: "Unified entry for light tasks and specialist routing",
    avatar: "/agents/haoyu.png",
    eveAgent: "omni",
    defaultDevUrl: "http://127.0.0.1:2000",
  },
  {
    id: "content-studio",
    category: "domain",
    displayName: "Content Studio",
    description: "Documents, decks, and structured content generation",
    avatar: "/agents/content-studio.png",
    eveAgent: "content-studio",
    defaultDevUrl: "http://127.0.0.1:2001",
  },
];

export function listAgents(): readonly AgentRegistryEntry[] {
  return AGENT_REGISTRY;
}

export function getAgent(id: string): AgentRegistryEntry | undefined {
  return AGENT_REGISTRY.find((a) => a.id === id);
}
