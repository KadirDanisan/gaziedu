import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["xlsx-js-style"],
  },
  server: {
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
});
