/* ============================================================================
 * roadmap.js — доступ к контенту карты.
 *
 * roadmap-data.js — классический скрипт: он присваивает window.ROADMAP и ничего
 * не экспортирует. Поэтому подключаем его тегом во время работы, а не импортом
 * на сборке. Так 287 КБ контента остаются одним файлом на два приложения, а в
 * бандл планнера не попадает его копия.
 * ========================================================================== */

export function loadRoadmap() {
  if (window.ROADMAP) return Promise.resolve(window.ROADMAP);

  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    // Планнер лежит в /planner/, контент — на уровень выше, в корне сайта.
    el.src = new URL("../roadmap-data.js", document.baseURI).href;
    el.onload = () =>
      window.ROADMAP
        ? resolve(window.ROADMAP)
        : reject(new Error("roadmap-data.js загрузился, но window.ROADMAP пуст"));
    el.onerror = () => reject(new Error("не удалось загрузить roadmap-data.js"));
    document.head.appendChild(el);
  });
}
