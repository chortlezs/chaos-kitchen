(() => {
  "use strict";
  function bind(board, getOrder) {
    const stage = board.parentElement;
    const ambience = stage.querySelector(".stage-ambience").getContext("2d");
    const order = stage.querySelector(".pocket-order");
    let nextUpdate = 0;
    return function update(ms) {
      if (ms < nextUpdate || stage.inert || board.hidden) return;
      nextUpdate = ms + 180;
      ambience.drawImage(board, 0, 0, ambience.canvas.width, ambience.canvas.height);
      const text = getOrder();
      if (order.textContent !== text) order.textContent = text;
    };
  }
  window.KitchenViewport = { bind };
})();
