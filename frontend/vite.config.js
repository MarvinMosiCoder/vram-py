import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tailwind v4 needs no postcss.config.js and no tailwind.config.js -- the
// plugin handles both, and the design tokens live in src/index.css under
// @theme. See docs/ARCHITECTURE.md, "Styling".
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
