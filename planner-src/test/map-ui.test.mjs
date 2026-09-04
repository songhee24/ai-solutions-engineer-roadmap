/* ============================================================================
 * Карта в jsdom: роутер, отрисовка страниц этапов и сохранение прогресса.
 *
 * Почему эти тесты лежат в planner-src, хотя проверяют корень репозитория:
 * jsdom — зависимость, а корень обязан оставаться без npm. planner-src —
 * единственное место в проекте, где сборка разрешена, и его node_modules
 * заодно обслуживают эти проверки. Сама карта при этом не знает о них ничего
 * и продолжает открываться как простые файлы.
 *
 * Проверки данных живут отдельно и без зависимостей: test/roadmap-data.test.mjs.
 * ========================================================================== */

import { test } from "vitest";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = (name) => fileURLToPath(new URL(`../../${name}`, import.meta.url));

/**
 * Поднимает карту так же, как это делает браузер: сначала документ, потом
 * roadmap-data.js, потом app.js.
 *
 * ⚠ Ждать события load обязательно. Сразу после конструктора JSDOM
 * document.readyState === "loading", и app.js уходит ждать DOMContentLoaded —
 * init() не запускается, ничего не рисуется, а тесты падают загадочно.
 */
async function openMap({ hash = "", storage = null } = {}) {
  const dom = new JSDOM(fs.readFileSync(root("index.html"), "utf8"), {
    url: `https://example.test/${hash}`,
    runScripts: "outside-only",
    pretendToBeVisual: true
  });
  const w = dom.window;
  await new Promise((res) => w.addEventListener("load", res, { once: true }));

  // jsdom не умеет прокрутку и печатает «Not implemented» на каждый вызов.
  w.scrollTo = () => {};
  if (storage) w.localStorage.setItem("asr:v1", JSON.stringify(storage));

  w.eval(fs.readFileSync(root("roadmap-data.js"), "utf8"));
  w.eval(fs.readFileSync(root("app.js"), "utf8"));
  return w;
}

const visible = (w) =>
  Array.from(w.document.querySelectorAll("main > section"))
    .filter((s) => !s.hidden)
    .map((s) => s.id);

async function goto(w, hash) {
  w.location.hash = hash;
  w.dispatchEvent(new w.Event("hashchange"));
  await new Promise((r) => setTimeout(r, 10));
}

/* -------------------------------------------------------------- запуск --- */

test("карта поднимается и показывает главную", async () => {
  const w = await openMap();
  assert.ok(w.ROADMAP, "roadmap-data.js не подключился");
  assert.equal(w.ROADMAP.stages.length, 15);

  const shown = visible(w);
  assert.ok(shown.includes("hero"), `на главной нет hero: ${shown.join(", ")}`);
  assert.equal(shown.includes("stage-page"), false, "страница этапа видна на главной");
  assert.equal(
    w.document.getElementById("stages").textContent.includes("Не удалось загрузить"),
    false,
    "init() решил, что данных нет"
  );
});

/* ------------------------------------------------------------- роутер --- */

test("каждый маршрут показывает свой раздел и ровно его", async () => {
  const w = await openMap();
  const routes = [
    ["#/", "hero"],
    ["#/roadmap", "roadmap"],
    ["#/method", "study-method"],
    ["#/reviews", "reviews"],
    ["#/tutorial-hell", "tutorial-hell"],
    ["#/jobs", "job-readiness"],
    ["#/throughline", "throughline"],
    ["#/diagnostics", "diagnostics"]
  ];
  for (const [hash, section] of routes) {
    await goto(w, hash);
    const shown = visible(w);
    assert.ok(shown.includes(section), `${hash}: не видно ${section}, видно ${shown.join(", ")}`);
    assert.ok(shown.length > 0 && shown.length <= 4, `${hash}: показано ${shown.length} разделов`);
  }
});

test("страница открывается для каждого этапа и трека", async () => {
  const w = await openMap();
  for (const stage of w.ROADMAP.stages) {
    await goto(w, `#/stage/${stage.id}`);
    const shown = visible(w);
    assert.ok(shown.includes("stage-page"), `${stage.id}: не открылась страница этапа`);

    const text = w.document.getElementById("stage-page").textContent;
    assert.ok(text.includes(stage.title), `${stage.id}: на странице нет её заголовка`);
    for (const topic of stage.topics) {
      assert.ok(text.includes(topic.title), `${stage.id}: нет темы «${topic.title}»`);
    }
  }
});

