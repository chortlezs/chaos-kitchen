(() => {
  "use strict";

  const scenes = [
    { id: "coffee", name: "咖啡豆仓" },
    { id: "fridge", name: "冰封后厨" },
    { id: "toilet", name: "马桶水箱" },
    { id: "neon", name: "赛博办公室" }
  ];
  const foods = ["订书机", "老板公仔", "文件夹", "打印机", "键盘", "空调"];
  const marks = {
    hat: [
      ["#452115", 9, 5, 14, 21], ["#452115", 5, 8, 22, 12], ["#fff9ec", 7, 10, 18, 8],
      ["#fffdf6", 11, 7, 10, 15], ["#ecd3be", 10, 16, 12, 5], ["#ff7936", 11, 21, 10, 3]
    ],
    mystery: [
      ["#452115", 8, 4, 16, 4], ["#452115", 20, 8, 5, 7], ["#452115", 14, 14, 10, 4],
      ["#452115", 13, 17, 5, 5], ["#452115", 13, 25, 5, 5], ["#fff9ec", 8, 3, 16, 4],
      ["#fff9ec", 19, 7, 5, 7], ["#fff9ec", 13, 13, 10, 4], ["#fff9ec", 12, 16, 5, 5], ["#fff9ec", 12, 24, 5, 5]
    ],
    coffee: [
      ["#452115", 5, 5, 22, 15], ["#452115", 8, 18, 16, 6], ["#452115", 10, 23, 12, 6],
      ["#fbe0b6", 7, 7, 18, 3], ["#e99463", 7, 10, 18, 8], ["#b56332", 10, 18, 12, 4],
      ["#ffad65", 12, 23, 8, 4], ["#723a2c", 9, 13, 4, 3], ["#723a2c", 15, 14, 4, 3], ["#723a2c", 20, 11, 3, 4]
    ],
    fridge: [
      ["#29365c", 7, 3, 19, 26], ["#e1f6fb", 9, 5, 15, 22], ["#6da8d8", 10, 6, 12, 13],
      ["#b8eaff", 10, 6, 12, 3], ["#f0fbff", 12, 8, 3, 5], ["#f0fbff", 18, 8, 2, 4],
      ["#6493c5", 9, 20, 15, 2], ["#29365c", 20, 14, 2, 4], ["#29365c", 12, 23, 6, 2]
    ],
    toilet: [
      ["#283b63", 4, 8, 24, 15], ["#283b63", 9, 22, 15, 4], ["#eaf8ff", 6, 10, 20, 11],
      ["#64bff1", 7, 15, 18, 5], ["#a6dfff", 7, 15, 18, 2], ["#48769a", 9, 12, 11, 2],
      ["#ee5d51", 19, 12, 6, 5], ["#ff9d84", 20, 12, 3, 2], ["#adcbe4", 11, 22, 11, 2], ["#f9fdff", 7, 7, 17, 2]
    ],
    neon: [
      ["#332046", 4, 5, 24, 19], ["#a77cca", 6, 7, 20, 15], ["#56438a", 8, 9, 16, 11],
      ["#6fc984", 10, 11, 11, 7], ["#283557", 13, 12, 5, 5], ["#ffe092", 20, 12, 3, 1],
      ["#332046", 13, 24, 6, 3], ["#332046", 9, 27, 14, 2], ["#bfa1e4", 11, 27, 10, 1]
    ],
    0: [
      ["#452115", 4, 19, 24, 8], ["#452115", 7, 9, 20, 8], ["#452115", 10, 15, 13, 6],
      ["#f16c59", 9, 11, 16, 4], ["#ffa17b", 10, 10, 13, 2], ["#b9553e", 19, 14, 6, 6], ["#e76c50", 6, 21, 20, 4]
    ],
    1: [
      ["#452115", 7, 24, 18, 5], ["#452115", 12, 16, 8, 10], ["#452115", 7, 5, 18, 14],
      ["#db8a55", 9, 7, 14, 10], ["#ffcf93", 9, 10, 13, 6], ["#452115", 11, 11, 2, 2],
      ["#452115", 18, 11, 2, 2], ["#ef6944", 14, 20, 4, 5], ["#845052", 9, 25, 14, 2]
    ],
    2: [
      ["#452115", 5, 9, 22, 17], ["#452115", 7, 6, 11, 5], ["#d79330", 7, 9, 18, 15],
      ["#fff0ce", 10, 8, 13, 10], ["#e6cab0", 13, 11, 7, 2], ["#ffc75e", 7, 15, 18, 7], ["#ecad46", 7, 22, 18, 2]
    ],
    3: [
      ["#392544", 5, 13, 23, 11], ["#392544", 10, 4, 13, 10], ["#fff0de", 12, 6, 9, 8],
      ["#aa8ac0", 7, 15, 19, 4], ["#826299", 7, 19, 19, 3], ["#392544", 10, 20, 13, 8],
      ["#fff0de", 12, 20, 9, 6], ["#ec7043", 23, 16, 2, 2], ["#bc9f99", 14, 22, 5, 1]
    ],
    4: [
      ["#263f44", 4, 9, 24, 15], ["#83aa9b", 6, 11, 20, 11], ["#b6d6b6", 6, 11, 20, 2],
      ["#e8ebcc", 8, 13, 3, 2], ["#e8ebcc", 13, 13, 3, 2], ["#e8ebcc", 18, 13, 3, 2],
      ["#e8ebcc", 23, 13, 2, 2], ["#e8ebcc", 8, 17, 3, 2], ["#edaf6c", 13, 18, 10, 2]
    ],
    5: [
      ["#324263", 4, 8, 24, 14], ["#e3f3ef", 6, 10, 20, 9], ["#9cc9d8", 7, 16, 18, 3],
      ["#4a7793", 8, 17, 16, 1], ["#42a99b", 22, 12, 2, 1], ["#6bc5d7", 11, 23, 2, 4],
      ["#6bc5d7", 16, 24, 2, 5], ["#6bc5d7", 21, 23, 2, 4]
    ]
  };

  const emotions = [
    { id: "joy", label: "快乐", dish: 0, scene: "coffee", note: "咔哒一下，收好今天的小成就。" },
    { id: "sadness", label: "悲伤", dish: 2, scene: "fridge", note: "把暂时说不出口的心事，慢慢整理。" },
    { id: "anger", label: "愤怒", dish: 1, scene: "toilet", note: "把这股火气，交给今天的锅。" },
    { id: "fear", label: "恐惧", dish: 3, scene: "neon", note: "先从眼前的一步开始，把失控感拆开。" },
    { id: "surprise", label: "惊讶", dish: 4, scene: "neon", note: "给今天的意外，留一个特别的位置。" },
    { id: "disgust", label: "厌恶", dish: 5, scene: "toilet", note: "把那些不舒服，冲进今天的厨房。" }
  ];
  const examples = [
    ["终于做完了", "忙了一周的方案终于通过了，老板也表扬了我，好开心！"],
    ["有点憋火", "改了五版又让我重做，真的很生气，想把烦心事冲走。"],
    ["想安静一下", "准备了很久却没被看见，有点难过，想一个人安静一下。"]
  ];
  function drawMark(canvas, mark, theme) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (Number.isInteger(mark) && theme && window.KitchenItems) {
      window.KitchenItems.draw(ctx, theme, mark, canvas.width / 2, canvas.height / 2, .44);
      return;
    }
    for (const [color, x, y, width, height] of marks[mark]) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, width, height);
    }
  }


  function bind({ game, dishes, launch }) {
    const get = id => document.getElementById(id);
    const opening = get("kitchen-opening"), cover = get("opening-cover"), draw = get("opening-draw");
    const play = get("opening-play"), cook = get("opening-cook"), home = get("opening-home");
    const sceneCard = get("opening-scene"), dishCard = get("opening-dish"), result = get("opening-result");
    const question = get("chef-question"), answers = get("chef-answers");
    const decks = draw.querySelector(".opening-decks"), steps = draw.querySelectorAll(".opening-steps li");
    const worlds = draw.querySelectorAll("[data-world]"), readout = get("draw-readout");
    const form = get("mood-form"), description = get("mood-description"), submit = get("mood-submit");
    const status = get("mood-status"), editor = get("mood-editor"), adjustments = get("mood-adjustments");
    let scene = null, dish = null, recommendation = null, coverTransition = null, pending = null, revision = 0;
    drawMark(draw.querySelector(".draw-medallion canvas"), "hat");

    function showStep(active) {
      draw.dataset.step = active;
      steps.forEach((step, index) => index === active ? step.setAttribute("aria-current", "step") : step.removeAttribute("aria-current"));
    }
    function updateAtlas() {
      worlds.forEach(world => {
        world.dataset.state = world.dataset.world === (scene?.id ?? recommendation?.scene) ? "selected" : recommendation ? "dimmed" : "available";
      });
      draw.dataset.world = scene?.id ?? recommendation?.scene ?? "";
    }
    function renderCard(card, name, mark, theme) {
      const revealed = mark !== "mystery";
      card.dataset.skin = theme ?? (revealed ? mark : "");
      if (revealed && !card.hasAttribute("data-revealed") && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        card.animate?.([
          { transform: "perspective(550px) rotateY(-89deg) scale(.91)" },
          { transform: "perspective(550px) rotateY(8deg) scale(1.03)", offset: .74 },
          { transform: "perspective(550px) rotateY(0) scale(1)" }
        ], { duration: 440, easing: "cubic-bezier(.2,.75,.23,1)" });
      }
      card.toggleAttribute("data-revealed", revealed);
      card.setAttribute("aria-disabled", String(revealed || !recommendation));
      card.disabled = !recommendation;
      card.querySelector(".opening-card-name").textContent = name;
      drawMark(card.querySelector("canvas"), mark, theme);
    }
    function renderCards() {
      const chosenScene = scene?.id ?? recommendation?.scene;
      const name = dish === null ? null : dishes[chosenScene][dish].name;
      renderCard(sceneCard, scene?.name ?? (recommendation ? "翻开你的厨房" : "等待心情入锅"), scene?.id ?? "mystery");
      renderCard(dishCard, name ?? (recommendation ? "翻开你的菜品" : "今日菜品待揭晓"), dish ?? "mystery", chosenScene);
      decks.hidden = false;
      decks.dataset.reveals = Number(Boolean(scene)) + Number(dish !== null);
      cook.hidden = !recommendation;
      cook.disabled = !scene || dish === null;
      readout.hidden = !recommendation;
      readout.textContent = cook.disabled ? (!scene && dish === null ? "两张卡都翻开，就可以开锅啦。" : !scene ? "再翻开场景卡。" : "再翻开菜品卡。") : `${scene.name} · ${name}`;
      result.textContent = cook.disabled ? "" : `本局订单：${scene.name}，${name}`;
      updateAtlas();
    }
    function setBusy(busy) {
      draw.dataset.loading = String(busy);
      form.setAttribute("aria-busy", String(busy));
      description.disabled = busy;
      submit.disabled = busy;
      submit.textContent = busy ? "小厨师正在读懂你的心情…" : "把心情交给小厨师 →";
      for (const button of get("mood-examples").querySelectorAll("button")) button.disabled = busy;
    }
    function cancelRequest() {
      revision++;
      pending?.abort();
      pending = null;
      setBusy(false);
    }
    function clearRecommendation() {
      recommendation = null; scene = null; dish = null;
      adjustments.hidden = true;
      editor.hidden = true;
      get("mood-summary").textContent = "今天的心情，准备下锅。";
      get("mood-reason").textContent = "小厨师会配好厨房与菜品。翻开两张卡，再决定要不要开锅。";
      get("mood-source").textContent = "六种心情 · 四个厨房 · 你来确认";
      renderCards();
      showStep(0);
    }
    function applyRecommendation(data) {
      const emotion = emotions.find(item => item.id === data.emotion);
      if (!emotion || !scenes.some(item => item.id === data.scene)) throw new Error("订单还没配好，请再试一次。");
      recommendation = { ...data, dish: emotion.dish };
      scene = null; dish = null;
      question.textContent = data.reply;
      get("mood-summary").textContent = data.needs_clarification ? "这份心情，还想多听一点。" : `听起来，你有一点${emotion.label}。`;
      get("mood-reason").textContent = data.reason;
      get("mood-source").textContent = data.source === "deepseek" ? "DeepSeek 为这份心情配的菜 · 随时可以修改" : "按你的心情选择配菜 · 你最了解自己";
      get("mood-scene-select").value = data.scene;
      adjustments.hidden = false;
      editor.hidden = !data.needs_clarification;
      get("mood-correct").textContent = "心情不太对？";
      showStep(2);
      renderCards();
      if (window.matchMedia("(max-width: 800px)").matches) get("mood-ticket").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    function showManual() {
      cancelRequest();
      editor.hidden = false;
      question.textContent = "你自己的感受最重要。选一个最接近此刻的心情吧。";
      status.textContent = "手动选择同样可以开锅。";
      status.dataset.kind = "";
      showStep(1);
      answers.querySelector("button")?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 800px)").matches) editor.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    emotions.forEach(emotion => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.emotion = emotion.id;
      const icon = document.createElement("canvas"); icon.width = icon.height = 32;
      drawMark(icon, emotion.dish);
      const label = document.createElement("strong"); label.textContent = emotion.label;
      const ingredient = document.createElement("small"); ingredient.textContent = foods[emotion.dish];
      button.append(icon, label, ingredient);
      button.onclick = () => {
        applyRecommendation({ emotion: emotion.id, scene: recommendation?.scene ?? emotion.scene,
          reply: emotion.note, reason: "按你的选择配好这一份，厨房也可以换成你喜欢的。", source: "manual" });
        status.textContent = "已按你的选择更新订单。";
      };
      answers.append(button);
    });
    examples.forEach(([label, text]) => {
      const button = document.createElement("button");
      button.type = "button"; button.textContent = label;
      button.onclick = () => {
        clearRecommendation(); description.value = text;
        get("mood-count").textContent = `${text.length} / 600`;
        status.textContent = "可以改成自己的故事，再交给小厨师。";
        description.focus();
      };
      get("mood-examples").append(button);
    });
    description.oninput = () => {
      get("mood-count").textContent = `${description.value.length} / 600`;
      if (recommendation) clearRecommendation();
      status.textContent = "";
    };
    form.onsubmit = async event => {
      event.preventDefault();
      const text = description.value.trim();
      if (pending) return;
      if (text.length < 2 || text.length > 600) { status.textContent = "再多告诉小厨师一点，写 2–600 个字就好。"; return; }
      if (window.location.protocol === "file:") { status.textContent = "请使用本地游戏链接打开 AI 厨房，或先手动选择心情。"; return; }
      clearRecommendation();
      const ticket = ++revision, controller = new AbortController();
      pending = controller; setBusy(true); showStep(1);
      status.dataset.kind = "loading";
      status.textContent = "正在给今天的故事配一道菜…";
      question.textContent = "收到你的故事了，让我想想今天适合开什么锅。";
      const timeout = window.setTimeout(() => controller.abort(), 28000);
      try {
        const response = await window.fetch("/api/recommend", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }), signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (ticket !== revision) return;
        if (!response.ok) throw new Error(data.error || "AI 厨房暂时没回应，可以重试或自己选。请用新版启动入口打开游戏。");
        applyRecommendation(data);
        status.dataset.kind = "success";
        status.textContent = data.needs_clarification ? "小厨师还想听多一点，也可以直接在右侧选心情。" : "今日订单已配好，去翻开两张卡吧。";
      } catch (error) {
        if (ticket !== revision) return;
        status.dataset.kind = "error";
        status.textContent = error.name === "AbortError" ? "小厨师这次回应慢了，重试一下，或自己选择心情。" : error.message;
        question.textContent = "还没收到小厨师的订单。你的故事还在这里，可以再试一次。";
        editor.hidden = false;
        showStep(0);
      } finally {
        window.clearTimeout(timeout);
        if (ticket === revision) { pending = null; setBusy(false); }
      }
    };
    get("mood-manual").onclick = showManual;
    get("mood-correct").onclick = showManual;
    get("mood-scene-select").onchange = event => {
      if (!recommendation) return;
      recommendation.scene = event.target.value;
      scene = null;
      get("mood-source").textContent = "已换成你选择的厨房";
      get("mood-reason").textContent = "同一份心情，也可以换一个地方下锅。";
      renderCards();
    };
    function show(screen) {
      cancelRequest();
      window.KitchenAudio?.sync("cover", screen);
      opening.hidden = false; game.inert = true;
      cover.hidden = screen !== "cover"; draw.hidden = screen !== "draw";
      opening.dataset.page = screen; home.hidden = screen === "cover";
      document.title = screen === "cover" ? "CHAOS KITCHEN · AI 情绪厨房" : "说说今天 · AI 情绪厨房";
      opening.scrollTop = 0;
      const url = new URL(window.location.href);
      url.searchParams.delete("scene"); url.searchParams.delete("opening");
      window.history.replaceState(null, "", url.href);
      if (screen === "draw") {
        clearRecommendation();
        question.textContent = "今天，想把什么下锅？开心的、烦心的，我都听着。";
        status.textContent = ""; status.dataset.kind = "";
        description.focus({ preventScroll: true });
      } else {
        play.focus();
      }
    }
    function hide() { cancelRequest(); opening.hidden = true; game.inert = false; }
    home.onclick = () => { coverTransition?.cancel(); show("cover"); };
    opening.onkeydown = event => {
      if (event.key === "Escape" && !home.hidden) { event.stopPropagation(); home.onclick(); }
    };
    play.onclick = async () => {
      if (play.disabled) return;
      window.KitchenAudio?.unlock?.(); window.KitchenAudio?.cue("start", "cover");
      const art = get("cover-art");
      play.disabled = true; home.hidden = false; cover.classList.add("is-launching");
      try {
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && art.animate) {
          const { width, height } = art.getBoundingClientRect();
          const centered = `translate(${-width * .155}px, ${height * .08}px)`;
          const rush = art.animate([{ transform: "scale(1)" }, { transform: "scale(1.025)", offset: .22 },
            { transform: centered + " scale(2.2)", offset: .62 }, { transform: centered + " scale(5.5)", opacity: .15 }],
            { duration: 680, easing: "cubic-bezier(.45,0,.75,.6)", fill: "forwards" });
          coverTransition = rush;
          try { await rush.finished; } catch (error) { if (error.name === "AbortError") return; throw error; }
          finally { coverTransition = null; rush.cancel(); }
        }
        show("draw");
      } finally { cover.classList.remove("is-launching"); play.disabled = false; }
    };
    sceneCard.onclick = () => {
      if (!recommendation || scene) return;
      window.KitchenAudio?.cue("card", "cover");
      scene = scenes.find(item => item.id === recommendation.scene); renderCards();
    };
    dishCard.onclick = () => {
      if (!recommendation || dish !== null) return;
      window.KitchenAudio?.cue("card", "cover"); dish = recommendation.dish; renderCards();
    };
    cook.onclick = () => { if (!cook.disabled) { hide(); launch(scene.id, dish); } };
    return { show };
  }
  window.KitchenOpening = { bind };
})();
