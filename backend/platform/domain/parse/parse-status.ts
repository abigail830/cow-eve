export const ParseStatus = {
  PENDING: "pending",
  RUNNING: "running",
  READY: "ready",
  FAILED: "failed",
  SKIPPED: "skipped",
} as const;

export type ParseStatusValue = (typeof ParseStatus)[keyof typeof ParseStatus];

export const PARSE_READY_STATUSES = new Set<string>([
  ParseStatus.READY,
  ParseStatus.SKIPPED,
]);
