/* ============================================================================
 * scripts/check-links.mjs — проверка ссылок НАСТОЯЩИМ браузером.
 *
 * Зачем не curl и не fetch: они врут в обе стороны. Khan Academy отдаёт 200 на
 * несуществующий слаг (страница-заглушка рисуется на клиенте), Cloudflare
 * отдаёт 403 живым страницам, а часть хостов просто не отвечает не-браузеру.
 * Правило проекта «каждая ссылка реально открыта» иначе не выполнить.
 *
 * Запуск (Chrome должен быть уже поднят с --remote-debugging-port):
 *   node scripts/check-links.mjs urls.json --port 9337
 *
 * urls.json — массив строк или массив объектов с полем url.
 * На выходе — JSON-отчёт в stdout и человекочитаемая сводка в stderr.
 * ========================================================================== */

import fs from "node:fs";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const port = Number((args.find((a) => a.startsWith("--port")) || "--port=9337").split(/[= ]/)[1]) || 9337;
if (!file) {
  console.error("нужен файл со списком ссылок: node scripts/check-links.mjs urls.json [--port 9337]");
  process.exit(2);
}

const raw = JSON.parse(fs.readFileSync(file, "utf8"));
const urls = raw.map((x) => (typeof x === "string" ? x : x.url));

/* ------------------------------------------------------------------- CDP --- */

async function connect() {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target =
    list.find((t) => t.type === "page") ||
    (await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json());

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error(`CDP на ${port} не отвечает`));
  });

  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
    } else if (msg.method) {
      for (const fn of listeners) fn(msg);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const mid = ++id;
      pending.set(mid, { res, rej });
      ws.send(JSON.stringify({ id: mid, method, params }));
      setTimeout(() => {
        if (pending.has(mid)) { pending.delete(mid); rej(new Error(`таймаут ${method}`)); }
      }, 45000);
    });
  return { send, on: (fn) => listeners.add(fn), off: (fn) => listeners.delete(fn), close: () => ws.close() };
}

const cdp = await connect();
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Network.enable");

const evalJs = async (expression) => {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};

/** Признаки «страница открылась, но её нет» — их не видно по коду ответа. */
const NOT_FOUND = /\b(404|page not found|страница не найдена|not found|no longer exists|doesn'?t exist)\b/i;

async function check(url) {
  let status = null;
  let mime = null;
  const onResponse = (msg) => {
    // Интересует только основной документ: коды картинок и аналитики не в счёт.
    if (msg.method === "Network.responseReceived" && msg.params.type === "Document" && status === null) {
      status = msg.params.response.status;
      mime = msg.params.response.mimeType;
    }
  };
  cdp.on(onResponse);
  try {
    await cdp.send("Page.navigate", { url });
    const until = Date.now() + 25000;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, 200));
      const state = await evalJs("document.readyState").catch(() => null);
      if (state === "complete") break;
    }
    // PDF и прочие не-HTML документы DOM не отдают — судим по коду ответа.
    if (mime && !/html/.test(mime)) {
      return { url, status, mime, finalUrl: url, title: `(${mime})`, ok: status >= 200 && status < 400 };
    }
    await new Promise((r) => setTimeout(r, 900));
    const info = await evalJs(`({
      finalUrl: location.href,
      title: (document.title || "").trim().slice(0, 120),
      h1: (document.querySelector("h1")?.textContent || "").trim().slice(0, 120),
      text: (document.body?.innerText || "").trim().length
    })`);
    const looksMissing = NOT_FOUND.test(info.title) || NOT_FOUND.test(info.h1);
    return {
      url,
      status,
      mime,
      finalUrl: info.finalUrl,
      title: info.title,
      h1: info.h1,
      chars: info.text,
      redirected: info.finalUrl.replace(/\/$/, "") !== url.replace(/\/$/, ""),
      ok: status !== null && status >= 200 && status < 400 && !looksMissing && info.text > 200,
      why: looksMissing ? "текст страницы говорит «не найдено»"
        : info.text <= 200 ? "страница почти пустая"
        : status >= 400 ? `код ${status}` : null
    };
  } catch (err) {
    return { url, status, ok: false, why: err.message.slice(0, 120) };
  } finally {
    cdp.off(onResponse);
  }
}

const out = [];
for (const [i, url] of urls.entries()) {
  const r = await check(url);
  out.push(r);
  const mark = r.ok ? "✓" : "✗";
  process.stderr.write(
    `${mark} [${String(i + 1).padStart(3)}/${urls.length}] ${String(r.status ?? "—").padStart(3)} ${url}\n` +
    (r.redirected ? `      → ${r.finalUrl}\n` : "") +
    (r.ok ? "" : `      ${r.why || "не открылась"}\n`)
  );
}

const dead = out.filter((r) => !r.ok);
process.stderr.write(`\nживых ${out.length - dead.length} из ${out.length}\n`);
if (dead.length) process.stderr.write("не прошли:\n" + dead.map((r) => `  ${r.url} — ${r.why}`).join("\n") + "\n");
console.log(JSON.stringify(out, null, 2));
cdp.close();
