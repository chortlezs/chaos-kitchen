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
  const moods = [
    { label: "困得睁不开眼", scenes: ["coffee", "neon"], reply: "豆仓里咖啡正香，隔壁工位的屏幕也还亮着。" },
    { label: "热到冒烟", scenes: ["fridge", "toilet"], reply: "我翻出了两张凉快的厨房卡，一张带霜，一张带水。" },
    { label: "今天想摸鱼", scenes: ["neon", "fridge"], reply: "主机在休眠，冰柜在冻货。两处都能偷偷开火。" },
    { label: "有点烦", scenes: ["toilet", "coffee"], reply: "烦心事可以冲走，也可以丢进豆仓磨碎。" }
  ];
  const cravings = [
    { label: "咔嚓脆的", reply: "好，来点咔嚓响的！", dishes: [0, 4] },
    { label: "一层一层的", reply: "给你留两份千层的。", dishes: [2, 3] },
    { label: "来点火气", reply: "锅已经烧热了！", dishes: [1, 5] },
    { label: "冰凉清爽", reply: "收到，给这锅降降温。", dishes: [5, 2] }
  ];

  // A future dialogue provider can return the same scene and dish IDs.
  function recommendCards(mood, craving) {
    return { scenes: scenes.filter(scene => mood.scenes.includes(scene.id)), dishes: craving.dishes };
  }

  function sample(options) {
    return options[Math.floor(Math.random() * options.length)];
  }

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

  function bind({ game, dishes, launch, openManual }) {
    const get = id => document.getElementById(id);
    const opening = get("kitchen-opening");
    const cover = get("opening-cover");
    const draw = get("opening-draw");
    const play = get("opening-play");
    const cook = get("opening-cook");
    const sceneCard = get("opening-scene");
    const dishCard = get("opening-dish");
    const result = get("opening-result");
    let scene = null;
    let dish = null;

    const question = get("chef-question");
    const answers = get("chef-answers");
    const decks = draw.querySelector(".opening-decks");
    const steps = draw.querySelectorAll(".opening-steps li");
    const home = get("opening-home");
    let pool = null;
    let coverTransition = null;
    drawMark(draw.querySelector(".draw-medallion canvas"), "hat");
    const worlds = draw.querySelectorAll("[data-world]");
    const readout = get("draw-readout");
    function updateAtlas(){
      worlds.forEach(world => {
        const id = world.dataset.world;
        world.dataset.state = id === scene?.id ? "selected" :
          !pool || (!scene && pool.scenes.some(option => option.id === id)) ? "available" : "dimmed";
      });
      draw.dataset.world = scene?.id ?? "";
    }

    function showStep(activeStep) {
      draw.dataset.step = activeStep;
      steps.forEach((step, index) => {
        if (index === activeStep) step.setAttribute("aria-current", "step");
        else step.removeAttribute("aria-current");
      });
    }

    function ask(line, choices, respond) {
      question.textContent = line;
      answers.hidden = false;
      answers.replaceChildren(...choices.map(choice => {
        const button = document.createElement("button");
        button.type = "button";
        const title = document.createElement("strong");
        title.textContent = choice.label;
        const icons = document.createElement("span");
        icons.className = "draw-option-icons";
        icons.setAttribute("aria-hidden", "true");
        for (const value of choice.scenes ?? choice.dishes) {
          const icon = document.createElement("canvas");
          icon.width = icon.height = 32;
          drawMark(icon,value);
          icons.append(icon);
        }
        button.append(icons,title);
        if (choice.scenes) {
          const destinations = document.createElement("small");
          destinations.textContent = choice.scenes.map(id => scenes.find(scene => scene.id === id).name).join(" / ");
          button.append(destinations);
        }
        button.onclick = () => {
          window.KitchenAudio?.cue("select","cover");
          respond(choice);
        };
        return button;
      }));
      question.focus({ preventScroll: true });
    }

    function beginConversation() {
      pool = null;
      scene = null;
      dish = null;
      decks.hidden = true;
      cook.hidden = true;
      cook.disabled = true;
      result.textContent = "";
      readout.hidden = true;
      updateAtlas();
      showStep(0);
      ask("开锅啦！今天想吃什么口感？", cravings, craving => {
        showStep(1);
        ask(craving.reply + " 今天上班什么状态？", moods, mood => {
          pool = recommendCards(mood, craving);
          answers.hidden = true;
          decks.hidden = false;
          cook.hidden = false;
          showStep(2);
          question.textContent = mood.reply + " 两叠各翻一张吧！";
          renderCards();
          sceneCard.focus({ preventScroll: true });
        });
      });
    }

    function renderCard(card, name, mark, theme) {
      const revealed = mark !== "mystery";
      card.dataset.skin = theme ?? (revealed ? mark : "");
      if (revealed && !card.hasAttribute("data-revealed") &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        card.animate?.([
          { transform: "perspective(550px) rotateY(-89deg) scale(.91)", filter: "brightness(1.75)" },
          { transform: "perspective(550px) rotateY(12deg) scale(1.045)", offset: .74 },
          { transform: "perspective(550px) rotateY(0) scale(1)" }
        ], { duration: 440, easing: "cubic-bezier(.2,.75,.23,1)" });
      }
      card.toggleAttribute("data-revealed", revealed);
      card.setAttribute("aria-disabled", String(revealed));
      card.querySelector(".opening-card-name").textContent = name;
      drawMark(card.querySelector("canvas"), mark, theme);
    }

    function renderCards() {
      const dishName = dish === null ? null : scene ? dishes[scene.id][dish].name : foods[dish];
      renderCard(sceneCard, scene?.name ?? pool.scenes.map(option => option.name).join(" / "), scene?.id ?? "mystery");
      renderCard(dishCard, dishName ?? pool.dishes.map(id => foods[id]).join(" / "), dish ?? "mystery", scene?.id ?? pool.scenes[0].id);
      cook.disabled = !scene || dish === null;
      decks.dataset.reveals = Number(Boolean(scene)) + Number(dish !== null);
      updateAtlas();
      readout.hidden = false;
      readout.textContent = cook.disabled ? (scene ? "再翻菜品卡" : dish !== null ? "再翻场景卡" : "翻开两张卡，确定本局的厨房和菜品") :
        `${scene.name} · ${dishName}`;
      if (!cook.disabled) question.textContent = "走，去" + scene.name + "做「" + dishName + "」！";
      result.textContent = [scene?.name, dishName].filter(Boolean).join(" · ");
    }

    function show(screen) {
      window.KitchenAudio?.sync("cover",screen);
      opening.hidden = false;
      game.inert = true;
      cover.hidden = screen !== "cover";
      draw.hidden = screen !== "draw";
      opening.dataset.page = screen;
      home.hidden = screen === "cover";
      document.title = screen === "cover" ? "CHAOS KITCHEN" : "CHAOS KITCHEN · 抽卡";
      opening.scrollTop = 0;
      if (screen === "draw") {
        beginConversation();
      } else {
        const url = new URL(window.location.href);
        if (url.searchParams.has("scene")) {
          url.searchParams.delete("scene");
          window.history.replaceState(null, "", url.href);
        }
        play.focus();
      }
    }

    function hide() {
      opening.hidden = true;
      game.inert = false;
    }

    function exitOpening() {
      coverTransition?.cancel();
      show("cover");
    }
    home.onclick = exitOpening;
    opening.onkeydown = event => {
      if (event.key === "Escape" && !home.hidden) {
        event.stopPropagation();
        exitOpening();
      }
    };
    play.onclick = async () => {
      if (play.disabled) return;
      window.KitchenAudio?.unlock?.();
      window.KitchenAudio?.cue("start","cover");
      const manual = get("opening-manual");
      const art = get("cover-art");
      play.disabled = manual.disabled = true;
      home.hidden = false;
      cover.classList.add("is-launching");
      try {
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && art.animate) {
          const { width, height } = art.getBoundingClientRect();
          const dx = -.155 * width;
          const dy = .08 * height;
          const centered = `translate(${dx}px, ${dy}px)`;
          const rush = art.animate([
            { transform: "scale(1)" },
            { transform: "scale(1.025)", offset: .22 },
            { transform: centered + " scale(2.2)", offset: .62 },
            { transform: centered + " scale(5.5)", opacity: .15 }
          ], { duration: 680, easing: "cubic-bezier(.45,0,.75,.6)", fill: "forwards" });
          coverTransition = rush;
          try {
            await rush.finished;
          } catch (error) {
            if (error.name === "AbortError") return;
            throw error;
          } finally {
            coverTransition = null;
            rush.cancel();
          }
        }
        show("draw");
      } finally {
        cover.classList.remove("is-launching");
        play.disabled = manual.disabled = false;
        if (!cover.hidden) play.focus();
      }
    };
    get("opening-manual").onclick = () => {
      window.KitchenAudio?.cue("select","cover");
      hide();
      openManual();
      get("start").focus();
    };
    sceneCard.onclick = () => {
      if (scene) return;
      window.KitchenAudio?.cue("card","cover");
      scene = sample(pool.scenes);
      renderCards();
    };
    dishCard.onclick = () => {
      if (dish !== null) return;
      window.KitchenAudio?.cue("card","cover");
      dish = sample(pool.dishes);
      renderCards();
    };
    cook.onclick = () => {
      if (cook.disabled) return;
      hide();
      launch(scene.id, dish);
    };

    return { show };
  }

  window.KitchenOpening = { bind };
})();
