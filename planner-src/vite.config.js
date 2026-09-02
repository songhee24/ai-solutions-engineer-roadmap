import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/**
 * В dev-режиме Vite отдаёт только planner-src, а контент карты лежит на уровень
 * выше и подключается тегом во время работы (см. src/lib/roadmap.js). Отдаём
 * его сами, чтобы dev и прод грузили ровно один и тот же файл, а не копию.
 */
function serveRepoRoot() {
  return {
    name: "serve-repo-root",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = /^\/(roadmap-data\.js)(\?|$)/.exec(req.url || "");
        if (!match) return next();
        res.setHeader("content-type", "text/javascript; charset=utf-8");
        fs.createReadStream(repoRoot + match[1]).pipe(res);
      });
    }
  };
}

export default defineConfig({
  // Относительный base: одинаково работает и на GitHub Pages, где сайт лежит
  // в подкаталоге проекта, и с локального сервера в корне репозитория.
  base: "./",
  plugins: [svelte(), serveRepoRoot()],
  // shared/schedule.mjs лежит выше корня проекта — общее ядро на два приложения.
  server: { fs: { allow: [repoRoot] } },
  build: {
    outDir: fileURLToPath(new URL("../planner", import.meta.url)),
    emptyOutDir: true,
    target: "es2022"
  }
});
