import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Netlify (Linux) : évite lightningcss et ses binaires optionnels absents du lock Windows
    cssMinify: "esbuild",
  },
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
  },
});
