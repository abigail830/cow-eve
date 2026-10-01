export type WorkspaceFile = {
  id: string;
  userId: string;
  folderId: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
  storageKey: string;
  contentHash: string | null;
  parseStatus: string;
  parsePipelineId: string | null;
  parseJobId: string | null;
  parseErrorCode: string | null;
  parseErrorMessage: string | null;
  parseStageSnapshot: Record<string, unknown> | null;
  parsedArtifactManifest: Record<string, unknown> | null;
  gist: string | null;
  gistContentSha256: string | null;
  gistGeneratedAt: Date | null;
  createdAt: Date;
};

export type WorkspaceFolder = {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};
