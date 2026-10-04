/**
 * Register a Notion MCP OAuth client (DCR) and print backend/.env lines.
 *
 * Usage:
 *   npx tsx scripts/register-notion-mcp-oauth.ts
 *   NOTION_MCP_REDIRECT_URI=http://127.0.0.1:2000/api/integrations/notion/callback npx tsx scripts/register-notion-mcp-oauth.ts
 */
const redirectUri =
  process.env.NOTION_MCP_REDIRECT_URI?.trim() ||
  "http://127.0.0.1:2000/api/integrations/notion/callback";

const body = {
  client_name: "cow-eve",
  redirect_uris: [redirectUri],
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  token_endpoint_auth_method: "client_secret_post",
};

const response = await fetch("https://mcp.notion.com/register", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify(body),
});

const text = await response.text();
if (!response.ok) {
  console.error(`Registration failed (${response.status}):\n${text}`);
  process.exit(1);
}

const data = JSON.parse(text) as {
  client_id?: string;
  client_secret?: string;
  redirect_uris?: string[];
};

if (!data.client_id || !data.client_secret) {
  console.error("Unexpected response:", text);
  process.exit(1);
}

console.log("Notion MCP OAuth client registered.\n");
console.log("Add or replace in backend/.env (then save file and restart omni):\n");
console.log(`NOTION_MCP_CLIENT_ID=${data.client_id}`);
console.log(`NOTION_MCP_CLIENT_SECRET=${data.client_secret}`);
console.log(`NOTION_MCP_REDIRECT_URI=${redirectUri}`);
console.log("\nRegistered redirect_uris:", data.redirect_uris?.join(", ") ?? redirectUri);
