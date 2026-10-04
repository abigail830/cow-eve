import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { findBackendRoot } from "./backend-root.js";

describe("findBackendRoot", () => {
  it("resolves backend/ when cwd is backend/ (npm test)", () => {
    const root = findBackendRoot();
    const pkg = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as { name?: string };
    assert.equal(pkg.name, "cow-eve-backend");
    assert.ok(
      existsSync(
        join(root, "agents", "omni", "agent", "connections", "notion.ts"),
      ),
    );
  });
});
