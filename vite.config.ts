import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/pivot.ts",
      formats: ["es"],
      fileName: () => "pivot.mjs",
    },
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
