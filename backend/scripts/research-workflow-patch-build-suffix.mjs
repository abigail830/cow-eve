/** Appended to eve-research Vercel buildCommand (cwd ends in agents/research). */
export const RESEARCH_WORKFLOW_PATCH_MARKER = "patch-eve-research-workflow-id.mjs";

export const RESEARCH_WORKFLOW_PATCH_BUILD_SUFFIX =
  " && cd '../..' && node scripts/patch-eve-research-workflow-id.mjs";

export function appendResearchWorkflowPatchToBuildCommand(buildCommand) {
  if (typeof buildCommand !== "string" || buildCommand.length === 0) {
    return buildCommand;
  }
  if (buildCommand.includes(RESEARCH_WORKFLOW_PATCH_MARKER)) {
    return buildCommand;
  }
  return buildCommand + RESEARCH_WORKFLOW_PATCH_BUILD_SUFFIX;
}
