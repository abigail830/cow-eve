import knowledge from "@fde/knowledge";

const hybridSearchUrl = process.env.HYBRID_SEARCH_MCP_URL?.trim();
const hybridSearchApiKey = process.env.HYBRID_SEARCH_API_KEY?.trim();

export default knowledge(
  hybridSearchUrl && hybridSearchApiKey
    ? { hybridSearchUrl, hybridSearchApiKey }
    : {},
);
