import { defineRemoteAgent } from "eve";

/**
 * Peer specialist in the same workspace. Locally run content-studio on :2001
 * (`npm run dev:content-studio`). Override with CONTENT_STUDIO_URL in deploy.
 */
export default defineRemoteAgent({
  url: () => process.env.CONTENT_STUDIO_URL ?? "http://127.0.0.1:2001",
  description:
    "Content Studio specialist for documents, one-page PPT outlines, brand-aligned writing, and structured content drafts.",
  forwardPrincipal: true,
});
