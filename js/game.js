(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const elLevel = document.getElementById("level");
  const elMoney = document.getElementById("money");
  const elTarget = document.getElementById("target");
  const elTimer = document.getElementById("timer");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayMsg = document.getElementById("overlay-msg");
  const btnStart = document.getElementById("btn-start");
  const btnSound = document.getElementById("btn-sound");
  const btnHook = document.getElementById("btn-hook");

  const isTouchDevice =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    matchMedia("(pointer: coarse)").matches;

  const PIVOT = { x: W / 2, y: 72 };
  const ROPE_LEN = 70;
  const HOOK_SPEED = 6;
  const RETRACT_BASE = 5;
  const SWING_SPEED = 0.025;

  const ITEM_TYPES = {
    goldS: { radius: 14, value: 50, weight: 1, color: "#ffd700", label: "vàng nhỏ" },
    goldM: { radius: 22, value: 100, weight: 2, color: "#e8b923", label: "vàng vừa" },
    goldL: { radius: 32, value: 250, weight: 3.5, color: "#d4a017", label: "vàng lớn" },
    rock: { radius: 26, value: 11, weight: 4, color: "#6b6b6b", label: "đá" },
    diamond: { radius: 12, value: 600, weight: 0.8, color: "#7fdbff", label: "kim cương" },
    bag: { radius: 18, value: 0, weight: 1.5, color: "#8b4513", label: "túi bí ẩn", mystery: true },
  };

  const LEVELS = [
    { target: 650, time: 60 },
    { target: 1200, time: 55 },
    { target: 2000, time: 50 },
    { target: 3500, time: 50 },
    { target: 5000, time: 45 },
    { target: 7500, time: 45 },
    { target: 10000, time: 40 },
  ];

  let state = "menu";
  let level = 1;
  let money = 0;
  let timeLeft = 60;
  let items = [];
  let particles = [];

  let angle = 0;
  let swingDir = 1;
  let hookState = "swing";
  let ropeLen = ROPE_LEN;
  let grabbed = null;
  let lastTime = 0;
  let timerAccum = 0;
  let prevControlsKey = "";

  function getLevelConfig() {
    const idx = Math.min(level - 1, LEVELS.length - 1);
    const base = LEVELS[idx];
    if (level > LEVELS.length) {
      return {
        target: base.target + (level - LEVELS.length) * 2500,
        time: Math.max(35, base.time - (level - LEVELS.length)),
      };
    }
    return base;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function spawnItems() {
    items = [];
    const configs = [
      { type: "goldS", count: 6 },
      { type: "goldM", count: 4 },
      { type: "goldL", count: 2 },
      { type: "rock", count: 5 },
      { type: "diamond", count: 1 },
      { type: "bag", count: 2 },
    ];

    const placed = [];
    const minY = 180;
    const maxY = H - 50;

    function overlaps(x, y, r) {
      for (const p of placed) {
        const dx = x - p.x;
        const dy = y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < r + p.r + 8) return true;
      }
      return false;
    }

    for (const cfg of configs) {
      for (let i = 0; i < cfg.count; i++) {
        const def = ITEM_TYPES[cfg.type];
        let x, y, tries = 0;
        do {
          x = rand(60, W - 60);
          y = rand(minY, maxY);
          tries++;
        } while (overlaps(x, y, def.radius) && tries < 80);

        if (tries < 80) {
          const item = {
            type: cfg.type,
            x,
            y,
            radius: def.radius,
            value: def.value,
            weight: def.weight,
            color: def.color,
            mystery: def.mystery || false,
            resolved: false,
          };
          if (item.mystery) {
            item.value = [50, 100, 250, 500, 11][Math.floor(Math.random() * 5)];
          }
          items.push(item);
          placed.push({ x, y, r: def.radius });
        }
      }
    }
  }

  function hookTip() {
    return {
      x: PIVOT.x + Math.sin(angle) * ropeLen,
      y: PIVOT.y + Math.cos(angle) * ropeLen,
    };
  }

  function updateHUD() {
    const cfg = getLevelConfig();
    elLevel.textContent = level;
    elMoney.textContent = "$" + money;
    elTarget.textContent = "$" + cfg.target;
    elTimer.textContent = Math.ceil(timeLeft);
    elTimer.style.color = timeLeft <= 10 ? "#ff6b6b" : "#ffd700";
  }

  function getDefaultHint() {
    return isTouchDevice
      ? "Chạm màn hình hoặc bấm nút THẢ MÓC để hút vàng. Thu đủ tiền trước khi hết giờ!"
      : "Nhấn Space hoặc Click để thả móc. Thu thập đủ tiền trước khi hết giờ!";
  }

  function setPlayingLayout(active) {
    document.body.classList.toggle("is-playing", active);
  }

  function updateMobileControls() {
    const key = state + ":" + hookState;
    if (key === prevControlsKey) return;
    prevControlsKey = key;

    const canHook = state === "playing" && hookState === "swing";
    btnHook.disabled = !canHook;
    btnHook.classList.toggle("ready", canHook);
    setPlayingLayout(state === "playing");
  }

  function showOverlay(title, msg, btnText) {
    overlayTitle.textContent = title;
    overlayMsg.textContent = msg;
    btnStart.textContent = btnText;
    overlay.classList.remove("hidden");
    setPlayingLayout(false);
    updateMobileControls();
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
    updateMobileControls();
  }

  function startLevel() {
    const cfg = getLevelConfig();
    timeLeft = cfg.time;
    timerAccum = 0;
    hookState = "swing";
    ropeLen = ROPE_LEN;
    grabbed = null;
    angle = rand(-0.8, 0.8);
    spawnItems();
    particles = [];
    updateHUD();
    state = "playing";
    hideOverlay();
    Sound.startLevel();
  }

  function startGame() {
    level = 1;
    money = 0;
    startLevel();
  }

  function nextLevel() {
    level++;
    startLevel();
  }

  function endLevel(won) {
    state = won ? "levelComplete" : "gameOver";
    Sound.stopBgm();
    if (won) Sound.win();
    else Sound.lose();

    const cfg = getLevelConfig();
    if (won) {
      showOverlay(
        "Qua màn!",
        `Bạn kiếm được $${money}. Mục tiêu màn ${level}: $${cfg.target}. Sẵn sàng màn ${level + 1}?`,
        "Màn tiếp"
      );
    } else {
      showOverlay(
        "Thua rồi!",
        `Chỉ kiếm được $${money} / $${cfg.target}. Thử lại màn ${level} nhé!`,
        "Chơi lại"
      );
    }
  }

  function addParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x,
        y,
        vx: rand(-3, 3),
        vy: rand(-4, -1),
        life: rand(20, 40),
        color,
        size: rand(2, 5),
      });
    }
  }

  function tryGrab() {
    const tip = hookTip();
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      const dist = Math.hypot(tip.x - it.x, tip.y - it.y);
      if (dist < it.radius + 10) {
        grabbed = it;
        items.splice(i, 1);
        hookState = "retract";
        return;
      }
    }
    hookState = "retract";
  }

  function releaseGrabbed() {
    if (!grabbed) return;
    const tip = hookTip();
    money += grabbed.value;
    Sound.collect(grabbed.value);
    addParticles(tip.x, tip.y, grabbed.color, 12);
    if (grabbed.value >= 100) {
      addParticles(tip.x, tip.y, "#ffd700", 8);
    }
    grabbed = null;
    updateHUD();
  }

  function update(dt) {
    if (state !== "playing") return;

    timerAccum += dt;
    if (timerAccum >= 1000) {
      timerAccum -= 1000;
      timeLeft -= 1;
      updateHUD();
      if (timeLeft <= 10) {
        Sound.tick(timeLeft <= 5);
      }
      if (timeLeft <= 0) {
        const cfg = getLevelConfig();
        endLevel(money >= cfg.target);
        return;
      }
    }

    if (hookState === "swing") {
      angle += SWING_SPEED * swingDir;
      if (angle > 1.1) swingDir = -1;
      if (angle < -1.1) swingDir = 1;
    } else if (hookState === "extend") {
      ropeLen += HOOK_SPEED;
      const tip = hookTip();

      if (tip.y >= H - 10 || tip.x <= 5 || tip.x >= W - 5) {
        hookState = "retract";
        Sound.retractEmpty();
        return;
      }

      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        const dist = Math.hypot(tip.x - it.x, tip.y - it.y);
        if (dist < it.radius + 8) {
          grabbed = it;
          items.splice(i, 1);
          hookState = "retract";
          Sound.grab(it.type);
          return;
        }
      }
    } else if (hookState === "retract") {
      const speed = grabbed
        ? RETRACT_BASE / grabbed.weight
        : RETRACT_BASE * 1.8;
      ropeLen -= speed;

      if (grabbed) {
        const tip = hookTip();
        grabbed.x = tip.x;
        grabbed.y = tip.y + 8;
      }

      if (ropeLen <= ROPE_LEN) {
        ropeLen = ROPE_LEN;
        if (grabbed) releaseGrabbed();
        hookState = "swing";
        updateMobileControls();
      }
    }

    particles = particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life--;
      return p.life > 0;
    });
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, 140);
    sky.addColorStop(0, "#87ceeb");
    sky.addColorStop(1, "#c4a574");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, 140);

    ctx.fillStyle = "#5c4033";
    ctx.fillRect(0, 130, W, 20);

    const ground = ctx.createLinearGradient(0, 150, 0, H);
    ground.addColorStop(0, "#8b6914");
    ground.addColorStop(0.3, "#6b4423");
    ground.addColorStop(1, "#3d2817");
    ctx.fillStyle = ground;
    ctx.fillRect(0, 150, W, H - 150);

    for (let i = 0; i < 30; i++) {
      const sx = (i * 137) % W;
      const sy = 160 + ((i * 89) % (H - 180));
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.beginPath();
      ctx.ellipse(sx, sy, 20 + (i % 5) * 8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMiner() {
    const mx = PIVOT.x;
    const my = PIVOT.y - 30;

    ctx.fillStyle = "#4a3728";
    ctx.fillRect(mx - 28, my - 8, 56, 36);

    ctx.fillStyle = "#f4c2a0";
    ctx.beginPath();
    ctx.arc(mx, my - 18, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.moveTo(mx - 18, my - 28);
    ctx.lineTo(mx + 18, my - 28);
    ctx.lineTo(mx + 12, my - 42);
    ctx.lineTo(mx - 12, my - 42);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#b8860b";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#2d5016";
    ctx.fillRect(mx - 30, my + 20, 14, 22);
    ctx.fillRect(mx + 16, my + 20, 14, 22);
  }

  function drawRopeAndHook() {
    const tip = hookTip();

    ctx.strokeStyle = "#5c3d1e";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(PIVOT.x, PIVOT.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(-angle);

    ctx.fillStyle = "#888";
    ctx.fillRect(-14, -4, 28, 8);
    ctx.fillStyle = "#aaa";
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.lineTo(-20, 10);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -4);
    ctx.lineTo(20, 10);
    ctx.lineTo(8, 10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawItem(it) {
    if (it.type === "diamond") {
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.fillStyle = it.color;
      ctx.beginPath();
      ctx.moveTo(0, -it.radius);
      ctx.lineTo(it.radius * 0.7, 0);
      ctx.lineTo(0, it.radius);
      ctx.lineTo(-it.radius * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (it.type.startsWith("gold")) {
      const grad = ctx.createRadialGradient(
        it.x - it.radius * 0.3,
        it.y - it.radius * 0.3,
        2,
        it.x,
        it.y,
        it.radius
      );
      grad.addColorStop(0, "#fff8a8");
      grad.addColorStop(0.5, it.color);
      grad.addColorStop(1, "#8b6914");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(it.x, it.y, it.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#b8860b";
      ctx.lineWidth = 2;
      ctx.stroke();
      return;
    }

    if (it.type === "rock") {
      ctx.fillStyle = it.color;
      ctx.beginPath();
      ctx.ellipse(it.x, it.y, it.radius, it.radius * 0.75, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#555";
      ctx.beginPath();
      ctx.ellipse(it.x - 5, it.y - 3, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (it.type === "bag") {
      ctx.fillStyle = it.color;
      ctx.beginPath();
      ctx.ellipse(it.x, it.y + 4, it.radius, it.radius * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd700";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("?", it.x, it.y + 8);
      return;
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = p.life / 40;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    drawBackground();
    drawMiner();

    for (const it of items) drawItem(it);
    if (grabbed) drawItem(grabbed);

    drawRopeAndHook();
    drawParticles();

    if (state === "playing" && hookState === "swing" && !isTouchDevice) {
      ctx.fillStyle = "rgba(255,215,0,0.7)";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Nhấn Space / Click để thả móc", W / 2, H - 16);
    }
  }

  function loop(timestamp) {
    const dt = lastTime ? timestamp - lastTime : 16;
    lastTime = timestamp;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function onHookAction() {
    Sound.init();
    if (state === "playing" && hookState === "swing") {
      hookState = "extend";
      Sound.hookDrop();
      updateMobileControls();
    }
  }

  function updateSoundButton() {
    btnSound.textContent = Sound.isEnabled() ? "🔊" : "🔇";
    btnSound.classList.toggle("muted", !Sound.isEnabled());
  }

  let lastHookAt = 0;

  function onHookPointer(e) {
    if (e.cancelable) e.preventDefault();
    const now = Date.now();
    if (now - lastHookAt < 280) return;
    lastHookAt = now;
    onHookAction();
  }

  canvas.addEventListener("click", onHookPointer);
  canvas.addEventListener("touchend", onHookPointer, { passive: false });

  btnHook.addEventListener("click", (e) => {
    e.preventDefault();
    onHookPointer(e);
  });

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      onHookAction();
    }
    if (e.code === "KeyR" && state !== "playing") {
      if (state === "levelComplete") nextLevel();
      else if (state === "gameOver") startLevel();
      else startGame();
    }
  });

  function onStartClick(e) {
    if (e) e.preventDefault();
    Sound.init();
    if (state === "menu") startGame();
    else if (state === "levelComplete") nextLevel();
    else if (state === "gameOver") startLevel();
  }

  btnStart.addEventListener("click", onStartClick);
  btnStart.addEventListener("touchend", (e) => {
    e.preventDefault();
    onStartClick(e);
  }, { passive: false });

  btnSound.addEventListener("click", (e) => {
    e.preventDefault();
    Sound.init();
    Sound.toggle();
    updateSoundButton();
  });

  document.addEventListener("touchmove", (e) => {
    if (state === "playing" && e.target === canvas) {
      e.preventDefault();
    }
  }, { passive: false });

  updateSoundButton();
  updateHUD();
  showOverlay("Đào Vàng", getDefaultHint(), "Bắt đầu");
  requestAnimationFrame(loop);
})();
