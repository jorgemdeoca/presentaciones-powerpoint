import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
  plugins: [
    tanstackStart({
      server: {
        entry: "src/server.ts",
        // Usa el preset de Vercel en producción; en desarrollo Node estándar
        preset: mode === "production" ? "vercel" : "node",
      },
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
}));