test("неизвестный маршрут не оставляет пустой экран", async () => {
  const w = await openMap();
  await goto(w, "#/такого-нет");
  assert.ok(visible(w).length > 0, "показано пусто");

  await goto(w, "#/stage/несуществующий-этап");
  assert.ok(visible(w).length > 0, "несуществующий этап оставил пустой экран");
});

test("активный пункт меню подсвечивается ровно один", async () => {
  const w = await openMap();
  for (const hash of ["#/", "#/roadmap", "#/method", "#/stage/track-math"]) {
    await goto(w, hash);
    const current = Array.from(w.document.querySelectorAll('[data-nav][aria-current="true"]'));
    assert.equal(current.length, 1, `${hash}: подсвечено ${current.length} пунктов`);
    assert.equal(current[0].getAttribute("href"), hash, `${hash}: подсвечен не тот пункт`);
  }
});

test("отдельные страницы в меню роутером не управляются", async () => {
  // Планнер и «Прикидка» — обычные страницы, а не маршруты. Если у них
  // появится data-nav, роутер начнёт их скрывать и подсвечивать как разделы.
  const w = await openMap();
  const extra = Array.from(w.document.querySelectorAll(".section-nav a.nav-extra"));
  assert.equal(extra.length, 2, `отдельных страниц ${extra.length}, ожидали 2`);
  for (const a of extra) {
    assert.equal(a.hasAttribute("data-nav"), false, `${a.textContent.trim()}: имеет data-nav`);
    assert.match(a.getAttribute("href"), /^\.\//, "ссылка не относительная");
  }
});

/* ------------------------------------------------------------ прогресс --- */

test("отметка темы сохраняется в asr:v1 и переживает перезагрузку", async () => {
  const w = await openMap({ hash: "#/stage/stage-0" });
  const topicId = w.ROADMAP.stages.find((s) => s.id === "stage-0").topics[0].id;

  const box = w.document.getElementById("cb-" + topicId);
  assert.ok(box, `нет чекбокса темы ${topicId}`);
  box.click();

  // Тема хранится объектом, а не флагом: рядом с done живут skipped, заметка
  // и время отметки.
  const saved = JSON.parse(w.localStorage.getItem("asr:v1"));
  assert.equal(saved.topics[topicId].done, true, "отметка не записалась");
  assert.ok(saved.topics[topicId].at, "не записано время отметки");

  const again = await openMap({ hash: "#/stage/stage-0", storage: saved });
  assert.equal(again.document.getElementById("cb-" + topicId).checked, true,
    "отметка не восстановилась после перезагрузки");
});

test("испорченное состояние не роняет карту", async () => {
  const dom = new JSDOM(fs.readFileSync(root("index.html"), "utf8"), {
    url: "https://example.test/", runScripts: "outside-only", pretendToBeVisual: true
  });
  const w = dom.window;
  await new Promise((res) => w.addEventListener("load", res, { once: true }));
  w.scrollTo = () => {};
  w.localStorage.setItem("asr:v1", "{это не json");
  w.eval(fs.readFileSync(root("roadmap-data.js"), "utf8"));
  w.eval(fs.readFileSync(root("app.js"), "utf8"));

  assert.ok(visible(w).includes("hero"), "карта не открылась при битом состоянии");
});

test("смена профиля меняет часы, но не трогает отметки", async () => {
  const w = await openMap({ hash: "#/stage/stage-1" });

  // Сначала отмечаем тему — переключение профиля не должно её сбросить.
  const topicId = w.ROADMAP.stages.find((st) => st.id === "stage-1").topics[0].id;
  w.document.getElementById("cb-" + topicId).click();

  const page = () => w.document.getElementById("stage-page").textContent;
  const before = page();

  const dev = w.document.querySelector('[data-profile="dev"]');
  assert.ok(dev, "нет кнопки профиля «Разработчик»");
  dev.click();
  await new Promise((r) => setTimeout(r, 10));

  assert.notEqual(page(), before, "переключение профиля ничего не изменило");
  assert.equal(dev.getAttribute("aria-pressed"), "true", "кнопка не отметилась нажатой");
  assert.equal(
    w.document.querySelector('[data-profile="novice"]').getAttribute("aria-pressed"),
    "false",
    "нажатыми остались обе кнопки"
  );

  const saved = JSON.parse(w.localStorage.getItem("asr:v1"));
  assert.equal(saved.profile, "dev", "профиль не сохранился");
  assert.equal(saved.topics[topicId].done, true, "переключение профиля сбросило отметку");
  assert.equal(w.document.getElementById("cb-" + topicId).checked, true,
    "галочка пропала с экрана после смены профиля");
});

/* ------------------------------------------------ оглавление «Как заниматься» --- */

test("оглавление страницы метода — кнопки, и каждая ведёт к существующему блоку", async () => {
  const w = await openMap({ hash: "#/method" });
  const buttons = Array.from(w.document.querySelectorAll(".method-toc-item"));
  assert.equal(buttons.length, 6, `кнопок ${buttons.length}, ожидали 6`);

  for (const b of buttons) {
    // Ссылка сломала бы роутер: currentRoute режет хеш по «/», и «#/method#tools»
    // превращается в неизвестный маршрут, уводящий на главную.
    assert.equal(b.tagName, "BUTTON", `«${b.textContent.trim()}» не кнопка`);
    assert.equal(b.hasAttribute("href"), false);
  }

  // Цели существуют. Переименуют id — тест упадёт, а не оглавление молча онемеет.
  for (const id of ["sm-rule", "sm-tools", "sm-day", "sm-areas", "sm-notebook", "sm-week"]) {
    assert.ok(w.document.getElementById(id), `нет цели #${id}`);
    assert.ok(
      w.document.getElementById(id).classList.contains("method-anchor"),
      `#${id} без класса method-anchor — уедет под липкую шапку`
    );
  }
});

test("блок «Чем писать» отрисован из данных", async () => {
  const w = await openMap({ hash: "#/method" });
  const tools = w.ROADMAP.studyMethod.tools;
  assert.equal(w.document.querySelectorAll("#sm-tools-list dt").length, tools.items.length);
  assert.equal(w.document.querySelectorAll("#sm-tools-list dd").length, tools.items.length);

  const text = w.document.getElementById("sm-tools").textContent;
  for (const item of tools.items) {
    assert.ok(text.includes(item.what), `на странице нет «${item.what}»`);
  }
});

test("блок «День 1 по шагам» отрисован из данных, по шагу на пункт", async () => {
  const w = await openMap({ hash: "#/method" });
  const day = w.ROADMAP.studyMethod.walkthrough;
  const items = Array.from(w.document.querySelectorAll("#sm-day-list li"));
  assert.equal(items.length, day.steps.length, "число шагов на странице разошлось с данными");

  const text = w.document.getElementById("sm-day").textContent;
  for (const step of day.steps) {
    assert.ok(text.includes(step.when), `на странице нет шага «${step.when}»`);
  }
  // Список нумерованный: порядок здесь — часть смысла, ul его не передаёт.
  assert.equal(w.document.getElementById("sm-day-list").tagName, "OL");
});

test("renderStudyMethod не вызывается дважды — ничего не удвоилось", async () => {
  // Он использует appendChild без очистки: второй вызов удвоил бы содержимое.
  const w = await openMap({ hash: "#/method" });
  assert.equal(w.document.querySelectorAll("#sm-areas .method-area").length, 2);
  assert.equal(w.document.querySelectorAll(".method-toc-item").length, 6);
  assert.equal(w.document.querySelectorAll("#sm-tools-list dt").length, 3);
  assert.equal(
    w.document.querySelectorAll("#sm-day-list li").length,
    w.ROADMAP.studyMethod.walkthrough.steps.length
  );
});

/* -------------------------------------------------------------- разметка --- */

test("идентификаторы в документе уникальны после хождения по маршрутам", async () => {
  const w = await openMap();
  for (const hash of ["#/roadmap", "#/stage/stage-1", "#/stage/track-math", "#/reviews", "#/"]) {
    await goto(w, hash);
  }
  const ids = Array.from(w.document.querySelectorAll("[id]")).map((e) => e.id);
  const seen = new Set();
  const dupes = [...new Set(ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false))))];
  assert.deepEqual(dupes, [], "повторяющиеся id в документе");
});

