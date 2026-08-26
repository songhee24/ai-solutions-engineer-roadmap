/* ==========================================================================
 * app.js — интерфейс дорожной карты. Содержание лежит в roadmap-data.js.
 * Vanilla JS, без сборки и зависимостей.
 * ========================================================================== */
(function () {
  "use strict";

  var DATA = window.ROADMAP;
  var STORAGE_KEY = "asr:v1";
  var WEEKS_PER_MONTH = 4.345;

  /* ------------------------------- состояние ------------------------------ */

  function defaultState() {
    return {
      v: 1,
      profile: DATA.meta.defaultProfile || "novice",
      pace: DATA.meta.defaultPace || 15,
      theme: null,
      startDate: null,
      topics: {},
      open: {},
      openTopics: {}
    };
  }

  function loadState() {
    var s = defaultState();
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          s.profile = parsed.profile === "dev" ? "dev" : "novice";
          s.pace = Number(parsed.pace) > 0 ? Number(parsed.pace) : s.pace;
          s.theme = parsed.theme === "dark" || parsed.theme === "light" ? parsed.theme : null;
          s.startDate = typeof parsed.startDate === "string" ? parsed.startDate : null;
          if (parsed.topics && typeof parsed.topics === "object") s.topics = parsed.topics;
          if (parsed.open && typeof parsed.open === "object") s.open = parsed.open;
          if (parsed.openTopics && typeof parsed.openTopics === "object") s.openTopics = parsed.openTopics;
        }
      }
    } catch (e) {
      console.warn("Не удалось прочитать сохранённый прогресс:", e);
    }
    return s;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Не удалось сохранить прогресс:", e);
      toast("Не удалось сохранить прогресс: браузер запретил localStorage");
    }
  }

  var state = loadState();

  function topicState(id) {
    var t = state.topics[id];
    if (!t) { t = { done: false, skipped: false, note: "", at: null }; state.topics[id] = t; }
    return t;
  }

  function isComplete(id) {
    var t = state.topics[id];
    return !!(t && (t.done || t.skipped));
  }

  /* ------------------------------- утилиты -------------------------------- */

  var allTopics = [];
  DATA.stages.forEach(function (stage) {
    stage.topics.forEach(function (topic) {
      allTopics.push({ stage: stage, topic: topic });
    });
  });

  function hoursOf(topic) { return topic.hours[state.profile] || 0; }

  function stageHours(stage) {
    var total = 0, done = 0;
    stage.topics.forEach(function (t) {
      var h = hoursOf(t);
      total += h;
      if (isComplete(t.id)) done += h;
    });
    return { total: total, done: done, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  // Часы дополнительных треков (stage.optional) НЕ входят в общий срок:
  // они не ведут к цели карты, и смешивать их с основным путём было бы враньём.
  function overall() {
    var total = 0, done = 0, extraTotal = 0, extraDone = 0;
    allTopics.forEach(function (row) {
      var h = hoursOf(row.topic);
      var complete = isComplete(row.topic.id);
      if (row.stage.optional) {
        extraTotal += h;
        if (complete) extraDone += h;
      } else {
        total += h;
        if (complete) done += h;
      }
    });
    var exact = total ? (done / total) * 100 : 0;
    return {
      total: total, done: done, left: total - done,
      pct: Math.round(exact), exact: exact,
      extraTotal: extraTotal, extraDone: extraDone
    };
  }

  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }

  function formatMonths(weeks) {
    var months = weeks / WEEKS_PER_MONTH;
    if (months < 1) {
      var w = Math.max(0, Math.round(weeks));
      return w + " " + plural(w, "неделя", "недели", "недель");
    }
    var rounded = Math.round(months * 10) / 10;
    // При дробном числе русский требует родительный падеж единственного числа: «18,6 месяца».
    var word = rounded % 1 === 0 ? plural(rounded, "месяц", "месяца", "месяцев") : "месяца";
    return rounded.toFixed(1).replace(".", ",") + " " + word;
  }

  function finishDate(weeks) {
    var d = new Date();
    d.setDate(d.getDate() + Math.ceil(weeks * 7));
    return d.toLocaleDateString("ru-RU", { year: "numeric", month: "long" });
  }

  function ruDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("ru-RU", { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  var toastTimer = null;
  function toast(message) {
    var box = document.getElementById("toast");
    box.textContent = message;
    box.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.hidden = true; }, 3600);
  }

  /* -------------------------------- фильтры ------------------------------- */

  var filters = { need: "all", cost: "all", kind: "all", track: "all", query: "" };

  // Тема попадает под фильтр, если СОДЕРЖИТ ресурс такой стоимости.
  // Иначе «Платно» показывало бы лишь темы, где вообще нет бесплатной альтернативы.
  function topicHasCost(topic, cost) {
    if (!topic.resources.length) return cost === "free";
    return topic.resources.some(function (r) { return (r.cost === "paid" ? "paid" : "free") === cost; });
  }

  function matchesFilters(topic) {
    if (filters.need === "required" && !topic.required) return false;
    if (filters.need === "optional" && topic.required) return false;
    if (filters.cost !== "all" && !topicHasCost(topic, filters.cost)) return false;
    if (filters.kind !== "all" && topic.kind !== filters.kind) return false;
    if (filters.track !== "all" && topic.track !== filters.track) return false;
    if (filters.query) {
      var q = filters.query;
      var hay = [topic.title, topic.en, topic.task || "", topic.courseNote || "", topic.check || ""]
        .concat(topic.steps || [])
        .concat(topic.example ? [topic.example.ru, topic.example.en, topic.example.gain || ""] : [])
        .concat(topic.resources.map(function (r) { return r.title + " " + (r.study || "") + " " + (r.scope || ""); }))
        .join(" ").toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  function filtersActive() {
    return filters.need !== "all" || filters.cost !== "all" || filters.kind !== "all" ||
           filters.track !== "all" || filters.query !== "";
  }

  /* ------------------------------ отрисовка: герой ------------------------ */

  function renderHero() {
    var o = overall();
    var weeksLeft = state.pace > 0 ? o.left / state.pace : 0;
    var current = currentStage();

    var stats = document.getElementById("hero-stats");
    stats.textContent = "";

    function stat(label, value, sub) {
      var box = el("div", "stat");
      box.appendChild(el("div", "stat-label", label));
      var v = el("div", "stat-value", value);
      if (sub) { var s = el("small", null, " " + sub); v.appendChild(s); }
      box.appendChild(v);
      return box;
    }

    stats.appendChild(stat("Текущий этап", current ? (current.kind === "track" ? "Трек " + current.num : "Этап " + current.num) : "Готово", current ? "" : ""));
    stats.appendChild(stat("Общий прогресс", o.pct + "%", o.done + " из " + o.total + " ч"));
    stats.appendChild(stat("Осталось", formatMonths(weeksLeft), "при " + state.pace + " ч/нед"));
    stats.appendChild(stat("Ориентир финиша", o.left > 0 ? finishDate(weeksLeft) : "—", ""));
    stats.appendChild(stat("Профиль", state.profile === "dev" ? "Разработчик" : "Новичок", ""));

    document.getElementById("progress-fill").style.width = (o.exact > 0 && o.exact < 1 ? 1 : o.exact).toFixed(2) + "%";
    document.getElementById("progress-label").textContent = "Общий прогресс: " + o.pct + "%";

    var meta = document.getElementById("footer-meta");
    meta.textContent = "Карта обновлена " + ruDate(DATA.meta.updated) +
      " · всего " + o.total + " ч в профиле «" + (state.profile === "dev" ? "Разработчик" : "Новичок") + "»" +
      " · дата старта: " + ruDate(state.startDate);
  }

  function currentStage() {
    for (var i = 0; i < DATA.stages.length; i++) {
      if (DATA.stages[i].optional) continue;
      if (stageHours(DATA.stages[i]).pct < 100) return DATA.stages[i];
    }
    return null;
  }

  /* --------------------- отрисовка: Сейчас / Далее / Позже ---------------- */

  function renderHorizons() {
    var grid = document.getElementById("horizon-grid");
    grid.textContent = "";

    var pending = DATA.stages.filter(function (s) { return stageHours(s).pct < 100; });
    var current = pending.filter(function (s) { return !s.optional; })[0] || null;
    var tracks = pending.filter(function (s) { return s.kind === "track" && !s.optional && s !== current; });
    var nextStage = pending.filter(function (s) { return s !== current && s.kind !== "track" && !s.optional; })[0] || null;
    var later = pending.filter(function (s) { return s !== current && s !== nextStage && tracks.indexOf(s) === -1; });

    function incompleteTopics(stage, limit) {
      return stage.topics.filter(function (t) { return !isComplete(t.id); }).slice(0, limit);
    }

    function card(className, title, sub, items, emptyText) {
      var box = el("div", "horizon " + className);
      box.appendChild(el("h3", null, title));
      box.appendChild(el("p", "horizon-sub", sub));
      var ul = el("ul");
      if (!items.length) {
        ul.appendChild(el("li", null, emptyText));
      } else {
        items.forEach(function (item) {
          var li = el("li");
          li.appendChild(el("span", "h-stage", item.stage));
          if (item.href) {
            var a = el("a", null, item.title);
            a.href = item.href;
            a.addEventListener("click", function () {
              if (item.topicId) state.openTopics[item.topicId] = true;
              openStage(item.stageId);
            });
            li.appendChild(a);
          } else {
            li.appendChild(document.createTextNode(item.title));
          }
          if (item.hours != null) {
            li.appendChild(document.createElement("br"));
            li.appendChild(el("span", "h-hours", item.hours + " ч"));
          }
          ul.appendChild(li);
        });
      }
      box.appendChild(ul);
      return box;
    }

    var nowItems = [];
    if (current) {
      incompleteTopics(current, 5).forEach(function (t) {
        nowItems.push({
          stage: (current.kind === "track" ? "Трек " : "Этап ") + current.num,
          title: t.title, hours: hoursOf(t), href: "#" + current.id,
          stageId: current.id, topicId: t.id
        });
      });
    }
    tracks.slice(0, 2).forEach(function (tr) {
      var t = incompleteTopics(tr, 1)[0];
      if (t) nowItems.push({ stage: "Параллельно · Трек " + tr.num, title: t.title, hours: hoursOf(t), href: "#" + tr.id, stageId: tr.id, topicId: t.id });
    });

    var nextItems = [];
    if (nextStage) {
      incompleteTopics(nextStage, 4).forEach(function (t) {
        nextItems.push({ stage: "Этап " + nextStage.num, title: t.title, hours: hoursOf(t), href: "#" + nextStage.id, stageId: nextStage.id, topicId: t.id });
      });
    }

    var laterItems = later.map(function (s) {
      var h = stageHours(s);
      var label = (s.kind === "track" ? "Трек " : "Этап ") + s.num + (s.optional ? " · по желанию" : "");
      return { stage: label, title: s.title, hours: h.total - h.done, href: "#" + s.id, stageId: s.id };
    });

    grid.appendChild(card("now", "Сейчас", "Берите отсюда — и ничего больше", nowItems, "Всё пройдено. Поздравляю."));
    grid.appendChild(card("next", "Далее", "Следующий этап, к которому вы готовитесь", nextItems, "Следующего этапа нет."));
    grid.appendChild(card("later", "Позже", "Не открывайте эти вкладки сегодня", laterItems, "Ничего не осталось."));
  }

  /* --------------------------- отрисовка: диагностика --------------------- */

  function renderDiagnostics() {
    var grid = document.getElementById("diag-grid");
    grid.textContent = "";

    DATA.diagnostics.forEach(function (d) {
      var known = d.skips.every(function (id) { return isComplete(id); }) && d.skips.length > 0;
      var box = el("div", "diag" + (known ? " is-known" : ""));
      box.appendChild(el("h4", null, d.area));
      box.appendChild(el("p", "diag-q", d.question));
      box.appendChild(el("p", null, "Можно пропустить, если: " + d.skipIf));

      var actions = el("div", "diag-actions");
      var yes = el("button", "btn btn-sm" + (known ? " btn-primary" : ""), known ? "Отмечено как знаю" : "Знаю — пропустить");
      yes.type = "button";
      yes.addEventListener("click", function () {
        d.skips.forEach(function (id) {
          var t = topicState(id);
          t.skipped = !known;
          if (!known) t.at = new Date().toISOString();
        });
        ensureStart();
        saveState();
        renderAll();
        toast(known ? "Темы снова в плане" : "Отмечено как известное — срок пересчитан");
      });
      actions.appendChild(yes);

      var link = el("a", "btn btn-sm", "Показать темы");
      link.href = "#roadmap";
      link.addEventListener("click", function () {
        d.skips.forEach(function (id) {
          var row = allTopics.filter(function (r) { return r.topic.id === id; })[0];
          if (row) { state.openTopics[id] = true; openStage(row.stage.id); }
        });
      });
      actions.appendChild(link);

      box.appendChild(actions);
      grid.appendChild(box);
    });
  }

  /* ----------------------------- отрисовка: этапы ------------------------- */

  var TRACK_LABELS = DATA.meta.tracks;
  var KIND_LABELS = { theory: "теория", practice: "практика", project: "проект" };

  function renderStages(list, opts) {
    opts = opts || {};
    var host = document.getElementById(opts.host || "stages");
    host.textContent = "";
    var shownTopics = 0, shownStages = 0;

    (list || DATA.stages).forEach(function (stage) {
      var visible = stage.topics.filter(matchesFilters);
      var stageMatchesText = filters.query && stage.title.toLowerCase().indexOf(filters.query) !== -1;
      if (!visible.length && !stageMatchesText) return;
      if (stageMatchesText && !visible.length) visible = stage.topics;

      shownStages++;
      shownTopics += visible.length;

      var h = stageHours(stage);
      var card = el("section", "stage" + (stage.kind === "track" ? " is-track" : "") + (stage.optional ? " is-optional" : "") + (h.pct === 100 ? " is-done" : ""));
      card.id = stage.id;

      var bodyId = stage.id + "-body";
      var isOpen = opts.forceOpen || filtersActive() ? true : !!state.open[stage.id];

      var head = el("button", "stage-head");
      head.type = "button";
      head.setAttribute("aria-expanded", String(isOpen));
      head.setAttribute("aria-controls", bodyId);

      head.appendChild(el("span", "stage-num", stage.num));

      var titleBox = el("span");
      var titleLine = el("span", "stage-title", stage.title);
      if (stage.optional) titleLine.appendChild(el("span", "stage-flag", "дополнительно"));
      titleBox.appendChild(titleLine);
      titleBox.appendChild(document.createElement("br"));
      titleBox.appendChild(el("span", "stage-sub", stage.subtitle + " · " + h.total + " ч" +
        (stage.optional ? " сверх основного пути" : "")));
      head.appendChild(titleBox);

      var meta = el("span", "stage-meta");
      var track = el("span", "mini-track");
      var fill = el("span", "mini-fill");
      fill.style.width = h.pct + "%";
      track.appendChild(fill);
      meta.appendChild(track);
      meta.appendChild(el("span", "stage-pct", h.pct + "%"));
      meta.appendChild(el("span", "chevron", "›"));
      head.appendChild(meta);

      if (!opts.forceOpen) head.addEventListener("click", function () {
        var open = head.getAttribute("aria-expanded") === "true";
        head.setAttribute("aria-expanded", String(!open));
        body.hidden = open;
        state.open[stage.id] = !open;
        saveState();
      });
      card.appendChild(head);

      var body = el("div", "stage-body");
      body.id = bodyId;
      body.hidden = !isOpen;

      var why = el("div", "why");
      why.appendChild(el("strong", null, "Зачем это Solutions Engineer"));
      why.appendChild(el("p", null, stage.why));
      body.appendChild(why);

      if (stage.courseNote) {
        var scn = el("div", "course-note");
        scn.appendChild(el("strong", null, "Объём курсов"));
        scn.appendChild(el("p", null, stage.courseNote));
        body.appendChild(scn);
      }

      if (stage.prereq && stage.prereq.length) {
        var names = stage.prereq.map(function (id) {
          var s = DATA.stages.filter(function (x) { return x.id === id; })[0];
          return s ? s.title : id;
        });
        body.appendChild(el("p", "prereq", "Предварительно нужно: " + names.join(" · ")));
      }

      visible.forEach(function (topic) { body.appendChild(renderTopic(stage, topic)); });

      var projects = stage.projects || (stage.project ? [stage.project] : []);
      projects.forEach(function (p) { body.appendChild(renderProject(p)); });

      if (stage.ready && stage.ready.length) {
        var ready = el("div", "ready");
        ready.appendChild(el("h4", null, "Я готов двигаться дальше, если могу…"));
        var ul = el("ul");
        stage.ready.forEach(function (r) { ul.appendChild(el("li", null, r)); });
        ready.appendChild(ul);
        body.appendChild(ready);
      }

      if (stage.devNote) {
        var dn = el("div", "dev-note");
        dn.appendChild(el("strong", null, "Для тех, кто уже программирует"));
        dn.appendChild(el("p", null, stage.devNote));
        body.appendChild(dn);
      }

      card.appendChild(body);
      host.appendChild(card);
    });

    if (opts.quiet) return;
    var status = document.getElementById("filter-status");
    status.textContent = filtersActive()
      ? "Показано " + shownTopics + " " + plural(shownTopics, "тема", "темы", "тем") + " в " + shownStages + " " + plural(shownStages, "этапе", "этапах", "этапах")
      : "";
  }

  function renderTopic(stage, topic) {
    var st = topicState(topic.id);
    var box = el("div", "topic" + (st.done ? " is-done" : "") + (st.skipped ? " is-skipped" : ""));

    var head = el("div", "topic-head");

    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "topic-check";
    cb.checked = !!st.done;
    cb.id = "cb-" + topic.id;
    // Ярлыком раньше служил <label> с названием; теперь название — кнопка раскрытия,
    // поэтому чекбоксу нужен собственный доступный ярлык.
    cb.setAttribute("aria-label", "Отметить пройденным: " + topic.title);
    cb.addEventListener("change", function () {
      st.done = cb.checked;
      st.at = cb.checked ? new Date().toISOString() : null;
      if (cb.checked) st.skipped = false;
      ensureStart();
      saveState();
      renderAll();
    });
    head.appendChild(cb);

    var detailId = "det-" + topic.id;
    var isOpen = filtersActive() ? true : !!state.openTopics[topic.id];

    var main = el("div", "topic-main");
    var toggle = el("button", "topic-toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-controls", detailId);
    var title = el("span", "topic-title");
    title.appendChild(document.createTextNode(topic.title + " "));
    title.appendChild(el("span", "topic-en", "(" + topic.en + ")"));
    toggle.appendChild(title);
    toggle.appendChild(el("span", "topic-chevron", "›"));
    main.appendChild(toggle);

    var tags = el("div", "topic-tags");
    tags.appendChild(el("span", "tag " + (topic.required ? "req" : "opt"), topic.required ? "обязательно" : "дополнительно"));
    tags.appendChild(el("span", "tag", KIND_LABELS[topic.kind] || topic.kind));
    tags.appendChild(el("span", "tag", TRACK_LABELS[topic.track] || topic.track));
    tags.appendChild(el("span", "tag hrs", hoursOf(topic) + " ч"));
    if (st.skipped) tags.appendChild(el("span", "tag", "пропущено"));
    if (st.at) tags.appendChild(el("span", "tag hrs", ruDate(st.at)));
    main.appendChild(tags);

    var parts = [];
    if (topic.resources.length) {
      parts.push(topic.resources.length + " " + plural(topic.resources.length, "ресурс", "ресурса", "ресурсов"));
    }
    if (topic.steps && topic.steps.length) parts.push("порядок действий");
    if (topic.example) parts.push("пример");
    if (topic.task) parts.push("задание");
    if (st.note && st.note.trim()) parts.push("ваша заметка");
    if (parts.length) main.appendChild(el("div", "topic-summary", parts.join(" · ")));

    head.appendChild(main);

    var actions = el("div", "topic-actions");
    var skip = el("button", "btn btn-sm", st.skipped ? "Вернуть в план" : "Уже знаю");
    skip.type = "button";
    skip.addEventListener("click", function () {
      st.skipped = !st.skipped;
      if (st.skipped) { st.done = false; st.at = new Date().toISOString(); }
      ensureStart();
      saveState();
      renderAll();
    });
    actions.appendChild(skip);
    head.appendChild(actions);
    box.appendChild(head);

    var detail = el("div", "topic-detail");
    detail.id = detailId;
    detail.hidden = !isOpen;

    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      detail.hidden = open;
      if (open) delete state.openTopics[topic.id];
      else state.openTopics[topic.id] = true;
      saveState();
    });

    if (topic.courseNote) {
      var cn = el("div", "course-note");
      cn.appendChild(el("strong", null, "Сколько брать из курса"));
      cn.appendChild(el("p", null, topic.courseNote));
      detail.appendChild(cn);
    }

    if (topic.steps && topic.steps.length) {
      var how = el("div", "howto");
      how.appendChild(el("strong", null, "Как это делать"));
      var ol = document.createElement("ol");
      topic.steps.forEach(function (st) { ol.appendChild(el("li", null, st)); });
      how.appendChild(ol);
      detail.appendChild(how);
    }

    if (topic.example) {
      var ex = el("div", "example");
      ex.appendChild(el("strong", null, "Как это выглядит"));
      if (topic.example.intro) ex.appendChild(el("p", "example-intro", topic.example.intro));
      var pair = el("div", "example-pair");
      var ru = el("div", "example-side");
      ru.appendChild(el("span", "example-label", "Проход 1 — по-русски"));
      ru.appendChild(el("p", null, topic.example.ru));
      var en = el("div", "example-side");
      en.appendChild(el("span", "example-label", "Проход 2 — в оригинале"));
      en.appendChild(el("p", null, topic.example.en));
      pair.appendChild(ru);
      pair.appendChild(en);
      ex.appendChild(pair);
      if (topic.example.gain) ex.appendChild(el("p", "example-gain", topic.example.gain));
      detail.appendChild(ex);
    }

    if (topic.check) {
      var ch = el("div", "check-note");
      ch.appendChild(el("strong", null, "Проверь себя"));
      ch.appendChild(el("p", null, topic.check));
      detail.appendChild(ch);
    }

    topic.resources.forEach(function (r) {
      var res = el("div", "res");
      var line = el("div");
      var a = el("a", "res-title", r.title);
      a.href = r.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      line.appendChild(a);

      var badges = el("span", "res-badges");
      badges.appendChild(el("span", "badge " + (r.cost === "paid" ? "paid" : "free"), r.cost === "paid" ? "платно" : "бесплатно"));
      if (r.required) badges.appendChild(el("span", "badge must", "основной"));
      else badges.appendChild(el("span", "badge", "дополнительно"));
      badges.appendChild(el("span", "badge", r.lang === "ru" ? "рус" : "англ"));
      badges.appendChild(el("span", "badge", r.level));
      badges.appendChild(el("span", "badge", "~" + r.hours + " ч"));
      line.appendChild(badges);
      res.appendChild(line);

      if (r.scope) {
        var sc = el("div", "res-meta res-scope");
        sc.appendChild(el("b", null, "Объём: "));
        sc.appendChild(document.createTextNode(r.scope));
        res.appendChild(sc);
      }

      var what = el("div", "res-meta");
      what.appendChild(el("b", null, "Изучать: "));
      what.appendChild(document.createTextNode(r.study));
      res.appendChild(what);

      if (r.skip && r.skip !== "—") {
        var sk = el("div", "res-meta");
        sk.appendChild(el("b", null, "Пропустить: "));
        sk.appendChild(document.createTextNode(r.skip));
        res.appendChild(sk);
      }

      res.appendChild(el("div", "res-checked", "ссылка проверена " + ruDate(r.checked)));
      detail.appendChild(res);
    });

    if (topic.task) {
      var task = el("div", "task");
      task.appendChild(el("strong", null, "Практическое задание"));
      task.appendChild(document.createTextNode(topic.task));
      detail.appendChild(task);
    }

    var note = document.createElement("textarea");
    note.className = "note-area";
    note.placeholder = "Заметки по теме: что понял, где застрял, ссылка на свой код…";
    note.value = st.note || "";
    note.setAttribute("aria-label", "Заметка по теме: " + topic.title);
    note.addEventListener("input", function () { st.note = note.value; });
    note.addEventListener("blur", saveState);
    detail.appendChild(note);

    box.appendChild(detail);
    return box;
  }

  function renderProject(p) {
    var box = el("div", "project");
    box.appendChild(el("h4", null, p.title));
    if (p.requirements && p.requirements.length) {
      box.appendChild(el("h5", null, "Требования"));
      var ul = el("ul");
      p.requirements.forEach(function (r) { ul.appendChild(el("li", null, r)); });
      box.appendChild(ul);
    }
    if (p.deliverables && p.deliverables.length) {
      box.appendChild(el("h5", null, "Что должно остаться на выходе"));
      var ul2 = el("ul");
      p.deliverables.forEach(function (d) { ul2.appendChild(el("li", null, d)); });
      box.appendChild(ul2);
    }
    return box;
  }

  /* --------------------- статические секции: один раз --------------------- */

  function renderStatic() {
    document.getElementById("th-title").textContent = DATA.tutorialHell.title;
    document.getElementById("th-intro").textContent = DATA.tutorialHell.intro;
    var rules = document.getElementById("th-rules");
    DATA.tutorialHell.rules.forEach(function (r) { rules.appendChild(el("li", null, r)); });
    document.getElementById("th-split").textContent = "Как делить время: " + DATA.tutorialHell.timeSplit;

    var body = document.getElementById("jobs-body");
    DATA.jobReadiness.forEach(function (j) {
      var tr = document.createElement("tr");
      var th = document.createElement("th");
      th.scope = "row";
      th.textContent = j.role;
      tr.appendChild(th);
      [j.must, j.nice, j.okGaps].forEach(function (list) {
        var td = document.createElement("td");
        var ul = el("ul");
        list.forEach(function (x) { ul.appendChild(el("li", null, x)); });
        td.appendChild(ul);
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });

    renderStudyMethod();
    renderThroughline();

    var honest = document.getElementById("honest-list");
    DATA.about.honest.forEach(function (h) { honest.appendChild(el("li", null, h)); });
  }

  function renderStudyMethod() {
    var m = DATA.studyMethod;
    if (!m) return;
    document.getElementById("sm-title").textContent = m.title;
    document.getElementById("sm-intro").textContent = m.intro;
    document.getElementById("sm-rule").textContent = m.rule;

    var host = document.getElementById("sm-areas");
    m.areas.forEach(function (a) {
      var box = el("div", "method-area");
      box.appendChild(el("h3", null, a.area));
      box.appendChild(el("p", "method-note", a.note));

      function list(label, items, cls) {
        if (!items || !items.length) return;
        box.appendChild(el("h4", "method-label " + cls, label));
        var ul = el("ul");
        items.forEach(function (x) { ul.appendChild(el("li", null, x)); });
        box.appendChild(ul);
      }
      list("Где нужна бумага", a.need, "is-need");
      list("Где бумага лишняя", a.skip, "is-skip");

      if (a.trap) {
        var t = el("div", "callout");
        t.textContent = a.trap;
        box.appendChild(t);
      }
      host.appendChild(box);
    });

    var nb = DATA.studyMethod.notebook;
    document.getElementById("sm-nb-title").textContent = nb.title;
    document.getElementById("sm-nb-intro").textContent = nb.intro;
    var w = document.getElementById("sm-nb-write");
    nb.write.forEach(function (x) { w.appendChild(el("li", null, x)); });
    var dw = document.getElementById("sm-nb-dont");
    nb.dontWrite.forEach(function (x) { dw.appendChild(el("li", null, x)); });
    document.getElementById("sm-nb-why").textContent = nb.why;

    var wk = DATA.studyMethod.week;
    document.getElementById("sm-week-title").textContent = wk.title;
    var wl = document.getElementById("sm-week-items");
    wk.items.forEach(function (x) { wl.appendChild(el("li", null, x)); });
    document.getElementById("sm-week-note").textContent = wk.note;
  }

  function renderThroughline() {
    var t = DATA.throughline;
    if (!t) return;
    document.getElementById("tl-name").textContent = t.name;
    document.getElementById("tl-intro").textContent = t.intro;
    document.getElementById("tl-domain").textContent = t.domain;

    var body = document.getElementById("tl-body");
    t.steps.forEach(function (row) {
      var tr = document.createElement("tr");
      var th = document.createElement("th");
      th.scope = "row";
      th.textContent = row.stage;
      tr.appendChild(th);
      var td = document.createElement("td");
      td.textContent = row.add;
      tr.appendChild(td);
      body.appendChild(tr);
    });
    document.getElementById("tl-warning").textContent = t.warning;
  }

  /* ------------------------------- фильтры UI ----------------------------- */

  function buildFilterGroup(hostId, key, options) {
    var host = document.getElementById(hostId);
    options.forEach(function (opt) {
      var b = el("button", "chip", opt.label);
      b.type = "button";
      b.setAttribute("aria-pressed", String(filters[key] === opt.value));
      b.addEventListener("click", function () {
        filters[key] = filters[key] === opt.value ? "all" : opt.value;
        if (opt.value === "all") filters[key] = "all";
        Array.prototype.forEach.call(host.children, function (c, i) {
          c.setAttribute("aria-pressed", String(filters[key] === options[i].value));
        });
        renderRoadmapPage();
      });
      host.appendChild(b);
    });
  }

  function setupFilters() {
    buildFilterGroup("filter-need", "need", [
      { value: "all", label: "Все" }, { value: "required", label: "Обязательно" }, { value: "optional", label: "Дополнительно" }
    ]);
    buildFilterGroup("filter-cost", "cost", [
      { value: "all", label: "Все" }, { value: "free", label: "Бесплатно" }, { value: "paid", label: "Платно" }
    ]);
    buildFilterGroup("filter-kind", "kind", [
      { value: "all", label: "Все" }, { value: "theory", label: "Теория" }, { value: "practice", label: "Практика" }, { value: "project", label: "Проект" }
    ]);
    var trackOptions = [{ value: "all", label: "Все" }];
    Object.keys(TRACK_LABELS).forEach(function (k) { trackOptions.push({ value: k, label: TRACK_LABELS[k] }); });
    buildFilterGroup("filter-track", "track", trackOptions);

    var search = document.getElementById("search");
    var timer = null;
    search.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        filters.query = search.value.trim().toLowerCase();
        renderRoadmapPage();
      }, 160);
    });

    document.getElementById("expand-all").addEventListener("click", function () {
      DATA.stages.forEach(function (s) {
        state.open[s.id] = true;
        s.topics.forEach(function (t) { state.openTopics[t.id] = true; });
      });
      saveState();
      renderRoute();
    });
    document.getElementById("collapse-all").addEventListener("click", function () {
      DATA.stages.forEach(function (s) {
        state.open[s.id] = false;
        s.topics.forEach(function (t) { delete state.openTopics[t.id]; });
      });
      saveState();
      renderRoute();
    });
  }

  /* ------------------------------ прочие действия ------------------------- */

  function ensureStart() {
    if (!state.startDate) state.startDate = new Date().toISOString();
  }

  // Прокрутка к элементу. Сначала обычный плавный путь; если браузер его
  // проигнорировал (в некоторых окнах Chrome программная прокрутка не срабатывает),
  // через 400 мс прыгаем мгновенно, вручную вычитая высоту липкой шапки.
  function scrollToNode(node) {
    if (!node) return;
    var startY = window.scrollY;
    try { node.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { /* старый браузер */ }
    setTimeout(function () {
      if (Math.abs(window.scrollY - startY) > 4) return;
      var header = document.querySelector(".site-header");
      var offset = (header ? header.offsetHeight : 112) + 12;
      var top = Math.max(0, node.getBoundingClientRect().top + window.scrollY - offset);
      try { window.scrollTo({ top: top, behavior: "instant" }); }
      catch (e) { window.scrollTo(0, top); }
    }, 400);
  }

  function openStage(stageId) {
    state.open[stageId] = true;
    saveState();
    goTo("#/stage/" + stageId);
  }

  function prefersDark() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); }
    catch (e) { return false; }
  }

  function setTheme(theme) {
    state.theme = theme;
    if (theme) document.documentElement.setAttribute("data-theme", theme);
    else document.documentElement.removeAttribute("data-theme");
    var dark = theme === "dark" || (!theme && prefersDark());
    document.getElementById("theme-icon").textContent = dark ? "☀" : "☾";
    document.getElementById("theme-label").textContent = dark ? "Светлая" : "Тёмная";
    saveState();
  }

  function setupHeader() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-profile]"), function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.profile === state.profile));
      btn.addEventListener("click", function () {
        state.profile = btn.dataset.profile;
        Array.prototype.forEach.call(document.querySelectorAll("[data-profile]"), function (b) {
          b.setAttribute("aria-pressed", String(b.dataset.profile === state.profile));
        });
        saveState();
        renderAll();
        toast(state.profile === "dev" ? "Профиль «Разработчик»: часы пересчитаны" : "Профиль «Новичок»: часы пересчитаны");
      });
    });

    var pace = document.getElementById("pace-select");
    if (!Array.prototype.some.call(pace.options, function (o) { return Number(o.value) === state.pace; })) {
      var extra = document.createElement("option");
      extra.value = String(state.pace);
      extra.textContent = state.pace + " ч/нед";
      pace.appendChild(extra);
    }
    pace.value = String(state.pace);
    pace.addEventListener("change", function () {
      state.pace = Number(pace.value) || 15;
      saveState();
      renderHero();
      toast("Режим: " + state.pace + " ч/нед");
    });

    document.getElementById("theme-toggle").addEventListener("click", function () {
      var dark = state.theme === "dark" || (!state.theme && prefersDark());
      setTheme(dark ? "light" : "dark");
    });

    document.getElementById("continue-btn").addEventListener("click", function () {
      var next = allTopics.filter(function (r) { return !isComplete(r.topic.id); })[0];
      if (!next) { toast("Все темы пройдены."); return; }
      state.openTopics[next.topic.id] = true;   // иначе прокрутка приведёт к свёрнутой карточке
      openStage(next.stage.id);
      setTimeout(function () {
        var cb = document.getElementById("cb-" + next.topic.id);
        if (cb) { scrollToNode(cb); cb.focus(); }
      }, 260);
    });
  }

  /* --------------------------- экспорт / импорт / сброс ------------------- */

  function setupDataButtons() {
    document.getElementById("export-btn").addEventListener("click", function () {
      var payload = JSON.stringify({
        exportedAt: new Date().toISOString(),
        roadmapVersion: DATA.meta.version,
        state: state
      }, null, 2);
      var blob = new Blob([payload], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "ai-solutions-engineer-progress.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      toast("Прогресс выгружен в JSON");
    });

    var file = document.getElementById("import-file");
    document.getElementById("import-btn").addEventListener("click", function () { file.click(); });
    file.addEventListener("change", function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = JSON.parse(String(reader.result));
          var incoming = parsed && parsed.state ? parsed.state : parsed;
          if (!incoming || typeof incoming !== "object" || !incoming.topics) throw new Error("Неверная структура файла");
          state.profile = incoming.profile === "dev" ? "dev" : "novice";
          state.pace = Number(incoming.pace) > 0 ? Number(incoming.pace) : state.pace;
          state.startDate = typeof incoming.startDate === "string" ? incoming.startDate : state.startDate;
          state.topics = incoming.topics;
          state.open = incoming.open && typeof incoming.open === "object" ? incoming.open : {};
          state.openTopics = incoming.openTopics && typeof incoming.openTopics === "object" ? incoming.openTopics : {};
          saveState();
          location.reload();
        } catch (e) {
          toast("Не удалось импортировать: " + e.message);
        }
      };
      reader.onerror = function () { toast("Не удалось прочитать файл"); };
      reader.readAsText(f);
      file.value = "";
    });

    var reset = document.getElementById("reset-btn");
    var armed = false, armTimer = null;
    reset.addEventListener("click", function () {
      if (!armed) {
        armed = true;
        reset.textContent = "Нажмите ещё раз, чтобы стереть всё";
        toast("Это удалит весь прогресс и заметки. Нажмите кнопку ещё раз в течение 6 секунд.");
        armTimer = setTimeout(function () {
          armed = false;
          reset.textContent = "Сбросить прогресс";
        }, 6000);
        return;
      }
      clearTimeout(armTimer);
      armed = false;
      reset.textContent = "Сбросить прогресс";
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* игнорируем */ }
      state = defaultState();
      saveState();
      location.reload();
    });
  }

  /* ------------------------------- роутер --------------------------------- */

  // Сайт разбит на страницы: за раз отрисован ровно один экран, а не весь лист.
  // Раньше в DOM жили все 13 этапов сразу — 6046 узлов, из них 92% приходилось
  // на карту, и ориентироваться в этом было тяжело.
  var PAGES = {
    "":              ["hero", "horizons", "honesty"],
    "diagnostics":   ["diagnostics"],
    "roadmap":       ["roadmap"],
    "stage":         ["stage-page"],
    "throughline":   ["throughline"],
    "method":        ["study-method"],
    "tutorial-hell": ["tutorial-hell"],
    "jobs":          ["job-readiness"]
  };

  function allPageSections() {
    var ids = [];
    Object.keys(PAGES).forEach(function (k) {
      PAGES[k].forEach(function (id) { if (ids.indexOf(id) === -1) ids.push(id); });
    });
    return ids;
  }

  function currentRoute() {
    var h = (location.hash || "").replace(/^#\/?/, "");
    if (!h) return { name: "", param: null };

    // Старые ссылки вида #track-math продолжают работать
    var legacy = DATA.stages.filter(function (s) { return s.id === h; })[0];
    if (legacy) return { name: "stage", param: legacy.id };

    var parts = h.split("/");
    if (parts[0] === "stage" && parts[1]) return { name: "stage", param: parts[1] };
    if (Object.prototype.hasOwnProperty.call(PAGES, parts[0])) return { name: parts[0], param: null };
    return { name: "", param: null };
  }

  function goTo(hash) {
    if (location.hash === hash) renderRoute();
    else location.hash = hash;
  }

  // Оглавление карты: 13 лёгких карточек вместо 13 раскрытых этапов
  function renderRoadmapIndex() {
    var host = document.getElementById("roadmap-index");
    host.textContent = "";

    DATA.stages.forEach(function (stage) {
      var h = stageHours(stage);
      var a = el("a", "stage-card" + (stage.kind === "track" ? " is-track" : "") +
                      (stage.optional ? " is-optional" : "") + (h.pct === 100 ? " is-done" : ""));
      a.href = "#/stage/" + stage.id;

      a.appendChild(el("span", "stage-num", stage.num));

      var body = el("span", "stage-card-body");
      var titleLine = el("span", "stage-title", stage.title);
      if (stage.optional) titleLine.appendChild(el("span", "stage-flag", "дополнительно"));
      body.appendChild(titleLine);
      body.appendChild(el("span", "stage-sub", stage.subtitle));

      var facts = el("span", "stage-card-facts");
      facts.appendChild(el("span", "tag hrs", h.total + " ч"));
      facts.appendChild(el("span", "tag hrs", stage.topics.length + " " + plural(stage.topics.length, "тема", "темы", "тем")));
      body.appendChild(facts);
      a.appendChild(body);

      var meta = el("span", "stage-meta");
      var track = el("span", "mini-track");
      var fill = el("span", "mini-fill");
      fill.style.width = h.pct + "%";
      track.appendChild(fill);
      meta.appendChild(track);
      meta.appendChild(el("span", "stage-pct", h.pct + "%"));
      a.appendChild(meta);

      host.appendChild(a);
    });
  }

  function renderStagePage(stageId) {
    var idx = -1;
    DATA.stages.forEach(function (s, i) { if (s.id === stageId) idx = i; });
    if (idx === -1) { goTo("#/roadmap"); return; }

    renderStages([DATA.stages[idx]], { host: "stage-page-body", forceOpen: true, quiet: true });

    var pager = document.getElementById("stage-pager");
    pager.textContent = "";
    function link(stage, label) {
      if (!stage) return;
      var a = el("a", "btn", label + " " + (stage.kind === "track" ? "Трек " : "Этап ") + stage.num);
      a.href = "#/stage/" + stage.id;
      pager.appendChild(a);
    }
    link(DATA.stages[idx - 1], "←");
    var back = el("a", "btn", "Вся карта");
    back.href = "#/roadmap";
    pager.appendChild(back);
    link(DATA.stages[idx + 1], "→");
  }

  // На странице карты показываем либо оглавление, либо результаты фильтрации
  function renderRoadmapPage() {
    var filtering = filtersActive();
    document.getElementById("roadmap-index").hidden = filtering;
    document.getElementById("stages").hidden = !filtering;
    if (filtering) renderStages();
    else { renderRoadmapIndex(); document.getElementById("filter-status").textContent = ""; }
  }

  function markActiveNav(r) {
    var wanted = r.name === "stage" ? "#/stage/" + r.param : "#/" + r.name;
    Array.prototype.forEach.call(document.querySelectorAll("[data-nav]"), function (a) {
      if (a.getAttribute("href") === wanted) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }

  function renderRoute() {
    var r = currentRoute();
    var visible = PAGES[r.name] || PAGES[""];

    allPageSections().forEach(function (id) {
      var node = document.getElementById(id);
      if (node) node.hidden = visible.indexOf(id) === -1;
    });

    if (r.name === "stage") renderStagePage(r.param);
    if (r.name === "roadmap") renderRoadmapPage();

    markActiveNav(r);
    window.scrollTo(0, 0);
  }

  function setupSectionNav() {
    // Ссылки меню — обычные якоря вида #/roadmap. Всю работу делает роутер.
    window.addEventListener("hashchange", renderRoute);
  }

  /* --------------------------------- запуск ------------------------------- */

  function renderAll() {
    renderHero();
    renderHorizons();
    renderDiagnostics();
    renderRoute();
  }

  function init() {
    if (!DATA || !DATA.stages || !DATA.stages.length) {
      document.getElementById("stages").textContent = "Не удалось загрузить содержание дорожной карты.";
      return;
    }
    setTheme(state.theme);
    setupHeader();
    setupFilters();
    setupDataButtons();
    setupSectionNav();
    renderStatic();
    renderAll();

    try {
      var mq = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
      if (mq && mq.addEventListener) mq.addEventListener("change", function () { if (!state.theme) setTheme(null); });
    } catch (e) { /* браузер без matchMedia — просто без авто-переключения */ }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
