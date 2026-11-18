/* ESP firmware emits one chop for a complete down/up cycle. Never synthesize E. */
(function (root) {
  "use strict";
  function create({ onChop, onStatus = () => {}, EventSourceImpl = root.EventSource,
    url = "http://127.0.0.1:8766/events" }) {
    let source = null;
    const seen = new Set();
    function disconnect() {
      const previous = source;
      source = null;
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
      stream.onerror = () => { if (source === stream) onStatus("retrying"); };
      stream.onmessage = message => {
        if (source !== stream) return;
        let packet;
        try { packet = JSON.parse(message.data); } catch (_) { return; }
        if (!packet || packet.type !== "motion" || packet.action !== "chop" ||
            packet.cycle !== "down_up" || !Number.isFinite(packet.t_ms) || packet.t_ms < 0) return;
        if (Number.isFinite(packet.sent_at_ms) && Date.now() - packet.sent_at_ms > 1500) return;
        // Keep recent IDs across SSE reconnects, menus and rounds. Drop, never queue.
        const id = packet.event_id != null ? String(packet.event_id) :
          `${packet.boot_id || "legacy"}:${packet.t_ms}`;
        if (seen.has(id)) return;
        seen.add(id);
        if (seen.size > 512) seen.delete(seen.values().next().value);
        onStatus("receiving");
        onChop(packet);
      };
    }
    return { connect, disconnect, get active() { return source !== null; } };
  }

  function bind({ button, status, onChop }) {
    const labels = {
      disconnected: "键盘 / 触屏可用", connecting: "正在连接本地网关…",
      waiting: "网关已连接 · 等待动作", receiving: "动作已收到 · 一下一上一刀",
      retrying: "连接中断 · 正在重试", unsupported: "浏览器不支持硬件连接",
      unavailable: "连接失败 · 请启动本地网关"
    };
    const client = create({ onChop, onStatus: state => {
      status.textContent = labels[state];
      button.textContent = ["disconnected", "unsupported", "unavailable"].includes(state) ? "连接 ESP" : "断开 ESP";
    } });
    button.onclick = () => client.active ? client.disconnect() : client.connect();
    root.addEventListener("pagehide", () => client.disconnect());
    if (new URLSearchParams(root.location.search).get("esp") === "1") client.connect();
    return client;
  }
  root.KitchenHardware = { create, bind };
})(window);
