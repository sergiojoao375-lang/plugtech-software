import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from "path";

// Build estático autónomo para empacotamento desktop (Electron).
// Carrega apenas a CalcStudio (app 100% cliente, sem SSR).
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  root: resolve(__dirname, "electron/renderer"),
  build: {
    outDir: resolve(__dirname, "dist-electron"),
    emptyOutDir: true,
  },
});
