/* ============================================================================
 * scripts/cdp.mjs — минимальный клиент Chrome DevTools Protocol.
 * Без зависимостей: в Node 22+ WebSocket глобальный.
 *
 * Два потребителя: scripts/check-site.mjs (дымовая проверка страниц) и
 * scripts/check-links.mjs (проверка ссылок настоящим браузером).
 *
 * Chrome поднимается ОТДЕЛЬНЫЙ — свой профиль и свой порт, чтобы не трогать
 * уже открытые окна:
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *     --headless=new --remote-debugging-port=9337 \
 *     --user-data-dir=/tmp/roadmap-check --no-first-run --disable-gpu
 * ========================================================================== */

export async function connect(port, { timeoutMs = 15000 } = {}) {
  const base = `http://127.0.0.1:${port}`;
  let target = null;
  const until = Date.now() + timeoutMs;
  while (Date.now() < until && !target) {
    try {
      const list = await (await fetch(`${base}/json/list`)).json();
      target = list.find((t) => t.type === "page");
      if (!target) {
        target = await (await fetch(`${base}/json/new?about:blank`, { method: "PUT" })).json();
      }
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (!target) throw new Error(`CDP на ${port} не отвечает`);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error("не удалось открыть WebSocket к CDP"));
  });

  let id = 0;
  const pending = new Map();
  const events = [];
  // Подписчики нужны там, где событие надо поймать по ходу, а не разбирать
  // журнал потом: check-links ловит код ответа основного документа.
  const listeners = new Set();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
    } else if (msg.method) {
      events.push(msg);
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
      }, 30000);
    });

  return {
    send,
    events,
    on: (fn) => listeners.add(fn),
    off: (fn) => listeners.delete(fn),
    close: () => ws.close(),
    targetId: target.id
  };
}

export async function evalJs(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  }
  return r.result.value;
}

export async function goto(cdp, url, { settleMs = 700 } = {}) {
  // Переход на ТОТ ЖЕ адрес Chrome переходом не считает: документ не
  // перезагружается, и в памяти остаётся прежний CSS. Проверка тогда показывает
  // прошлый прогон — только что исправленное «остаётся» сломанным.
  const here = await evalJs(cdp, "location.href").catch(() => null);
  if (here === url) {
    await cdp.send("Page.reload", { ignoreCache: true });
  } else {
    await cdp.send("Page.navigate", { url });
  }
  // Ждём загрузки, но с потолком: подвисшая страница не должна вешать проверку.
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 120));
    const state = await evalJs(cdp, "document.readyState").catch(() => null);
    if (state === "complete") break;
  }
  await new Promise((r) => setTimeout(r, settleMs));
}

export function errorsSince(cdp, offset) {
  return cdp.events
    .slice(offset)
    .filter((e) => e.method === "Log.entryAdded" && e.params.entry.level === "error")
    .map((e) => e.params.entry.text.slice(0, 160));
}

export async function shot(cdp, path, { width = 1440, height = 900 } = {}) {
  const fs = await import("node:fs/promises");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 1, mobile: false
  });
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  await fs.writeFile(path, Buffer.from(data, "base64"));
}
