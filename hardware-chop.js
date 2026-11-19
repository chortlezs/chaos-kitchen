/* Semantic hardware input: one-cycle chop, short-lived stirring, single flip. */
(function (root) {
  "use strict";
  function create({ onChop = () => {}, onStir = () => false, onFlip = () => {}, onPlate = () => false, onStatus = () => {},
    clock = () => root.performance ? root.performance.now() : Date.now(), EventSourceImpl = root.EventSource,
    url = "http://127.0.0.1:8766/events" }) {
    let source = null;
    let stirUntil = 0;
    let plateState = null;
    let plateUntil = 0;
    const seen = new Set();
    function clearStir() { stirUntil = 0; }
    function clearPlate() { plateState = null; plateUntil = 0; }
    function disconnect() {
      const previous = source;
      source = null;
      clearStir();
      clearPlate();
      if (previous) previous.close();
      onStatus("disconnected");
    }
    function connect() {
      if (source) return;
      if (!EventSourceImpl) { onStatus("unsupported"); return; }
      onStatus("connecting");
      let stream;
      try { stream = new EventSourceImpl(url); }
      catch (_) { onStatus("unavailable"); return; }
      source = stream;
      stream.onopen = () => { if (source === stream) onStatus("waiting"); };
      stream.onerror = () => { if (source === stream) { clearStir(); onStatus("retrying"); } };
      stream.onmessage = message => {
        if (source !== stream) return;
        let packet;
        try { packet = JSON.parse(message.data); } catch (_) { return; }
        if (!packet || packet.type !== "motion" || !Number.isFinite(packet.t_ms) || packet.t_ms < 0) return;
        const chop = packet.action === "chop" && packet.cycle === "down_up";
        const stir = packet.action === "wok" && packet.motion === "circle" && typeof packet.active === "boolean";
        const flip = packet.action === "flip" && packet.motion === "vertical";
        const plate = packet.action === "plate" && packet.motion === "tilt" && Number.isFinite(packet.roll);
        if (!chop && !stir && !flip && !plate) return;
        if (Number.isFinite(packet.sent_at_ms) && Date.now() - packet.sent_at_ms > 1500) return;
        // Keep recent IDs across SSE reconnects, menus and rounds. Drop, never queue.
        const id = packet.event_id != null ? String(packet.event_id) :
          `${packet.boot_id || "legacy"}:${packet.action}:${packet.t_ms}`;
        if (seen.has(id)) return;
        seen.add(id);
        if (seen.size > 512) seen.delete(seen.values().next().value);
        if (chop) { onStatus("receiving"); onChop(packet); }
        if (stir) {
          const accepted = onStir(packet);
          stirUntil = packet.active && accepted === true ? clock() + 350 : 0;
          onStatus(packet.active && accepted === true ? "stirring" : "stopped");
        }
        if (flip) { clearStir(); onStatus("flip"); onFlip(packet); }
        if (plate) {
          const accepted = onPlate(packet);
          plateState = accepted === true ? packet : null;
          plateUntil = accepted === true ? clock() + 250 : 0;
          if (accepted === true) onStatus("plate");
        }
      };
    }
    return { connect, disconnect, clearStir, clearPlate,
      stirring: () => source !== null && clock() < stirUntil,
      plate: () => source !== null && plateState && clock() < plateUntil ? plateState : null,
      get active() { return source !== null; } };
  }

  function bind({ button, status, onChop, onStir, onFlip, onPlate }) {
    const labels = {
      disconnected: "键盘 / 触屏可用", connecting: "正在连接本地网关…",
      waiting: "网关已连接 · 等待动作", receiving: "动作已收到 · 一下一上一刀",
      stirring: "画圈翻炒中 · 停止即松开 E", stopped: "翻炒已停止 · 继续画圈",
      flip: "上颠已收到 · 翻面一次",
      plate: "盘面修正已收到",
      retrying: "连接中断 · 正在重试", unsupported: "浏览器不支持硬件连接",
      unavailable: "连接失败 · 请启动本地网关"
    };
    const client = create({ onChop, onStir, onFlip, onPlate, onStatus: state => {
      status.textContent = labels[state];
      button.textContent = ["disconnected", "unsupported", "unavailable"].includes(state) ? "连接 ESP" : "断开 ESP";
    } });
    button.onclick = () => client.active ? client.disconnect() : client.connect();
    root.addEventListener("pagehide", () => client.disconnect());
    root.addEventListener("blur", () => { client.clearStir(); client.clearPlate(); });
    if (new URLSearchParams(root.location.search).get("esp") === "1") client.connect();
    return client;
  }
  root.KitchenHardware = { create, bind };
})(window);
