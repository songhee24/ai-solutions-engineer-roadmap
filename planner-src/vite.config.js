import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
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
  /* Под vitest svelte по умолчанию резолвится в СЕРВЕРНУЮ сборку, и mount()
     падает с lifecycle_function_unavailable. Условие browser возвращает ту же
     сборку, что уходит в браузер. На прод-сборку это не влияет: переменная
     VITEST выставляется только тестовым прогоном. */
  resolve: process.env.VITEST ? { conditions: ["browser"] } : {},
  // shared/schedule.mjs лежит выше корня проекта — общее ядро на два приложения.
  server: { fs: { allow: [repoRoot] } },
  build: {
    outDir: fileURLToPath(new URL("../planner", import.meta.url)),
    emptyOutDir: true,
    target: "es2022"
  },
  /* Окружение по умолчанию — node, а не jsdom: map-ui.test.mjs конструирует
     свой JSDOM сам, и глобальная подмена окружения ему мешает. Тестам экранов
     jsdom включается построчной директивой в шапке файла. */
  test: {
    environment: "node",
    include: ["test/**/*.test.mjs", "test-ui/**/*.test.js"]
  }
});
