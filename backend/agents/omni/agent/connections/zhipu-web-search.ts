import { defineDynamic, defineMcpClientConnection } from "eve/connections";
import {
  getZhipuApiKey,
  getZhipuWebSearchMcpUrl,
} from "../../../../platform/infrastructure/config/mcp.config.js";

export default defineDynamic({
  events: {
    "session.started": () => {
      const connections: Record<
        string,
        ReturnType<typeof defineMcpClientConnection>
      > = {};

      const zhipuUrl = getZhipuWebSearchMcpUrl();
      const zhipuKey = getZhipuApiKey();
      if (zhipuUrl && zhipuKey) {
        connections["zhipu-web-search"] = defineMcpClientConnection({
          url: zhipuUrl,
          description:
            "Zhipu web search for timely public information when KB coverage is insufficient.",
          instanceKey: "zhipu-web-search",
          headers: {
            Authorization: zhipuKey,
          },
        });
      }

      return connections;
    },
  },
});
