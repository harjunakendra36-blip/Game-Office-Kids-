/**
 * =============================================================================
 * MINI GAME — Office Chair Racing 🏁
 * Isolated namespace: MiniGame
 * Canvas 2D + custom physics (no external dependencies)
 * Integrates with main Office Kids gameState for coin persistence.
 * =============================================================================
 */

const MiniGame = (() => {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────────────────────
  const GRAVITY       = 0.55;
  const ACCEL         = 0.55;
  const BRAKE_FORCE   = 0.42;
  const MAX_SPEED     = 11;
  const FRICTION      = 0.978;
  const TILT_TORQUE   = 0.045;
  const TILT_DAMP     = 0.88;
  const ENERGY_DRAIN  = 0.014;  // per frame
  const COFFEE_REFILL = 42;     // energy units
  const COIN_SCORE    = 10;
  const TERRAIN_SEG   = 80;     // pixels per terrain segment
  const LOOKAHEAD     = 30;     // segments ahead to keep in memory
  const SEGMENT_TYPES = ['flat','hill','valley','ramp','slide'];
  const PLAYER_W      = 54;
  const PLAYER_H      = 36;
  const WHEEL_R       = 12;
  const GROUND_Y_BASE = 0.62;   // fraction of canvas height

  // Quiz data (office-themed education)
  const QUIZ_POOL = [
    {
      q: 'Apa nama dokumen resmi yang dipakai untuk mengirim surat ke instansi lain?',
      opts: ['Memo Internal', 'Surat Dinas', 'Nota Pembelian', 'Kwitansi'],
      ans: 1
    },
    {
      q: 'Apa singkatan dari "CC" dalam surat menyurat?',
      opts: ['Carbon Copy', 'Computer Courier', 'Chief Clerk', 'Copy Center'],
      ans: 0
    },
    {
      q: 'Peralatan kantor yang digunakan untuk menggandakan dokumen disebut?',
      opts: ['Scanner', 'Printer Laser', 'Mesin Fotokopi', 'Faksimile'],
      ans: 2
    },
    {
      q: 'Istilah "deadline" dalam dunia kerja berarti?',
      opts: ['Jam istirahat', 'Batas waktu penyelesaian', 'Rapat harian', 'Daftar tugas'],
      ans: 1
    },
    {
      q: 'Dokumen yang berisi rencana keuangan perusahaan disebut?',
      opts: ['Notulen Rapat', 'Anggaran/Budget', 'Surat Perintah', 'Absensi'],
      ans: 1
    },
    {
      q: 'Sikap profesional saat menerima telepon kantor yang benar adalah?',
      opts: ['Langsung tanya "siapa ini?"', 'Diam saja dan tunggu', 'Sapa dengan ramah & sebut nama/instansi', 'Langsung tutup telepon'],
      ans: 2
    },
    {
      q: 'Apa fungsi "stempel" pada surat resmi kantor?',
      opts: ['Hiasan saja', 'Tanda tangan digital', 'Pengesahan & keabsahan dokumen', 'Nomor urut surat'],
      ans: 2
    },
  ];

  // ─── State ───────────────────────────────────────────────────────────────────
  let canvas, ctx, ui, rafId;
  let running = false, paused = false;

  // Player physics
  const player = {
    x: 180, y: 300,
    vx: 0, vy: 0,
    angle: 0, av: 0,       // angle & angular velocity (radians)
    onGround: false,
    dead: false,
    energy: 100,
    coins: 0,
    distanceTraveled: 0,
    quizzesDone: 0
  };

  // Input state
  const keys = { left: false, right: false };

  // Terrain
  let terrainPoints = [];   // [{x, y}] — world coordinates
  let genX = 0;             // last generated x

  // Entities (coins, coffees, checkpoints)
  let entities = [];

  // Camera offset (world x that maps to canvas x=0)
  let camX = 0;

  // Quiz checkpoint interval (every N world-pixels)
  const QUIZ_INTERVAL = 1800;
  let lastQuizX = 0;
  let quizPending = false;
  let currentQuiz = null;
  let quizAnswered = false;

  // Timing
  let lastTime = 0;
  let frameCount = 0;

  // Results to pass to main game
  let sessionCoins = 0;

  // ─── Terrain generation ──────────────────────────────────────────────────────
  function getBaseY(cw, ch) {
    return ch * GROUND_Y_BASE;
  }

  /** Seed noise for deterministic(ish) terrain per session */
  let noiseSeed = 0;
  function seededRand(seed) {
    let s = Math.sin(seed * 9301 + 49297) * 233280;
    return s - Math.floor(s);
  }

  function generateSegmentsAhead(ch) {
    const baseY = getBaseY(0, ch);
    // How many more segments do we need?
    const needed = Math.ceil(camX / TERRAIN_SEG) + LOOKAHEAD + 5;
    while (terrainPoints.length < needed + 1) {
      const i = terrainPoints.length;
      const prevY = i > 0 ? terrainPoints[i - 1].y : baseY;
      const r1 = seededRand(noiseSeed + i * 1.7);
      const r2 = seededRand(noiseSeed + i * 3.1);
      const r3 = seededRand(noiseSeed + i * 5.3);

      // Type-based height offset
      let dy = (r1 - 0.5) * 40;
      if (r2 < 0.15)      dy = -60 + r3 * 20;   // hill crest
      else if (r2 < 0.28) dy =  50 + r3 * 30;   // ramp up
      else if (r2 < 0.38) dy = -40 - r3 * 20;   // valley
      else                dy = (r1 - 0.5) * 35;  // gentle

      let newY = prevY + dy;
      // Clamp so terrain doesn't go too high or too low
      newY = Math.max(baseY - 220, Math.min(baseY + 80, newY));

      // First 4 segments flat for comfortable start
      if (i < 4) newY = baseY;

      terrainPoints.push({ x: i * TERRAIN_SEG, y: newY });
    }
  }

  /** Get terrain Y at world x (linear interpolation) */
  function terrainYAt(wx) {
    const idx = wx / TERRAIN_SEG;
    const lo  = Math.floor(idx);
    const hi  = lo + 1;
    if (lo < 0 || hi >= terrainPoints.length) return 9999;
    const t = idx - lo;
    return terrainPoints[lo].y * (1 - t) + terrainPoints[hi].y * t;
  }

  /** Draw terrain polyline */
  function drawTerrain(cw, ch) {
    const startSeg = Math.max(0, Math.floor(camX / TERRAIN_SEG) - 1);
    const endSeg   = Math.min(terrainPoints.length - 1, startSeg + Math.ceil(cw / TERRAIN_SEG) + 3);

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, ch);
    sky.addColorStop(0,   '#0f172a');
    sky.addColorStop(0.6, '#1e2a5e');
    sky.addColorStop(1,   '#2d4a8a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cw, ch);

    // Parallax clouds (decorative)
    drawClouds(cw, ch);

    // Ground fill
    ctx.beginPath();
    ctx.moveTo(terrainPoints[startSeg].x - camX, terrainPoints[startSeg].y);
    for (let i = startSeg; i <= endSeg; i++) {
      ctx.lineTo(terrainPoints[i].x - camX, terrainPoints[i].y);
    }
    ctx.lineTo(terrainPoints[endSeg].x - camX, ch + 10);
    ctx.lineTo(terrainPoints[startSeg].x - camX, ch + 10);
    ctx.closePath();

    const grd = ctx.createLinearGradient(0, ch * 0.5, 0, ch);
    grd.addColorStop(0,   '#1d4ed8');
    grd.addColorStop(0.3, '#1e40af');
    grd.addColorStop(1,   '#1e3a8a');
    ctx.fillStyle = grd;
    ctx.fill();

    // Ground line with glow
    ctx.beginPath();
    for (let i = startSeg; i <= endSeg; i++) {
      const sx = terrainPoints[i].x - camX;
      const sy = terrainPoints[i].y;
      i === startSeg ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
    }
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#93c5fd';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw decorative office items on terrain
    drawTerrainDecorations(startSeg, endSeg, ch);
  }

  let cloudOffsets = null;
  function drawClouds(cw, ch) {
    if (!cloudOffsets) {
      cloudOffsets = Array.from({length:6}, (_,i) => ({
        rx: seededRand(i*7.3) * cw,
        ry: 40 + seededRand(i*11.1) * (ch * 0.3),
        rw: 60 + seededRand(i*3.7) * 100,
        rh: 20 + seededRand(i*5.9) * 30,
      }));
    }
    ctx.save();
    ctx.globalAlpha = 0.12;
    for (const c of cloudOffsets) {
      const px = ((c.rx - camX * 0.15) % (cw + c.rw + 200) + (cw + c.rw + 200)) % (cw + c.rw + 200) - c.rw;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(px, c.ry, c.rw, c.rh, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const DECO_CACHE = new Map();
  function drawTerrainDecorations(startSeg, endSeg, ch) {
    for (let i = startSeg; i < endSeg - 1; i++) {
      const decoR = seededRand(noiseSeed + i * 13.7);
      if (decoR > 0.18) continue; // ~18% segments have deco

      if (!DECO_CACHE.has(i)) {
        const r2 = seededRand(noiseSeed + i * 17.3);
        DECO_CACHE.set(i, r2 < 0.4 ? '📄' : r2 < 0.65 ? '🗂️' : r2 < 0.82 ? '📦' : '🖨️');
      }
      const emoji = DECO_CACHE.get(i);
      const tx = terrainPoints[i].x - camX + TERRAIN_SEG / 2;
      const ty = terrainPoints[i].y - 6;
      ctx.save();
      ctx.font = '18px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.globalAlpha = 0.65;
      ctx.fillText(emoji, tx, ty);
      ctx.restore();
    }
  }

  // ─── Entity spawning ─────────────────────────────────────────────────────────
  function spawnEntitiesAhead(cw) {
    const needed = camX + cw + TERRAIN_SEG * 10;
    // Find furthest entity x
    const maxEX = entities.length > 0 ? Math.max(...entities.map(e => e.x)) : camX + cw;
    if (maxEX > needed) return;

    let spawnX = maxEX + TERRAIN_SEG * 2;
    const count = 6 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count && spawnX < needed + TERRAIN_SEG * 12; i++) {
      const r = seededRand(noiseSeed + spawnX * 0.031);
      const groundY = terrainYAt(spawnX);
      if (groundY > 9000) { spawnX += TERRAIN_SEG; continue; }

      let type = 'coin';
      if (r < 0.15 && spawnX > 600) type = 'coffee'; // coffee after first 600px
      else if (r < 0.3)             type = 'coin';
      else                          type = 'coin';

      const yOff = type === 'coin' ? -28 : -36;
      entities.push({
        type,
        x: spawnX,
        y: groundY + yOff,
        collected: false,
        r: type === 'coin' ? 14 : 18,
        bobPhase: Math.random() * Math.PI * 2
      });
      spawnX += 55 + Math.random() * 90;
    }
  }

  function pruneEntities() {
    entities = entities.filter(e => !e.collected && e.x > camX - 200);
  }

  // ─── Player drawing ───────────────────────────────────────────────────────────
  function drawPlayer() {
    const sx = player.x - camX;
    const sy = player.y;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(player.angle);

    // Chair body
    ctx.fillStyle = '#312e81';
    ctx.beginPath();
    ctx.roundRect(-PLAYER_W / 2, -PLAYER_H + 6, PLAYER_W, PLAYER_H - 12, 8);
    ctx.fill();

    // Chair back
    ctx.fillStyle = '#4338ca';
    ctx.beginPath();
    ctx.roundRect(-PLAYER_W / 2 + 4, -PLAYER_H - 12, 14, PLAYER_H - 4, 6);
    ctx.fill();

    // Seat cushion
    ctx.fillStyle = '#6366f1';
    ctx.beginPath();
    ctx.roundRect(-PLAYER_W / 2 + 4, -14, PLAYER_W - 8, 10, 5);
    ctx.fill();

    // Rider (agent)
    const avatar = (typeof gameState !== 'undefined' && gameState?.profile?.avatar) ? gameState.profile.avatar : '👦🏻';
    ctx.font = '20px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(avatar, 2, -PLAYER_H + 2);

    // Helmet
    ctx.font = '12px serif';
    ctx.fillText('⛑️', 2, -PLAYER_H - 6);

    // Wheels
    const wheelOffsets = [{ x: -PLAYER_W / 2 + 4 }, { x: PLAYER_W / 2 - 4 }];
    for (const wo of wheelOffsets) {
      ctx.beginPath();
      ctx.arc(wo.x, 2, WHEEL_R, 0, Math.PI * 2);
      ctx.fillStyle = '#1e1b4b';
      ctx.fill();
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Wheel spoke
      ctx.save();
      ctx.translate(wo.x, 2);
      ctx.rotate(player.x * 0.05); // rolling effect
      ctx.strokeStyle = '#a5b4fc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-WHEEL_R + 3, 0); ctx.lineTo(WHEEL_R - 3, 0);
      ctx.moveTo(0, -WHEEL_R + 3); ctx.lineTo(0, WHEEL_R - 3);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  // ─── Draw entities ────────────────────────────────────────────────────────────
  function drawEntities(time) {
    for (const e of entities) {
      if (e.collected) continue;
      const sx = e.x - camX;
      if (sx < -50 || sx > canvas.width + 50) continue;

      const bob = Math.sin(time * 0.002 + e.bobPhase) * 4;
      const sy  = e.y + bob;

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (e.type === 'coin') {
        // Coin glow
        ctx.shadowColor = '#fde68a';
        ctx.shadowBlur  = 10;
        ctx.font = '22px serif';
        ctx.fillText('🪙', sx, sy);
      } else if (e.type === 'coffee') {
        ctx.shadowColor = '#6ee7b7';
        ctx.shadowBlur  = 12;
        ctx.font = '24px serif';
        ctx.fillText('☕', sx, sy);
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // ─── HUD drawing ─────────────────────────────────────────────────────────────
  function updateHUD() {
    // Coin count
    const coinEl = ui.querySelector('#mg-coin-count');
    if (coinEl) coinEl.textContent = player.coins;

    // Distance
    const distEl = ui.querySelector('#mg-score-label');
    if (distEl) distEl.textContent = `${Math.floor(player.distanceTraveled / 10)}m`;

    // Energy bar
    const barFill = ui.querySelector('#mg-energy-bar-fill');
    if (barFill) {
      const pct = Math.max(0, Math.min(100, player.energy));
      barFill.style.width = pct + '%';
      barFill.className = 'mg-energy-bar-fill';
      if (pct > 60)      barFill.classList.add('full');
      else if (pct > 30) barFill.classList.add('medium');
      else               barFill.classList.add('low');
    }

    // Minimap player marker
    const markerEl = ui.querySelector('#mg-marker-player');
    if (markerEl) {
      // Minimap shows last 3000px of world
      const mmW  = ui.querySelector('#mg-minimap-track')?.offsetWidth || 200;
      const VIEW = 3000;
      const pct  = Math.min(1, player.x / VIEW);
      markerEl.style.left = `calc(${pct * 100}%)`;
    }

    // Pause stats update
    const pauseDist  = ui.querySelector('#mg-pause-dist');
    const pauseCoins = ui.querySelector('#mg-pause-coins');
    if (pauseDist)  pauseDist.textContent  = `${Math.floor(player.distanceTraveled / 10)}m`;
    if (pauseCoins) pauseCoins.textContent = player.coins;
  }

  // ─── Physics update ───────────────────────────────────────────────────────────
  function updatePhysics(dt) {
    if (paused || player.dead || quizPending) return;

    const clampedDt = Math.min(dt, 50); // safety clamp

    // Input
    const gasOn   = keys.right;
    const brakeOn = keys.left;

    // Apply acceleration / brake
    if (gasOn) {
      player.vx = Math.min(player.vx + ACCEL, MAX_SPEED);
      if (!player.onGround) player.av -= TILT_TORQUE; // tilt back in air
    }
    if (brakeOn) {
      player.vx = Math.max(player.vx - BRAKE_FORCE, -MAX_SPEED * 0.3);
      if (!player.onGround) player.av += TILT_TORQUE * 0.7; // tilt forward in air
    }

    // Friction
    player.vx *= FRICTION;

    // Gravity
    player.vy += GRAVITY;

    // Integrate position
    player.x += player.vx;
    player.y += player.vy;

    // Terrain collision
    const groundY = terrainYAt(player.x);
    if (player.y + WHEEL_R >= groundY) {
      player.y     = groundY - WHEEL_R;
      player.vy    = 0;
      player.onGround = true;

      // Align angle to slope
      const groundYNext = terrainYAt(player.x + 2);
      const slope  = Math.atan2(groundYNext - groundY, 2);
      player.angle += (slope - player.angle) * 0.18;
      player.av   *= TILT_DAMP;
    } else {
      player.onGround = false;
      // Angular velocity in air
      player.av   *= TILT_DAMP;
      player.angle += player.av;
    }

    // Minimum speed if on ground (no reversing off screen)
    if (player.onGround && player.vx < 0.8 && !brakeOn) {
      player.vx = Math.max(player.vx, 0.8);
    }

    // Camera follow
    const targetCamX = player.x - canvas.width * 0.3;
    camX += (targetCamX - camX) * 0.12;
    if (camX < 0) camX = 0;

    // Distance
    player.distanceTraveled = player.x;

    // Energy drain
    player.energy -= ENERGY_DRAIN;

    // Flip detection (angle > 120 deg either way)
    const absAngle = Math.abs(player.angle % (Math.PI * 2));
    const normAngle = absAngle > Math.PI ? (Math.PI * 2 - absAngle) : absAngle;
    if (normAngle > (Math.PI * 0.65)) {
      triggerGameOver('flip');
      return;
    }

    // Energy empty
    if (player.energy <= 0) {
      triggerGameOver('fuel');
      return;
    }

    // Entity pickup
    checkPickups();

    // Quiz checkpoint
    if (!quizPending && player.x - lastQuizX >= QUIZ_INTERVAL) {
      lastQuizX = player.x;
      triggerQuiz();
    }
  }

  // ─── Pickup collision ─────────────────────────────────────────────────────────
  function checkPickups() {
    for (const e of entities) {
      if (e.collected) continue;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < e.r + 18) {
        e.collected = true;
        if (e.type === 'coin') {
          player.coins++;
          spawnPickupText('+🪙', e.x, e.y, false);
        } else if (e.type === 'coffee') {
          player.energy = Math.min(100, player.energy + COFFEE_REFILL);
          spawnPickupText('+☕', e.x, e.y, true);
        }
      }
    }
  }

  function spawnPickupText(text, wx, wy, isCoffee) {
    const sx = wx - camX;
    const div = document.createElement('div');
    div.className = 'mg-pickup-text' + (isCoffee ? ' coffee' : '');
    div.textContent = text;
    div.style.left = sx + 'px';
    div.style.top  = (wy - 20) + 'px';
    ui.appendChild(div);
    setTimeout(() => div.remove(), 1100);
  }

  // ─── Quiz system ──────────────────────────────────────────────────────────────
  function triggerQuiz() {
    quizPending = true;
    paused      = true;

    // Pick a question not yet asked (cycle through pool)
    const idx = player.quizzesDone % QUIZ_POOL.length;
    currentQuiz = QUIZ_POOL[idx];
    player.quizzesDone++;

    const overlay = ui.querySelector('#mg-quiz-overlay');
    const qEl     = ui.querySelector('#mg-quiz-question');
    const optsEl  = ui.querySelector('#mg-quiz-options');
    const fbEl    = ui.querySelector('#mg-quiz-feedback');
    const contBtn = ui.querySelector('#mg-quiz-continue');
    const cpLabel = ui.querySelector('.quiz-checkpoint-label');

    qEl.textContent     = currentQuiz.q;
    fbEl.textContent    = '';
    contBtn.style.display = 'none';
    quizAnswered        = false;
    if (cpLabel) cpLabel.textContent = `Checkpoint #${player.quizzesDone}`;

    // Build options
    optsEl.innerHTML = '';
    currentQuiz.opts.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className   = 'mg-quiz-option';
      btn.textContent = opt;
      btn.addEventListener('click', () => onQuizAnswer(i));
      optsEl.appendChild(btn);
    });

    overlay.classList.add('visible');
  }

  function onQuizAnswer(chosenIdx) {
    if (quizAnswered) return;
    quizAnswered = true;

    const optsEl = ui.querySelectorAll('.mg-quiz-option');
    const fbEl   = ui.querySelector('#mg-quiz-feedback');
    const contBtn = ui.querySelector('#mg-quiz-continue');

    optsEl.forEach(btn => btn.disabled = true);

    if (chosenIdx === currentQuiz.ans) {
      optsEl[chosenIdx].classList.add('correct');
      fbEl.textContent = '🎉 Benar! Kamu hebat! Dapat +20 koin bonus!';
      player.coins += 20;
      updateHUD();
      spawnPickupText('+20🪙 Bonus!', player.x, player.y - 50, false);
    } else {
      optsEl[chosenIdx].classList.add('wrong');
      optsEl[currentQuiz.ans].classList.add('correct');
      fbEl.textContent = '😅 Kurang tepat, tapi jangan menyerah!';
    }

    contBtn.style.display = 'block';
  }

  function closeQuiz() {
    const overlay = ui.querySelector('#mg-quiz-overlay');
    overlay.classList.remove('visible');
    quizPending = false;
    paused      = false;
  }

  // ─── Pause system ─────────────────────────────────────────────────────────────
  function togglePause() {
    if (player.dead || quizPending) return;
    paused = !paused;
    const overlay = ui.querySelector('#mg-pause-overlay');
    if (paused) {
      updateHUD();
      overlay.classList.add('visible');
    } else {
      overlay.classList.remove('visible');
    }
  }

  // ─── Game Over / Win ─────────────────────────────────────────────────────────
  function triggerGameOver(reason) {
    if (player.dead) return;
    player.dead = true;
    paused      = true;

    let emoji, title, sub;
    if (reason === 'flip') {
      emoji = '🪑💥'; title = 'Kursinya Terbalik!';
      sub   = 'Jaga keseimbanganmu, jangan kebut terlalu kencang di tanjakan!';
    } else {
      emoji = '☕😴'; title = 'Kehabisan Kopi!';
      sub   = 'Ambil ikon ☕ di jalan untuk mengisi energi sebelum habis!';
    }
    showEndScreen(false, emoji, title, sub);
  }

  function triggerWin() {
    if (player.dead) return;
    player.dead = true;
    paused      = true;
    const dist = Math.floor(player.distanceTraveled / 10);
    showEndScreen(true, '🏆', 'Luar Biasa!', `Kamu mencapai ${dist}m dengan ${player.coins} koin!`);
  }

  function showEndScreen(won, emoji, title, sub) {
    // Save coins to main game
    sessionCoins = player.coins;
    commitCoinsToMainGame(sessionCoins);

    const overlay = ui.querySelector('#mg-endscreen-overlay');
    ui.querySelector('#mg-endscreen-emoji').textContent  = won ? '🏆' : emoji;
    ui.querySelector('#mg-endscreen-title').textContent  = title;
    ui.querySelector('#mg-endscreen-sub').textContent    = sub;

    const dist = Math.floor(player.distanceTraveled / 10);
    const vals = overlay.querySelectorAll('.es-val');
    if (vals[0]) vals[0].textContent = dist + 'm';
    if (vals[1]) vals[1].textContent = player.coins;
    if (vals[2]) vals[2].textContent = player.quizzesDone;

    overlay.classList.add('visible');
  }

  function commitCoinsToMainGame(amount) {
    if (amount <= 0) return;
    try {
      if (typeof gameState !== 'undefined') {
        gameState.coins = (gameState.coins || 0) + amount;
        if (typeof Storage !== 'undefined' && typeof Storage.save === 'function') {
          Storage.save();
        }
        // Update main UI coin counter if visible
        const topCoin = document.getElementById('top-coin-count');
        const custCoin = document.getElementById('customizer-coin-count');
        if (topCoin) topCoin.textContent = gameState.coins;
        if (custCoin) custCoin.textContent = gameState.coins;
      }
    } catch(e) {
      console.warn('[MiniGame] Could not update main game coins:', e);
    }
  }

  // ─── Main game loop ────────────────────────────────────────────────────────────
  function gameLoop(time) {
    if (!running) return;
    rafId = requestAnimationFrame(gameLoop);

    const dt = time - lastTime;
    lastTime = time;
    frameCount++;

    const cw = canvas.width;
    const ch = canvas.height;

    generateSegmentsAhead(ch);
    spawnEntitiesAhead(cw);

    if (!paused) updatePhysics(dt);

    // Render
    ctx.clearRect(0, 0, cw, ch);
    drawTerrain(cw, ch);
    drawEntities(time);
    drawPlayer();

    pruneEntities();

    if (!paused) updateHUD();
  }

  // ─── Init & teardown ──────────────────────────────────────────────────────────
  function resetState(ch) {
    const baseY = ch * GROUND_Y_BASE;
    // Clear terrain and entities
    terrainPoints = [];
    entities      = [];
    DECO_CACHE.clear();
    cloudOffsets  = null;
    noiseSeed     = Math.random() * 9999;
    genX          = 0;
    camX          = 0;
    lastQuizX     = 0;
    quizPending   = false;
    quizAnswered  = false;
    frameCount    = 0;
    sessionCoins  = 0;

    // Reset player
    player.x = 180;
    player.y = baseY - WHEEL_R - 20;
    player.vx = 0; player.vy = 0;
    player.angle = 0; player.av = 0;
    player.onGround = false;
    player.dead     = false;
    player.energy   = 100;
    player.coins    = 0;
    player.distanceTraveled = 0;
    player.quizzesDone = 0;

    // Pre-generate initial terrain
    generateSegmentsAhead(ch);
    spawnEntitiesAhead(canvas?.width || 600);
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width  = canvas.parentElement.clientWidth  || window.innerWidth;
    canvas.height = canvas.parentElement.clientHeight || window.innerHeight;
  }

  function bindControls() {
    // Keyboard
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup',   onKeyUp);

    // Touch pedals
    const pLeft  = ui.querySelector('#mg-pedal-left');
    const pRight = ui.querySelector('#mg-pedal-right');

    function touchStart(e, isRight) {
      e.preventDefault();
      if (isRight) keys.right = true;
      else         keys.left  = true;
    }
    function touchEnd(e, isRight) {
      e.preventDefault();
      if (isRight) keys.right = false;
      else         keys.left  = false;
    }

    pLeft.addEventListener('touchstart',  e => touchStart(e, false), { passive: false });
    pLeft.addEventListener('touchend',    e => touchEnd(e, false),   { passive: false });
    pLeft.addEventListener('touchcancel', e => touchEnd(e, false),   { passive: false });
    pLeft.addEventListener('mousedown',   e => touchStart(e, false));
    pLeft.addEventListener('mouseup',     e => touchEnd(e, false));
    pLeft.addEventListener('mouseleave',  e => touchEnd(e, false));

    pRight.addEventListener('touchstart',  e => touchStart(e, true), { passive: false });
    pRight.addEventListener('touchend',    e => touchEnd(e, true),   { passive: false });
    pRight.addEventListener('touchcancel', e => touchEnd(e, true),   { passive: false });
    pRight.addEventListener('mousedown',   e => touchStart(e, true));
    pRight.addEventListener('mouseup',     e => touchEnd(e, true));
    pRight.addEventListener('mouseleave',  e => touchEnd(e, true));
  }

  function unbindControls() {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup',   onKeyUp);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowRight') { keys.right = true;  e.preventDefault(); }
    if (e.key === 'ArrowLeft')  { keys.left  = true;  e.preventDefault(); }
    if (e.key === 'Escape')     togglePause();
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
  }

  function onKeyUp(e) {
    if (e.key === 'ArrowRight') keys.right = false;
    if (e.key === 'ArrowLeft')  keys.left  = false;
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  function launch() {
    ui = document.getElementById('miniGameUI');
    if (!ui) { console.error('[MiniGame] #miniGameUI not found'); return; }

    canvas = ui.querySelector('#miniGameCanvas');
    ctx    = canvas.getContext('2d');

    ui.classList.add('active');
    resizeCanvas();
    resetState(canvas.height);

    running = true;
    paused  = false;
    keys.left = keys.right = false;

    bindControls();

    // Reset end/pause overlays
    ui.querySelector('#mg-endscreen-overlay')?.classList.remove('visible');
    ui.querySelector('#mg-pause-overlay')?.classList.remove('visible');
    ui.querySelector('#mg-quiz-overlay')?.classList.remove('visible');

    lastTime = performance.now();
    rafId    = requestAnimationFrame(gameLoop);
  }

  function quit() {
    running = false;
    paused  = false;
    if (rafId) cancelAnimationFrame(rafId);
    unbindControls();
    keys.left = keys.right = false;

    // Hide all overlays
    if (ui) {
      ui.querySelector('#mg-endscreen-overlay')?.classList.remove('visible');
      ui.querySelector('#mg-pause-overlay')?.classList.remove('visible');
      ui.querySelector('#mg-quiz-overlay')?.classList.remove('visible');
      ui.classList.remove('active');
    }

    // If session had coins (and not already committed on game-over), commit now
    if (player.coins > 0 && !player.dead) {
      commitCoinsToMainGame(player.coins);
    }
  }

  function restart() {
    if (rafId) cancelAnimationFrame(rafId);
    ui.querySelector('#mg-endscreen-overlay')?.classList.remove('visible');
    ui.querySelector('#mg-pause-overlay')?.classList.remove('visible');
    ui.querySelector('#mg-quiz-overlay')?.classList.remove('visible');
    keys.left = keys.right = false;
    paused  = false;
    running = false;

    resizeCanvas();
    resetState(canvas.height);

    running  = true;
    lastTime = performance.now();
    rafId    = requestAnimationFrame(gameLoop);
  }

  function resume() {
    if (!paused || quizPending) return;
    paused = false;
    ui.querySelector('#mg-pause-overlay')?.classList.remove('visible');
  }

  // ─── DOM wiring (called once when script loads) ───────────────────────────────
  function wireDOM() {
    const uiEl = document.getElementById('miniGameUI');
    if (!uiEl) return;

    // Pause button
    uiEl.querySelector('#mg-btn-pause')?.addEventListener('click', () => togglePause());

    // Pause overlay buttons
    uiEl.querySelector('#mg-btn-resume')?.addEventListener('click',  () => resume());
    uiEl.querySelector('#mg-btn-quit-pause')?.addEventListener('click', () => { quit(); });

    // Quiz continue
    uiEl.querySelector('#mg-quiz-continue')?.addEventListener('click', () => closeQuiz());

    // End screen buttons
    uiEl.querySelector('#mg-btn-restart')?.addEventListener('click',     () => restart());
    uiEl.querySelector('#mg-btn-main-menu-end')?.addEventListener('click', () => quit());
  }

  // Wire DOM after DOMContentLoaded (or immediately if already loaded)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireDOM);
  } else {
    wireDOM();
  }

  // ─── Exports ─────────────────────────────────────────────────────────────────
  return { launch, quit, restart, resume };

})();

