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
    displayName: "HaoYu FDE",
    description: "Unified entry for light tasks, knowledge Q&A, and content generation",
    avatar: "/agents/haoyu-grey.png",
    eveAgent: "omni",
    defaultDevUrl: "http://127.0.0.1:2000",
  },
  {
    id: "research",
    category: "domain",
    displayName: "Ann Researcher",
    description: "Multi-source research plans and published reports for any topic, including client and sales enablement",
    avatar: "/agents/avatar11.png",
    eveAgent: "research",
    defaultDevUrl: "http://127.0.0.1:2002",
  },
  {
    id: "nova-auditor",
    category: "domain",
    displayName: "Nova Auditor",
    description: "Pair with certification auditors on evidence-backed audit summaries, executive summaries, and findings",
    avatar: "/agents/lrqa-assist.png",
    eveAgent: "nova-auditor",
    defaultDevUrl: "http://127.0.0.1:2003",
  },
  {
    id: "x-proposal",
    category: "domain",
    displayName: "X Proposal",
    description:
      "Catalog-backed proposals via blueprints (SG SME ABS & Rikvin): matching, quotation, and Compose IR",
    avatar: "/agents/avatar7.png",
    eveAgent: "x-proposal",
    defaultDevUrl: "http://127.0.0.1:2004",
  },
];

export function listAgents(): readonly AgentRegistryEntry[] {
  return AGENT_REGISTRY;
}

export function getAgent(id: string): AgentRegistryEntry | undefined {
  return AGENT_REGISTRY.find((a) => a.id === id);
}
