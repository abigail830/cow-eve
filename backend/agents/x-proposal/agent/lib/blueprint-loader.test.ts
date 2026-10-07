import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  loadBlueprint,
  loadGraph,
  listBlueprintSummaries,
} from "./blueprint-loader.js";

describe("blueprint-loader", () => {
  it("lists SG SME blueprints", () => {
    const list = listBlueprintSummaries();
    const ids = list.map((b) => b.id);
    assert.ok(ids.includes("acorp-sg-sme-abs"));
    assert.ok(ids.includes("acorp-sg-sme-rikvin"));
  });

  it("loads ABS graph with About component", () => {
    const bp = loadBlueprint("acorp-sg-sme-abs");
    const graph = loadGraph(bp.compose.graph);
    const ids = graph.sections.map((s) => s.componentId);
    assert.ok(ids.includes("about_firm_snapshot_sg_abs"));
    assert.ok(ids.includes("fee_table_dual_column"));
  });

  it("loads Rikvin graph without About", () => {
    const bp = loadBlueprint("acorp-sg-sme-rikvin");
    const graph = loadGraph(bp.compose.graph);
    const ids = graph.sections.map((s) => s.componentId);
    assert.equal(ids.includes("about_firm_snapshot_sg_abs"), false);
    assert.ok(ids.includes("acceptance_signature_sg_rikvin"));
  });
});
