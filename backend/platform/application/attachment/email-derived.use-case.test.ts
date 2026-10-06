import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveEmailDerivedMaterializationTarget } from "./email-derived.use-case.js";
import type { WorkspaceFile } from "../../domain/workspace/workspace-file.entity.js";

const workspaceParent = {
  id: "parent-id",
  userId: "user-1",
  folderId: "folder-1",
  filename: "mail.eml",
  mediaType: "message/rfc822",
  sizeBytes: 1,
  storageKey: "k",
  contentHash: null,
  parseStatus: "ready",
  parsePipelineId: "email_standard",
  parseJobId: null,
  parseErrorCode: null,
  parseErrorMessage: null,
  parseStageSnapshot: null,
  parsedArtifactManifest: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies WorkspaceFile;

describe("resolveEmailDerivedMaterializationTarget", () => {
  it("uses workspace when parent exists even if run source_kind is chat_attachment", () => {
    assert.equal(
      resolveEmailDerivedMaterializationTarget({
        runSourceKind: "chat_attachment",
        parentWorkspaceFile: workspaceParent,
      }),
      "workspace",
    );
  });

  it("uses chat when parent is not a workspace file", () => {
    assert.equal(
      resolveEmailDerivedMaterializationTarget({
        runSourceKind: "chat_attachment",
        parentWorkspaceFile: null,
      }),
      "chat",
    );
  });

  it("throws when run is workspace_file but parent row is missing", () => {
    assert.throws(
      () =>
        resolveEmailDerivedMaterializationTarget({
          runSourceKind: "workspace_file",
          parentWorkspaceFile: null,
        }),
      /Parent workspace file not found/,
    );
  });
});
