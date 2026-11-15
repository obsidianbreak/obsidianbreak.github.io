import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// obsidianbreak.github.io is a GitHub user site, so it is served from the
// domain root. Override with VITE_BASE_PATH only if you move it to a subpath.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? "/",
});
