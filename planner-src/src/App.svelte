<script>
  /* Оболочка планнера: грузит контент карты, считает общий срез прогресса и
     отдаёт его экранам. Сами экраны состояние не считают — только показывают. */
  import { onMount } from "svelte";
  import { buildUnits } from "../../shared/schedule.mjs";
  import { loadRoadmap } from "./lib/roadmap.js";
  import { customUnits } from "./lib/custom.js";
  import { planner, setScreen, setStart } from "./lib/store.svelte.js";
  import { doneHoursByUnit, groupProgress, stats, todayIso } from "./lib/progress.js";
  import { dateLong } from "./lib/format.js";
  import Settings from "./ui/Settings.svelte";
  import Today from "./screens/Today.svelte";
  import Calendar from "./screens/Calendar.svelte";
  import KnowledgeMap from "./screens/KnowledgeMap.svelte";

  const SCREENS = [
    { id: "today", title: "Сегодня" },
    { id: "calendar", title: "Календарь" },
    { id: "map", title: "Карта знаний" }
  ];

  let data = $state(null);
  let error = $state(null);
  let today = $state(todayIso());
  let showSettings = $state(false);
  let startPick = $state(todayIso());

  /* Свои темы приклеиваются к родным ровно здесь и больше нигде: дальше
     remainingUnits, planDays, stats и groupProgress работают с ними, не зная,
     что они не из карты.

     Свои — ПЕРВЫМИ в очереди. planDays берёт единицы по порядку, и в хвосте
     своя тема всплыла бы через двести с лишним дней, то есть никогда: её
     заводят, чтобы заняться ею скоро, а не когда-нибудь. Отложить на день
     по-прежнему можно кнопкой «Не сегодня». */
  let units = $derived(
    data ? [...customUnits(planner.custom), ...buildUnits(data, planner.profile)] : []
  );
  let doneByUnit = $derived(doneHoursByUnit(planner.log));
  let progress = $derived(groupProgress(units, doneByUnit));
  let summary = $derived(stats({ units, planner, todayIso: today }));
  let screen = $derived(SCREENS.some((s) => s.id === planner.screen) ? planner.screen : "today");

  onMount(() => {
    loadRoadmap().then((r) => (data = r)).catch((e) => (error = e.message));
    // Страницу оставляют открытой: без этого после полуночи планнер продолжал
    // бы показывать вчерашний день и молча считать сегодня пропущенным.
    const tick = setInterval(() => {
      const now = todayIso();
      if (now !== today) today = now;
    }, 60000);
    return () => clearInterval(tick);
  });
</script>

<header class="bar">
  <div class="bar-in">
    <a class="home" href="../index.html">← Дорожная карта</a>
    <span class="name">Планнер</span>
    {#if planner.startDate}
      <span class="spacer"></span>
      <button class="btn ghost small" onclick={() => (showSettings = !showSettings)}
              aria-expanded={showSettings}>Настройки</button>
    {/if}
  </div>
</header>

{#if planner.startDate}
  <nav class="bar tabs-bar">
    <div class="bar-in">
      <div class="tabs" role="tablist" aria-label="Экраны планнера">
        {#each SCREENS as s (s.id)}
          <button role="tab" aria-selected={screen === s.id} onclick={() => setScreen(s.id)}>
            {s.title}
          </button>
        {/each}
      </div>
    </div>
  </nav>
{/if}

<main class="wrap">
  {#if error}
    <div class="note">Не удалось загрузить содержание карты: {error}.
      Планнер берёт темы из <code>roadmap-data.js</code> в корне сайта — проверьте, что файл на месте.</div>

  {:else if !data}
    <p class="lede">Загружаем карту…</p>

  {:else if !planner.startDate}
    <!-- Дату старта нельзя зашивать в код: каждый начинает в свой день, и
         вся арифметика планнера отсчитывается именно от неё. -->
    <h1>С какого дня вы учитесь?</h1>
    <p class="lede">От этой даты считается всё остальное: сколько дней прошло, что стоит на сегодня,
      какие дни пропущены и когда при нынешнем темпе закончится программа.
      Дату можно поменять потом в настройках.</p>
    <div class="card start">
      <label for="start">Первый день занятий</label>
      <input id="start" class="field" type="date" bind:value={startPick} max={todayIso()}>
      <p><small>{dateLong(startPick)}</small></p>
      <button class="btn" onclick={() => setStart(startPick)}>Начать вести планнер</button>
    </div>

  {:else}
    {#if showSettings}
      <Settings {today} {units} {summary} onclose={() => (showSettings = false)} />
    {/if}

    {#if screen === "today"}
      <Today {units} {doneByUnit} {summary} {today} />
    {:else if screen === "calendar"}
      <Calendar {summary} {today} />
    {:else}
      <KnowledgeMap {data} {progress} {summary} {units} {doneByUnit} {today} profile={planner.profile} />
    {/if}
  {/if}
</main>

<style>
  .bar {
    position: sticky; top: 0; z-index: 20;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    box-shadow: var(--shadow-sm);
  }
  .tabs-bar { top: 45px; box-shadow: none; }
  .bar-in {
    max-width: var(--maxw); margin: 0 auto; padding: 9px 20px;
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  }
  .home { font-size: 13px; text-decoration: none; }
  .name { font-weight: 700; }
  .spacer { margin-left: auto; }

  .tabs { display: flex; gap: 6px; flex-wrap: wrap; }
  .tabs button {
    font: inherit; font-size: 13px; cursor: pointer;
    padding: 6px 14px; border-radius: 99px;
    border: 1px solid var(--border);
    background: var(--surface-2); color: var(--text-muted);
  }
  .tabs button[aria-selected="true"] {
    background: var(--primary); color: var(--primary-text); border-color: var(--primary);
  }
  .tabs button:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

  .start { padding: 18px 20px; display: grid; gap: 10px; max-width: 420px; justify-items: start; }
  .start label { font-size: 13px; font-weight: 600; }
  .start input { width: 100%; }
  .start p { margin: 0; }

  @media (max-width: 720px) {
    .bar-in { padding: 8px 14px; }
    .tabs-bar { top: 43px; }
  }
</style>
