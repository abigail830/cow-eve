import type {
  BlueprintIndex,
  ComponentRegistry,
  ProposalBlueprint,
  SectionGraph,
} from "./blueprint-types.js";
import blueprintIndex from "../skills/proposal-blueprints/references/blueprints/index.json";
import acorpSgSmeAbs from "../skills/proposal-blueprints/references/blueprints/acorp-sg-sme-abs.json";
import acorpSgSmeRikvin from "../skills/proposal-blueprints/references/blueprints/acorp-sg-sme-rikvin.json";
import graphSgSmeAbs from "../skills/proposal-blueprints/references/graphs/sg-sme-abs.json";
import graphSgSmeRikvin from "../skills/proposal-blueprints/references/graphs/sg-sme-rikvin.json";
import componentRegistry from "../skills/proposal-blueprints/references/components/registry.json";
import taxRates from "../skills/proposal-blueprints/references/schemas/tax-rates.json";

/**
 * Eve: tools import blueprint data from a lib module (bundled at build).
 * JSON sources live in the proposal-blueprints skill tree (also compiled to
 * $HOME/.agents/skills for load_skill + read_file). Do not readFileSync at runtime.
 */

const INDEX = blueprintIndex as BlueprintIndex;

const BLUEPRINT_BY_ID: Readonly<Record<string, ProposalBlueprint>> = {
  "acorp-sg-sme-abs": acorpSgSmeAbs as ProposalBlueprint,
  "acorp-sg-sme-rikvin": acorpSgSmeRikvin as ProposalBlueprint,
};

const GRAPH_BY_ID: Readonly<Record<string, SectionGraph>> = {
  "sg-sme-abs": graphSgSmeAbs as SectionGraph,
  "sg-sme-rikvin": graphSgSmeRikvin as SectionGraph,
};

export type TaxRatesSchema = Record<
  string,
  {
    gstRatePercent: number;
    label: string;
    feesExclusiveOfTax: boolean;
  }
>;

export function getTaxRates(): TaxRatesSchema {
  return taxRates as TaxRatesSchema;
}

export function loadBlueprintIndex(): BlueprintIndex {
  return INDEX;
}

export function loadBlueprint(blueprintId: string): ProposalBlueprint {
  if (!INDEX.blueprints.some((b) => b.id === blueprintId)) {
    throw new Error(`Unknown blueprint_id: ${blueprintId}`);
  }
  const bp = BLUEPRINT_BY_ID[blueprintId];
  if (!bp) {
    throw new Error(`Unknown blueprint_id: ${blueprintId}`);
  }
  return bp;
}

export function loadGraph(graphId: string): SectionGraph {
  const graph = GRAPH_BY_ID[graphId];
  if (!graph) {
    throw new Error(`Unknown graph_id: ${graphId}`);
  }
  return graph;
}

export function loadComponentRegistry(): ComponentRegistry {
  return componentRegistry as ComponentRegistry;
}

export function listBlueprintSummaries(): BlueprintIndex["blueprints"] {
  return INDEX.blueprints;
}
