/** Artifact build config: ONE fully self-contained HTML (no code splitting,
 *  fonts and JS inlined) for design-taste-mcp critique_render. critique_render
 *  uses page.setContent(), which cannot resolve relative asset URLs, so the
 *  real multi-file production build is unsuitable for it. This build removes
 *  lazy chunks by disabling codeSplitting and inlines everything. */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: { alias: { "@": "/src" } },
  build: {
    outDir: "dist-artifact",
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 100_000,
    rollupOptions: { output: { codeSplitting: false } },
  },
});
