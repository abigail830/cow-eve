export type ProposalBlueprint = {
  id: string;
  displayName: string;
  catalog: { businessUnit: string };
  compose: {
    graph: string;
    sosMode: string;
    quotationLayout: string;
  };
  output: { defaultFormat: string; supported: string[] };
  defaults: { tier: string; extensions: string[] };
  clientSchemaOverlay?: string;
  letterEntity?: string;
  kbTags?: string[];
};

export type BlueprintIndex = {
  blueprints: Array<{ id: string; displayName: string }>;
};

export type SectionGraph = {
  id: string;
  displayName?: string;
  sections: Array<{
    componentId: string;
    enabledIf?: string;
  }>;
};

export type ComponentRegistry = {
  components: Array<{
    id: string;
    kind: string;
    displayName: string;
    snippetRef?: string;
    description?: string;
  }>;
};

export type ComposeMeta = {
  blueprintId: string;
  businessUnit: string;
  sosMode: string;
  quotationLayout: string;
  tier: string;
  outputFormat: string;
  enabledExtensions: string[];
  graphId: string;
  initializedAt: string;
};
