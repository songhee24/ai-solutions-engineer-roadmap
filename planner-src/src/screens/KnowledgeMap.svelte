<script>
  /* Экран «Карта знаний»: вся программа целиком с закраской по мере прохождения.
     Геометрию считает lib/map-layout.js — здесь только разметка. */
  import { buildMapLayout } from "../lib/map-layout.js";
  import { ruNum, hoursNum } from "../lib/format.js";

  let { data, progress, summary, profile } = $props();

  let map = $derived(buildMapLayout(data, progress, profile));
</script>

<h1>Карта знаний</h1>
<p class="lede">Хребет — этапы по порядку. Сверху и снизу параллельные рельсы: математика и
  английский идут одновременно с этапами, а не после них. Пунктиром — дополнительные треки,
  они вне общего срока. Пройденное закрашено, непройденное намеренно бледное.</p>

<div class="card map-card">
  <svg class="map" viewBox="0 0 {map.width} {map.height}" width="100%" role="img"
       aria-label="Карта всех тем: этапы, параллельные треки и дополнительные ветки">

    {#each map.rails as rail (rail.id)}
      <rect class="rail {rail.kind}" x={rail.x} y={rail.y} width={rail.w} height={rail.h} rx={rail.rx} />
      <clipPath id={rail.clipId}>
        <rect x={rail.x} y={rail.y} width={rail.w} height={rail.h} rx={rail.rx} />
      </clipPath>
      {#if rail.doneW > 0}
        <rect class="rail-done" x={rail.x} y={rail.y} width={rail.doneW} height={rail.h}
              clip-path="url(#{rail.clipId})" />
      {/if}
      {#each rail.dots as dot (dot.id)}
        <circle class="topic" class:done={dot.done} cx={dot.cx} cy={dot.cy} r={dot.r}>
          <title>{dot.title}</title>
        </circle>
      {/each}
      <text class="rail-label" x={rail.labelX} y={rail.labelY}>
        {rail.label} — <tspan class="rail-strong">{rail.labelStrong}</tspan> · {rail.labelTail}
      </text>
    {/each}

    {#each map.links as link, i (i)}
      <line class="link" class:done={link.done} x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2} />
    {/each}

    {#each map.nodes as node (node.id)}
      <g class="node {node.state}" transform="translate({node.cx},{node.cy})">
        <circle class="ring" r={node.r} />
        <circle class="prog" r={node.r} stroke-dasharray={node.dash} />
        <text class="num" y="7">{node.num}</text>
        <title>{node.hint}</title>
      </g>
      {#each node.lines as line, i (i)}
        <text class="node-label" x={node.cx} y={node.lineY[i]}>{line}</text>
      {/each}
      <text class="node-hrs" x={node.cx} y={node.subY}>{node.sub}</text>
    {/each}

    {#if map.here}
      <g class="here" transform="translate({map.here.x},{map.here.y})">
        <rect x="-42" y="-19" width="84" height="24" rx="12" />
        <text y="-2">вы здесь</text>
        <path d="M -6 5 L 6 5 L 0 13 Z" />
      </g>
    {/if}

    <text class="rail-label" x={map.optionalLabel.x} y={map.optionalLabel.y}>{map.optionalLabel.text}</text>
    {#each map.optional as chip (chip.id)}
      <g class="opt-chip" transform="translate({chip.x},{chip.y})">
        <rect width={chip.w} height={chip.h} rx={chip.h / 2} />
        <circle class="topic opt" cx="21" cy={chip.h / 2} r="8" />
        <text class="opt-label" x="38" y={chip.h / 2 + 5}>{chip.label}</text>
      </g>
    {/each}
  </svg>

  <div class="legend">
    <span><i class="done"></i>пройдено</span>
    <span><i class="todo"></i>впереди</span>
    <span><i class="cur"></i>текущий этап</span>
    <span><i class="opt"></i>дополнительно, вне срока</span>
  </div>
</div>

<h2>По направлениям</h2>
<div class="card pad">
  <div class="tracks">
    {#each map.tracks as track (track.id)}
      <div class="trow">
        <span>{track.title}</span>
        <div class="bar"><i style="width:{track.percent}%"></i></div>
        <span class="n mono">{hoursNum(track.doneH)} / {hoursNum(track.totalH)} ч</span>
      </div>
    {/each}
  </div>
  <p class="foot"><small>Полосы, а не радар: пока большинство направлений на нуле, радар
    вырождается в одну колючку и врёт сильнее, чем помогает. Пройдено
    {hoursNum(summary.doneHours)} из {hoursNum(summary.totalHours)} часов основного пути.</small></p>
</div>

<style>
  .map-card { padding: 14px; overflow-x: auto; }
  svg.map { display: block; min-width: 1120px; }

  .map :global(.rail) { fill: var(--surface-2); stroke: var(--border); }
  .map :global(.rail.math) { fill: color-mix(in srgb, var(--s-math) 8%, var(--surface-2));
                             stroke: color-mix(in srgb, var(--s-math) 28%, var(--border)); }
  .map :global(.rail.eng)  { fill: color-mix(in srgb, var(--s-english) 8%, var(--surface-2));
                             stroke: color-mix(in srgb, var(--s-english) 28%, var(--border)); }
  .map :global(.rail-done) { fill: color-mix(in srgb, var(--ok) 22%, transparent); }
  .map :global(.rail-label) { fill: var(--text-muted); font-size: 12px; font-family: var(--font); }
  .map :global(.rail-strong) { fill: var(--text); font-weight: 700; }

  /* Пройденное — заметно, непройденное — намеренно бледное: россыпь одинаковых
     точек читалась как «всё уже сделано». */
  .map :global(.topic) { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; }
  .map :global(.topic.done) { fill: var(--ok); stroke: var(--ok); }
  .map :global(.topic.opt) { fill: var(--surface); stroke: var(--warn); stroke-dasharray: 3 3; }

  .map :global(.link) { stroke: var(--border); stroke-width: 3; fill: none; }
  .map :global(.link.done) { stroke: var(--ok); }

  .map :global(.node .ring) { fill: var(--surface); stroke: var(--border); stroke-width: 3; }
  .map :global(.node .prog) { fill: none; stroke: var(--ok); stroke-width: 4; transform: rotate(-90deg); }
  .map :global(.node.done .ring) { stroke: var(--ok); }
  .map :global(.node.current .ring) { stroke: var(--primary); stroke-width: 4; }
  .map :global(.node .num) { fill: var(--text); font-size: 20px; font-weight: 700;
                             text-anchor: middle; font-family: var(--font); }
  .map :global(.node:not(.done):not(.current) .num) { fill: var(--text-faint); }
  .map :global(.node-label) { fill: var(--text); font-size: 12px; text-anchor: middle; font-family: var(--font); }
  .map :global(.node-hrs) { fill: var(--text-faint); font-size: 11px; text-anchor: middle; font-family: var(--font); }
  .map :global(.opt-label) { fill: var(--text-muted); font-size: 12.5px; font-family: var(--font); }
  .map :global(.opt-chip rect) { fill: var(--surface-2); stroke: var(--warn); stroke-dasharray: 4 3; }

  .map :global(.here rect) { fill: var(--primary); }
  .map :global(.here text) { fill: var(--primary-text); font-size: 11px; font-weight: 700;
                             text-anchor: middle; font-family: var(--font); }
  .map :global(.here path) { fill: var(--primary); }

  .legend { display: flex; align-items: center; gap: 14px; font-size: 12px;
            color: var(--text-muted); margin-top: 10px; flex-wrap: wrap; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .legend i { width: 13px; height: 13px; border-radius: 3px; display: inline-block; }
  .legend i.done { background: var(--ok); }
  .legend i.todo { background: var(--surface); box-shadow: inset 0 0 0 1.5px var(--border); }
  .legend i.cur  { background: var(--surface); box-shadow: inset 0 0 0 2px var(--primary); }
  .legend i.opt  { background: var(--surface); box-shadow: inset 0 0 0 2px var(--warn); }

  .pad { padding: 16px 18px; }
  .tracks { display: grid; gap: 8px; }
  .trow { display: grid; grid-template-columns: 130px 1fr 100px; gap: 12px; align-items: center; font-size: 13px; }
  .trow .bar { height: 16px; border-radius: 4px; background: var(--bg-soft); overflow: hidden; }
  .trow .bar > i { display: block; height: 100%; background: var(--primary); }
  .trow .n { text-align: right; color: var(--text-muted); }
  .foot { margin: 14px 0 0; }

  @media (max-width: 560px) {
    .trow { grid-template-columns: 110px 1fr 86px; gap: 8px; font-size: 12px; }
  }
</style>