test("на странице этапа каждая ссылка ресурса ведёт наружу и открывается безопасно", async () => {
  const w = await openMap({ hash: "#/stage/stage-6" });
  const links = Array.from(w.document.querySelectorAll('#stage-page a[href^="http"]'));
  assert.ok(links.length > 0, "на странице этапа нет внешних ссылок");
  for (const a of links) {
    assert.equal(a.getAttribute("target"), "_blank", `${a.href}: открывается в этой же вкладке`);
    assert.match(a.getAttribute("rel") || "", /noopener/, `${a.href}: нет rel=noopener`);
  }
});

/* ------------------------------------------ русские ссылки и уровень --- */

test("у ресурса Khan обе версии стоят равными кнопками", async () => {
  const w = await openMap({ hash: "#/stage/track-math" });
  await goto(w, "#/stage/track-math");

  const cards = Array.from(w.document.querySelectorAll("#stage-page .res"));
  const khan = cards.filter((c) => {
    const first = c.querySelector(".res-langs a");
    return first && first.href.includes("khanacademy.org");
  });
  assert.ok(khan.length > 0, "на треке математики нет карточек Khan");

  let сРусской = 0;
  for (const card of khan) {
    const links = Array.from(card.querySelectorAll(".res-langs a"));
    assert.equal(links[0].textContent, "ENG", "первой должна стоять кнопка языка самого ресурса");
    assert.match(links[0].href, /^https:\/\/www\.khanacademy\.org\//);
    if (links.length === 2) {
      сРусской++;
      assert.equal(links[1].textContent, "RU");
      assert.match(links[1].href, /^https:\/\/ru\.khanacademy\.org\//, "русская ведёт не туда");
      assert.ok(links[1].title, "у русской кнопки нет подсказки");
    }
    // Заголовок больше НЕ ссылка: язык выбирается кнопкой.
    assert.equal(card.querySelector(".res-title").tagName, "SPAN");
  }
  assert.ok(сРусской > 0, "ни одной пары ENG/RU");
});

test("переключатель уровня стоит только на треке английского", async () => {
  const w = await openMap();

  await goto(w, "#/stage/track-english");
  const buttons = w.document.querySelectorAll("#stage-page .level-btn");
  assert.equal(buttons.length, 5, "уровней не пять");
  assert.equal(
    Array.from(buttons).filter((b) => b.getAttribute("aria-pressed") === "true").length, 1,
    "нажатым должен быть ровно один уровень"
  );

  await goto(w, "#/stage/track-math");
  assert.equal(w.document.querySelectorAll("#stage-page .level-pick").length, 0,
    "переключатель уровня протёк на чужой трек");
});

test("смена уровня меняет адрес ссылок British Council и переживает перезагрузку", async () => {
  const w = await openMap();
  await goto(w, "#/stage/track-english");

  const listening = () =>
    Array.from(w.document.querySelectorAll("#stage-page .res"))
      .find((c) => c.querySelector(".res-title").textContent.includes("Listening"))
      .querySelector(".res-langs a");

  assert.match(listening().href, /\/listening\/b1$/, "по умолчанию должен быть B1");

  const a1 = Array.from(w.document.querySelectorAll("#stage-page .level-btn"))
    .find((b) => b.textContent === "A1");
  a1.click();
  await new Promise((r) => setTimeout(r, 10));

  assert.match(listening().href, /\/listening\/a1$/, "ссылка не переехала на A1");
  // Ключ СВОЙ, не внутри asr:v1: настройку задают и на карте, и в планнере.
  assert.equal(w.localStorage.getItem("asr:english-level"), "a1", "уровень не сохранился");
  assert.equal(JSON.parse(w.localStorage.getItem("asr:v1")).englishLevel, undefined,
    "уровень не должен дублироваться в состоянии карты");
});

test("уровень, оставшийся в старом месте, подхватывается при переезде", () => {
  // Короткое время 03.09.2026 уровень лежал внутри asr:v1. Тест держит запасной
  // путь живым: без него молча вернулся бы B1 и выбор человека пропал.
  return openMap({ storage: { v: 1, englishLevel: "b2", topics: {}, open: {}, openTopics: {} } })
    .then(async (w) => {
      await goto(w, "#/stage/track-english");
      const listening = Array.from(w.document.querySelectorAll("#stage-page .res"))
        .find((c) => c.querySelector(".res-title").textContent.includes("Listening"))
        .querySelector(".res-langs a");
      assert.match(listening.href, /\/listening\/b2$/, "старый уровень потерян");
    });
});
