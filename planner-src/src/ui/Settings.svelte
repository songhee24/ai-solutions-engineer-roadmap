<script>
  /* Настройки — панель, а не экран: их открывают редко и закрывают сразу.
     Отдельная вкладка под три поля была бы лишней сущностью. */
  import {
    planner, setStart, setHoursPerDay, setWeekdays, setProfile,
    addCustomTopic, updateCustomTopic, removeCustomTopic,
    exportState, importState, resetAll
  } from "../lib/store.svelte.js";
  import { formatHours, ruNum, dateDayMonth, WEEKDAY_NAMES } from "../lib/format.js";

  let { today, onclose } = $props();

  /* Порядок с понедельника: воскресенье первым — привычка англоязычных
     календарей, здесь неуместная. */
  const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

  let confirmReset = $state(false);
  let importError = $state("");

  const STREAM_TITLES = { seq: "Основной этап", math: "Математика", english: "Английский" };

  /* Черновик новой темы. Отдельный объект, а не поля вразброс: так его чистит
     одна строка после добавления. */
  let draft = $state({ title: "", url: "", stream: "seq", hours: "" });
  let draftError = $state("");
  /** id темы, которую сейчас правят, либо null. */
  let editing = $state(null);
  let confirmRemove = $state(null);

  function submitDraft() {
    draftError = "";
    const added = addCustomTopic(draft);
    if (!added) {
      draftError = "Нужны название и часы больше нуля.";
      return;
    }
    if (draft.url.trim() && !added.url) {
      // Тема добавлена, но ссылку не взяли — сказать об этом, а не молчать.
      draftError = "Тема добавлена, но ссылку не взяли: нужен http или https.";
    }
    draft = { title: "", url: "", stream: "seq", hours: "" };
  }

  function toggleWeekday(n) {
    const has = planner.weekdays.includes(n);
    const next = has ? planner.weekdays.filter((d) => d !== n) : [...planner.weekdays, n];
    // Пустая неделя означала бы «никогда не заниматься» и делила бы на ноль.
    if (next.length) setWeekdays(next);
  }

  function download() {
    const blob = new Blob([exportState()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `planner-${today}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function upload(event) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    importError = "";
    try {
      importState(await file.text());
    } catch (err) {
      importError = `Файл не похож на выгрузку планнера: ${err.message}`;
    }
    event.currentTarget.value = "";
  }
</script>

<div class="card panel">
  <header>
    <h2>Настройки</h2>
    <button class="btn ghost small" onclick={onclose}>Закрыть</button>
  </header>

  <div class="grid">
    <div class="row">
      <label for="set-start">Первый день занятий</label>
      <input id="set-start" class="field" type="date" value={planner.startDate} max={today}
             onchange={(e) => setStart(e.currentTarget.value)}>
      <small>От неё считаются дни, пропуски и отставание.</small>
    </div>

    <div class="row">
      <label for="set-hours">Часов в день</label>
      <input id="set-hours" class="field" type="number" min="0.5" max="16" step="0.5"
             value={planner.hoursPerDay}
             onchange={(e) => setHoursPerDay(e.currentTarget.value)}>
      <small>Бюджет обычного дня — {formatHours(planner.hoursPerDay)}. Отдельный день меняется
        на экране «Сегодня» и настройку не трогает.</small>
    </div>

    <div class="row">
      <label for="set-profile">Профиль</label>
      <select id="set-profile" class="field" value={planner.profile}
              onchange={(e) => setProfile(e.currentTarget.value)}>
        <option value="novice">Новичок — полный объём</option>
        <option value="dev">Разработчик — часть тем короче</option>
      </select>
      <small>Профиль меняет часы у тем, а значит и весь срок. Журнал при этом не трогается.</small>
    </div>

    <div class="row wide">
      <span class="label">Дни недели</span>
      <div class="week" role="group" aria-label="Дни недели, в которые вы занимаетесь">
        {#each WEEK_ORDER as n (n)}
          <button class="day" aria-pressed={planner.weekdays.includes(n)}
                  onclick={() => toggleWeekday(n)}>{WEEKDAY_NAMES[n]}</button>
        {/each}
      </div>
      <small>Невыбранные дни не считаются пропусками. Один день оставить обязательно.</small>
    </div>
  </div>

  <details class="section">
    <summary>Свои темы <span class="count">{planner.custom.length}</span></summary>

    <p class="hint">То, чего в карте нет. Своя тема встаёт <b>ближайшей в своём потоке</b> —
      её заводят, чтобы заняться скоро; отложить на день можно кнопкой «Не сегодня».
      При обновлении карты свои темы не пропадают: они хранятся отдельно от неё.
      Их часы входят в общий объём, поэтому доля пути пересчитается.</p>

    {#if planner.custom.length}
      <div class="mine">
        {#each planner.custom as topic (topic.id)}
          {#if editing === topic.id}
            <div class="edit">
              <input class="field" value={topic.title} placeholder="Название"
                     onchange={(e) => updateCustomTopic(topic.id, { title: e.currentTarget.value })}>
              <input class="field" value={topic.url ?? ""} placeholder="https://…"
                     onchange={(e) => updateCustomTopic(topic.id, { url: e.currentTarget.value })}>
              <select class="field" value={topic.stream}
                      onchange={(e) => updateCustomTopic(topic.id, { stream: e.currentTarget.value })}>
                {#each Object.entries(STREAM_TITLES) as [id, title] (id)}
                  <option value={id}>{title}</option>
                {/each}
              </select>
              <input class="field num" type="number" min="0.25" step="0.25" value={topic.hours}
                     onchange={(e) => updateCustomTopic(topic.id, { hours: e.currentTarget.value })}>
              <button class="btn small" onclick={() => (editing = null)}>Готово</button>
            </div>
          {:else}
            <div class="row">
              <span class="name">{topic.title}</span>
              <span class="meta">
                {topic.url ? new URL(topic.url).hostname : "без ссылки"} · {ruNum(topic.hours)} ч
              </span>
              <span class="chip {topic.stream}">{STREAM_TITLES[topic.stream]}</span>
              <button class="btn ghost small" onclick={() => (editing = topic.id)}>Править</button>
              {#if confirmRemove === topic.id}
                <button class="btn small danger"
                        onclick={() => { removeCustomTopic(topic.id); confirmRemove = null; }}>
                  Удалить вместе с отметками
                </button>
                <button class="btn ghost small" onclick={() => (confirmRemove = null)}>Отмена</button>
              {:else}
                <button class="btn ghost small" onclick={() => (confirmRemove = topic.id)}>Удалить</button>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    {/if}

    <div class="edit new">
      <input class="field" bind:value={draft.title} placeholder="Например, Docker для разработки">
      <input class="field" bind:value={draft.url} placeholder="https://… (необязательно)">
      <select class="field" bind:value={draft.stream}>
        {#each Object.entries(STREAM_TITLES) as [id, title] (id)}
          <option value={id}>{title}</option>
        {/each}
      </select>
      <input class="field num" type="number" min="0.25" step="0.25" bind:value={draft.hours} placeholder="часов">
      <button class="btn small" onclick={submitDraft}>Добавить</button>
    </div>
    {#if draftError}<p class="err">{draftError}</p>{/if}
  </details>

  <div class="tools">
    <button class="btn ghost small" onclick={download}>Выгрузить в файл</button>
    <label class="btn ghost small file">
      Загрузить из файла
      <input type="file" accept="application/json,.json" onchange={upload}>
    </label>
    {#if confirmReset}
      <button class="btn small danger" onclick={() => { resetAll(); confirmReset = false; }}>
        Точно стереть весь прогресс
      </button>
      <button class="btn ghost small" onclick={() => (confirmReset = false)}>Отмена</button>
    {:else}
      <button class="btn ghost small" onclick={() => (confirmReset = true)}>Стереть прогресс</button>
    {/if}
  </div>

  {#if importError}
    <p class="err">{importError}</p>
  {/if}

  <p class="how"><small>Календарь занятий нигде не хранится — хранится только журнал, что и когда
    закрыто. План на день выводится заново из того, что ещё не пройдено, поэтому пропущенный день
    ничего не теряет: непройденное всплывает завтра, а дата финиша сдвигается.</small></p>
</div>

<style>
  .panel { padding: 16px 18px; margin-bottom: 20px; }
  .panel header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
  .panel h2 { margin: 0; font-size: 17px; }
  .panel header button { margin-left: auto; }

  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; }
  .row { display: grid; gap: 5px; align-content: start; }
  .row.wide { grid-column: 1 / -1; }
  .row label, .row .label { font-size: 13px; font-weight: 600; }
  .row small { line-height: 1.4; }

  .week { display: flex; gap: 6px; flex-wrap: wrap; }
  .day {
    font: inherit; font-size: 13px; cursor: pointer; min-width: 44px;
    padding: 6px 10px; border-radius: var(--radius-sm);
    border: 1px solid var(--border); background: var(--surface-2); color: var(--text-muted);
  }
  .day[aria-pressed="true"] { background: var(--primary); color: var(--primary-text); border-color: var(--primary); }
  .day:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

  .tools { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px;
           padding-top: 14px; border-top: 1px solid var(--border); }
  .tools .file { position: relative; overflow: hidden; display: inline-flex; align-items: center; }
  .tools .file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .tools .danger { background: var(--miss); border-color: var(--miss); color: #fff; }

  .err { color: var(--miss); font-size: 13px; margin: 10px 0 0; }

  /* Секции свёрнуты по умолчанию: панель настроек не должна расти в стену.
     Нативный <details> — без единой строки состояния. */
  .section { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border); }
  .section > summary { cursor: pointer; font-size: 14px; font-weight: 600; }
  .section > summary::marker { color: var(--text-faint); }
  .section .count { color: var(--text-faint); font-weight: 400; }
  .section .hint { color: var(--text-muted); font-size: 13px; margin: 10px 0 12px; line-height: 1.45; }

  .mine { display: grid; gap: 6px; margin-bottom: 12px; }
  .mine .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
               padding: 8px 10px; border: 1px solid var(--border);
               border-radius: var(--radius-sm); background: var(--surface-2); }
  .mine .name { font-weight: 600; }
  .mine .meta { color: var(--text-muted); font-size: 12.5px; }
  .mine .row > button:first-of-type { margin-left: auto; }

  .edit { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .edit .field { flex: 1; min-width: 130px; }
  .edit .field.num { flex: 0 0 92px; min-width: 92px; }
  .edit.new { padding: 10px; border: 1px dashed var(--border-strong);
              border-radius: var(--radius-sm); }
  .how { margin: 12px 0 0; }
</style>
