import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@fde/artifact-spec": path.resolve(__dirname, "../packages/artifact-spec/src/index.ts"),
      "@fde/artifact-ui": path.resolve(__dirname, "../packages/artifact-ui/src/index.ts"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5273,
    strictPort: true,
  },
});
