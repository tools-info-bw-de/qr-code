import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const gitRoot = resolve(__dirname, "../..");

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        runes: true,
      },
    }),
  ],
  server: {
    fs: {
      // Some browsers/devtools can request source files via /@fs/...
      // (we've seen a stray request into a sibling project). Allow the git root
      // to avoid noisy "outside of allow list" errors during local dev.
      allow: [__dirname, gitRoot],
    },
  },
});
