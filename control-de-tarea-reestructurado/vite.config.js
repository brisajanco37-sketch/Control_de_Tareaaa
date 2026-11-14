import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  publicDir: "public",
  build: {
    rollupOptions: {
      input: {
        index: resolve(projectRoot, "index.html"),
        crear: resolve(projectRoot, "crear.html"),
        editar: resolve(projectRoot, "editar.html")
      }
    }
  }
});
