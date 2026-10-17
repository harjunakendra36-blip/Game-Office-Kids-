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

function startMiniGame() {
  if (typeof MiniGame !== 'undefined' && MiniGame.launch) {
    MiniGame.launch();
  }
}
window.startMiniGame = startMiniGame;
window.MiniGame = MiniGame;

// =============================================================================
// CHAPTER 1 INTERACTIVE MINI GAMES ENGINE
// Pilar Kearsipan & Filing — Episodes 1 to 5
// 2D Antigravity, Touch & Mouse Responsive, Educational Gamification
// =============================================================================
const Chapter1MiniGames = (() => {
  'use strict';

  let currentEpisodeId = 1;
  let timerInterval = null;
  let remainingTime = 35.0;
  let totalTime = 35.0;
  let isRunning = false;
  let callbacks = { onComplete: null, onRetry: null, onQuit: null };
  let episodeData = {};

  // Audio helper using main SoundSystem
  function playSfx(type) {
    if (typeof SoundSystem !== 'undefined' && SoundSystem.play) {
      SoundSystem.play(type);
    }
  }

  // Toast feedback helper
  function notify(text, type = 'info') {
    if (typeof showToast === 'function') {
      showToast(text, type);
    }
  }

  // Stop running game loops and timers
  function stop() {
    isRunning = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    const mount = document.getElementById('ch1-minigame-mount');
    if (mount) {
      // Clear key listeners if any
      window.onkeydown = null;
    }
  }

  // Top HUD Generator
  function renderHUD(mount, epNum, epTitle, instruction, icon) {
    return `
      <div class="ch1-hud">
        <div class="ch1-hud-row">
          <div class="ch1-hud-title-group">
            <span class="ch1-badge-ep">EPISODE ${epNum}</span>
            <span class="ch1-hud-name">${icon} ${epTitle}</span>
          </div>
          <div class="ch1-hud-stats">
            <div class="ch1-stat-pill" id="ch1-stat-progress">
              <span>Tersisa:</span>
              <strong id="ch1-progress-val">6</strong>
            </div>
            <div class="ch1-stat-pill">
              <span>⏱️</span>
              <strong id="ch1-timer-val">35.0s</strong>
            </div>
          </div>
        </div>
        <div class="ch1-timer-track">
          <div class="ch1-timer-fill" id="ch1-timer-fill" style="width: 100%;"></div>
        </div>
        <div class="ch1-instruction-banner">
          <span>💡</span>
          <span>${instruction}</span>
        </div>
      </div>
    `;
  }

  // Universal Game Timer
  function startTimer(durationSec, onTick, onTimeUp) {
    if (timerInterval) clearInterval(timerInterval);
    totalTime = durationSec;
    remainingTime = durationSec;
    isRunning = true;

    const timerValEl = document.getElementById('ch1-timer-val');
    const timerFillEl = document.getElementById('ch1-timer-fill');

    const startTime = performance.now();
    timerInterval = setInterval(() => {
      if (!isRunning) return;
      const elapsed = (performance.now() - startTime) / 1000;
      remainingTime = Math.max(0, totalTime - elapsed);

      const percent = (remainingTime / totalTime) * 100;
      if (timerValEl) timerValEl.textContent = `${remainingTime.toFixed(1)}s`;
      if (timerFillEl) {
        timerFillEl.style.width = `${percent}%`;
        if (remainingTime <= 8) {
          timerFillEl.className = 'ch1-timer-fill danger';
        } else if (remainingTime <= 16) {
          timerFillEl.className = 'ch1-timer-fill warn';
        } else {
          timerFillEl.className = 'ch1-timer-fill';
        }
      }

      if (onTick) onTick(remainingTime);

      if (remainingTime <= 0) {
        stop();
        if (timerValEl) timerValEl.textContent = '0.0s';
        if (timerFillEl) timerFillEl.style.width = '0%';
        playSfx('back');
        if (onTimeUp) onTimeUp();
      }
    }, 100);
  }

  // Fail/Retry Dialog
  function showFailScreen(mount, message) {
    const existing = mount.querySelector('.ch1-fail-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'ch1-fail-overlay';
    overlay.innerHTML = `
      <div class="ch1-fail-icon">⏰</div>
      <h3 class="ch1-fail-title">WAKTU HABIS!</h3>
      <p class="ch1-fail-desc">${message || 'Dr. Chaos membuat ruang kearsipan sedikit berantakan. Jangan menyerah, Agen! Latih kecepatanmu dan coba lagi sekarang!'}</p>
      <div class="ch1-fail-actions">
        <button class="ch1-btn-retry" id="ch1-btn-retry-action">🔄 Coba Lagi</button>
        <button class="ch1-btn-quit" id="ch1-btn-quit-action">🏠 Menu Misi</button>
      </div>
    `;

    mount.querySelector('.ch1-game-arena').appendChild(overlay);

    overlay.querySelector('#ch1-btn-retry-action').addEventListener('click', () => {
      playSfx('click');
      if (callbacks.onRetry) callbacks.onRetry();
      else start(currentEpisodeId, callbacks);
    });

    overlay.querySelector('#ch1-btn-quit-action').addEventListener('click', () => {
      playSfx('back');
      if (callbacks.onQuit) callbacks.onQuit();
    });
  }

  // ===========================================================================
  // EPISODE 1: PEMILAHAN DOKUMEN & SAMPAH (Antigravitasi Melompat & Menyortir)
  // ===========================================================================
  function startEpisode1(mount) {
    const items = [
      { id: 'ep1_1', type: 'archive', title: 'Laporan Keuangan', sub: 'Dokumen Penting Resmi 📊', icon: '📊' },
      { id: 'ep1_2', type: 'archive', title: 'Surat Dinas Pimpinan', sub: 'Surat Resmi Bersegel 📜', icon: '📜' },
      { id: 'ep1_3', type: 'archive', title: 'Kontrak Kerjasama Mitra', sub: 'Arsip Hukum Kantor 💼', icon: '💼' },
      { id: 'ep1_4', type: 'trash',   title: 'Bungkus Permen Bekas', sub: 'Sampah Makanan Ringan 🍬', icon: '🍬' },
      { id: 'ep1_5', type: 'trash',   title: 'Gelas Kopi Plastik', sub: 'Sampah Minuman Kantor 🥤', icon: '🥤' },
      { id: 'ep1_6', type: 'trash',   title: 'Kertas Coretan Kusut', sub: 'Kertas Bekas Tak Terpakai 🗞️', icon: '🗞️' },
    ];

    // Shuffle items
    items.sort(() => Math.random() - 0.5);

    let sortedCount = 0;
    let mistakes = 0;
    const playerAvatar = (typeof gameState !== 'undefined' && gameState.profile && gameState.profile.avatar) ? gameState.profile.avatar : '👦🏻';

    mount.innerHTML = `
      <div class="ch1-game-arena">
        <div class="ch1-arena-stars"></div>
        ${renderHUD(mount, 1, 'Bencana Kertas Terbang!', 'Lompat antigravitasi untuk menyortir Dokumen Resmi ke Lemari Arsip 📁 & Sampah ke Tempat Sampah 🗑️!', '🌪️')}

        <div class="ch1-targets-row">
          <div class="ch1-target-box archive-box" id="ch1-target-archive" data-type="archive">
            <div class="ch1-t-icon">📁</div>
            <div class="ch1-t-info">
              <div class="ch1-t-title">Lemari Arsip Kantor</div>
              <div class="ch1-t-sub">Dokumen Penting Resmi</div>
            </div>
            <div class="ch1-t-badge" id="ch1-count-archive">0 Disimpan</div>
          </div>

          <div class="ch1-target-box trash-box" id="ch1-target-trash" data-type="trash">
            <div class="ch1-t-icon">🗑️</div>
            <div class="ch1-t-info">
              <div class="ch1-t-title">Tempat Sampah Kantor</div>
              <div class="ch1-t-sub">Kertas Sampah & Bekas</div>
            </div>
            <div class="ch1-t-badge" id="ch1-count-trash">0 Dibuang</div>
          </div>
        </div>

        <div class="ch1-stage" id="ch1-stage-ep1">
          <div class="ch1-floating-container" id="ch1-cards-container">
            ${items.map(item => `
              <div class="ch1-float-card" id="card-${item.id}" draggable="true" data-id="${item.id}" data-type="${item.type}">
                <div class="ch1-card-head">
                  <span class="ch1-card-icon">${item.icon}</span>
                  <div class="ch1-card-text">
                    <div class="ch1-card-title">${item.title}</div>
                    <div class="ch1-card-type">${item.sub}</div>
                  </div>
                </div>
                <div class="ch1-quick-actions">
                  <button type="button" class="ch1-btn-sort archive" data-action="archive">📁 Ke Arsip</button>
                  <button type="button" class="ch1-btn-sort trash" data-action="trash">🗑️ Ke Sampah</button>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Floating Zero-G Agent Avatar -->
          <div class="ch1-zero-g-agent" id="ch1-agent" title="Klik atau tekan Lompat!">
            <span>${playerAvatar}</span>
            <div class="ch1-agent-bubble-aura"></div>
          </div>

          <!-- On-screen Jump Button -->
          <div class="ch1-ep1-controls">
            <button class="ch1-btn-float-jump" id="ch1-btn-jump">
              <span>🚀</span>
              <span>Lompat / Float</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const progressEl = mount.querySelector('#ch1-progress-val');
    const archiveCountEl = mount.querySelector('#ch1-count-archive');
    const trashCountEl = mount.querySelector('#ch1-count-trash');
    const agentEl = mount.querySelector('#ch1-agent');
    const jumpBtn = mount.querySelector('#ch1-btn-jump');

    // Agent Jump action
    function doAgentJump() {
      if (!agentEl) return;
      playSfx('step');
      agentEl.classList.add('jumping');
      setTimeout(() => agentEl.classList.remove('jumping'), 450);
    }

    if (jumpBtn) jumpBtn.addEventListener('click', doAgentJump);
    if (agentEl) agentEl.addEventListener('click', doAgentJump);

    window.onkeydown = (e) => {
      if (e.code === 'Space' || e.key === 'ArrowUp') {
        e.preventDefault();
        doAgentJump();
      }
    };

    // Sorting Handler
    function handleSort(itemId, targetType, cardEl) {
      if (!cardEl || cardEl.classList.contains('sorted-anim')) return;
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      if (item.type === targetType) {
        // Correct
        playSfx('coin');
        sortedCount++;
        cardEl.classList.add('sorted-anim');

        if (targetType === 'archive') {
          const current = parseInt(archiveCountEl.textContent) || 0;
          archiveCountEl.textContent = `${current + 1} Disimpan ✨`;
          mount.querySelector('#ch1-target-archive').classList.add('active-pulse');
          setTimeout(() => mount.querySelector('#ch1-target-archive')?.classList.remove('active-pulse'), 400);
        } else {
          const current = parseInt(trashCountEl.textContent) || 0;
          trashCountEl.textContent = `${current + 1} Dibuang ✨`;
          mount.querySelector('#ch1-target-trash').classList.add('active-pulse');
          setTimeout(() => mount.querySelector('#ch1-target-trash')?.classList.remove('active-pulse'), 400);
        }

        setTimeout(() => cardEl.remove(), 320);

        const left = items.length - sortedCount;
        if (progressEl) progressEl.textContent = left;
        notify(`Tepat! "${item.title}" berhasil dipilah! ✨`, 'success');

        if (sortedCount >= items.length) {
          stop();
          playSfx('success');
          const stars = (remainingTime >= 12 && mistakes <= 1) ? 3 : (remainingTime >= 4 ? 2 : 1);
          setTimeout(() => {
            if (callbacks.onComplete) {
              callbacks.onComplete({ stars, score: 600, timeRemaining: remainingTime, mistakes });
            }
          }, 600);
        }
      } else {
        // Mistake
        playSfx('back');
        mistakes++;
        cardEl.style.animation = 'none';
        void cardEl.offsetWidth;
        cardEl.style.animation = 'villainShake 0.4s ease';

        if (targetType === 'archive') {
          notify(`Ups! "${item.title}" adalah sampah, buang ke Tempat Sampah ya 🗑️!`, 'warning');
        } else {
          notify(`Ups! "${item.title}" adalah dokumen resmi, simpan ke Lemari Arsip 📁!`, 'warning');
        }
      }
    }

    // Bind Quick Action Buttons
    mount.querySelectorAll('.ch1-float-card').forEach(card => {
      const id = card.getAttribute('data-id');
      card.querySelector('.ch1-btn-sort.archive')?.addEventListener('click', (e) => {
        e.stopPropagation();
        handleSort(id, 'archive', card);
      });
      card.querySelector('.ch1-btn-sort.trash')?.addEventListener('click', (e) => {
        e.stopPropagation();
        handleSort(id, 'trash', card);
      });

      // Drag and Drop
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ id, type: card.getAttribute('data-type') }));
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });

    // Drop Zones
    [mount.querySelector('#ch1-target-archive'), mount.querySelector('#ch1-target-trash')].forEach(zone => {
      if (!zone) return;
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
      });
      zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        try {
          const data = JSON.parse(e.dataTransfer.getData('text/plain'));
          const cardEl = mount.querySelector(`#card-${data.id}`);
          if (cardEl) handleSort(data.id, zone.getAttribute('data-type'), cardEl);
        } catch (err) {}
      });
    });

    // Timer (35s)
    startTimer(35.0, null, () => {
      showFailScreen(mount, 'Waktu habis sebelum semua berkas berhasil dipilah! Kipas angin Dr. Chaos masih berputar!');
    });
  }

  // ===========================================================================
  // EPISODE 2: SORTIR MAP A-Z (Alphabetical Shelves)
  // ===========================================================================
  function startEpisode2(mount) {
    const folders = [
      { letter: 'A', title: 'Akta Pendirian', full: 'Akta Pendirian Kantor 📜', icon: '📜' },
      { letter: 'B', title: 'Berkas Pajak', full: 'Berkas Pajak & Perbankan 🏦', icon: '🏦' },
      { letter: 'C', title: 'Catatan Inventaris', full: 'Catatan Inventaris Aset 📦', icon: '📦' },
      { letter: 'D', title: 'Dokumen Personalia', full: 'Dokumen Personalia Pegawai 👥', icon: '👥' },
      { letter: 'E', title: 'Evaluasi Tahunan', full: 'Evaluasi Tahunan Divisi 📈', icon: '📈' },
    ];

    // Scramble folders for player to place
    const scrambled = [...folders].sort(() => Math.random() - 0.5);

    let placedCount = 0;
    let mistakes = 0;
    let selectedFolder = null;

    mount.innerHTML = `
      <div class="ch1-game-arena">
        <div class="ch1-arena-stars"></div>
        ${renderHUD(mount, 2, 'Sortir Map A-Z', 'Susun dan cocokkan map arsip yang melayang ke rak sesuai urutan abjad A sampai E!', '🗂️')}

        <div class="ch1-ep2-arena">
          <!-- Alphabet Progress Breadcrumb -->
          <div class="ch1-alphabet-guide">
            <span style="color:#94a3b8; font-size:0.8rem; font-weight:700;">Panduan Abjad:</span>
            ${folders.map((f, i) => `
              <div class="ch1-letter-token ${i === 0 ? 'active-needed' : ''}" id="token-${f.letter}">${f.letter}</div>
              ${i < folders.length - 1 ? '<span style="color:#64748b; font-size:0.8rem;">➔</span>' : ''}
            `).join('')}
          </div>

          <!-- Shelves Rack -->
          <div class="ch1-shelves-rack">
            ${folders.map(f => `
              <div class="ch1-shelf-slot" id="shelf-${f.letter}" data-letter="${f.letter}">
                <div class="ch1-shelf-badge">${f.letter}</div>
                <div class="ch1-shelf-label">Rak Map Klasifikasi [ ${f.letter} ]</div>
                <div class="ch1-shelf-status">Kosong (Tarik Map ke Sini) 📥</div>
              </div>
            `).join('')}
          </div>

          <!-- Drifting Folders Pool -->
          <div class="ch1-folders-pool" id="ch1-folders-pool">
            ${scrambled.map(f => `
              <div class="ch1-folder-card" id="folder-${f.letter}" draggable="true" data-letter="${f.letter}">
                <div class="ch1-folder-letter">${f.letter}</div>
                <div class="ch1-folder-title">${f.icon} ${f.title}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const progressEl = mount.querySelector('#ch1-progress-val');
    if (progressEl) progressEl.textContent = folders.length;

    function updateAlphabetGuide() {
      folders.forEach((f, index) => {
        const token = mount.querySelector(`#token-${f.letter}`);
        if (!token) return;
        token.classList.remove('active-needed', 'completed');
        const shelf = mount.querySelector(`#shelf-${f.letter}`);
        if (shelf && shelf.classList.contains('filled')) {
          token.classList.add('completed');
        } else if (index === placedCount) {
          token.classList.add('active-needed');
        }
      });
    }

    function placeFolderInShelf(folderLetter, shelfLetter) {
      const folderEl = mount.querySelector(`#folder-${folderLetter}`);
      const shelfEl = mount.querySelector(`#shelf-${shelfLetter}`);
      if (!folderEl || !shelfEl || shelfEl.classList.contains('filled')) return;

      const folderData = folders.find(f => f.letter === folderLetter);

      if (folderLetter === shelfLetter) {
        // Correct slot!
        playSfx('coin');
        placedCount++;
        shelfEl.classList.add('filled');
        shelfEl.querySelector('.ch1-shelf-status').textContent = `✅ Tersimpan Rapi: "${folderData.full}"`;

        folderEl.style.transition = 'all 0.3s ease';
        folderEl.style.transform = 'scale(0.2)';
        folderEl.style.opacity = '0';
        setTimeout(() => folderEl.remove(), 250);

        selectedFolder = null;
        updateAlphabetGuide();

        const left = folders.length - placedCount;
        if (progressEl) progressEl.textContent = left;
        notify(`Luar biasa! Map [${folderLetter}] "${folderData.title}" masuk di rak yang tepat! ✨`, 'success');

        if (placedCount >= folders.length) {
          stop();
          playSfx('success');
          const stars = (remainingTime >= 15 && mistakes === 0) ? 3 : (remainingTime >= 5 ? 2 : 1);
          setTimeout(() => {
            if (callbacks.onComplete) {
              callbacks.onComplete({ stars, score: 700, timeRemaining: remainingTime, mistakes });
            }
          }, 600);
        }
      } else {
        // Wrong slot
        playSfx('back');
        mistakes++;
        shelfEl.style.animation = 'villainShake 0.4s ease';
        setTimeout(() => shelfEl.style.animation = 'none', 400);
        notify(`Ups! Map [${folderLetter}] tidak cocok di rak [${shelfLetter}]. Cocokkan huruf abjadnya ya!`, 'warning');
      }
    }

    // Touch / Click to select folder then tap shelf
    mount.querySelectorAll('.ch1-folder-card').forEach(fCard => {
      fCard.addEventListener('click', () => {
        playSfx('click');
        mount.querySelectorAll('.ch1-folder-card').forEach(c => c.classList.remove('selected'));
        selectedFolder = fCard.getAttribute('data-letter');
        fCard.classList.add('selected');
      });

      // Drag
      fCard.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', fCard.getAttribute('data-letter'));
        selectedFolder = fCard.getAttribute('data-letter');
      });
    });

    mount.querySelectorAll('.ch1-shelf-slot').forEach(shelf => {
      shelf.addEventListener('click', () => {
        const shelfLetter = shelf.getAttribute('data-letter');
        if (selectedFolder) {
          placeFolderInShelf(selectedFolder, shelfLetter);
        } else {
          notify(`Pilih map folder di bawah terlebih dahulu, lalu klik rak [${shelfLetter}]!`, 'info');
        }
      });

      shelf.addEventListener('dragover', (e) => {
        e.preventDefault();
        shelf.classList.add('dragover');
      });
      shelf.addEventListener('dragleave', () => shelf.classList.remove('dragover'));
      shelf.addEventListener('drop', (e) => {
        e.preventDefault();
        shelf.classList.remove('dragover');
        const folderLetter = e.dataTransfer.getData('text/plain');
        if (folderLetter) placeFolderInShelf(folderLetter, shelf.getAttribute('data-letter'));
      });
    });

    // Timer (35s)
    startTimer(35.0, null, () => {
      showFailScreen(mount, 'Waktu habis! Map berkas tercebur ke genangan kopi Dr. Chaos! Rapikan kembali abjadnya!');
    });
  }

  // ===========================================================================
  // EPISODE 3: KODE WARNA ARSIP (Rotating Gravity Vortex)
  // ===========================================================================
  function startEpisode3(mount) {
    const docs = [
      { id: 'ep3_1', color: 'red',   title: 'Surat Perjanjian Rahasia', tag: 'Rahasia Pimpinan 🔒', icon: '🔒' },
      { id: 'ep3_2', color: 'red',   title: 'Kode Brankas Utama', tag: 'Akses Terbatas 🔑', icon: '🔑' },
      { id: 'ep3_3', color: 'blue',  title: 'Laporan Arus Kas Bulanan', tag: 'Keuangan Kantor 📊', icon: '📊' },
      { id: 'ep3_4', color: 'blue',  title: 'Kwitansi Belanja Modal', tag: 'Bukti Pembelian 🧾', icon: '🧾' },
      { id: 'ep3_5', color: 'green', title: 'Surat Undangan Rapat', tag: 'Operasional Kantor ✉️', icon: '✉️' },
      { id: 'ep3_6', color: 'green', title: 'Formulir Cuti Karyawan', tag: 'Administrasi Umum 📝', icon: '📝' },
    ];

    docs.sort(() => Math.random() - 0.5);

    let sortedCount = 0;
    let mistakes = 0;
    const colorCounts = { red: 0, blue: 0, green: 0 };

    mount.innerHTML = `
      <div class="ch1-game-arena">
        <div class="ch1-arena-stars"></div>
        ${renderHUD(mount, 3, 'Kode Warna Arsip', 'Pilah dokumen ke stasiun warna yang tepat: Merah = Rahasia, Biru = Keuangan, Hijau = Umum!', '🏷️')}

        <div class="ch1-ep3-arena">
          <!-- Rotating Gravity Vortex background rings -->
          <div class="ch1-vortex-ring"></div>
          <div class="ch1-vortex-ring inner"></div>

          <!-- 3 Color Stations -->
          <div class="ch1-color-bins-row">
            <div class="ch1-color-bin bin-red" id="bin-red" data-color="red">
              <span class="ch1-bin-icon">🔴</span>
              <div class="ch1-bin-title">Arsip Rahasia</div>
              <div class="ch1-bin-desc">Perjanjian & Kode Kunci</div>
              <span class="ch1-bin-counter" id="count-color-red">0 Arsip</span>
            </div>

            <div class="ch1-color-bin bin-blue" id="bin-blue" data-color="blue">
              <span class="ch1-bin-icon">🔵</span>
              <div class="ch1-bin-title">Arsip Keuangan</div>
              <div class="ch1-bin-desc">Kas, Nota, & Anggaran</div>
              <span class="ch1-bin-counter" id="count-color-blue">0 Arsip</span>
            </div>

            <div class="ch1-color-bin bin-green" id="bin-green" data-color="green">
              <span class="ch1-bin-icon">🟢</span>
              <div class="ch1-bin-title">Arsip Umum</div>
              <div class="ch1-bin-desc">Surat & Formulir Acara</div>
              <span class="ch1-bin-counter" id="count-color-green">0 Arsip</span>
            </div>
          </div>

          <!-- Orbiting Documents -->
          <div class="ch1-orbit-pool" id="ch1-color-pool">
            ${docs.map(doc => `
              <div class="ch1-color-card" id="color-card-${doc.id}" draggable="true" data-id="${doc.id}" data-color="${doc.color}">
                <div class="ch1-card-head">
                  <span class="ch1-card-icon">${doc.icon}</span>
                  <div class="ch1-card-text">
                    <div class="ch1-card-title">${doc.title}</div>
                    <div class="ch1-card-type">${doc.tag}</div>
                  </div>
                </div>
                <div class="ch1-color-picker-row">
                  <button type="button" class="ch1-btn-colortag red" data-color="red">🔴 Rahasia</button>
                  <button type="button" class="ch1-btn-colortag blue" data-color="blue">🔵 Keuangan</button>
                  <button type="button" class="ch1-btn-colortag green" data-color="green">🟢 Umum</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const progressEl = mount.querySelector('#ch1-progress-val');
    if (progressEl) progressEl.textContent = docs.length;

    function handleColorSort(docId, chosenColor, cardEl) {
      if (!cardEl || cardEl.classList.contains('sorted-anim')) return;
      const doc = docs.find(d => d.id === docId);
      if (!doc) return;

      if (doc.color === chosenColor) {
        // Correct
        playSfx('coin');
        sortedCount++;
        colorCounts[chosenColor]++;

        const binEl = mount.querySelector(`#bin-${chosenColor}`);
        if (binEl) {
          binEl.classList.add('flash');
          setTimeout(() => binEl.classList.remove('flash'), 400);
        }
        const counterEl = mount.querySelector(`#count-color-${chosenColor}`);
        if (counterEl) counterEl.textContent = `${colorCounts[chosenColor]} Arsip ✨`;

        cardEl.classList.add('sorted-anim');
        setTimeout(() => cardEl.remove(), 320);

        const left = docs.length - sortedCount;
        if (progressEl) progressEl.textContent = left;
        notify(`Tepat sekali! "${doc.title}" dikelompokkan ke warna ${chosenColor.toUpperCase()}! ✨`, 'success');

        if (sortedCount >= docs.length) {
          stop();
          playSfx('success');
          const stars = (remainingTime >= 12 && mistakes <= 1) ? 3 : (remainingTime >= 4 ? 2 : 1);
          setTimeout(() => {
            if (callbacks.onComplete) {
              callbacks.onComplete({ stars, score: 750, timeRemaining: remainingTime, mistakes });
            }
          }, 600);
        }
      } else {
        // Mistake
        playSfx('back');
        mistakes++;
        cardEl.style.animation = 'villainShake 0.4s ease';
        setTimeout(() => cardEl.style.animation = 'none', 400);

        const colorName = doc.color === 'red' ? 'Merah (Rahasia)' : (doc.color === 'blue' ? 'Biru (Keuangan)' : 'Hijau (Umum)');
        notify(`Ups! "${doc.title}" termasuk kategori ${colorName}!`, 'warning');
      }
    }

    // Bind Button actions
    mount.querySelectorAll('.ch1-color-card').forEach(card => {
      const id = card.getAttribute('data-id');
      card.querySelectorAll('.ch1-btn-colortag').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleColorSort(id, btn.getAttribute('data-color'), card);
        });
      });

      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', id);
      });
    });

    // Drop Bins
    ['red', 'blue', 'green'].forEach(col => {
      const bin = mount.querySelector(`#bin-${col}`);
      if (!bin) return;
      bin.addEventListener('dragover', (e) => {
        e.preventDefault();
        bin.classList.add('dragover');
      });
      bin.addEventListener('dragleave', () => bin.classList.remove('dragover'));
      bin.addEventListener('drop', (e) => {
        e.preventDefault();
        bin.classList.remove('dragover');
        const id = e.dataTransfer.getData('text/plain');
        const card = mount.querySelector(`#color-card-${id}`);
        if (card) handleColorSort(id, col, card);
      });
    });

    // Timer (35s)
    startTimer(35.0, null, () => {
      showFailScreen(mount, 'Waktu habis! Pusaran gravitasi Dr. Chaos mencampuradukkan semua warna berkas!');
    });
  }

  // ===========================================================================
  // EPISODE 4: PENCARIAN BERKAS KUNCI (Radar Scanner & Floating Clutter)
  // ===========================================================================
  function startEpisode4(mount) {
    const keyTargets = [
      { id: 'key_1', title: 'Berkas Kunci Pimpinan', icon: '🔑', desc: 'Dokumen Rahasia Kunci Emas', x: 25, y: 35 },
      { id: 'key_2', title: 'Kunci Brankas Master', icon: '🗝️', desc: 'Kunci Pengaman Tingkat 1', x: 75, y: 25 },
      { id: 'key_3', title: 'Stempel Validasi Emas', icon: '📜', desc: 'Pengesahan Sah Resmi', x: 50, y: 68 },
    ];

    const clutters = [
      { id: 'c1', name: 'Kardus Tua', icon: '📦', x: 22, y: 32 },
      { id: 'c2', name: 'Kertas Buram', icon: '📄', x: 27, y: 38 },
      { id: 'c3', name: 'Kardus Berdebu', icon: '📦', x: 72, y: 22 },
      { id: 'c4', name: 'Gelas Kopi', icon: '☕', x: 78, y: 28 },
      { id: 'c5', name: 'Tumpukan Surat', icon: '📨', x: 48, y: 65 },
      { id: 'c6', name: 'Kardus Arsip', icon: '📦', x: 53, y: 72 },
      { id: 'c7', name: 'Map Sobek', icon: '🗂️', x: 15, y: 70 },
      { id: 'c8', name: 'Kertas Kusut', icon: '🗞️', x: 82, y: 60 },
      { id: 'c9', name: 'Binder Tua', icon: '📁', x: 40, y: 20 },
      { id: 'c10', name: 'Sticky Notes', icon: '📝', x: 60, y: 40 },
    ];

    let foundCount = 0;

    mount.innerHTML = `
      <div class="ch1-game-arena">
        <div class="ch1-arena-stars"></div>
        ${renderHUD(mount, 4, 'Jejak Berkas Tersembunyi', 'Gunakan radar kearsipan! Sentuh & singkirkan tumpukan barang yang melayang untuk menemukan 3 Dokumen Kunci!', '🕵️')}

        <div class="ch1-ep4-arena">
          <!-- Radar HUD -->
          <div class="ch1-radar-box">
            <div class="ch1-radar-info">
              <div class="ch1-radar-ping"></div>
              <span id="ch1-radar-status">📡 Radar Sinyal: Mendeteksi...</span>
            </div>
            <div class="ch1-radar-bar">
              <div class="ch1-radar-fill" id="ch1-radar-fill" style="width: 20%;"></div>
            </div>
          </div>

          <!-- Clutter Field Area -->
          <div class="ch1-clutter-field" id="ch1-clutter-field">
            <!-- 3 Golden Targets hidden behind clutter -->
            ${keyTargets.map(kt => `
              <div class="ch1-key-target" id="target-${kt.id}" style="left: ${kt.x}%; top: ${kt.y}%;" title="${kt.title}">
                <span>${kt.icon}</span>
              </div>
            `).join('')}

            <!-- 10 Floating Clutter items covering them -->
            ${clutters.map(cl => `
              <div class="ch1-clutter-obj" id="clutter-${cl.id}" style="left: ${cl.x}%; top: ${cl.y}%;">
                <span>${cl.icon}</span>
                <span>${cl.name}</span>
              </div>
            `).join('')}
          </div>

          <!-- Vault Tray Inventory -->
          <div class="ch1-vault-tray">
            <span class="ch1-vault-label">Koper Berkas Aman:</span>
            <div class="ch1-vault-slots">
              <div class="ch1-vault-slot" id="vslot-1">🔒</div>
              <div class="ch1-vault-slot" id="vslot-2">🔒</div>
              <div class="ch1-vault-slot" id="vslot-3">🔒</div>
            </div>
          </div>
        </div>
      </div>
    `;

    const progressEl = mount.querySelector('#ch1-progress-val');
    if (progressEl) progressEl.textContent = '3 Kunci';

    const radarFill = mount.querySelector('#ch1-radar-fill');
    const radarStatus = mount.querySelector('#ch1-radar-status');
    const clutterField = mount.querySelector('#ch1-clutter-field');

    // Radar Proximity Tracking
    function updateRadar(e) {
      if (!clutterField || foundCount >= keyTargets.length) return;
      const rect = clutterField.getBoundingClientRect();
      const pointerX = (e.clientX || (e.touches && e.touches[0].clientX) || 0) - rect.left;
      const pointerY = (e.clientY || (e.touches && e.touches[0].clientY) || 0) - rect.top;

      let minDistance = 9999;
      keyTargets.forEach(kt => {
        const targetEl = mount.querySelector(`#target-${kt.id}`);
        if (!targetEl || targetEl.style.display === 'none') return;
        const targetRect = targetEl.getBoundingClientRect();
        const tx = targetRect.left - rect.left + targetRect.width / 2;
        const ty = targetRect.top - rect.top + targetRect.height / 2;
        const dist = Math.hypot(pointerX - tx, pointerY - ty);
        if (dist < minDistance) minDistance = dist;
      });

      const maxRange = 260;
      const closeness = Math.max(0, Math.min(100, Math.round((1 - (minDistance / maxRange)) * 100)));

      if (radarFill) {
        radarFill.style.width = `${Math.max(15, closeness)}%`;
        if (closeness >= 70) radarFill.style.background = 'linear-gradient(90deg, #10b981, #facc15)';
        else radarFill.style.background = 'linear-gradient(90deg, #38bdf8, #818cf8)';
      }

      if (radarStatus) {
        if (closeness >= 80) radarStatus.textContent = '📡 Radar: SINYAL SANGAT KUAT! (Dekat Sekali! ✨)';
        else if (closeness >= 50) radarStatus.textContent = '📡 Radar: Sinyal Hangat... Semakin Dekat!';
        else radarStatus.textContent = '📡 Radar Sinyal: Dingin... Cari di tumpukan lain!';
      }
    }

    if (clutterField) {
      clutterField.addEventListener('mousemove', updateRadar);
      clutterField.addEventListener('touchmove', updateRadar, { passive: true });
    }

    // Fling away clutter objects
    mount.querySelectorAll('.ch1-clutter-obj').forEach(clutter => {
      clutter.addEventListener('click', () => {
        playSfx('step');
        clutter.classList.add('flung');
        setTimeout(() => clutter.remove(), 450);
      });
      clutter.addEventListener('touchstart', () => {
        playSfx('step');
        clutter.classList.add('flung');
        setTimeout(() => clutter.remove(), 450);
      }, { passive: true });
    });

    // Collect Revealed Keys
    mount.querySelectorAll('.ch1-key-target').forEach(keyEl => {
      keyEl.addEventListener('click', () => {
        if (keyEl.style.display === 'none') return;
        const targetId = keyEl.id.replace('target-', '');
        const target = keyTargets.find(kt => kt.id === targetId);

        playSfx('badge');
        foundCount++;
        keyEl.style.display = 'none';

        const slot = mount.querySelector(`#vslot-${foundCount}`);
        if (slot) {
          slot.classList.add('filled');
          slot.textContent = target.icon;
        }

        const remaining = keyTargets.length - foundCount;
        if (progressEl) progressEl.textContent = `${remaining} Kunci`;
        notify(`Luar Biasa! ${target.title} berhasil diamankan ke koper! 🔑✨`, 'success');

        if (foundCount >= keyTargets.length) {
          stop();
          playSfx('success');
          const stars = remainingTime >= 14 ? 3 : (remainingTime >= 4 ? 2 : 1);
          setTimeout(() => {
            if (callbacks.onComplete) {
              callbacks.onComplete({ stars, score: 850, timeRemaining: remainingTime });
            }
          }, 650);
        }
      });
    });

    // Timer (35s)
    startTimer(35.0, null, () => {
      showFailScreen(mount, 'Waktu habis! Berkas kunci pimpinan masih tersembunyi di balik tumpukan kardus Dr. Chaos!');
    });
  }

  // ===========================================================================
  // EPISODE 5: BOSS LEVEL - UJIAN ARSIP 30 DETIK (Dr. Chaos Final Showdown)
  // ===========================================================================
  function startEpisode5(mount) {
    const tasks = [
      {
        id: 1,
        type: 'sort',
        badge: 'Tahap 1: Pemilahan Dokumen',
        prompt: 'Pilah "Piagam Kearsipan Resmi 📜" ke Lemari Arsip!',
        actionText: '📁 Simpan ke Lemari Arsip',
        target: 'archive',
        icon: '📜'
      },
      {
        id: 2,
        type: 'sort',
        badge: 'Tahap 1: Pembersihan Sampah',
        prompt: 'Buang "Kaleng Sabotase Bekas 🥫" ke Tempat Sampah!',
        actionText: '🗑️ Buang ke Tempat Sampah',
        target: 'trash',
        icon: '🥫'
      },
      {
        id: 3,
        type: 'alpha',
        badge: 'Tahap 2: Sortir Map A-Z',
        prompt: 'Simpan "Map [A - Akta Pimpinan] 🗂️" ke Rak Abjad [ A ]!',
        actionText: '🗂️ Masukkan ke Rak [ A ]',
        target: 'A',
        icon: '🗂️'
      },
      {
        id: 4,
        type: 'alpha',
        badge: 'Tahap 2: Sortir Map A-Z',
        prompt: 'Simpan "Map [B - Berkas Finansial] 🗂️" ke Rak Abjad [ B ]!',
        actionText: '🗂️ Masukkan ke Rak [ B ]',
        target: 'B',
        icon: '🗂️'
      },
      {
        id: 5,
        type: 'color',
        badge: 'Tahap 3: Kode Warna Arsip',
        prompt: 'Klasifikasikan "Dokumen Rahasia Negara 🔒" ke Kode Merah!',
        actionText: '🔴 Simpan ke Stasiun Merah',
        target: 'red',
        icon: '🔒'
      },
      {
        id: 6,
        type: 'color',
        badge: 'Tahap 3: Kode Warna Arsip',
        prompt: 'Klasifikasikan "Neraca Pembukuan Keuangan 📊" ke Kode Biru!',
        actionText: '🔵 Simpan ke Stasiun Biru',
        target: 'blue',
        icon: '📊'
      }
    ];

    let currentStep = 0;
    let mistakes = 0;

    const villainQuotes = [
      'Mwahaha! Badai anomali gravitasi penuh! 30 detik dari sekarang kantormu runtuh! 🌪️',
      'Grrr! Kamu berhasil memilah berkas pertama? Tunggu serangan berikutnya!',
      'Jangan senang dulu! Map A-Z ini tak akan bisa kamu susun tepat waktu!',
      'Tidaaak! Bagaimana kamu bisa hafal urutan abjad secepat itu?!',
      'Pusaran warna ini akan mengacaukan konsentrasi kearsipanmu!',
      'Gawaaat! Stabilitas kearsipan hampir mencapai 100%! Hentikan mereka!'
    ];

    mount.innerHTML = `
      <div class="ch1-game-arena ch1-ep5-arena">
        <div class="ch1-arena-stars"></div>

        <!-- Dr. Chaos Boss Header -->
        <div class="ch1-boss-header">
          <div class="ch1-boss-portrait">😈</div>
          <div class="ch1-boss-dialogue">
            <div class="ch1-boss-name">DR. CHAOS (BOSS LEVEL)</div>
            <div class="ch1-boss-quote" id="ch1-boss-quote">"${villainQuotes[0]}"</div>
          </div>
          <div class="ch1-boss-digits" id="ch1-boss-digits">30.00s</div>
        </div>

        <!-- Stability Gauge -->
        <div class="ch1-stability-wrap">
          <div class="ch1-stability-row">
            <span>🛡️ Stabilitas Kearsipan Kantor:</span>
            <strong id="ch1-stability-percent">0%</strong>
          </div>
          <div class="ch1-stability-track">
            <div class="ch1-stability-fill" id="ch1-stability-fill"></div>
          </div>
        </div>

        <!-- Multi-Task Challenge Container -->
        <div class="ch1-stage" id="ch1-boss-stage">
          <div class="ch1-boss-challenge-box" id="ch1-challenge-box">
            <!-- Dynamic task mounted here -->
          </div>
        </div>
      </div>
    `;

    const stabilityFill = mount.querySelector('#ch1-stability-fill');
    const stabilityPercent = mount.querySelector('#ch1-stability-percent');
    const bossQuote = mount.querySelector('#ch1-boss-quote');
    const bossDigits = mount.querySelector('#ch1-boss-digits');
    const challengeBox = mount.querySelector('#ch1-challenge-box');

    function renderCurrentTask() {
      if (currentStep >= tasks.length) {
        // Complete Boss Level!
        stop();
        playSfx('badge');
        if (stabilityFill) stabilityFill.style.width = '100%';
        if (stabilityPercent) stabilityPercent.textContent = '100% (STABIL SEMPURNA)';
        if (bossQuote) bossQuote.textContent = '"TIDAAAK! Kearsipan kalian terlalu rapi & disiplin! Rencanaku gagal total! 💫"';

        const stars = remainingTime >= 10.0 ? 3 : (remainingTime >= 1.0 ? 2 : 1);
        setTimeout(() => {
          if (callbacks.onComplete) {
            callbacks.onComplete({ stars, score: 1000, timeRemaining: remainingTime, mistakes });
          }
        }, 800);
        return;
      }

      const task = tasks[currentStep];
      const stepPercent = Math.round((currentStep / tasks.length) * 100);
      if (stabilityFill) stabilityFill.style.width = `${stepPercent}%`;
      if (stabilityPercent) stabilityPercent.textContent = `${stepPercent}%`;
      if (bossQuote && villainQuotes[currentStep]) {
        bossQuote.textContent = `"${villainQuotes[currentStep]}"`;
      }

      challengeBox.innerHTML = `
        <span class="ch1-challenge-step-badge">${task.badge} • Tantangan ${currentStep + 1}/${tasks.length}</span>
        <div class="ch1-challenge-prompt">${task.icon} ${task.prompt}</div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:8px;">
          <button type="button" class="btn-game-primary" id="btn-boss-solve" style="flex:1;">
            ${task.actionText}
          </button>
          <button type="button" class="btn-game-secondary" id="btn-boss-wrong" style="background:#475569; color:#fff; border-radius:50px; padding:10px 18px; border:none; font-weight:700; cursor:pointer;">
            ❌ Aksi Lain (Salah)
          </button>
        </div>
      `;

      challengeBox.querySelector('#btn-boss-solve').addEventListener('click', () => {
        playSfx('coin');
        currentStep++;
        renderCurrentTask();
      });

      challengeBox.querySelector('#btn-boss-wrong').addEventListener('click', () => {
        playSfx('back');
        mistakes++;
        challengeBox.style.animation = 'villainShake 0.4s ease';
        setTimeout(() => challengeBox.style.animation = 'none', 400);
        notify('Perhatikan instruksi kearsipan dengan cermat! Jangan salah tombol!', 'warning');
      });
    }

    renderCurrentTask();

    // 30-Second Countdown with live millisecond digits
    startTimer(30.0, (time) => {
      if (bossDigits) {
        bossDigits.textContent = `${time.toFixed(2)}s`;
        if (time <= 6.0) bossDigits.classList.add('panic');
      }
    }, () => {
      showFailScreen(mount, 'Waktu 30 detik habis! Dr. Chaos menguasai ruang arsip! Ulangi ujian dengan kecepatan penuh!');
    });
  }

  // ===========================================================================
  // MAIN ROUTER & PUBLIC API
  // ===========================================================================
  function start(episodeId = 1, options = {}) {
    currentEpisodeId = episodeId;
    callbacks = {
      onComplete: options.onComplete || null,
      onRetry: options.onRetry || null,
      onQuit: options.onQuit || null,
    };

    const mount = document.getElementById('ch1-minigame-mount');
    if (!mount) {
      console.error('[Chapter1MiniGames] #ch1-minigame-mount not found');
      return;
    }

    stop();

    if (episodeId === 1) {
      startEpisode1(mount);
    } else if (episodeId === 2) {
      startEpisode2(mount);
    } else if (episodeId === 3) {
      startEpisode3(mount);
    } else if (episodeId === 4) {
      startEpisode4(mount);
    } else if (episodeId === 5) {
      startEpisode5(mount);
    } else {
      startEpisode1(mount);
    }
  }

  return {
    start,
    stop,
  };
})();

window.Chapter1MiniGames = Chapter1MiniGames;

// =============================================================================
// CHAPTER 2 INTERACTIVE MINI GAMES ENGINE
// Pilar Komunikasi & Korespondensi — Episodes 1 to 5
// 2D Interactive Communication Center, Touch & Mouse Responsive
// =============================================================================
const Chapter2MiniGames = (() => {
  'use strict';

  let currentEpisodeId = 1;
  let timerInterval = null;
  let remainingTime = 35.0;
  let totalTime = 35.0;
  let isRunning = false;
  let callbacks = { onComplete: null, onRetry: null, onQuit: null };

  function playSfx(type) {
    if (typeof SoundSystem !== 'undefined' && SoundSystem.play) {
      SoundSystem.play(type);
    }
  }

  function notify(text, type = 'info') {
    if (typeof showToast === 'function') {
      showToast(text, type);
    }
  }

  function stop() {
    isRunning = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    window.onkeydown = null;
  }

  function renderHUD(mount, epNum, epTitle, instruction, icon) {
    return `
      <div class="ch2-hud">
        <div class="ch1-hud-row">
          <div class="ch1-hud-title-group">
            <span class="ch2-badge-ep">CH 2 • EPISODE ${epNum}</span>
            <span class="ch1-hud-name">${icon} ${epTitle}</span>
          </div>
          <div class="ch1-hud-stats">
            <div class="ch1-stat-pill" id="ch2-stat-progress">
              <span>Tersisa:</span>
              <strong id="ch2-progress-val">4</strong>
            </div>
            <div class="ch1-stat-pill">
              <span>⏱️</span>
              <strong id="ch2-timer-val">35.0s</strong>
            </div>
          </div>
        </div>
        <div class="ch1-timer-track">
          <div class="ch1-timer-fill" id="ch2-timer-fill" style="width: 100%;"></div>
        </div>
        <div class="ch1-instruction-banner">
          <span>💡</span>
          <span>${instruction}</span>
        </div>
      </div>
    `;
  }

  function startTimer(durationSec, onTick, onTimeUp) {
    if (timerInterval) clearInterval(timerInterval);
    totalTime = durationSec;
    remainingTime = durationSec;
    isRunning = true;

    const timerValEl = document.getElementById('ch2-timer-val');
    const timerFillEl = document.getElementById('ch2-timer-fill');

    const startTime = performance.now();
    timerInterval = setInterval(() => {
      if (!isRunning) return;
      const elapsed = (performance.now() - startTime) / 1000;
      remainingTime = Math.max(0, totalTime - elapsed);

      const percent = (remainingTime / totalTime) * 100;
      if (timerValEl) timerValEl.textContent = `${remainingTime.toFixed(1)}s`;
      if (timerFillEl) {
        timerFillEl.style.width = `${percent}%`;
        if (remainingTime <= 8) {
          timerFillEl.className = 'ch1-timer-fill danger';
        } else if (remainingTime <= 16) {
          timerFillEl.className = 'ch1-timer-fill warn';
        } else {
          timerFillEl.className = 'ch1-timer-fill';
        }
      }

      if (onTick) onTick(remainingTime);

      if (remainingTime <= 0) {
        stop();
        if (timerValEl) timerValEl.textContent = '0.0s';
        if (timerFillEl) timerFillEl.style.width = '0%';
        playSfx('back');
        if (onTimeUp) onTimeUp();
      }
    }, 100);
  }

  function showFailScreen(mount, message) {
    const existing = mount.querySelector('.ch1-fail-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'ch1-fail-overlay';
    overlay.innerHTML = `
      <div class="ch1-fail-icon">📡</div>
      <h3 class="ch1-fail-title">KOMUNIKASI TERPUTUS!</h3>
      <p class="ch1-fail-desc">${message || 'Waktu komunikasi habis sebelum seluruh pesan korespondensi selesai diproses. Coba lagi dan amankan saluran telekomunikasi kantor!'}</p>
      <div class="ch1-fail-actions">
        <button class="ch1-btn-retry" id="ch2-btn-retry-action">🔄 Coba Lagi</button>
        <button class="ch1-btn-quit" id="ch2-btn-quit-action">🏠 Menu Misi</button>
      </div>
    `;

    mount.querySelector('.ch2-game-arena').appendChild(overlay);

    overlay.querySelector('#ch2-btn-retry-action').addEventListener('click', () => {
      playSfx('click');
      if (callbacks.onRetry) callbacks.onRetry();
      else start(currentEpisodeId, callbacks);
    });

    overlay.querySelector('#ch2-btn-quit-action').addEventListener('click', () => {
      playSfx('back');
      if (callbacks.onQuit) callbacks.onQuit();
    });
  }

  // ===========================================================================
  // EPISODE 1: ETIKA & CATATAN PESAN TELEPON
  // ===========================================================================
  function startEpisode1(mount) {
    const calls = [
      {
        id: 'call_1',
        caller: 'Pak Bram (Direktur PT Mega Perkasa)',
        badge: 'Mitra Strategis 🏢',
        speech: '"Selamat pagi! Saya ingin konfirmasi agenda rapat evaluasi proyek jam 2 siang dengan Pimpinan kantor Anda."',
        correctIdx: 0,
        options: [
          'Selamat pagi Pak Bram, baik pesan rapat jam 14.00 kami catat dan segera kami teruskan ke Pimpinan. Terima kasih! 📝',
          'Aduh berisik sekali, saya lagi sibuk main game, telepon lagi nanti saja ya!',
          'Pimpinan tidak ada, jangan ganggu kantor kami hari ini.'
        ]
      },
      {
        id: 'call_2',
        caller: 'Ibu Maya (Bagian Keuangan Vendor Prima)',
        badge: 'Vendor Perlengkapan 🧾',
        speech: '"Halo, mohon informasikan apakah bukti transfer pembayaran sewa perangkat kantor bulan ini sudah diproses?"',
        correctIdx: 1,
        options: [
          'Terserah Ibu saja, bukan urusan saya mengurusi pembayaran.',
          'Halo Ibu Maya, terima kasih informasinya. Kami teruskan ke Bagian Keuangan untuk konfirmasi bukti transfer hari ini. 📝',
          'Datang sendiri ke kantor bawa kuitansinya, jangan malas telepon!'
        ]
      },
      {
        id: 'call_3',
        caller: 'Pak Rudi (Kepala Dinas Komunikasi)',
        badge: 'Instansi Pemerintah 🏛️',
        speech: '"Selamat siang, kami mengundang delegasi agen Office Kids untuk menghadiri seminar literasi korespondensi digital besok lusa."',
        correctIdx: 0,
        options: [
          'Selamat siang Pak Rudi, sebuah kehormatan. Surat undangan segera kami catat dan sampaikan kepada tim delegasi kantor. 📝',
          'Halo siapa ya? Kami tidak kenal dan tidak tertarik seminar.',
          'Besok lusa kami libur, jangan kirim undangan apa pun.'
        ]
      },
      {
        id: 'call_4',
        caller: 'Ibu Siska (Klien Konsultan Bisnis)',
        badge: 'Klien Eksternal ⭐',
        speech: '"Permisi, saya perlu menjadwalkan ulang konsultasi tatap muka karena ada kendala jadwal tiket penerbangan."',
        correctIdx: 2,
        options: [
          'Batalkan saja semuanya, bikin jadwal kok tidak konsisten!',
          'Bodo amat, jadwal penerbangan Ibu bukan urusan kantor kami.',
          'Baik Ibu Siska, kami catat permohonan reschedule dan kami infokan jadwal alternatif sesegera mungkin. 📝'
        ]
      }
    ];

    let currentCallIndex = 0;
    let mistakes = 0;

    mount.innerHTML = `
      <div class="ch2-game-arena">
        <div class="ch2-arena-waves"></div>
        ${renderHUD(mount, 1, 'Etika & Catatan Pesan Telepon', 'Dengarkan pesan telepon melayang, pilih kalimat etis & santun yang tepat untuk mencatat lembar pesan telepon!', '📞')}

        <div class="ch2-ep1-arena">
          <!-- Caller Card with ringing bell animation -->
          <div class="ch2-phone-caller-card" id="ch2-caller-card">
            <div class="ch2-phone-bell" id="ch2-phone-bell">📞</div>
            <div class="ch2-caller-info">
              <span class="ch2-caller-badge" id="ch2-caller-badge">Panggilan 1/4</span>
              <div class="ch2-caller-name" id="ch2-caller-name">Memanggil...</div>
              <div class="ch2-caller-speech" id="ch2-caller-speech">"..."</div>
            </div>
          </div>

          <!-- Telephone Message Slip -->
          <div class="ch2-msg-slip" id="ch2-msg-slip">
            <div class="ch2-slip-header">
              <span class="ch2-slip-title">📋 LEMBAR PESAN TELEPON RESMI</span>
              <span class="ch2-slip-time">STATUS: MENUNGGU RESPON ETIS</span>
            </div>
            <div class="ch2-slip-prompt">Pilih tindakan & tanggapan kalimat yang paling etis dan profesional:</div>

            <div class="ch2-response-options" id="ch2-options-container">
              <!-- Options rendered dynamically -->
            </div>
          </div>
        </div>
      </div>
    `;

    const progressEl = mount.querySelector('#ch2-progress-val');
    const callerCard = mount.querySelector('#ch2-caller-card');
    const callerBadge = mount.querySelector('#ch2-caller-badge');
    const callerName = mount.querySelector('#ch2-caller-name');
    const callerSpeech = mount.querySelector('#ch2-caller-speech');
    const optionsContainer = mount.querySelector('#ch2-options-container');

    function renderCall() {
      if (currentCallIndex >= calls.length) {
        // Complete!
        stop();
        playSfx('badge');
        notify('Semua panggilan berhasil dijawab dengan etika sempurna! 🌟', 'success');
        const stars = (remainingTime >= 12 && mistakes <= 1) ? 3 : (remainingTime >= 4 ? 2 : 1);
        setTimeout(() => {
          if (callbacks.onComplete) {
            callbacks.onComplete({ stars, score: 700, timeRemaining: remainingTime, mistakes });
          }
        }, 700);
        return;
      }

      const call = calls[currentCallIndex];
      if (progressEl) progressEl.textContent = calls.length - currentCallIndex;

      playSfx('step');
      callerBadge.textContent = `${call.badge} • Panggilan ${currentCallIndex + 1}/${calls.length}`;
      callerName.textContent = call.caller;
      callerSpeech.textContent = call.speech;

      optionsContainer.innerHTML = call.options.map((opt, idx) => `
        <button type="button" class="ch2-btn-reply" data-idx="${idx}">
          <span>💬</span>
          <span>${opt}</span>
        </button>
      `).join('');

      optionsContainer.querySelectorAll('.ch2-btn-reply').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-idx'));
          if (idx === call.correctIdx) {
            // Correct
            playSfx('coin');
            btn.classList.add('correct-flash');
            notify('Jawaban sangat etis & profesional! Pesan berhasil dicatat! ✨', 'success');
            setTimeout(() => {
              currentCallIndex++;
              renderCall();
            }, 450);
          } else {
            // Mistake
            playSfx('back');
            mistakes++;
            btn.classList.add('wrong-shake');
            setTimeout(() => btn.classList.remove('wrong-shake'), 500);
            notify('Kurang etis! Selalu gunakan salam, bahasa santun, dan catat pesan penting ya.', 'warning');
          }
        });
      });
    }

    renderCall();

    startTimer(35.0, null, () => {
      showFailScreen(mount, 'Waktu habis! Panggilan telepon terputus sebelum pesan berhasil dicatat!');
    });
  }

  // ===========================================================================
  // EPISODE 2: SORTIR SURAT MASUK & KELUAR (Inverted Gravity Conveyor)
  // ===========================================================================
  function startEpisode2(mount) {
    const letters = [
      { id: 'm1', type: 'inbox',  title: 'Surat Undangan Dinas Pemerintah', desc: 'Surat Masuk Berstempel Resmi 🏛️', icon: '🏛️' },
      { id: 'm2', type: 'outbox', title: 'Surat Penawaran Kerjasama Kantor', desc: 'Surat Keluar Resmi Berkop 📤', icon: '📤' },
      { id: 'm3', type: 'spam',   title: 'Brosur Undian Berhadiah Palsu', desc: 'Spam Brosur Dr. Chaos 🎭', icon: '🎭' },
      { id: 'm4', type: 'inbox',  title: 'Faktur Tagihan Resmi Listrik', desc: 'Surat Masuk Tagihan Operasional 🧾', icon: '🧾' },
      { id: 'm5', type: 'outbox', title: 'Surat Konfirmasi Jadwal Rapat', desc: 'Surat Keluar ke Mitra Bisnis ✉️', icon: '✉️' },
      { id: 'm6', type: 'spam',   title: 'Selebaran Pinjaman Gelap Liar', desc: 'Iklan Sampah Mengganggu 🗑️', icon: '🗑️' },
    ];

    letters.sort(() => Math.random() - 0.5);

    let sortedCount = 0;
    let mistakes = 0;
    const counts = { inbox: 0, outbox: 0, spam: 0 };

    mount.innerHTML = `
      <div class="ch2-game-arena">
        <div class="ch2-arena-waves"></div>
        ${renderHUD(mount, 2, 'Sortir Surat Masuk & Keluar', 'Pilah amplop surat di atas konveyor gravitasi terbalik: Surat Masuk 📨, Surat Keluar 📤, atau Spam 🗑️!', '✉️')}

        <div class="ch2-ep2-arena">
          <!-- 3 Sorting Stations -->
          <div class="ch2-mail-bins-row">
            <div class="ch2-mail-bin inbox" id="bin-inbox" data-type="inbox">
              <span style="font-size:1.6rem;">📨</span>
              <div style="color:#ffffff; font-weight:700; font-size:0.88rem;">Surat Masuk</div>
              <div style="color:#cbd5e1; font-size:0.72rem;">Dari Mitra / Instansi</div>
              <span class="ch2-bin-counter" id="cnt-inbox">0 Surat</span>
            </div>

            <div class="ch2-mail-bin outbox" id="bin-outbox" data-type="outbox">
              <span style="font-size:1.6rem;">📤</span>
              <div style="color:#ffffff; font-weight:700; font-size:0.88rem;">Surat Keluar</div>
              <div style="color:#cbd5e1; font-size:0.72rem;">Dikirim Kantor Kita</div>
              <span class="ch2-bin-counter" id="cnt-outbox">0 Surat</span>
            </div>

            <div class="ch2-mail-bin spam" id="bin-spam" data-type="spam">
              <span style="font-size:1.6rem;">🗑️</span>
              <div style="color:#ffffff; font-weight:700; font-size:0.88rem;">Spam & Sampah</div>
              <div style="color:#cbd5e1; font-size:0.72rem;">Iklan Liar Tak Resmi</div>
              <span class="ch2-bin-counter" id="cnt-spam">0 Dibuang</span>
            </div>
          </div>

          <!-- Conveyor Track -->
          <div class="ch2-conveyor-track" id="ch2-conveyor-track">
            ${letters.map(l => `
              <div class="ch2-envelope-card" id="env-${l.id}" draggable="true" data-id="${l.id}" data-type="${l.type}">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:1.6rem;">${l.icon}</span>
                  <div style="flex:1;">
                    <div style="font-size:0.86rem; font-weight:700; color:#1e293b; line-height:1.2;">${l.title}</div>
                    <div style="font-size:0.72rem; color:#64748b; font-weight:600;">${l.desc}</div>
                  </div>
                </div>
                <div class="ch2-env-actions">
                  <button type="button" class="ch2-btn-sort-mail inbox" data-act="inbox">📨 Masuk</button>
                  <button type="button" class="ch2-btn-sort-mail outbox" data-act="outbox">📤 Keluar</button>
                  <button type="button" class="ch2-btn-sort-mail spam" data-act="spam">🗑️ Spam</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const progressEl = mount.querySelector('#ch2-progress-val');
    if (progressEl) progressEl.textContent = letters.length;

    function handleMailSort(id, targetType, cardEl) {
      if (!cardEl || cardEl.classList.contains('sorted-anim')) return;
      const letter = letters.find(l => l.id === id);
      if (!letter) return;

      if (letter.type === targetType) {
        // Correct
        playSfx('coin');
        sortedCount++;
        counts[targetType]++;

        const binEl = mount.querySelector(`#bin-${targetType}`);
        if (binEl) {
          binEl.classList.add('flash');
          setTimeout(() => binEl.classList.remove('flash'), 350);
        }
        const counterEl = mount.querySelector(`#cnt-${targetType}`);
        if (counterEl) {
          counterEl.textContent = (targetType === 'spam') ? `${counts[targetType]} Dibuang ✨` : `${counts[targetType]} Surat ✨`;
        }

        cardEl.classList.add('sorted-anim');
        setTimeout(() => cardEl.remove(), 300);

        const left = letters.length - sortedCount;
        if (progressEl) progressEl.textContent = left;
        notify(`Tepat! "${letter.title}" berhasil disortir! ✨`, 'success');

        if (sortedCount >= letters.length) {
          stop();
          playSfx('success');
          const stars = (remainingTime >= 14 && mistakes <= 1) ? 3 : (remainingTime >= 4 ? 2 : 1);
          setTimeout(() => {
            if (callbacks.onComplete) {
              callbacks.onComplete({ stars, score: 750, timeRemaining: remainingTime, mistakes });
            }
          }, 600);
        }
      } else {
        // Mistake
        playSfx('back');
        mistakes++;
        cardEl.style.animation = 'villainShake 0.4s ease';
        setTimeout(() => cardEl.style.animation = 'none', 400);

        const typeName = letter.type === 'inbox' ? 'Surat Masuk Resmi 📨' : (letter.type === 'outbox' ? 'Surat Keluar Perusahaan 📤' : 'Spam & Iklan Tak Resmi 🗑️');
        notify(`Ups! "${letter.title}" seharusnya masuk ke kategori ${typeName}!`, 'warning');
      }
    }

    // Bind Quick Sort Buttons
    mount.querySelectorAll('.ch2-envelope-card').forEach(card => {
      const id = card.getAttribute('data-id');
      card.querySelectorAll('.ch2-btn-sort-mail').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleMailSort(id, btn.getAttribute('data-act'), card);
        });
      });

      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', id);
      });
    });

    // Drop Bins
    ['inbox', 'outbox', 'spam'].forEach(t => {
      const bin = mount.querySelector(`#bin-${t}`);
      if (!bin) return;
      bin.addEventListener('dragover', (e) => {
        e.preventDefault();
        bin.classList.add('dragover');
      });
      bin.addEventListener('dragleave', () => bin.classList.remove('dragover'));
      bin.addEventListener('drop', (e) => {
        e.preventDefault();
        bin.classList.remove('dragover');
        const id = e.dataTransfer.getData('text/plain');
        const card = mount.querySelector(`#env-${id}`);
        if (card) handleMailSort(id, t, card);
      });
    });

    startTimer(35.0, null, () => {
      showFailScreen(mount, 'Waktu habis! Ban konveyor gravitasi terbalik menumpahkan surat-surat kantor!');
    });
  }

  // ===========================================================================
  // EPISODE 3: DISTRIBUSI MEMO PRIORITAS (Division Cubicles)
  // ===========================================================================
  function startEpisode3(mount) {
    const memos = [
      { id: 'm1', target: 'hr',  title: 'Pengajuan Cuti Tahunan Karyawan', icon: '👥', tag: '⚡ SEGERA', divName: 'Divisi HRD' },
      { id: 'm2', target: 'fin', title: 'Pencairan Anggaran Rapat Koordinasi', icon: '💰', tag: '📌 PENTING', divName: 'Divisi Keuangan' },
      { id: 'm3', target: 'mkt', title: 'Rilis Materi Kampanye Iklan Baru', icon: '📣', tag: '⚡ SEGERA', divName: 'Divisi Marketing' },
      { id: 'm4', target: 'ops', title: 'Servis Rutin Jaringan Internet & Printer', icon: '⚙️', tag: '📌 PENTING', divName: 'Divisi Operasional & IT' },
      { id: 'm5', target: 'hr',  title: 'Evaluasi Pelatihan Pegawai Magang', icon: '👥', tag: '📌 PENTING', divName: 'Divisi HRD' },
    ];

    memos.sort(() => Math.random() - 0.5);

    let deliveredCount = 0;
    let mistakes = 0;

    mount.innerHTML = `
      <div class="ch2-game-arena">
        <div class="ch2-arena-waves"></div>
        ${renderHUD(mount, 3, 'Distribusi Memo Prioritas', 'Antar dan cocokkan memo penting kantor ke bilik divisi yang tepat: HRD 👥, Keuangan 💰, Marketing 📣, atau IT ⚙️!', '📋')}

        <div class="ch2-ep3-arena">
          <!-- 4 Cubicles -->
          <div class="ch2-cubicles-grid">
            <div class="ch2-cubicle hr" id="cub-hr" data-div="hr">
              <span class="ch2-cub-icon">👥</span>
              <div class="ch2-cub-info">
                <div class="ch2-cub-title">Divisi HRD & Personalia</div>
                <div class="ch2-cub-sub">Cuti, Karyawan, Pelatihan</div>
              </div>
            </div>

            <div class="ch2-cubicle fin" id="cub-fin" data-div="fin">
              <span class="ch2-cub-icon">💰</span>
              <div class="ch2-cub-info">
                <div class="ch2-cub-title">Divisi Keuangan / Finance</div>
                <div class="ch2-cub-sub">Anggaran, Kuitansi, Kas</div>
              </div>
            </div>

            <div class="ch2-cubicle mkt" id="cub-mkt" data-div="mkt">
              <span class="ch2-cub-icon">📣</span>
              <div class="ch2-cub-info">
                <div class="ch2-cub-title">Divisi Marketing / Promosi</div>
                <div class="ch2-cub-sub">Iklan, Event, Media Sosial</div>
              </div>
            </div>

            <div class="ch2-cubicle ops" id="cub-ops" data-div="ops">
              <span class="ch2-cub-icon">⚙️</span>
              <div class="ch2-cub-info">
                <div class="ch2-cub-title">Divisi Operasional & IT</div>
                <div class="ch2-cub-sub">Server, Printer, Logistik</div>
              </div>
            </div>
          </div>

          <!-- Memos Pool -->
          <div class="ch2-memos-pool" id="ch2-memos-pool">
            ${memos.map(m => `
              <div class="ch2-memo-card" id="memo-${m.id}" draggable="true" data-id="${m.id}" data-target="${m.target}">
                <div class="ch2-memo-header">
                  <span style="font-size:1.3rem;">${m.icon}</span>
                  <span class="ch2-priority-tag">${m.tag}</span>
                </div>
                <div class="ch2-memo-title">${m.title}</div>
                <div class="ch2-memo-routes">
                  <button type="button" class="ch2-btn-route" data-to="hr">👥 HRD</button>
                  <button type="button" class="ch2-btn-route" data-to="fin">💰 Keuangan</button>
                  <button type="button" class="ch2-btn-route" data-to="mkt">📣 Marketing</button>
                  <button type="button" class="ch2-btn-route" data-to="ops">⚙️ IT</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const progressEl = mount.querySelector('#ch2-progress-val');
    if (progressEl) progressEl.textContent = memos.length;

    function handleDispatch(memoId, chosenDiv, cardEl) {
      if (!cardEl || cardEl.classList.contains('sorted-anim')) return;
      const memo = memos.find(m => m.id === memoId);
      if (!memo) return;

      if (memo.target === chosenDiv) {
        // Correct
        playSfx('coin');
        deliveredCount++;

        const cubEl = mount.querySelector(`#cub-${chosenDiv}`);
        if (cubEl) {
          cubEl.classList.add('flash');
          setTimeout(() => cubEl.classList.remove('flash'), 350);
        }

        cardEl.classList.add('sorted-anim');
        setTimeout(() => cardEl.remove(), 300);

        const left = memos.length - deliveredCount;
        if (progressEl) progressEl.textContent = left;
        notify(`Sukses! Memo "${memo.title}" telah diterima oleh ${memo.divName}! ✨`, 'success');

        if (deliveredCount >= memos.length) {
          stop();
          playSfx('success');
          const stars = (remainingTime >= 15 && mistakes === 0) ? 3 : (remainingTime >= 5 ? 2 : 1);
          setTimeout(() => {
            if (callbacks.onComplete) {
              callbacks.onComplete({ stars, score: 800, timeRemaining: remainingTime, mistakes });
            }
          }, 600);
        }
      } else {
        // Mistake
        playSfx('back');
        mistakes++;
        cardEl.style.animation = 'villainShake 0.4s ease';
        setTimeout(() => cardEl.style.animation = 'none', 400);
        notify(`Salah bilik! Memo "${memo.title}" seharusnya ditujukan ke ${memo.divName}!`, 'warning');
      }
    }

    mount.querySelectorAll('.ch2-memo-card').forEach(card => {
      const id = card.getAttribute('data-id');
      card.querySelectorAll('.ch2-btn-route').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleDispatch(id, btn.getAttribute('data-to'), card);
        });
      });

      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', id);
      });
    });

    ['hr', 'fin', 'mkt', 'ops'].forEach(d => {
      const cub = mount.querySelector(`#cub-${d}`);
      if (!cub) return;
      cub.addEventListener('dragover', (e) => {
        e.preventDefault();
        cub.classList.add('dragover');
      });
      cub.addEventListener('dragleave', () => cub.classList.remove('dragover'));
      cub.addEventListener('drop', (e) => {
        e.preventDefault();
        cub.classList.remove('dragover');
        const id = e.dataTransfer.getData('text/plain');
        const card = mount.querySelector(`#memo-${id}`);
        if (card) handleDispatch(id, d, card);
      });
    });

    startTimer(35.0, null, () => {
      showFailScreen(mount, 'Waktu habis! Memo penting menumpuk dan alur kerja divisi terhambat!');
    });
  }

  // ===========================================================================
  // EPISODE 4: PUZZLE REKONSTRUKSI FAKS (Fax Message Strips)
  // ===========================================================================
  function startEpisode4(mount) {
    const faxPuzzles = [
      {
        id: 'fax_1',
        title: 'Instruksi Rapat Koordinasi Direksi',
        strips: [
          { order: 1, text: 'Yth. Seluruh Kepala Divisi Kantor,' },
          { order: 2, text: 'Mohon hadir tepat waktu' },
          { order: 3, text: 'dalam Rapat Koordinasi Triwulan' },
          { order: 4, text: 'di Ruang Serbaguna Lantai 3.' }
        ]
      },
      {
        id: 'fax_2',
        title: 'Pengumuman Resmi Pelayanan Tamu',
        strips: [
          { order: 1, text: 'Demikian instruksi ini disampaikan,' },
          { order: 2, text: 'atas perhatian dan kerjasama Bapak/Ibu' },
          { order: 3, text: 'kami ucapkan terima kasih.' },
          { order: 4, text: 'Tertanda, Sekretaris Perusahaan.' }
        ]
      }
    ];

    let currentPuzzleIdx = 0;
    let mistakes = 0;
    let selectedStrip = null;

    mount.innerHTML = `
      <div class="ch2-game-arena">
        <div class="ch2-arena-waves"></div>
        ${renderHUD(mount, 4, 'Puzzle Rekonstruksi Faks', 'Susun kembali potongan pesan faksimili yang teracak menjadi kalimat perintah korporat yang utuh!', '📠')}

        <div class="ch2-ep4-arena">
          <!-- Fax Machine Status Box -->
          <div class="ch2-fax-machine-box">
            <span class="ch2-fax-icon">📠</span>
            <div class="ch2-fax-info">
              <div class="ch2-fax-status" id="ch2-fax-status">STATUS MESIN FAKS: MEREKONSTRUKSI 1/2</div>
              <div class="ch2-fax-hint" id="ch2-fax-hint">Klik kepingan strip lalu tempatkan pada slot nomor urut 1 sampai 4!</div>
            </div>
          </div>

          <!-- Fax Reconstructed Paper Slots (1-4) -->
          <div class="ch2-fax-paper-tray" id="ch2-paper-tray">
            ${[1, 2, 3, 4].map(num => `
              <div class="ch2-fax-slot" id="fslot-${num}" data-slot="${num}">
                <div class="ch2-slot-num">${num}</div>
                <div class="ch2-slot-text" id="slot-text-${num}">(Seret atau klik kepingan teks ke sini) 📥</div>
              </div>
            `).join('')}
          </div>

          <!-- Strips Pool -->
          <div class="ch2-strips-pool" id="ch2-strips-pool">
            <!-- Populated dynamically -->
          </div>
        </div>
      </div>
    `;

    const progressEl = mount.querySelector('#ch2-progress-val');
    const faxStatus = mount.querySelector('#ch2-fax-status');
    const stripsPool = mount.querySelector('#ch2-strips-pool');

    function loadPuzzle(idx) {
      if (idx >= faxPuzzles.length) {
        // Complete!
        stop();
        playSfx('badge');
        notify('Seluruh dokumen faks berhasil direkonstruksi sempurna! 🖨️✨', 'success');
        const stars = (remainingTime >= 14 && mistakes <= 1) ? 3 : (remainingTime >= 4 ? 2 : 1);
        setTimeout(() => {
          if (callbacks.onComplete) {
            callbacks.onComplete({ stars, score: 850, timeRemaining: remainingTime, mistakes });
          }
        }, 700);
        return;
      }

      const puzzle = faxPuzzles[idx];
      selectedStrip = null;
      if (progressEl) progressEl.textContent = `Faks ${idx + 1}/${faxPuzzles.length}`;
      if (faxStatus) faxStatus.textContent = `STATUS FAKS: ${puzzle.title.toUpperCase()}`;

      // Reset slots
      for (let s = 1; s <= 4; s++) {
        const slot = mount.querySelector(`#fslot-${s}`);
        const slotText = mount.querySelector(`#slot-text-${s}`);
        if (slot) {
          slot.classList.remove('filled');
          delete slot.dataset.filledOrder;
        }
        if (slotText) slotText.textContent = `(Kepingan Kalimat Urutan ${s}) 📥`;
      }

      // Scramble strips
      const scrambledStrips = [...puzzle.strips].sort(() => Math.random() - 0.5);

      stripsPool.innerHTML = scrambledStrips.map(strip => `
        <div class="ch2-fax-strip" id="strip-${strip.order}" draggable="true" data-order="${strip.order}" data-text="${strip.text}">
          <span>📄</span>
          <span>"${strip.text}"</span>
        </div>
      `).join('');

      // Strip interactions
      stripsPool.querySelectorAll('.ch2-fax-strip').forEach(strEl => {
        strEl.addEventListener('click', () => {
          playSfx('click');
          stripsPool.querySelectorAll('.ch2-fax-strip').forEach(c => c.classList.remove('selected'));
          selectedStrip = {
            order: parseInt(strEl.getAttribute('data-order')),
            text: strEl.getAttribute('data-text'),
            el: strEl
          };
          strEl.classList.add('selected');
        });

        strEl.addEventListener('dragstart', (e) => {
          selectedStrip = {
            order: parseInt(strEl.getAttribute('data-order')),
            text: strEl.getAttribute('data-text'),
            el: strEl
          };
          e.dataTransfer.setData('text/plain', strEl.getAttribute('data-order'));
        });
      });
    }

    function checkSlotFill(slotNum) {
      if (!selectedStrip) {
        notify('Pilih salah satu kepingan faks di bawah terlebih dahulu!', 'info');
        return;
      }

      const slot = mount.querySelector(`#fslot-${slotNum}`);
      const slotText = mount.querySelector(`#slot-text-${slotNum}`);
      if (!slot || slot.classList.contains('filled')) return;

      if (selectedStrip.order === slotNum) {
        // Correct slot
        playSfx('coin');
        slot.classList.add('filled');
        slot.dataset.filledOrder = slotNum;
        if (slotText) slotText.textContent = `"${selectedStrip.text}" ✅`;

        selectedStrip.el.remove();
        selectedStrip = null;
        notify('Kepingan tepat pada urutannya! ✨', 'success');

        // Check if all 4 slots filled
        const filledCount = mount.querySelectorAll('.ch2-fax-slot.filled').length;
        if (filledCount === 4) {
          playSfx('step');
          notify('Dokumen faks selesai dicetak dan terverifikasi! 🖨️', 'success');
          setTimeout(() => {
            currentPuzzleIdx++;
            loadPuzzle(currentPuzzleIdx);
          }, 800);
        }
      } else {
        // Wrong slot order
        playSfx('back');
        mistakes++;
        slot.style.animation = 'villainShake 0.4s ease';
        setTimeout(() => slot.style.animation = 'none', 400);
        notify('Urutan kalimat belum tepat. Bacalah alur kalimatnya secara logis!', 'warning');
      }
    }

    // Bind Slots
    for (let s = 1; s <= 4; s++) {
      const slot = mount.querySelector(`#fslot-${s}`);
      if (slot) {
        slot.addEventListener('click', () => checkSlotFill(s));
        slot.addEventListener('dragover', (e) => {
          e.preventDefault();
          slot.classList.add('dragover');
        });
        slot.addEventListener('dragleave', () => slot.classList.remove('dragover'));
        slot.addEventListener('drop', (e) => {
          e.preventDefault();
          slot.classList.remove('dragover');
          checkSlotFill(s);
        });
      }
    }

    loadPuzzle(0);

    startTimer(35.0, null, () => {
      showFailScreen(mount, 'Waktu habis! Kepingan pesan faks rahasia hilang tertiup angin!');
    });
  }

  // ===========================================================================
  // EPISODE 5: BOSS LEVEL - KOMUNIKASI DARURAT 30 DETIK (Signal Jammer)
  // ===========================================================================
  function startEpisode5(mount) {
    const tasks = [
      {
        id: 1,
        badge: 'Tahap 1: Panggilan Darurat',
        prompt: 'Panggilan mendadak dari Pimpinan: "Segera kirim laporan darurat!"',
        actionText: '📞 "Baik Pimpinan, pesan tercatat & segera kami kirim!"',
        icon: '📞'
      },
      {
        id: 2,
        badge: 'Tahap 2: Sortir Surat Dinas',
        prompt: 'Pilah "Surat Dinas Penting Bersegel 📜" ke Jalur Masuk Resmi!',
        actionText: '📨 Masukkan ke Surat Masuk Resmi',
        icon: '📜'
      },
      {
        id: 3,
        badge: 'Tahap 2: Buang Spam Dr. Chaos',
        prompt: 'Singkirkan "Brosur Undian Palsu Jammer 🎭" ke Tempat Sampah!',
        actionText: '🗑️ Buang ke Kotak Spam',
        icon: '🎭'
      },
      {
        id: 4,
        badge: 'Tahap 3: Distribusi Memo Cepat',
        prompt: 'Antar "Memo Anggaran Darurat 💰" ke Bilik Keuangan!',
        actionText: '💰 Antar ke Bilik Keuangan',
        icon: '💰'
      },
      {
        id: 5,
        badge: 'Tahap 3: Distribusi Memo Cepat',
        prompt: 'Antar "Memo Reboot Server Frekuensi ⚙️" ke Bilik IT!',
        actionText: '⚙️ Antar ke Bilik Operasional & IT',
        icon: '⚙️'
      },
      {
        id: 6,
        badge: 'Tahap 4: Restorasi Jaringan',
        prompt: 'Aktifkan "Tombol Verifikasi Sinyal Kantor 📡" untuk pulihkan total!',
        actionText: '📡 PULIHKAN SINYAL SEKARANG!',
        icon: '📡'
      }
    ];

    let currentStep = 0;
    let mistakes = 0;

    const villainQuotes = [
      'Mwahaha! Menara jammerku mengunci sinyal komunikasi seluruh kantor dalam 30 detik! 📡⚡',
      'Grrr! Jangan coba-coba menjawab panggilan pimpinan!',
      'Surat-surat resmi kalian akan bercampur dengan spam buatanku!',
      'Memo divisi ini tak akan pernah sampai ke meja keuangan!',
      'Gawaaat! Sinyal komunikasi kantor mulai tersambung kembali?!',
      'TIDAAAK! Jangan tekan tombol restorasi sinyal itu!'
    ];

    mount.innerHTML = `
      <div class="ch2-game-arena ch2-ep5-arena">
        <div class="ch2-arena-waves"></div>

        <!-- Dr. Chaos Boss Jammer Header -->
        <div class="ch1-boss-header">
          <div class="ch1-boss-portrait">😈</div>
          <div class="ch1-boss-dialogue">
            <div class="ch1-boss-name">DR. CHAOS (BOSS LEVEL CH 2)</div>
            <div class="ch1-boss-quote" id="ch2-boss-quote">"${villainQuotes[0]}"</div>
          </div>
          <div class="ch1-boss-digits" id="ch2-boss-digits">30.00s</div>
        </div>

        <!-- Network Signal Strength Bar -->
        <div class="ch1-stability-wrap">
          <div class="ch1-stability-row">
            <span>📡 Kekuatan Sinyal Jaringan Kantor:</span>
            <strong id="ch2-signal-percent">0%</strong>
          </div>
          <div class="ch2-jammer-bar-track">
            <div class="ch2-jammer-bar-fill" id="ch2-signal-fill"></div>
          </div>
        </div>

        <!-- Boss Challenge Box -->
        <div class="ch1-stage" id="ch2-boss-stage">
          <div class="ch1-boss-challenge-box" id="ch2-challenge-box">
            <!-- Dynamic task mounted here -->
          </div>
        </div>
      </div>
    `;

    const signalFill = mount.querySelector('#ch2-signal-fill');
    const signalPercent = mount.querySelector('#ch2-signal-percent');
    const bossQuote = mount.querySelector('#ch2-boss-quote');
    const bossDigits = mount.querySelector('#ch2-boss-digits');
    const challengeBox = mount.querySelector('#ch2-challenge-box');

    function renderBossStep() {
      if (currentStep >= tasks.length) {
        // Complete Boss Level!
        stop();
        playSfx('badge');
        if (signalFill) signalFill.style.width = '100%';
        if (signalPercent) signalPercent.textContent = '100% (SINYAL PULIH TOTAL)';
        if (bossQuote) bossQuote.textContent = '"Aduuuh! Menara jammerku meledak! Komunikasi kantor kalian terlalu solid! 💥"';

        const stars = remainingTime >= 10.0 ? 3 : (remainingTime >= 1.0 ? 2 : 1);
        setTimeout(() => {
          if (callbacks.onComplete) {
            callbacks.onComplete({ stars, score: 1000, timeRemaining: remainingTime, mistakes });
          }
        }, 800);
        return;
      }

      const task = tasks[currentStep];
      const stepPercent = Math.round((currentStep / tasks.length) * 100);
      if (signalFill) signalFill.style.width = `${stepPercent}%`;
      if (signalPercent) signalPercent.textContent = `${stepPercent}%`;
      if (bossQuote && villainQuotes[currentStep]) {
        bossQuote.textContent = `"${villainQuotes[currentStep]}"`;
      }

      challengeBox.innerHTML = `
        <span class="ch1-challenge-step-badge">${task.badge} • Langkah ${currentStep + 1}/${tasks.length}</span>
        <div class="ch1-challenge-prompt">${task.icon} ${task.prompt}</div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:8px;">
          <button type="button" class="btn-game-primary" id="btn-ch2-boss-solve" style="flex:1;">
            ${task.actionText}
          </button>
          <button type="button" class="btn-game-secondary" id="btn-ch2-boss-wrong" style="background:#475569; color:#fff; border-radius:50px; padding:10px 18px; border:none; font-weight:700; cursor:pointer;">
            ❌ Tanggapan Salah
          </button>
        </div>
      `;

      challengeBox.querySelector('#btn-ch2-boss-solve').addEventListener('click', () => {
        playSfx('coin');
        currentStep++;
        renderBossStep();
      });

      challengeBox.querySelector('#btn-ch2-boss-wrong').addEventListener('click', () => {
        playSfx('back');
        mistakes++;
        challengeBox.style.animation = 'villainShake 0.4s ease';
        setTimeout(() => challengeBox.style.animation = 'none', 400);
        notify('Komunikasi darurat butuh ketepatan dan respon etis yang benar!', 'warning');
      });
    }

    renderBossStep();

    startTimer(30.0, (time) => {
      if (bossDigits) {
        bossDigits.textContent = `${time.toFixed(2)}s`;
        if (time <= 6.0) bossDigits.classList.add('panic');
      }
    }, () => {
      showFailScreen(mount, 'Waktu 30 detik habis! Menara jammer Dr. Chaos memutuskan komunikasi eksekutif kantor!');
    });
  }

  // ===========================================================================
  // MAIN ROUTER & PUBLIC API
  // ===========================================================================
  function start(episodeId = 1, options = {}) {
    currentEpisodeId = episodeId;
    callbacks = {
      onComplete: options.onComplete || null,
      onRetry: options.onRetry || null,
      onQuit: options.onQuit || null,
    };

    const mount = document.getElementById('ch2-minigame-mount');
    if (!mount) {
      console.error('[Chapter2MiniGames] #ch2-minigame-mount not found');
      return;
    }

    stop();

    if (episodeId === 1) {
      startEpisode1(mount);
    } else if (episodeId === 2) {
      startEpisode2(mount);
    } else if (episodeId === 3) {
      startEpisode3(mount);
    } else if (episodeId === 4) {
      startEpisode4(mount);
    } else if (episodeId === 5) {
      startEpisode5(mount);
    } else {
      startEpisode1(mount);
    }
  }

  return {
    start,
    stop,
  };
})();

window.Chapter2MiniGames = Chapter2MiniGames;

// =============================================================================
// CHAPTER 3 INTERACTIVE MINI GAMES ENGINE
// Pilar Keuangan & Inventaris — Episodes 1 to 5
// 2D Interactive Cash Register, Inventory Warehouses, Priority Audit
// =============================================================================
const Chapter3MiniGames = (() => {
  'use strict';

  let currentEpisodeId = 1;
  let timerInterval = null;
  let remainingTime = 35.0;
  let totalTime = 35.0;
  let isRunning = false;
  let callbacks = { onComplete: null, onRetry: null, onQuit: null };

  function playSfx(type) {
    if (typeof SoundSystem !== 'undefined' && SoundSystem.play) {
      SoundSystem.play(type);
    }
  }

  function notify(text, type = 'info') {
    if (typeof showToast === 'function') {
      showToast(text, type);
    }
  }

  function stop() {
    isRunning = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    window.onkeydown = null;
  }

  function renderHUD(mount, epNum, epTitle, instruction, icon) {
    return `
      <div class="ch3-hud">
        <div class="ch1-hud-row">
          <div class="ch1-hud-title-group">
            <span class="ch3-badge-ep">CH 3 • EPISODE ${epNum}</span>
            <span class="ch1-hud-name">${icon} ${epTitle}</span>
          </div>
          <div class="ch1-hud-stats">
            <div class="ch1-timer-chip">
              <span>⏱️</span>
              <strong id="ch3-timer-val">35.0s</strong>
            </div>
            <div class="ch1-progress-chip">
              <span>🎯 Sisa:</span>
              <strong id="ch3-progress-val">0</strong>
            </div>
          </div>
        </div>
        <div class="ch1-hud-instructions">
          <span>💡 <strong>Misi:</strong> ${instruction}</span>
        </div>
        <div class="ch1-timer-bar-track">
          <div class="ch1-timer-bar-fill" id="ch3-timer-fill" style="width: 100%;"></div>
        </div>
      </div>
    `;
  }

  function startTimer(durationSeconds, onTick, onTimeUp) {
    if (timerInterval) clearInterval(timerInterval);
    remainingTime = durationSeconds;
    totalTime = durationSeconds;
    isRunning = true;

    const timerValEl = document.getElementById('ch3-timer-val');
    const timerFillEl = document.getElementById('ch3-timer-fill');

    if (timerValEl) timerValEl.textContent = `${remainingTime.toFixed(1)}s`;
    if (timerFillEl) timerFillEl.style.width = '100%';

    timerInterval = setInterval(() => {
      if (!isRunning) return;
      remainingTime -= 0.1;

      if (timerValEl) timerValEl.textContent = `${Math.max(0, remainingTime).toFixed(1)}s`;
      if (timerFillEl) {
        const pct = Math.max(0, (remainingTime / totalTime) * 100);
        timerFillEl.style.width = `${pct}%`;
        if (pct < 25) timerFillEl.style.background = '#ef4444';
        else if (pct < 50) timerFillEl.style.background = '#f59e0b';
        else timerFillEl.style.background = '#10b981';
      }

      if (onTick) onTick(remainingTime);

      if (remainingTime <= 0) {
        stop();
        if (timerValEl) timerValEl.textContent = '0.0s';
        if (timerFillEl) timerFillEl.style.width = '0%';
        playSfx('back');
        if (onTimeUp) onTimeUp();
      }
    }, 100);
  }

  function showFailScreen(mount, message) {
    const existing = mount.querySelector('.ch1-fail-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'ch1-fail-overlay';
    overlay.innerHTML = `
      <div class="ch1-fail-icon">💰</div>
      <h3 class="ch1-fail-title">WAKTU AUDIT HABIS!</h3>
      <p class="ch1-fail-desc">${message || 'Waktu pencatatan kas habis sebelum seluruh transaksi dan inventaris berhasil diaudit. Coba lagi dan amankan keuangan kantor!'}</p>
      <div class="ch1-fail-actions">
        <button class="ch1-btn-retry" id="ch3-btn-retry-action">🔄 Coba Lagi</button>
        <button class="ch1-btn-quit" id="ch3-btn-quit-action">🏠 Menu Misi</button>
      </div>
    `;

    mount.querySelector('.ch3-game-arena').appendChild(overlay);

    overlay.querySelector('#ch3-btn-retry-action').addEventListener('click', () => {
      playSfx('click');
      if (callbacks.onRetry) callbacks.onRetry();
      else start(currentEpisodeId, callbacks);
    });

    overlay.querySelector('#ch3-btn-quit-action').addEventListener('click', () => {
      playSfx('back');
      if (callbacks.onQuit) callbacks.onQuit();
    });
  }

  // ===========================================================================
  // EPISODE 1: PEMASUKAN & PENGELUARAN KAS
  // ===========================================================================
  function startEpisode1(mount) {
    const transactions = [
      { id: 'tx1', type: 'inflow',  title: 'Modal Awal Kas Kecil', amount: 250000, desc: 'Dana kas disetujui pimpinan 🪙', icon: '🪙' },
      { id: 'tx2', type: 'outflow', title: 'Beli Kertas HVS & Tinta', amount: 85000, desc: 'Nota belanja ATK kantor 🧾', icon: '🧾' },
      { id: 'tx3', type: 'inflow',  title: 'Pendapatan Jasa Foto Dokumen', amount: 120000, desc: 'Kas masuk dari klien kantor 💵', icon: '💵' },
      { id: 'tx4', type: 'outflow', title: 'Kuitansi Ongkir Kurir Kilat', amount: 25000, desc: 'Biaya kirim paket dinas 📦', icon: '📦' },
      { id: 'tx5', type: 'inflow',  title: 'Pengembalian Sisa Belanja Tim', amount: 35000, desc: 'Sisa uang kas dari belanja 💰', icon: '💰' },
      { id: 'tx6', type: 'outflow', title: 'Snack & Konsumsi Rapat Tim', amount: 60000, desc: 'Nota makanan rapat mingguan 🥐', icon: '🥐' },
    ];

    transactions.sort(() => Math.random() - 0.5);

    let sortedCount = 0;
    let mistakes = 0;
    let totalInflow = 0;
    let totalOutflow = 0;

    function formatRupiah(num) {
      return 'Rp ' + num.toLocaleString('id-ID');
    }

    mount.innerHTML = `
      <div class="ch3-game-arena">
        <div class="ch3-arena-sparks"></div>
        ${renderHUD(mount, 1, 'Pemasukan & Pengeluaran Kas', 'Pilah arus koin pemasukan (Kas Masuk 🟢) dan bukti nota pengeluaran (Kas Keluar 🔴) ke buku kas yang tepat!', '🪙')}

        <div class="ch3-ep1-arena">
          <!-- Realtime Net Cash Balance Badge -->
          <div class="ch3-balance-badge" id="ch3-balance-badge">
            <span>📊 Saldo Kas Terhitung:</span>
            <strong id="ch3-net-balance">Rp 0</strong>
          </div>

          <!-- 2 Ledger Drop Bins -->
          <div class="ch3-ledger-bins-row">
            <div class="ch3-ledger-bin inflow" id="bin-inflow" data-type="inflow">
              <span style="font-size:1.8rem;">📥 🟢</span>
              <div style="color:#ffffff; font-weight:800; font-size:0.92rem;">Buku Kas Masuk (Penerimaan)</div>
              <div style="color:#cbd5e1; font-size:0.75rem;">Modal, Pendapatan, Sisa Belanja</div>
              <span class="ch3-bin-amount" id="amt-inflow">Rp 0 (0 Transaksi)</span>
            </div>

            <div class="ch3-ledger-bin outflow" id="bin-outflow" data-type="outflow">
              <span style="font-size:1.8rem;">📤 🔴</span>
              <div style="color:#ffffff; font-weight:800; font-size:0.92rem;">Buku Kas Keluar (Pengeluaran)</div>
              <div style="color:#cbd5e1; font-size:0.75rem;">Nota Belanja ATK, Kurir, Konsumsi</div>
              <span class="ch3-bin-amount" id="amt-outflow">Rp 0 (0 Transaksi)</span>
            </div>
          </div>

          <!-- Floating Transaction Slips -->
          <div class="ch3-coins-conveyor" id="ch3-coins-conveyor">
            ${transactions.map(t => `
              <div class="ch3-coin-slip" id="tx-${t.id}" draggable="true" data-id="${t.id}" data-type="${t.type}">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:1.7rem;">${t.icon}</span>
                  <div style="flex:1;">
                    <div style="font-size:0.86rem; font-weight:800; color:#0f172a; line-height:1.2;">${t.title}</div>
                    <div style="font-size:0.72rem; color:#64748b; font-weight:600;">${t.desc}</div>
                    <div class="ch3-slip-nominal" style="color:${t.type === 'inflow' ? '#059669' : '#dc2626'};">
                      ${t.type === 'inflow' ? '+' : '-'}${formatRupiah(t.amount)}
                    </div>
                  </div>
                </div>
                <div class="ch3-coin-actions">
                  <button type="button" class="ch3-btn-coin inflow" data-act="inflow">🟢 Kas Masuk</button>
                  <button type="button" class="ch3-btn-coin outflow" data-act="outflow">🔴 Kas Keluar</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const progressEl = mount.querySelector('#ch3-progress-val');
    const netBalanceEl = mount.querySelector('#ch3-net-balance');
    const amtInflowEl = mount.querySelector('#amt-inflow');
    const amtOutflowEl = mount.querySelector('#amt-outflow');
    if (progressEl) progressEl.textContent = transactions.length;

    function handleTransactionSort(id, targetType, cardEl) {
      if (!cardEl || cardEl.classList.contains('sorted-anim')) return;
      const tx = transactions.find(t => t.id === id);
      if (!tx) return;

      if (tx.type === targetType) {
        // Correct
        playSfx('coin');
        sortedCount++;

        if (tx.type === 'inflow') totalInflow += tx.amount;
        else totalOutflow += tx.amount;

        const netBalance = totalInflow - totalOutflow;
        if (netBalanceEl) {
          netBalanceEl.textContent = (netBalance >= 0 ? '+' : '') + formatRupiah(netBalance);
          netBalanceEl.style.color = netBalance >= 0 ? '#4ade80' : '#f87171';
        }

        const binEl = mount.querySelector(`#bin-${targetType}`);
        if (binEl) {
          binEl.classList.add('flash');
          setTimeout(() => binEl.classList.remove('flash'), 350);
        }

        if (amtInflowEl) amtInflowEl.textContent = `+${formatRupiah(totalInflow)}`;
        if (amtOutflowEl) amtOutflowEl.textContent = `-${formatRupiah(totalOutflow)}`;

        cardEl.classList.add('sorted-anim');
        setTimeout(() => cardEl.remove(), 280);

        const left = transactions.length - sortedCount;
        if (progressEl) progressEl.textContent = left;
        notify(`Tepat! ${tx.title} dicatat ke ${targetType === 'inflow' ? 'Kas Masuk 🟢' : 'Kas Keluar 🔴'}!`, 'success');

        if (sortedCount >= transactions.length) {
          stop();
          playSfx('success');
          const stars = (remainingTime >= 15 && mistakes === 0) ? 3 : (remainingTime >= 5 ? 2 : 1);
          setTimeout(() => {
            if (callbacks.onComplete) {
              callbacks.onComplete({ stars, score: 780, timeRemaining: remainingTime, mistakes });
            }
          }, 600);
        }
      } else {
        // Wrong
        playSfx('back');
        mistakes++;
        cardEl.classList.add('wrong-shake');
        setTimeout(() => cardEl.classList.remove('wrong-shake'), 500);
        notify(`Keliru! "${tx.title}" adalah transaksi ${tx.type === 'inflow' ? 'Penerimaan / Kas Masuk 🟢' : 'Pengeluaran / Kas Keluar 🔴'}.`, 'warning');
      }
    }

    // Bind Quick Buttons
    mount.querySelectorAll('.ch3-btn-coin').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.ch3-coin-slip');
        if (!card) return;
        const id = card.getAttribute('data-id');
        const act = btn.getAttribute('data-act');
        handleTransactionSort(id, act, card);
      });
    });

    // Drag and Drop
    mount.querySelectorAll('.ch3-coin-slip').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.getAttribute('data-id'));
      });
    });

    ['inflow', 'outflow'].forEach(type => {
      const bin = mount.querySelector(`#bin-${type}`);
      if (!bin) return;
      bin.addEventListener('dragover', (e) => {
        e.preventDefault();
        bin.classList.add('dragover');
      });
      bin.addEventListener('dragleave', () => bin.classList.remove('dragover'));
      bin.addEventListener('drop', (e) => {
        e.preventDefault();
        bin.classList.remove('dragover');
        const id = e.dataTransfer.getData('text/plain');
        const card = mount.querySelector(`#tx-${id}`);
        handleTransactionSort(id, type, card);
      });
    });

    startTimer(35.0, null, () => {
      showFailScreen(mount, 'Waktu habis! Masih ada transaksi kas yang belum berhasil dibukukan.');
    });
  }

  // ===========================================================================
  // EPISODE 2: HITUNG KEMBALIAN KASIR
  // ===========================================================================
  function startEpisode2(mount) {
    const customers = [
      {
        id: 1,
        name: 'Agen Budi',
        avatar: '🧒🏽',
        item: 'Beli 2 Rim Kertas HVS',
        total: 13000,
        paid: 20000,
        change: 7000
      },
      {
        id: 2,
        name: 'Agen Nia',
        avatar: '👧🏻',
        item: 'Beli Snack Rapat & Minuman',
        total: 34000,
        paid: 50000,
        change: 16000
      },
      {
        id: 3,
        name: 'Mitra PT Mega',
        avatar: '👨‍💼',
        item: 'Beli Paket Souvenir Kantor',
        total: 72500,
        paid: 100000,
        change: 27500
      }
    ];

    let currentCustIdx = 0;
    let mistakes = 0;
    let currentGiven = 0;

    function formatRupiah(num) {
      return 'Rp ' + num.toLocaleString('id-ID');
    }

    mount.innerHTML = `
      <div class="ch3-game-arena">
        <div class="ch3-arena-sparks"></div>
        ${renderHUD(mount, 2, 'Hitung Kembalian Kasir', 'Hitung selisih uang belanja dan susun nominal kembalian yang tepat dari laci kasir!', '🧮')}

        <div class="ch3-ep2-arena">
          <!-- POS Screen -->
          <div class="ch3-pos-screen" id="ch3-pos-screen">
            <div class="ch3-pos-row">
              <span class="ch3-pos-label">👤 Pelanggan:</span>
              <strong style="color:#ffffff;" id="cust-name-display">Agen Budi</strong>
            </div>
            <div class="ch3-pos-row">
              <span class="ch3-pos-label">🛒 Belanja:</span>
              <span style="color:#cbd5e1;" id="cust-item-display">2 Rim Kertas HVS</span>
            </div>
            <div class="ch3-pos-row">
              <span class="ch3-pos-label">💵 Total Tagihan:</span>
              <strong class="ch3-pos-val" id="pos-total-bill">Rp 13.000</strong>
            </div>
            <div class="ch3-pos-row">
              <span class="ch3-pos-label">💳 Uang Diterima:</span>
              <strong class="ch3-pos-val" style="color:#fde047;" id="pos-paid-bill">Rp 20.000</strong>
            </div>
            <div class="ch3-pos-row" style="border-top:1px dashed #475569; padding-top:6px;">
              <span class="ch3-pos-label">🎯 Target Kembalian:</span>
              <strong class="ch3-pos-val change-target" id="pos-target-change">Rp 7.000</strong>
            </div>
          </div>

          <!-- Given Counter Bar -->
          <div class="ch3-given-bar">
            <div>
              <div style="font-size:0.75rem; color:#94a3b8; font-weight:700;">Uang Kembalian yang Kamu Siapkan:</div>
              <div class="ch3-given-display">
                <span id="ch3-given-val">Rp 0</span>
              </div>
            </div>
            <div class="ch3-change-controls">
              <button type="button" class="ch3-btn-reset-change" id="btn-reset-change">🔄 Reset</button>
              <button type="button" class="ch3-btn-submit-change" id="btn-submit-change">Bayarkan Kembalian ✅</button>
            </div>
          </div>

          <!-- Cash Drawer -->
          <div class="ch3-cash-drawer">
            <div class="ch3-drawer-title">💵 Laci Kasir (Klik Pecahan Uang untuk Menambah):</div>
            <div class="ch3-money-grid">
              <button type="button" class="ch3-btn-cash" data-val="50000" style="border-color:#3b82f6;">
                <span>💵 50rb</span>
                <span style="font-size:0.7rem; color:#93c5fd;">Rp 50.000</span>
              </button>
              <button type="button" class="ch3-btn-cash" data-val="20000" style="border-color:#10b981;">
                <span>💵 20rb</span>
                <span style="font-size:0.7rem; color:#6ee7b7;">Rp 20.000</span>
              </button>
              <button type="button" class="ch3-btn-cash" data-val="10000" style="border-color:#a855f7;">
                <span>💵 10rb</span>
                <span style="font-size:0.7rem; color:#d8b4fe;">Rp 10.000</span>
              </button>
              <button type="button" class="ch3-btn-cash" data-val="5000" style="border-color:#d97706;">
                <span>💵 5rb</span>
                <span style="font-size:0.7rem; color:#fde68a;">Rp 5.000</span>
              </button>
              <button type="button" class="ch3-btn-cash" data-val="2000" style="border-color:#64748b;">
                <span>💵 2rb</span>
                <span style="font-size:0.7rem; color:#cbd5e1;">Rp 2.000</span>
              </button>
              <button type="button" class="ch3-btn-cash" data-val="1000" style="border-color:#eab308;">
                <span>🪙 1rb</span>
                <span style="font-size:0.7rem; color:#fef08a;">Rp 1.000</span>
              </button>
              <button type="button" class="ch3-btn-cash" data-val="500" style="border-color:#94a3b8;">
                <span>🪙 500</span>
                <span style="font-size:0.7rem; color:#e2e8f0;">Rp 500</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const progressEl = mount.querySelector('#ch3-progress-val');
    const custNameEl = mount.querySelector('#cust-name-display');
    const custItemEl = mount.querySelector('#cust-item-display');
    const totalBillEl = mount.querySelector('#pos-total-bill');
    const paidBillEl = mount.querySelector('#pos-paid-bill');
    const targetChangeEl = mount.querySelector('#pos-target-change');
    const givenValEl = mount.querySelector('#ch3-given-val');

    function loadCustomer(idx) {
      if (idx >= customers.length) {
        // Complete!
        stop();
        playSfx('badge');
        notify('Semua kembalian kasir berhasil dihitung akurat tanpa selisih! 🧮✨', 'success');
        const stars = (remainingTime >= 16 && mistakes <= 1) ? 3 : (remainingTime >= 4 ? 2 : 1);
        setTimeout(() => {
          if (callbacks.onComplete) {
            callbacks.onComplete({ stars, score: 820, timeRemaining: remainingTime, mistakes });
          }
        }, 650);
        return;
      }

      const c = customers[idx];
      currentGiven = 0;
      if (givenValEl) givenValEl.textContent = formatRupiah(currentGiven);
      if (progressEl) progressEl.textContent = `Pelanggan ${idx + 1}/${customers.length}`;
      if (custNameEl) custNameEl.textContent = `${c.avatar} ${c.name}`;
      if (custItemEl) custItemEl.textContent = c.item;
      if (totalBillEl) totalBillEl.textContent = formatRupiah(c.total);
      if (paidBillEl) paidBillEl.textContent = formatRupiah(c.paid);
      if (targetChangeEl) targetChangeEl.textContent = formatRupiah(c.change);
    }

    // Money Click Handlers
    mount.querySelectorAll('.ch3-btn-cash').forEach(btn => {
      btn.addEventListener('click', () => {
        playSfx('coin');
        const val = parseInt(btn.getAttribute('data-val'), 10);
        currentGiven += val;
        if (givenValEl) givenValEl.textContent = formatRupiah(currentGiven);
      });
    });

    // Reset Button
    mount.querySelector('#btn-reset-change').addEventListener('click', () => {
      playSfx('click');
      currentGiven = 0;
      if (givenValEl) givenValEl.textContent = formatRupiah(currentGiven);
      notify('Baki kembalian dikosongkan.', 'info');
    });

    // Submit Change
    mount.querySelector('#btn-submit-change').addEventListener('click', () => {
      const c = customers[currentCustIdx];
      if (currentGiven === c.change) {
        // Perfect change!
        playSfx('success');
        notify(`Luar biasa! Kembalian ${formatRupiah(c.change)} tepat dan diterima oleh ${c.name}! 🎉`, 'success');
        currentCustIdx++;
        setTimeout(() => {
          loadCustomer(currentCustIdx);
        }, 500);
      } else {
        // Wrong change
        playSfx('back');
        mistakes++;
        const posScreen = mount.querySelector('#ch3-pos-screen');
        if (posScreen) {
          posScreen.style.animation = 'villainShake 0.4s ease';
          setTimeout(() => posScreen.style.animation = 'none', 400);
        }
        notify(`Nominal belum pas! Target kembalian ${formatRupiah(c.change)}, yang kamu berikan ${formatRupiah(currentGiven)}. Coba hitung ulang ya!`, 'warning');
      }
    });

    loadCustomer(0);

    startTimer(40.0, null, () => {
      showFailScreen(mount, 'Waktu habis! Antrean kasir menumpuk karena perhitungan kembalian terlambat!');
    });
  }

  // ===========================================================================
  // EPISODE 3: SORTIR & STIKER KODE BARANG
  // ===========================================================================
  function startEpisode3(mount) {
    const items = [
      { id: 'i1', title: 'Laptop Kerja Asus Mini', code: 'ELK-01', target: 'elk', icon: '💻', desc: 'Perangkat Komputer' },
      { id: 'i2', title: 'Kertas Rim HVS 80gr', code: 'ATK-02', target: 'atk', icon: '📄', desc: 'Kertas Cetak Laporan' },
      { id: 'i3', title: 'Kursi Putar Ergonomis', code: 'FUR-03', target: 'fur', icon: '🪑', desc: 'Perabot Meja Kerja' },
      { id: 'i4', title: 'Pembersih Kaca Spray', code: 'KBS-04', target: 'kbs', icon: '🧴', desc: 'Sanitasi Kantor' },
      { id: 'i5', title: 'Proyektor Mini Presentasi', code: 'ELK-05', target: 'elk', icon: '📽️', desc: 'Media Presentasi' },
      { id: 'i6', title: 'Spidol Whiteboard & Eraser', code: 'ATK-06', target: 'atk', icon: '🖊️', desc: 'Alat Tulis Rapat' },
    ];

    items.sort(() => Math.random() - 0.5);

    let sortedCount = 0;
    let mistakes = 0;

    mount.innerHTML = `
      <div class="ch3-game-arena">
        <div class="ch3-arena-sparks"></div>
        ${renderHUD(mount, 3, 'Sortir & Stiker Kode Barang', 'Tempelkan stiker kode kategori ke rak yang tepat: ELK (Elektronik 💻), ATK (Alat Tulis ✏️), FUR (Furnitur 🪑), atau KBS (Kebersihan 🧹)!', '📦')}

        <div class="ch3-ep3-arena">
          <!-- 4 Warehouses Shelves -->
          <div class="ch3-shelves-grid">
            <div class="ch3-shelf-card elk" id="sh-elk" data-cat="elk">
              <span style="font-size:1.6rem;">💻</span>
              <span class="ch3-shelf-code">RAK-ELK</span>
              <span class="ch3-shelf-name">Elektronik & IT</span>
            </div>

            <div class="ch3-shelf-card atk" id="sh-atk" data-cat="atk">
              <span style="font-size:1.6rem;">✏️</span>
              <span class="ch3-shelf-code">RAK-ATK</span>
              <span class="ch3-shelf-name">Alat Tulis Kantor</span>
            </div>

            <div class="ch3-shelf-card fur" id="sh-fur" data-cat="fur">
              <span style="font-size:1.6rem;">🪑</span>
              <span class="ch3-shelf-code">RAK-FUR</span>
              <span class="ch3-shelf-name">Furnitur & Perabot</span>
            </div>

            <div class="ch3-shelf-card kbs" id="sh-kbs" data-cat="kbs">
              <span style="font-size:1.6rem;">🧹</span>
              <span class="ch3-shelf-code">RAK-KBS</span>
              <span class="ch3-shelf-name">Sanitasi & Bersih</span>
            </div>
          </div>

          <!-- Inventory Pool -->
          <div class="ch3-items-pool" id="ch3-items-pool">
            ${items.map(it => `
              <div class="ch3-inv-card" id="inv-${it.id}" draggable="true" data-id="${it.id}" data-target="${it.target}">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:1.5rem;">${it.icon}</span>
                  <div>
                    <div style="font-size:0.84rem; font-weight:800; color:#0f172a;">${it.title}</div>
                    <div style="font-size:0.7rem; color:#64748b;">${it.desc}</div>
                    <span style="font-family:'Courier New', monospace; font-size:0.72rem; font-weight:800; color:#d97706;">🏷️ ${it.code}</span>
                  </div>
                </div>
                <div class="ch3-inv-actions">
                  <button type="button" class="ch3-btn-shelf elk" data-to="elk">💻 ELK</button>
                  <button type="button" class="ch3-btn-shelf atk" data-to="atk">✏️ ATK</button>
                  <button type="button" class="ch3-btn-shelf fur" data-to="fur">🪑 FUR</button>
                  <button type="button" class="ch3-btn-shelf kbs" data-to="kbs">🧹 KBS</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const progressEl = mount.querySelector('#ch3-progress-val');
    if (progressEl) progressEl.textContent = items.length;

    function handleItemSort(id, chosenShelf, cardEl) {
      if (!cardEl || cardEl.classList.contains('sorted-anim')) return;
      const it = items.find(i => i.id === id);
      if (!it) return;

      if (it.target === chosenShelf) {
        // Correct
        playSfx('coin');
        sortedCount++;

        const shelfEl = mount.querySelector(`#sh-${chosenShelf}`);
        if (shelfEl) {
          shelfEl.classList.add('flash');
          setTimeout(() => shelfEl.classList.remove('flash'), 350);
        }

        cardEl.classList.add('sorted-anim');
        setTimeout(() => cardEl.remove(), 280);

        const left = items.length - sortedCount;
        if (progressEl) progressEl.textContent = left;
        notify(`Sukses! ${it.title} diberi stiker & ditata ke RAK-${it.target.toUpperCase()}! ✨`, 'success');

        if (sortedCount >= items.length) {
          stop();
          playSfx('success');
          const stars = (remainingTime >= 15 && mistakes === 0) ? 3 : (remainingTime >= 5 ? 2 : 1);
          setTimeout(() => {
            if (callbacks.onComplete) {
              callbacks.onComplete({ stars, score: 800, timeRemaining: remainingTime, mistakes });
            }
          }, 600);
        }
      } else {
        // Mistake
        playSfx('back');
        mistakes++;
        cardEl.classList.add('wrong-shake');
        setTimeout(() => cardEl.classList.remove('wrong-shake'), 500);
        notify(`Kategori keliru! ${it.title} bukan untuk rak tersebut. Periksa fungsi barangnya!`, 'warning');
      }
    }

    // Quick Buttons
    mount.querySelectorAll('.ch3-btn-shelf').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.ch3-inv-card');
        if (!card) return;
        const id = card.getAttribute('data-id');
        const to = btn.getAttribute('data-to');
        handleItemSort(id, to, card);
      });
    });

    // Drag and Drop
    mount.querySelectorAll('.ch3-inv-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.getAttribute('data-id'));
      });
    });

    ['elk', 'atk', 'fur', 'kbs'].forEach(cat => {
      const sh = mount.querySelector(`#sh-${cat}`);
      if (!sh) return;
      sh.addEventListener('dragover', (e) => {
        e.preventDefault();
        sh.classList.add('dragover');
      });
      sh.addEventListener('dragleave', () => sh.classList.remove('dragover'));
      sh.addEventListener('drop', (e) => {
        e.preventDefault();
        sh.classList.remove('dragover');
        const id = e.dataTransfer.getData('text/plain');
        const card = mount.querySelector(`#inv-${id}`);
        handleItemSort(id, cat, card);
      });
    });

    startTimer(35.0, null, () => {
      showFailScreen(mount, 'Waktu habis! Barang inventaris gudang kantor masih berceceran!');
    });
  }

  // ===========================================================================
  // EPISODE 4: AUDIT SKALA PRIORITAS
  // ===========================================================================
  function startEpisode4(mount) {
    const proposals = [
      {
        id: 'p1',
        title: 'Tagihan Listrik & WiFi Kantor',
        amount: 450000,
        prio: 'essential',
        icon: '💡',
        desc: 'Urat nadi operasional! Tanpa listrik & internet, komputer, server arsip, dan lampu padam total.'
      },
      {
        id: 'p2',
        title: 'Sofa Pijat Elektrik Ruang Istirahat',
        amount: 2500000,
        prio: 'secondary',
        icon: '🛋️',
        desc: 'Fasilitas hiburan mewah tambahan. Kursi kerja yang ada saat ini masih sangat layak dan nyaman.'
      },
      {
        id: 'p3',
        title: 'Kertas HVS & Tinta Printer Laporan',
        amount: 175000,
        prio: 'essential',
        icon: '🖨️',
        desc: 'Kebutuhan mendesak mencetak berkas dinas, disposisi pimpinan, dan surat kontrak klien resmi.'
      },
      {
        id: 'p4',
        title: 'Mesin Kopi Kapsul Impor Mewah',
        amount: 1800000,
        prio: 'secondary',
        icon: '☕',
        desc: 'Kebutuhan sekunder pelengkap. Kantor sudah memiliki teko pemanas air dan kopi seduh standar.'
      },
      {
        id: 'p5',
        title: 'Kotak P3K & Obat Darurat Kantor',
        amount: 95000,
        prio: 'essential',
        icon: '🩹',
        desc: 'Keselamatan & pertolongan pertama kesehatan saat ada staf atau agen yang mendadak sakit/cedera.'
      },
      {
        id: 'p6',
        title: 'Camilan Biskuit Cokelat Impor Kaleng',
        amount: 350000,
        prio: 'secondary',
        icon: '🍪',
        desc: 'Kudapan manis mewah pelengkap meja rapat, bukan kebutuhan wajib harian kantor.'
      }
    ];

    let currentIdx = 0;
    let mistakes = 0;

    function formatRupiah(num) {
      return 'Rp ' + num.toLocaleString('id-ID');
    }

    mount.innerHTML = `
      <div class="ch3-game-arena">
        <div class="ch3-arena-sparks"></div>
        ${renderHUD(mount, 4, 'Audit Skala Prioritas', 'Audit daftar pengajuan pengeluaran: pisahkan Kebutuhan Esensial Kantor 🛡️ dari Belanja Sekunder ⏳!', '⚖️')}

        <div class="ch3-ep4-arena">
          <!-- 2 Priority Drop Bins -->
          <div class="ch3-priority-bins">
            <div class="ch3-prio-bin essential" id="bin-essential" data-prio="essential">
              <span style="font-size:1.8rem;">🛡️</span>
              <div style="color:#ffffff; font-weight:800; font-size:0.92rem;">Prioritas Utama (Esensial)</div>
              <div style="color:#fef3c7; font-size:0.75rem;">Wajib & Kritis Bagi Kelangsungan Kantor</div>
            </div>

            <div class="ch3-prio-bin secondary" id="bin-secondary" data-prio="secondary">
              <span style="font-size:1.8rem;">⏳</span>
              <div style="color:#ffffff; font-weight:800; font-size:0.92rem;">Prioritas Tambahan (Sekunder)</div>
              <div style="color:#e9d5ff; font-size:0.75rem;">Bisa Ditunda / Bukan Kebutuhan Pokok</div>
            </div>
          </div>

          <!-- Current Proposal Under Audit -->
          <div class="ch3-audit-pool" id="ch3-audit-pool">
            <!-- Dynamic card mounted here -->
          </div>
        </div>
      </div>
    `;

    const progressEl = mount.querySelector('#ch3-progress-val');
    const auditPool = mount.querySelector('#ch3-audit-pool');

    function loadProposal(idx) {
      if (idx >= proposals.length) {
        // Complete!
        stop();
        playSfx('badge');
        notify('Audit skala prioritas anggaran selesai sempurna dengan transparansi tinggi! ⚖️✨', 'success');
        const stars = (remainingTime >= 15 && mistakes === 0) ? 3 : (remainingTime >= 5 ? 2 : 1);
        setTimeout(() => {
          if (callbacks.onComplete) {
            callbacks.onComplete({ stars, score: 850, timeRemaining: remainingTime, mistakes });
          }
        }, 650);
        return;
      }

      const p = proposals[idx];
      if (progressEl) progressEl.textContent = `Audit ${idx + 1}/${proposals.length}`;

      auditPool.innerHTML = `
        <div class="ch3-audit-card" id="prop-${p.id}">
          <div class="ch3-audit-header">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.6rem;">${p.icon}</span>
              <span class="ch3-audit-title">${p.title}</span>
            </div>
            <span class="ch3-audit-amount">${formatRupiah(p.amount)}</span>
          </div>
          <div class="ch3-audit-desc">
            <strong>Keterangan Pengajuan:</strong> ${p.desc}
          </div>
          <div class="ch3-audit-actions">
            <button type="button" class="ch3-btn-audit essential" data-act="essential">
              🛡️ Setujui: Prioritas Utama (Esensial)
            </button>
            <button type="button" class="ch3-btn-audit secondary" data-act="secondary">
              ⏳ Tunda: Belanja Sekunder
            </button>
          </div>
        </div>
      `;

      auditPool.querySelectorAll('.ch3-btn-audit').forEach(btn => {
        btn.addEventListener('click', () => {
          const act = btn.getAttribute('data-act');
          handleAuditDecision(p, act);
        });
      });
    }

    function handleAuditDecision(p, chosenPrio) {
      if (p.prio === chosenPrio) {
        // Correct
        playSfx('coin');
        const bin = mount.querySelector(`#bin-${chosenPrio}`);
        if (bin) {
          bin.classList.add('flash');
          setTimeout(() => bin.classList.remove('flash'), 350);
        }

        notify(
          chosenPrio === 'essential'
            ? `Tepat! "${p.title}" adalah prioritas pokok kantor! 🛡️`
            : `Tepat! "${p.title}" adalah belanja sekunder yang dapat ditunda demi efisiensi kas! ⏳`,
          'success'
        );

        currentIdx++;
        setTimeout(() => loadProposal(currentIdx), 450);
      } else {
        // Mistake
        playSfx('back');
        mistakes++;
        const card = mount.querySelector(`#prop-${p.id}`);
        if (card) {
          card.classList.add('wrong-shake');
          setTimeout(() => card.classList.remove('wrong-shake'), 500);
        }
        notify(
          p.prio === 'essential'
            ? `Kurang tepat! "${p.title}" sangat penting bagi kelangsungan operasional kantor (Esensial)!`
            : `Kurang tepat! "${p.title}" merupakan barang mewah/sekunder yang bisa ditunda!`,
          'warning'
        );
      }
    }

    loadProposal(0);

    startTimer(35.0, null, () => {
      showFailScreen(mount, 'Waktu habis! Audit anggaran kantor belum selesai diverifikasi!');
    });
  }

  // ===========================================================================
  // EPISODE 5: BOSS LEVEL - KEBUTUHAN KAS & GUDANG 30 DETIK
  // ===========================================================================
  function startEpisode5(mount) {
    const tasks = [
      {
        id: 1,
        badge: 'Tahap 1: Audit Kas Masuk',
        prompt: 'Pilah "Koin Modal Kas Kantor Rp 200.000 🪙" ke Pos Kasir!',
        actionText: '🟢 Catat ke Kas Masuk',
        icon: '🪙'
      },
      {
        id: 2,
        badge: 'Tahap 2: Audit Nota Keluar',
        prompt: 'Pilah "Kuitansi Ongkir Kurir Kilat Rp 30.000 📦" ke Pos Kasir!',
        actionText: '🔴 Catat ke Kas Keluar',
        icon: '📦'
      },
      {
        id: 3,
        badge: 'Tahap 3: Hitung Kembalian Kilat',
        prompt: 'Total Belanja Rp 12.000, Uang Dibayar Rp 20.000. Kembaliannya?',
        actionText: '💵 Berikan Kembalian Rp 8.000',
        icon: '🧮'
      },
      {
        id: 4,
        badge: 'Tahap 4: Stiker Inventaris Cepat',
        prompt: 'Pasang Kode Stiker Inventaris pada "Laptop Kantor Utama 💻"!',
        actionText: '💻 Tempel ke RAK-ELK (Elektronik)',
        icon: '💻'
      },
      {
        id: 5,
        badge: 'Tahap 5: Skala Prioritas Anggaran',
        prompt: 'Audit "Tagihan Listrik & WiFi Kantor 💡", tergolong prioritas mana?',
        actionText: '🛡️ Setujui: Prioritas Utama (Esensial)',
        icon: '💡'
      },
      {
        id: 6,
        badge: 'Tahap 6: Restorasi Brankas & Gudang',
        prompt: 'Aktifkan "Kunci Brankas & Reboot Sistem Logistik Gudang 🔐"!',
        actionText: '🔐 KUNCI BRANKAS & PULIHKAN LOGISTIK!',
        icon: '🔐'
      }
    ];

    let currentStep = 0;
    let mistakes = 0;

    const villainQuotes = [
      'Mwahaha! Koin brankas kas dan rak gudang logistik sudah kuacak total dalam 30 detik! 💰🌪️',
      'Kalian tak akan sempat membedakan kas masuk dan nota pengeluaran!',
      'Kasir kalian akan keliru menghitung kembalian uang belanja!',
      'Gudang logistik kalian akan kacau tanpa stiker barcode inventaris!',
      'Aduuuh! Sistem audit keuangan kalian terlalu teliti dan solid?!',
      'TIDAAAK! Jangan kunci pintu brankas dan pulihkan sistem gudang itu!'
    ];

    mount.innerHTML = `
      <div class="ch3-game-arena ch3-ep5-arena">
        <div class="ch3-arena-sparks"></div>

        <!-- Dr. Chaos Boss Financial Jammer Header -->
        <div class="ch1-boss-header">
          <div class="ch1-boss-portrait">😈</div>
          <div class="ch1-boss-dialogue">
            <div class="ch1-boss-name">DR. CHAOS (BOSS LEVEL CH 3)</div>
            <div class="ch1-boss-quote" id="ch3-boss-quote">"${villainQuotes[0]}"</div>
          </div>
          <div class="ch1-boss-digits" id="ch3-boss-digits">30.00s</div>
        </div>

        <!-- Financial & Warehouse Vault Stability Bar -->
        <div class="ch1-stability-wrap">
          <div class="ch1-stability-row">
            <span>🔐 Stabilitas Sistem Keuangan & Gudang:</span>
            <strong id="ch3-vault-percent">0%</strong>
          </div>
          <div class="ch3-vault-bar-track">
            <div class="ch3-vault-bar-fill" id="ch3-vault-fill"></div>
          </div>
        </div>

        <!-- Boss Challenge Box -->
        <div class="ch1-stage" id="ch3-boss-stage">
          <div class="ch1-boss-challenge-box" id="ch3-challenge-box">
            <!-- Dynamic task mounted here -->
          </div>
        </div>
      </div>
    `;

    const vaultFill = mount.querySelector('#ch3-vault-fill');
    const vaultPercent = mount.querySelector('#ch3-vault-percent');
    const bossQuote = mount.querySelector('#ch3-boss-quote');
    const bossDigits = mount.querySelector('#ch3-boss-digits');
    const challengeBox = mount.querySelector('#ch3-challenge-box');

    function renderBossStep() {
      if (currentStep >= tasks.length) {
        // Complete Boss Level!
        stop();
        playSfx('badge');
        if (vaultFill) vaultFill.style.width = '100%';
        if (vaultPercent) vaultPercent.textContent = '100% (BRANKAS & GUDANG AMAN)';
        if (bossQuote) bossQuote.textContent = '"Aduuuh! Sistem audit kas dan gudang kalian terlalu kuat! Aku kalah lagi! 💥"';

        const stars = remainingTime >= 10.0 ? 3 : (remainingTime >= 1.0 ? 2 : 1);
        setTimeout(() => {
          if (callbacks.onComplete) {
            callbacks.onComplete({ stars, score: 1000, timeRemaining: remainingTime, mistakes });
          }
        }, 800);
        return;
      }

      const task = tasks[currentStep];
      const stepPercent = Math.round((currentStep / tasks.length) * 100);
      if (vaultFill) vaultFill.style.width = `${stepPercent}%`;
      if (vaultPercent) vaultPercent.textContent = `${stepPercent}%`;
      if (bossQuote && villainQuotes[currentStep]) {
        bossQuote.textContent = `"${villainQuotes[currentStep]}"`;
      }

      challengeBox.innerHTML = `
        <div class="ch1-boss-task-badge">${task.badge}</div>
        <div class="ch1-boss-task-prompt">
          <span style="font-size:2rem;">${task.icon}</span>
          <span style="font-size:0.95rem; font-weight:700; color:#f8fafc;">${task.prompt}</span>
        </div>
        <button type="button" class="ch1-btn-boss-action" id="btn-boss-act">
          ${task.actionText}
        </button>
      `;

      challengeBox.querySelector('#btn-boss-act').addEventListener('click', () => {
        playSfx('coin');
        currentStep++;
        notify(`Langkah ${currentStep} berhasil diselesaikan! ⚡`, 'success');
        renderBossStep();
      });
    }

    renderBossStep();

    startTimer(30.0, (rem) => {
      if (bossDigits) bossDigits.textContent = `${rem.toFixed(2)}s`;
    }, () => {
      showFailScreen(mount, 'Waktu habis! Dr. Chaos menguras brankas kas kecil dan mengacak rak inventaris kantor!');
    });
  }

  // Engine Entry Point
  function start(episodeId, options = {}) {
    currentEpisodeId = episodeId;
    callbacks = {
      onComplete: options.onComplete || null,
      onRetry: options.onRetry || null,
      onQuit: options.onQuit || null,
    };

    const mount = document.getElementById('ch3-minigame-mount');
    if (!mount) {
      console.error('[Chapter3MiniGames] #ch3-minigame-mount not found');
      return;
    }

    stop();

    if (episodeId === 1) {
      startEpisode1(mount);
    } else if (episodeId === 2) {
      startEpisode2(mount);
    } else if (episodeId === 3) {
      startEpisode3(mount);
    } else if (episodeId === 4) {
      startEpisode4(mount);
    } else if (episodeId === 5) {
      startEpisode5(mount);
    } else {
      startEpisode1(mount);
    }
  }

  return {
    start,
    stop,
  };
})();

window.Chapter3MiniGames = Chapter3MiniGames;







// =============================================================================
// CHAPTER 4 INTERACTIVE MINI GAMES ENGINE
// Pilar Manajemen Operasional — Episodes 1 to 5
// 2D Interactive Operations Bureaucracy, SOP Flowchart Reconstruction,
// Facility & Blueprint Audit, Document Authenticity Verification,
// & Boss Level: 30-Second Administration Recovery (EXtreme Difficulty)
// =============================================================================
const Chapter4MiniGames = (() => {
  'use strict';

  let currentEpisodeId = 1;
  let timerInterval = null;
  let remainingTime = 40.0;
  let totalTime = 40.0;
  let isRunning = false;
  let callbacks = { onComplete: null, onRetry: null, onQuit: null };

  function playSfx(type) {
    if (typeof SoundSystem !== 'undefined' && SoundSystem.play) {
      SoundSystem.play(type);
    }
  }

  function notify(text, type = 'info') {
    if (typeof showToast === 'function') {
      showToast(text, type);
    }
  }

  function stop() {
    isRunning = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    window.onkeydown = null;
  }

  function renderHUD(epNum, epTitle, instruction, icon) {
    return `
      <div class="ch4-hud">
        <div class="ch1-hud-row">
          <div class="ch1-hud-title-group">
            <span class="ch4-badge-ep">CH 4 • EPISODE ${epNum}</span>
            <span class="ch1-hud-name">${icon} ${epTitle}</span>
          </div>
          <div class="ch1-hud-stats">
            <div class="ch1-timer-chip">
              <span>⏱️</span>
              <strong id="ch4-timer-val">40.0s</strong>
            </div>
            <div class="ch1-progress-chip">
              <span>🎯 Sisa:</span>
              <strong id="ch4-progress-val">0</strong>
            </div>
          </div>
        </div>
        <div class="ch1-hud-instructions">
          <span>💡 <strong>Misi:</strong> ${instruction}</span>
        </div>
        <div class="ch1-timer-bar-track">
          <div class="ch1-timer-bar-fill" id="ch4-timer-fill" style="width: 100%;"></div>
        </div>
      </div>
    `;
  }

  function startTimer(durationSeconds, onTick, onTimeUp) {
    if (timerInterval) clearInterval(timerInterval);
    remainingTime = durationSeconds;
    totalTime = durationSeconds;
    isRunning = true;

    const timerValEl = document.getElementById('ch4-timer-val');
    const timerFillEl = document.getElementById('ch4-timer-fill');

    if (timerValEl) timerValEl.textContent = `${remainingTime.toFixed(1)}s`;
    if (timerFillEl) timerFillEl.style.width = '100%';

    timerInterval = setInterval(() => {
      if (!isRunning) return;
      remainingTime -= 0.1;

      if (timerValEl) timerValEl.textContent = `${Math.max(0, remainingTime).toFixed(1)}s`;
      if (timerFillEl) {
        const pct = Math.max(0, (remainingTime / totalTime) * 100);
        timerFillEl.style.width = `${pct}%`;
        if (pct < 25) timerFillEl.style.background = '#ef4444';
        else if (pct < 50) timerFillEl.style.background = '#f59e0b';
        else timerFillEl.style.background = '#06b6d4';
      }

      if (onTick) onTick(remainingTime);

      if (remainingTime <= 0) {
        stop();
        if (timerValEl) timerValEl.textContent = '0.0s';
        if (timerFillEl) timerFillEl.style.width = '0%';
        playSfx('back');
        if (onTimeUp) onTimeUp();
      }
    }, 100);
  }

  function applyPenalty(seconds = 2.0) {
    remainingTime = Math.max(0, remainingTime - seconds);
    const timerValEl = document.getElementById('ch4-timer-val');
    if (timerValEl) {
      timerValEl.textContent = `${remainingTime.toFixed(1)}s`;
      timerValEl.classList.add('penalty-flash');
      setTimeout(() => timerValEl.classList.remove('penalty-flash'), 400);
    }
  }

  function showFailScreen(mount, message) {
    const existing = mount.querySelector('.ch1-fail-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'ch1-fail-overlay';
    overlay.innerHTML = `
      <div class="ch1-fail-icon">⚙️</div>
      <h3 class="ch1-fail-title">SISTEM OPERASIONAL LUMPUH!</h3>
      <p class="ch1-fail-desc">${message || 'Waktu pemulihan habis sebelum sistem administrasi dan operasional kantor tertata rapi. Coba lagi dan tegakkan kembali birokrasi kantor!'}</p>
      <div class="ch1-fail-actions">
        <button class="ch1-btn-retry" id="ch4-btn-retry-action">🔄 Coba Lagi</button>
        <button class="ch1-btn-quit" id="ch4-btn-quit-action">🏠 Menu Misi</button>
      </div>
    `;

    mount.querySelector('.ch4-game-arena').appendChild(overlay);

    overlay.querySelector('#ch4-btn-retry-action').addEventListener('click', () => {
      playSfx('click');
      if (callbacks.onRetry) callbacks.onRetry();
      else start(currentEpisodeId, callbacks);
    });

    overlay.querySelector('#ch4-btn-quit-action').addEventListener('click', () => {
      playSfx('back');
      if (callbacks.onQuit) callbacks.onQuit();
    });
  }

  // ===========================================================================
  // EPISODE 1: TATA KELOLA DOKUMEN OPERASIONAL
  // Mekanik: Klasifikasi dokumen operasional melayang akibat antigravitasi
  // ke 4 laci birokrasi (Regulasi/SOP, Finansial, SDM, Logistik)
  // ===========================================================================
  function startEpisode1(mount) {
    const documents = [
      { id: 'd1', title: 'Surat Keputusan Direksi No. 04', type: 'regulasi', typeName: 'Regulasi & SOP', icon: '📜', desc: 'Penetapan pedoman operasional jam kerja kantor' },
      { id: 'd2', title: 'Purchase Order (PO) 10 Laptop', type: 'finansial', typeName: 'Finansial & Purchasing', icon: '💰', desc: 'Disposisi anggaran pengadaan komputer operasional' },
      { id: 'd3', title: 'Form Pengajuan Cuti Tahunan Staf', type: 'sdm', typeName: 'SDM & Personalia', icon: '👥', desc: 'Permohonan cuti resmi staf divisi administrasi' },
      { id: 'd4', title: 'Surat Jalan Distribusi Logistik', type: 'logistik', typeName: 'Logistik & Aset', icon: '📦', desc: 'Dokumen pengiriman peralatan antar cabang kantor' },
      { id: 'd5', title: 'Pedoman Standar K3 Kantor', type: 'regulasi', typeName: 'Regulasi & SOP', icon: '📜', desc: 'Protokol keselamatan kerja dan evakuasi gedung' },
      { id: 'd6', title: 'Invoice Tagihan Vendor Cloud', type: 'finansial', typeName: 'Finansial & Purchasing', icon: '💰', desc: 'Kuitansi pembayaran server database kantor' },
      { id: 'd7', title: 'Lembar Penilaian Kinerja Staf', type: 'sdm', typeName: 'SDM & Personalia', icon: '👥', desc: 'Evaluasi performa bulanan agen operasional cilik' },
      { id: 'd8', title: 'Berita Acara Penerimaan Inventaris', type: 'logistik', typeName: 'Logistik & Aset', icon: '📦', desc: 'Pencatatan aset meja dan kursi baru masuk gudang' }
    ];

    let currentIndex = 0;
    let mistakes = 0;
    let sortedCount = { regulasi: 0, finansial: 0, sdm: 0, logistik: 0 };

    mount.innerHTML = `
      <div class="ch4-game-arena ch4-ep1-arena">
        ${renderHUD(1, 'Tata Kelola Dokumen Operasional', 'Klasifikasikan dokumen operasional melayang ke 4 laci birokrasi yang tepat!', '📂')}
        
        <div class="ch4-antigravity-zone">
          <div class="ch4-floating-particles">
            <span class="particle p1">📄</span>
            <span class="particle p2">✨</span>
            <span class="particle p3">📑</span>
            <span class="particle p4">🌀</span>
          </div>

          <div class="ch4-active-doc-container" id="ch4-active-doc-box">
            <!-- Active floating doc inserted here -->
          </div>
        </div>

        <div class="ch4-drawers-grid">
          <div class="ch4-drawer-card drawer-regulasi" data-type="regulasi" id="drawer-regulasi">
            <div class="ch4-drawer-handle"></div>
            <div class="ch4-drawer-header">
              <span class="drawer-icon">📜</span>
              <div>
                <h4 class="drawer-title">Regulasi & SOP</h4>
                <span class="drawer-sub">SK Direksi, K3, Kebijakan</span>
              </div>
            </div>
            <div class="ch4-drawer-count" id="count-regulasi">0 Dokumen</div>
          </div>

          <div class="ch4-drawer-card drawer-finansial" data-type="finansial" id="drawer-finansial">
            <div class="ch4-drawer-handle"></div>
            <div class="ch4-drawer-header">
              <span class="drawer-icon">💰</span>
              <div>
                <h4 class="drawer-title">Finansial & Purchasing</h4>
                <span class="drawer-sub">PO, Invoice, Tagihan Vendor</span>
              </div>
            </div>
            <div class="ch4-drawer-count" id="count-finansial">0 Dokumen</div>
          </div>

          <div class="ch4-drawer-card drawer-sdm" data-type="sdm" id="drawer-sdm">
            <div class="ch4-drawer-handle"></div>
            <div class="ch4-drawer-header">
              <span class="drawer-icon">👥</span>
              <div>
                <h4 class="drawer-title">SDM & Personalia</h4>
                <span class="drawer-sub">Form Cuti, Absensi, Kinerja</span>
              </div>
            </div>
            <div class="ch4-drawer-count" id="count-sdm">0 Dokumen</div>
          </div>

          <div class="ch4-drawer-card drawer-logistik" data-type="logistik" id="drawer-logistik">
            <div class="ch4-drawer-handle"></div>
            <div class="ch4-drawer-header">
              <span class="drawer-icon">📦</span>
              <div>
                <h4 class="drawer-title">Logistik & Aset</h4>
                <span class="drawer-sub">Surat Jalan, Inventaris, BAST</span>
              </div>
            </div>
            <div class="ch4-drawer-count" id="count-logistik">0 Dokumen</div>
          </div>
        </div>
      </div>
    `;

    const docBox = mount.querySelector('#ch4-active-doc-box');
    const progEl = mount.querySelector('#ch4-progress-val');

    function renderActiveDoc() {
      if (currentIndex >= documents.length) {
        // Complete!
        stop();
        playSfx('success');
        let stars = 3;
        if (mistakes >= 3) stars = 1;
        else if (mistakes >= 1) stars = 2;

        notify(`Luar biasa! 8 Dokumen Operasional berhasil ditata rapi! ⭐ ${stars} Bintang!`, 'success');
        setTimeout(() => {
          if (callbacks.onComplete) {
            callbacks.onComplete({ stars, score: 800, timeRemaining: remainingTime, mistakes });
          }
        }, 800);
        return;
      }

      const doc = documents[currentIndex];
      const remaining = documents.length - currentIndex;
      if (progEl) progEl.textContent = `${remaining} Dokumen`;

      docBox.innerHTML = `
        <div class="ch4-doc-floating-card antigravity-float" id="ch4-doc-current">
          <div class="ch4-doc-float-glow"></div>
          <div class="ch4-doc-badge">🌀 Melayang di Gravitasi Nol (${currentIndex + 1} / ${documents.length})</div>
          <div class="ch4-doc-main">
            <span class="ch4-doc-icon">${doc.icon}</span>
            <div class="ch4-doc-meta">
              <h3 class="ch4-doc-title">${doc.title}</h3>
              <p class="ch4-doc-desc">${doc.desc}</p>
            </div>
          </div>
          <div class="ch4-doc-actions-hint">Pilih laci birokrasi yang tepat:</div>
          <div class="ch4-doc-quick-actions">
            <button class="ch4-btn-classify btn-regulasi" data-target="regulasi">📜 Regulasi/SOP</button>
            <button class="ch4-btn-classify btn-finansial" data-target="finansial">💰 Finansial</button>
            <button class="ch4-btn-classify btn-sdm" data-target="sdm">👥 SDM</button>
            <button class="ch4-btn-classify btn-logistik" data-target="logistik">📦 Logistik</button>
          </div>
        </div>
      `;

      // Quick action buttons
      docBox.querySelectorAll('.ch4-btn-classify').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const target = btn.getAttribute('data-target');
          handleClassification(target);
        });
      });
    }

    function handleClassification(chosenDrawer) {
      const doc = documents[currentIndex];
      const currentCard = mount.querySelector('#ch4-doc-current');
      const targetDrawerEl = mount.querySelector(`#drawer-${chosenDrawer}`);

      if (chosenDrawer === doc.type) {
        // Correct!
        playSfx('place');
        sortedCount[chosenDrawer]++;
        const countEl = mount.querySelector(`#count-${chosenDrawer}`);
        if (countEl) countEl.textContent = `${sortedCount[chosenDrawer]} Dokumen`;

        if (targetDrawerEl) {
          targetDrawerEl.classList.add('flash-correct');
          setTimeout(() => targetDrawerEl.classList.remove('flash-correct'), 500);
        }

        if (currentCard) {
          currentCard.classList.add('suck-into-drawer');
        }

        currentIndex++;
        setTimeout(renderActiveDoc, 350);
      } else {
        // Wrong!
        playSfx('warning');
        mistakes++;
        applyPenalty(1.5);
        notify(`⚠️ Salah laci! "${doc.title}" termasuk kategori ${doc.typeName}! (-1.5s)`, 'warning');

        if (currentCard) {
          currentCard.classList.add('shake-error');
          setTimeout(() => currentCard.classList.remove('shake-error'), 450);
        }

        if (targetDrawerEl) {
          targetDrawerEl.classList.add('flash-wrong');
          setTimeout(() => targetDrawerEl.classList.remove('flash-wrong'), 450);
        }
      }
    }

    // Direct click on drawers
    mount.querySelectorAll('.ch4-drawer-card').forEach(card => {
      card.addEventListener('click', () => {
        if (currentIndex < documents.length) {
          const type = card.getAttribute('data-type');
          handleClassification(type);
        }
      });
    });

    renderActiveDoc();

    startTimer(40.0, null, () => {
      showFailScreen(mount, 'Waktu habis! Dokumen operasional masih melayang tak beraturan akibat gravitasi Dr. Chaos!');
    });
  }

  // ===========================================================================
  // EPISODE 2: REKONSTRUKSI FLOWCHART SOP
  // Mekanik: Menyusun kembali urutan 5 langkah SOP kantor yang teracak
  // Input Formulir -> Verifikasi Berkas -> Persetujuan Manajer -> Eksekusi -> Arsip
  // ===========================================================================
  function startEpisode2(mount) {
    const sopSteps = [
      { id: 1, stepNumber: 1, title: 'Input Permohonan', icon: '📥', desc: 'Divisi mengajukan formulir pengadaan operasional resmi' },
      { id: 2, stepNumber: 2, title: 'Verifikasi Administrasi', icon: '🔍', desc: 'Pengecekan kelengkapan berkas & pagu anggaran' },
      { id: 3, stepNumber: 3, title: 'Persetujuan Manajer', icon: '⚖️', desc: 'Disposisi kelayakan keputusan bisnis oleh pimpinan' },
      { id: 4, stepNumber: 4, title: 'Eksekusi Pengadaan', icon: '🛒', desc: 'Penerbitan PO dan pemesanan ke vendor terdaftar' },
      { id: 5, stepNumber: 5, title: 'Audit Akhir & Arsip SOP', icon: '📁', desc: 'Inspeksi fisik barang dan penutupan dokumen berita acara' }
    ];

    // Shuffled initial blocks
    let unassignedBlocks = [...sopSteps].sort(() => Math.random() - 0.5);
    let slots = [null, null, null, null, null]; // 5 slots
    let mistakes = 0;

    mount.innerHTML = `
      <div class="ch4-game-arena ch4-ep2-arena">
        ${renderHUD(2, 'Rekonstruksi Flowchart SOP', 'Susun balok langkah SOP sesuai alur keputusan bisnis kantor yang logis!', '🔀')}

        <div class="ch4-flowchart-container">
          <div class="ch4-flowchart-header">
            <span class="sop-tag">Bagan Standar Operasional Prosedur (SOP)</span>
            <span class="sop-theme">SOP-OPS-01: Prosedur Pengadaan Fasilitas Kantor</span>
          </div>

          <div class="ch4-flowchart-track" id="ch4-flow-track">
            <!-- 5 Flow Slots -->
            ${[1, 2, 3, 4, 5].map(num => `
              <div class="ch4-flow-slot-wrapper">
                <div class="ch4-flow-slot" data-slot-index="${num - 1}" id="flow-slot-${num - 1}">
                  <div class="slot-placeholder">
                    <span class="slot-num">Tahap ${num}</span>
                    <span class="slot-hint">Klik balok untuk tempatkan</span>
                  </div>
                </div>
                ${num < 5 ? `<div class="ch4-flow-arrow" id="flow-arrow-${num - 1}">➔</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <div class="ch4-sop-tray-wrapper">
          <div class="tray-title-row">
            <span class="tray-title">🧩 Potongan Balok SOP Teracak (Klik balok untuk masukkan ke slot alur):</span>
            <button class="ch4-btn-reset-sop" id="btn-reset-sop">🔄 Reset Balok</button>
          </div>
          <div class="ch4-sop-tray" id="ch4-sop-tray">
            <!-- Unassigned blocks -->
          </div>
        </div>

        <div class="ch4-flow-controls">
          <button class="ch4-btn-validate-sop" id="btn-validate-sop">
            <span>⚡ Validasi Alur SOP Sekarang</span>
          </button>
        </div>
      </div>
    `;

    const trayEl = mount.querySelector('#ch4-sop-tray');
    const progEl = mount.querySelector('#ch4-progress-val');

    function renderSlotsAndTray() {
      // Update slots
      slots.forEach((item, idx) => {
        const slotEl = mount.querySelector(`#flow-slot-${idx}`);
        if (!slotEl) return;

        if (item) {
          slotEl.innerHTML = `
            <div class="ch4-slotted-card" data-step-id="${item.id}">
              <div class="slotted-header">
                <span class="slotted-num">Tahap ${idx + 1}</span>
                <button class="btn-remove-slotted" title="Lepas Balok">&times;</button>
              </div>
              <div class="slotted-body">
                <span class="slotted-icon">${item.icon}</span>
                <span class="slotted-title">${item.title}</span>
              </div>
            </div>
          `;

          slotEl.querySelector('.btn-remove-slotted').addEventListener('click', (e) => {
            e.stopPropagation();
            playSfx('unequip');
            unassignedBlocks.push(item);
            slots[idx] = null;
            renderSlotsAndTray();
          });
        } else {
          slotEl.innerHTML = `
            <div class="slot-placeholder">
              <span class="slot-num">Tahap ${idx + 1}</span>
              <span class="slot-hint">Kosong</span>
            </div>
          `;
        }

        slotEl.onclick = () => {
          if (slots[idx]) {
            playSfx('unequip');
            unassignedBlocks.push(slots[idx]);
            slots[idx] = null;
            renderSlotsAndTray();
          }
        };
      });

      // Update tray
      trayEl.innerHTML = '';
      if (unassignedBlocks.length === 0) {
        trayEl.innerHTML = `<div class="tray-empty-hint">✨ Semua balok sudah masuk ke bagan alur! Tekan tombol <strong>Validasi Alur SOP</strong> di bawah!</div>`;
      } else {
        unassignedBlocks.forEach((block, bIdx) => {
          const card = document.createElement('div');
          card.className = 'ch4-sop-tray-card';
          card.innerHTML = `
            <div class="tray-card-icon">${block.icon}</div>
            <div class="tray-card-info">
              <h5 class="tray-card-title">${block.title}</h5>
              <p class="tray-card-desc">${block.desc}</p>
            </div>
            <button class="btn-place-sop">Pasang ➔</button>
          `;

          card.addEventListener('click', () => {
            // Find first empty slot
            const firstEmptyIdx = slots.indexOf(null);
            if (firstEmptyIdx !== -1) {
              playSfx('place');
              slots[firstEmptyIdx] = block;
              unassignedBlocks.splice(bIdx, 1);
              renderSlotsAndTray();
            } else {
              notify('Semua slot alur sudah terisi! Lepaskan satu untuk menukar.', 'warning');
            }
          });

          trayEl.appendChild(card);
        });
      }

      // Progress count
      const filledCount = slots.filter(s => s !== null).length;
      if (progEl) progEl.textContent = `${5 - filledCount} Kosong`;
    }

    renderSlotsAndTray();

    // Reset button
    mount.querySelector('#btn-reset-sop').addEventListener('click', () => {
      playSfx('click');
      unassignedBlocks = [...sopSteps].sort(() => Math.random() - 0.5);
      slots = [null, null, null, null, null];
      renderSlotsAndTray();
    });

    // Validate button
    mount.querySelector('#btn-validate-sop').addEventListener('click', () => {
      const unfilled = slots.some(s => s === null);
      if (unfilled) {
        playSfx('warning');
        notify('Lengkapi seluruh 5 tahap alur SOP sebelum memvalidasi!', 'warning');
        return;
      }

      // Check order: stepNumber must be 1, 2, 3, 4, 5
      let isCorrect = true;
      let wrongSlots = [];

      slots.forEach((item, idx) => {
        if (item.stepNumber !== idx + 1) {
          isCorrect = false;
          wrongSlots.push(idx);
        }
      });

      if (isCorrect) {
        // SUCCESS!
        stop();
        playSfx('success');
        mount.querySelectorAll('.ch4-flow-slot').forEach(s => s.classList.add('flow-success-glow'));
        mount.querySelectorAll('.ch4-flow-arrow').forEach(a => a.classList.add('arrow-glow'));

        let stars = 3;
        if (mistakes >= 3) stars = 1;
        else if (mistakes >= 1) stars = 2;

        notify(`Bagus sekali! Alur SOP Pengadaan Tervalidasi Sempurna! ⭐ ${stars} Bintang!`, 'success');
        setTimeout(() => {
          if (callbacks.onComplete) {
            callbacks.onComplete({ stars, score: 850, timeRemaining: remainingTime, mistakes });
          }
        }, 1000);
      } else {
        // Wrong order!
        playSfx('warning');
        mistakes++;
        applyPenalty(2.0);

        wrongSlots.forEach(idx => {
          const slotEl = mount.querySelector(`#flow-slot-${idx}`);
          if (slotEl) {
            slotEl.classList.add('shake-error');
            setTimeout(() => slotEl.classList.remove('shake-error'), 500);
          }
        });

        notify('Urutan alur SOP belum tepat! Perhatikan logika: Input Permohonan ➔ Verifikasi ➔ Persetujuan Manajer ➔ Eksekusi ➔ Arsip!', 'warning');
      }
    });

    startTimer(45.0, null, () => {
      showFailScreen(mount, 'Waktu habis! Bagan alur SOP kantor gagal disusun kembali!');
    });
  }

  // ===========================================================================
  // EPISODE 3: AUDIT TATA RUANG & FASILITAS KANTOR
  // Mekanik: Denah Blueprint 2D kantor. Tempatkan 6 inventaris kantor
  // ke zona yang benar dan lakukan inspeksi/perbaikan pada fasilitas rusak.
  // ===========================================================================
  function startEpisode3(mount) {
    const zones = [
      { id: 'workstation', name: 'Ruang Kerja Terbuka', icon: '💻', desc: 'Meja kerja tim, PC, fotokopi' },
      { id: 'meeting', name: 'Ruang Rapat Direksi', icon: '🤝', desc: 'Diskusi bisnis, layar proyektor' },
      { id: 'pantry', name: 'Area Pantry & Istirahat', icon: '☕', desc: 'Kopi, lemari es, relaksasi staf' },
      { id: 'archive', name: 'Ruang Arsip Dokumen', icon: '🗄️', desc: 'Lemari berkas rahasia & dokumen' }
    ];

    const facilities = [
      { id: 'f1', name: 'Meja Kerja Ergonomis & PC', icon: '🖥️', correctZone: 'workstation', damaged: false },
      { id: 'f2', name: 'Layar Proyektor Rapat', icon: '📊', correctZone: 'meeting', damaged: true, repairHint: 'Kabel proyektor longgar & miring' },
      { id: 'f3', name: 'Mesin Kopi Espresso Otomatis', icon: '☕', correctZone: 'pantry', damaged: false },
      { id: 'f4', name: 'Lemari Arsip Tahan Api', icon: '🗄️', correctZone: 'archive', damaged: true, repairHint: 'Kunci pintu macet & laci keluar jalur' },
      { id: 'f5', name: 'Mesin Fotokopi & Scanner Utama', icon: '🖨️', correctZone: 'workstation', damaged: false },
      { id: 'f6', name: 'Kulkas Mini & Dispenser Air', icon: '🧊', correctZone: 'pantry', damaged: true, repairHint: 'Kompresor pendingin error & filter kotor' }
    ];

    // Status tracking: placedZone (null if unplaced), repaired (true/false)
    let state = facilities.map(f => ({
      ...f,
      placedZone: null,
      repaired: !f.damaged // if not damaged, considered already fine
    }));

    let selectedFacilityId = null;
    let mistakes = 0;

    mount.innerHTML = `
      <div class="ch4-game-arena ch4-ep3-arena">
        ${renderHUD(3, 'Audit Tata Ruang & Fasilitas Kantor', 'Tempatkan 6 inventaris kantor ke zona Blueprint denah yang benar dan perbaiki unit yang rusak!', '🏢')}

        <div class="ch4-blueprint-container">
          <div class="ch4-blueprint-header">
            <span class="bp-title">📐 BLUEPRINT TATA RUANG KANTOR OFFICE KIDS</span>
            <span class="bp-sub">Kepatuhan Tata Ruang: <strong id="bp-compliance-val">0 / 6 Optimal</strong></span>
          </div>

          <div class="ch4-blueprint-grid">
            ${zones.map(z => `
              <div class="ch4-bp-zone" data-zone-id="${z.id}" id="bp-zone-${z.id}">
                <div class="bp-zone-header">
                  <span class="bp-zone-icon">${z.icon}</span>
                  <div>
                    <h4 class="bp-zone-title">${z.name}</h4>
                    <span class="bp-zone-desc">${z.desc}</span>
                  </div>
                </div>
                <div class="bp-zone-items" id="bp-items-${z.id}">
                  <!-- Placed items will appear here -->
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="ch4-facility-tray-section">
          <div class="tray-title-row">
            <span class="tray-title">📦 Fasilitas yang Perlu Diaudit (Pilih fasilitas lalu klik zona denah):</span>
          </div>
          <div class="ch4-facility-tray" id="ch4-fac-tray">
            <!-- Facility items waiting to be placed -->
          </div>
        </div>
      </div>
    `;

    const trayEl = mount.querySelector('#ch4-fac-tray');
    const compEl = mount.querySelector('#bp-compliance-val');
    const progEl = mount.querySelector('#ch4-progress-val');

    function checkWinCondition() {
      const allPlaced = state.every(item => item.placedZone === item.correctZone);
      const allRepaired = state.every(item => item.repaired);

      const optimalCount = state.filter(item => item.placedZone === item.correctZone && item.repaired).length;
      if (compEl) compEl.textContent = `${optimalCount} / 6 Optimal`;
      if (progEl) progEl.textContent = `${6 - optimalCount} Belum Beres`;

      if (allPlaced && allRepaired) {
        stop();
        playSfx('success');
        let stars = 3;
        if (mistakes >= 3) stars = 1;
        else if (mistakes >= 1) stars = 2;

        notify(`Sempurna! Seluruh tata ruang dan fasilitas kantor 100% prima! ⭐ ${stars} Bintang!`, 'success');
        setTimeout(() => {
          if (callbacks.onComplete) {
            callbacks.onComplete({ stars, score: 900, timeRemaining: remainingTime, mistakes });
          }
        }, 800);
      }
    }

    function renderFacilities() {
      // Clear all zone item containers
      zones.forEach(z => {
        const container = mount.querySelector(`#bp-items-${z.id}`);
        if (container) container.innerHTML = '';
      });

      // Render placed items in zones
      state.forEach(item => {
        if (item.placedZone) {
          const zoneContainer = mount.querySelector(`#bp-items-${item.placedZone}`);
          if (zoneContainer) {
            const card = document.createElement('div');
            card.className = `ch4-placed-item ${item.repaired ? 'status-ok' : 'status-damaged'}`;
            card.innerHTML = `
              <div class="placed-item-content">
                <span class="placed-icon">${item.icon}</span>
                <span class="placed-name">${item.name}</span>
              </div>
              <div class="placed-actions">
                ${!item.repaired ? `
                  <button class="btn-repair-unit" id="repair-${item.id}">🔧 Servis</button>
                ` : `
                  <span class="badge-repaired">✅ Prima</span>
                `}
                <button class="btn-unplace-unit" id="unplace-${item.id}" title="Pindahkan">↩️</button>
              </div>
            `;

            if (!item.repaired) {
              card.querySelector(`#repair-${item.id}`).addEventListener('click', (e) => {
                e.stopPropagation();
                playSfx('place');
                item.repaired = true;
                notify(`Fasilitas "${item.name}" berhasil diperbaiki dan kembali optimal! 🔧`, 'success');
                renderFacilities();
                checkWinCondition();
              });
            }

            card.querySelector(`#unplace-${item.id}`).addEventListener('click', (e) => {
              e.stopPropagation();
              playSfx('unequip');
              item.placedZone = null;
              renderFacilities();
              checkWinCondition();
            });

            zoneContainer.appendChild(card);
          }
        }
      });

      // Render unplaced items in tray
      trayEl.innerHTML = '';
      const unplaced = state.filter(s => s.placedZone === null);

      if (unplaced.length === 0) {
        trayEl.innerHTML = `<div class="tray-empty-hint">✨ Seluruh fasilitas sudah ditempatkan pada denah! Periksa apakah ada fasilitas yang masih butuh servis 🔧!</div>`;
      } else {
        unplaced.forEach(item => {
          const isSelected = (selectedFacilityId === item.id);
          const card = document.createElement('div');
          card.className = `ch4-fac-card ${isSelected ? 'selected' : ''} ${item.damaged ? 'is-damaged' : ''}`;
          card.innerHTML = `
            <div class="fac-card-top">
              <span class="fac-card-icon">${item.icon}</span>
              ${item.damaged ? `<span class="fac-alert-badge">⚠️ Anomali Rusak</span>` : `<span class="fac-ready-badge">Siap Pasang</span>`}
            </div>
            <div class="fac-card-body">
              <h5 class="fac-card-title">${item.name}</h5>
              ${item.damaged ? `<p class="fac-damage-hint">${item.repairHint}</p>` : `<p class="fac-ready-hint">Kondisi fisik normal</p>`}
            </div>
            <button class="btn-select-fac">${isSelected ? 'Dipilih (Klik Zona) 🎯' : 'Pilih Item'}</button>
          `;

          card.addEventListener('click', () => {
            playSfx('click');
            selectedFacilityId = (selectedFacilityId === item.id) ? null : item.id;
            renderFacilities();
          });

          trayEl.appendChild(card);
        });
      }

      checkWinCondition();
    }

    // Zone click handlers
    zones.forEach(z => {
      const zoneEl = mount.querySelector(`#bp-zone-${z.id}`);
      if (zoneEl) {
        zoneEl.addEventListener('click', () => {
          if (!selectedFacilityId) {
            notify('Pilih terlebih dahulu fasilitas dari rak di bawah!', 'info');
            return;
          }

          const targetItem = state.find(s => s.id === selectedFacilityId);
          if (!targetItem) return;

          if (z.id === targetItem.correctZone) {
            // Correct placement
            playSfx('place');
            targetItem.placedZone = z.id;
            selectedFacilityId = null;
            notify(`Tepat! "${targetItem.name}" ditempatkan di ${z.name}! 📐`, 'success');
            renderFacilities();
          } else {
            // Wrong placement
            playSfx('warning');
            mistakes++;
            applyPenalty(1.5);
            zoneEl.classList.add('shake-error');
            setTimeout(() => zoneEl.classList.remove('shake-error'), 450);
            notify(`Zona tidak cocok! "${targetItem.name}" tidak berada di ${z.name}! (-1.5s)`, 'warning');
          }
        });
      }
    });

    renderFacilities();

    startTimer(45.0, null, () => {
      showFailScreen(mount, 'Waktu audit habis! Tata ruang kantor belum tertata sesuai standar operasional!');
    });
  }

  // ===========================================================================
  // EPISODE 4: VERIFIKASI KEOTENTIKAN STEMPEL & DOKUMEN
  // Mekanik: Papers-Please style verifikasi dokumen operasional:
  // Cek Cap Stempel, Tanda Tangan, Hologram, dan Nomor Surat.
  // ===========================================================================
  function startEpisode4(mount) {
    const inspectionDocs = [
      {
        id: 'doc_auth_1',
        title: 'Surat Disposisi Anggaran Proyek Baru',
        regNo: 'OK-OPS-2026/089',
        date: '17 Oktober 2026',
        body: 'Disetujui alokasi dana operasional peremajaan komputer dan perangkat server administrasi kantor.',
        isAuthentic: true,
        sealText: 'OFFICE KIDS OPERASIONAL RESMI',
        sealType: 'authentic', // Blue circular official seal
        signatureName: 'Komandan Kiki, S.Kom.',
        signatureType: 'authentic',
        hologramIcon: '✨',
        hologramType: 'authentic',
        hologramText: 'HOLOGRAM KEAMANAN RESMI',
        flawDesc: null
      },
      {
        id: 'doc_auth_2',
        title: 'Surat Pengalihan Aset Gedung Kantor',
        regNo: 'CHAOS-HACK-666/BAD',
        date: '00 Kiamat 2026',
        body: 'Seluruh meja, kursi, dan kunci brankas kantor diserahkan tanpa syarat kepada Penguasa Dr. Chaos.',
        isAuthentic: false,
        sealText: 'DR. CHAOS SABOTASE SHADOW',
        sealType: 'fake', // Cracked red skull seal
        signatureName: 'Dr. Chaos (Coretan Kasar)',
        signatureType: 'fake',
        hologramIcon: '👾',
        hologramType: 'fake',
        hologramText: 'HOLOGRAM PALSU BURAM',
        flawDesc: 'Cap stempel sabotase Dr. Chaos, nomor surat ilegal, dan hologram kusam virus!'
      },
      {
        id: 'doc_auth_3',
        title: 'Surat Keputusan Promosi Jabatan Staf',
        regNo: 'OK-OPS-2026/112',
        date: '18 Oktober 2026',
        body: 'Pengangkatan agen berprestasi menjadi Staf Senior Divisi Manajemen Operasional Kantor.',
        isAuthentic: true,
        sealText: 'OFFICE KIDS OPERASIONAL RESMI',
        sealType: 'authentic',
        signatureName: 'Komandan Kiki, S.Kom.',
        signatureType: 'authentic',
        hologramIcon: '✨',
        hologramType: 'authentic',
        hologramText: 'HOLOGRAM KEAMANAN RESMI',
        flawDesc: null
      },
      {
        id: 'doc_auth_4',
        title: 'Surat Perintah Pemadaman Server Utama',
        regNo: 'OK-OPS-2026/999',
        date: '19 Oktober 2026',
        body: 'Harap matikan seluruh pendingin server dan hapus seluruh basis data kearsipan operasional segera.',
        isAuthentic: false,
        sealText: 'OFFICE KIDS OPERASIONAL RESMI',
        sealType: 'authentic',
        signatureName: 'Coretan Cakar Ayam Palsu ✍️',
        signatureType: 'fake',
        hologramIcon: '👾',
        hologramType: 'fake',
        hologramText: 'HOLOGRAM CACAT MATI',
        flawDesc: 'Tanda tangan pemalsuan bukan pimpinan dan hologram pengaman tidak berkilau emas!'
      },
      {
        id: 'doc_auth_5',
        title: 'Berita Acara Pembelian Perlengkapan Ergonomis',
        regNo: 'OK-OPS-2026/145',
        date: '20 Oktober 2026',
        body: 'Penerimaan 15 unit kursi kerja ergonomis untuk mendukung kenyamanan operasional seluruh tim agen cilik.',
        isAuthentic: true,
        sealText: 'OFFICE KIDS OPERASIONAL RESMI',
        sealType: 'authentic',
        signatureName: 'Komandan Kiki, S.Kom.',
        signatureType: 'authentic',
        hologramIcon: '✨',
        hologramType: 'authentic',
        hologramText: 'HOLOGRAM KEAMANAN RESMI',
        flawDesc: null
      }
    ];

    let currentDocIndex = 0;
    let mistakes = 0;
    let isStamping = false;

    mount.innerHTML = `
      <div class="ch4-game-arena ch4-ep4-arena">
        ${renderHUD(4, 'Verifikasi Keotentikan Stempel & Dokumen', 'Periksa stempel, tanda tangan, dan hologram! Terima dokumen asli atau tolak dokumen sabotase Dr. Chaos!', '🔍')}

        <div class="ch4-auth-desk-layout">
          <!-- Guide on Left -->
          <div class="ch4-auth-guide-panel">
            <h4 class="guide-title">📋 Pedoman Keaslian Dokumen</h4>
            <div class="guide-item valid">
              <span class="guide-badge">✅ Dokumen RESMI:</span>
              <p>• Cap bulat biru <em>"OFFICE KIDS RESMI"</em><br>• Hologram Bintang Emas ✨<br>• Tanda tangan Komandan Kiki yang rapi<br>• Kode berformat <code>OK-OPS-2026/...</code></p>
            </div>
            <div class="guide-item fake">
              <span class="guide-badge">❌ Ciri Dokumen PALSU:</span>
              <p>• Stempel tengkorak/chaos ☠️<br>• Hologram kusam/cacat 👾<br>• Tanda tangan coretan acak Dr. Chaos<br>• Perintah merusak operasional kantor</p>
            </div>
          </div>

          <!-- Document Inspection Viewport in Center -->
          <div class="ch4-doc-desk-viewport" id="ch4-doc-desk">
            <!-- Render active document sheet -->
          </div>
        </div>

        <!-- Stamping Controls at Bottom -->
        <div class="ch4-stamp-actions-bar">
          <button class="ch4-btn-stamp btn-stamp-reject" id="btn-stamp-reject">
            <span class="stamp-btn-icon">❌</span>
            <div class="stamp-btn-text">
              <strong>TOLAK DOKUMEN (PALSU)</strong>
              <small>Sabotase Dr. Chaos</small>
            </div>
          </button>

          <button class="ch4-btn-stamp btn-stamp-accept" id="btn-stamp-accept">
            <span class="stamp-btn-icon">✅</span>
            <div class="stamp-btn-text">
              <strong>TERIMA DOKUMEN (RESMI)</strong>
              <small>Lolos Audit Keotentikan</small>
            </div>
          </button>
        </div>
      </div>
    `;

    const deskEl = mount.querySelector('#ch4-doc-desk');
    const progEl = mount.querySelector('#ch4-progress-val');

    function renderDocument() {
      if (currentDocIndex >= inspectionDocs.length) {
        stop();
        playSfx('success');
        let stars = 3;
        if (mistakes >= 3) stars = 1;
        else if (mistakes >= 1) stars = 2;

        notify(`Hebat! Seluruh 5 dokumen operasional berhasil diaudit keotentikannya! ⭐ ${stars} Bintang!`, 'success');
        setTimeout(() => {
          if (callbacks.onComplete) {
            callbacks.onComplete({ stars, score: 900, timeRemaining: remainingTime, mistakes });
          }
        }, 800);
        return;
      }

      const doc = inspectionDocs[currentDocIndex];
      const remaining = inspectionDocs.length - currentDocIndex;
      if (progEl) progEl.textContent = `${remaining} Dokumen`;

      deskEl.innerHTML = `
        <div class="ch4-paper-sheet" id="ch4-current-sheet">
          <div class="paper-watermark">OFFICE KIDS</div>
          
          <div class="paper-header">
            <div class="paper-logo-brand">
              <span class="paper-logo-icon">🏢</span>
              <div>
                <h4 class="paper-corp-name">KANTOR PUSAT AGEN OFFICE KIDS</h4>
                <span class="paper-dept-name">DIVISI MANAJEMEN OPERASIONAL & KEARSIPAN</span>
              </div>
            </div>
            <div class="paper-meta-box">
              <div class="paper-meta-row"><strong>No. Reg:</strong> <span>${doc.regNo}</span></div>
              <div class="paper-meta-row"><strong>Tanggal:</strong> <span>${doc.date}</span></div>
            </div>
          </div>

          <div class="paper-divider"></div>

          <div class="paper-subject">
            <strong>PERIHAL:</strong> <span class="subject-text">${doc.title}</span>
          </div>

          <div class="paper-body">
            <p>${doc.body}</p>
          </div>

          <div class="paper-footer">
            <!-- Hologram -->
            <div class="paper-hologram-wrap ${doc.hologramType}">
              <div class="hologram-sticker">
                <span class="holo-icon">${doc.hologramIcon}</span>
                <span class="holo-txt">${doc.hologramText}</span>
              </div>
            </div>

            <!-- Official Seal -->
            <div class="paper-seal-wrap ${doc.sealType}">
              <div class="official-seal-stamp">
                <span class="seal-star">★</span>
                <span class="seal-caption">${doc.sealText}</span>
                <span class="seal-star">★</span>
              </div>
            </div>

            <!-- Signature -->
            <div class="paper-signature-wrap ${doc.signatureType}">
              <div class="signature-line">
                <span class="signature-hand">${doc.signatureType === 'authentic' ? '✍️ Kiki Komandan' : 'Dr. Chaos (X_x)'}</span>
              </div>
              <div class="signature-signee">${doc.signatureName}</div>
            </div>
          </div>

          <!-- Stamped Overlay (Hidden until stamped) -->
          <div class="ch4-stamped-stamp-overlay" id="sheet-stamp-overlay"></div>
        </div>
      `;
    }

    function processDecision(userChoice) {
      if (isStamping || currentDocIndex >= inspectionDocs.length) return;
      isStamping = true;

      const doc = inspectionDocs[currentDocIndex];
      const isCorrect = (userChoice === 'accept' && doc.isAuthentic) || (userChoice === 'reject' && !doc.isAuthentic);
      const sheet = mount.querySelector('#ch4-current-sheet');
      const stampOverlay = mount.querySelector('#sheet-stamp-overlay');

      if (userChoice === 'accept') {
        playSfx('place');
        if (stampOverlay) {
          stampOverlay.className = 'ch4-stamped-stamp-overlay stamp-approved-ink';
          stampOverlay.textContent = 'DITERIMA / VALID';
        }
      } else {
        playSfx('place');
        if (stampOverlay) {
          stampOverlay.className = 'ch4-stamped-stamp-overlay stamp-rejected-ink';
          stampOverlay.textContent = 'DITOLAK / PALSU';
        }
      }

      setTimeout(() => {
        if (isCorrect) {
          playSfx('success');
          notify(doc.isAuthentic ? 'Tepat! Dokumen resmi disahkan ke dalam sistem! ✅' : 'Tepat! Upaya sabotase Dr. Chaos berhasil digagalkan! 🛡️', 'success');
        } else {
          playSfx('warning');
          mistakes++;
          applyPenalty(3.0);
          notify(doc.isAuthentic ? 'Salah! Dokumen tersebut sah dan resmi! (-3.0s)' : `Salah! Dokumen tersebut palsu: ${doc.flawDesc} (-3.0s)`, 'warning');
          if (sheet) {
            sheet.classList.add('shake-error');
          }
        }

        setTimeout(() => {
          currentDocIndex++;
          isStamping = false;
          renderDocument();
        }, 700);
      }, 400);
    }

    mount.querySelector('#btn-stamp-accept').addEventListener('click', () => processDecision('accept'));
    mount.querySelector('#btn-stamp-reject').addEventListener('click', () => processDecision('reject'));

    renderDocument();

    startTimer(45.0, null, () => {
      showFailScreen(mount, 'Waktu audit dokumen habis! Dokumen palsu Dr. Chaos berhasil menyusup ke kantor!');
    });
  }

  // ===========================================================================
  // EPISODE 5: BOSS LEVEL - PEMULIHAN SISTEM ADMINISTRASI 30 DETIK (EXTREME)
  // Mekanik: Tantangan Puncak Multi-tasking 30 Detik di bawah anomali gravitasi penuh!
  // Modul 1: Sortir Cepat Berkas Darurat
  // Modul 2: Verifikasi Kilat Dokumen Sabotase
  // Modul 3: Kalibrasi Protokol Sakelar SOP Pemulihan (1 -> 2 -> 3)
  // ===========================================================================
  function startEpisode5(mount) {
    let currentModule = 1; // 1: Rapid Sort, 2: Rapid Auth, 3: Protocol Switches
    let mistakes = 0;
    let emergencySortCount = 0;
    let rapidAuthCount = 0;
    let currentSwitchSequence = [];

    mount.innerHTML = `
      <div class="ch4-game-arena ch4-ep5-arena">
        <!-- Flashing Emergency Siren Bar -->
        <div class="ch4-boss-siren-bar">
          <span class="siren-light s1">🚨</span>
          <span class="siren-txt">PERINGATAN DARURAT: ANOMALI VORTEKS GRAVITASI DR. CHAOS AKTIF!</span>
          <span class="siren-light s2">🚨</span>
        </div>

        <div class="ch4-hud boss-hud">
          <div class="ch1-hud-row">
            <div class="ch1-hud-title-group">
              <span class="ch4-badge-ep boss-badge">CH 4 • BOSS EXTREME</span>
              <span class="ch1-hud-name">🚨 Pemulihan Sistem Administrasi 30 Detik</span>
            </div>
            <div class="ch1-hud-stats">
              <div class="ch1-timer-chip boss-timer-chip">
                <span>⏱️</span>
                <strong id="ch4-boss-digits">30.00s</strong>
              </div>
              <div class="ch1-progress-chip">
                <span>⚡ Modul:</span>
                <strong id="ch4-boss-phase-chip">1 / 3</strong>
              </div>
            </div>
          </div>
          <div class="ch1-timer-bar-track boss-track">
            <div class="ch1-timer-bar-fill boss-fill" id="ch4-timer-fill" style="width: 100%;"></div>
          </div>
        </div>

        <div class="ch4-boss-stage-viewport" id="ch4-boss-stage">
          <!-- Active challenge module rendered here -->
        </div>
      </div>
    `;

    const stageEl = mount.querySelector('#ch4-boss-stage');
    const phaseChip = mount.querySelector('#ch4-boss-phase-chip');
    const bossDigits = mount.querySelector('#ch4-boss-digits');

    function renderModule() {
      if (currentModule === 1) {
        // MODULE 1: RAPID SORT (3 Emergency Operational Files)
        if (phaseChip) phaseChip.textContent = 'Modul 1: Sortir Darurat';
        const emergencyDocs = [
          { title: 'Kunci Akses Reaktor Operasional', type: 'brankas', icon: '🗝️', desc: 'Amankan ke Brankas Sistem Utama' },
          { title: 'Peta Evakuasi Antigravitasi', type: 'brankas', icon: '🗺️', desc: 'Amankan ke Brankas Sistem Utama' },
          { title: 'Kode Dekripsi Arsip Markas', type: 'brankas', icon: '💻', desc: 'Amankan ke Brankas Sistem Utama' }
        ];

        const doc = emergencyDocs[emergencySortCount];
        stageEl.innerHTML = `
          <div class="ch4-boss-card-box">
            <div class="boss-task-header">
              <span class="task-badge">MODUL 1/3: SORTIR BERKAS KRITIS (${emergencySortCount + 1}/3)</span>
              <p class="task-desc">Berkas darurat berputar cepat! Klik brankas pemulihan sebelum terbakar anomali!</p>
            </div>

            <div class="boss-floating-target vortex-spin-subtle">
              <span class="target-icon">${doc.icon}</span>
              <div class="target-info">
                <h4>${doc.title}</h4>
                <small>${doc.desc}</small>
              </div>
            </div>

            <div class="boss-sort-buttons-row">
              <button class="btn-boss-bin bin-brankas" id="btn-boss-save">
                <span>🔐 SIMPAN KE BRANKAS PUSAT</span>
              </button>
              <button class="btn-boss-bin bin-trap" id="btn-boss-trap">
                <span>🗑️ BUANG KE TEMPAT SAMPAH</span>
              </button>
            </div>
          </div>
        `;

        stageEl.querySelector('#btn-boss-save').addEventListener('click', () => {
          playSfx('place');
          emergencySortCount++;
          if (emergencySortCount >= emergencyDocs.length) {
            playSfx('success');
            notify('Modul 1 Berhasil! Beralih ke Verifikasi Kilat! ⚡', 'success');
            currentModule = 2;
            setTimeout(renderModule, 300);
          } else {
            renderModule();
          }
        });

        stageEl.querySelector('#btn-boss-trap').addEventListener('click', () => {
          playSfx('warning');
          mistakes++;
          applyPenalty(3.0);
          notify('⚠️ KESALAHAN FATAL! Berkas penting tidak boleh dibuang! (-3.0s)', 'warning');
        });

      } else if (currentModule === 2) {
        // MODULE 2: RAPID AUTHENTICATION (Detect Dr. Chaos Trap Document)
        if (phaseChip) phaseChip.textContent = 'Modul 2: Verifikasi Kilat';
        const rapidDocs = [
          {
            title: 'Perintah Evakuasi Palsu Dr. Chaos',
            isFake: true,
            seal: '☠️ Cap Tengkorak Dr. Chaos',
            desc: 'Awas! Dokumen ini mencoba mematikan perisai markas!'
          },
          {
            title: 'Instruksi Pemulihan Gravitasi Kantor',
            isFake: false,
            seal: '★ Office Kids Operasional Resmi ★',
            desc: 'Protokol resmi Komandan Kiki untuk menyalakan stabilizer'
          }
        ];

        const doc = rapidDocs[rapidAuthCount];
        stageEl.innerHTML = `
          <div class="ch4-boss-card-box">
            <div class="boss-task-header">
              <span class="task-badge">MODUL 2/3: VERIFIKASI DOKUMEN KILAT (${rapidAuthCount + 1}/2)</span>
              <p class="task-desc">Periksa stempel dokumen darurat dalam hitungan detik!</p>
            </div>

            <div class="boss-rapid-doc-sheet">
              <div class="rapid-doc-title">📜 ${doc.title}</div>
              <div class="rapid-doc-seal ${doc.isFake ? 'seal-danger' : 'seal-safe'}">${doc.seal}</div>
              <p class="rapid-doc-desc">${doc.desc}</p>
            </div>

            <div class="boss-rapid-actions">
              <button class="btn-boss-reject" id="btn-rapid-fake">
                <span>❌ SABOTASE PALSU (TOLAK)</span>
              </button>
              <button class="btn-boss-accept" id="btn-rapid-real">
                <span>✅ RESMI ASLI (TERIMA)</span>
              </button>
            </div>
          </div>
        `;

        stageEl.querySelector('#btn-rapid-fake').addEventListener('click', () => {
          if (doc.isFake) {
            playSfx('success');
            rapidAuthCount++;
            if (rapidAuthCount >= rapidDocs.length) {
              notify('Modul 2 Selesai! Beralih ke Protokol Sakelar SOP! ⚡', 'success');
              currentModule = 3;
              setTimeout(renderModule, 300);
            } else {
              renderModule();
            }
          } else {
            playSfx('warning');
            mistakes++;
            applyPenalty(3.0);
            notify('Salah! Dokumen tersebut resmi dan sah! (-3.0s)', 'warning');
          }
        });

        stageEl.querySelector('#btn-rapid-real').addEventListener('click', () => {
          if (!doc.isFake) {
            playSfx('success');
            rapidAuthCount++;
            if (rapidAuthCount >= rapidDocs.length) {
              notify('Modul 2 Selesai! Beralih ke Protokol Sakelar SOP! ⚡', 'success');
              currentModule = 3;
              setTimeout(renderModule, 300);
            } else {
              renderModule();
            }
          } else {
            playSfx('warning');
            mistakes++;
            applyPenalty(3.0);
            notify('BAHAYA! Kamu menyetujui dokumen sabotase Dr. Chaos! (-3.0s)', 'warning');
          }
        });

      } else if (currentModule === 3) {
        // MODULE 3: PROTOCOL SWITCH SEQUENCE (1 -> 2 -> 3)
        if (phaseChip) phaseChip.textContent = 'Modul 3: Kalibrasi Sakelar SOP';
        const switches = [
          { id: 1, label: '1. Reaktor Operasional', icon: '⚡' },
          { id: 2, label: '2. Enkripsi Berkas', icon: '🔄' },
          { id: 3, label: '3. Perisai Antigravitasi', icon: '🛡️' }
        ];

        stageEl.innerHTML = `
          <div class="ch4-boss-card-box">
            <div class="boss-task-header">
              <span class="task-badge">MODUL 3/3: AKTIFKAN PROTOKOL SAKELAR SOP PEMULIHAN</span>
              <p class="task-desc">Aktifkan 3 sakelar secara berurutan: <strong>1. Reaktor ➔ 2. Enkripsi ➔ 3. Perisai</strong>!</p>
            </div>

            <div class="ch4-switches-grid">
              ${switches.map(sw => {
                const isActive = currentSwitchSequence.includes(sw.id);
                return `
                  <button class="ch4-switch-btn ${isActive ? 'active' : ''}" data-sw-id="${sw.id}" id="sw-${sw.id}">
                    <span class="sw-icon">${sw.icon}</span>
                    <span class="sw-label">${sw.label}</span>
                    <span class="sw-led">${isActive ? '🟢 AKTIF' : '⚪ MATI'}</span>
                  </button>
                `;
              }).join('')}
            </div>

            <div class="boss-sequence-hint">
              Urutan Diaktifkan: <strong>${currentSwitchSequence.length === 0 ? 'Belum Ada' : currentSwitchSequence.map(n => `Sakelar ${n}`).join(' ➔ ')}</strong>
            </div>
          </div>
        `;

        switches.forEach(sw => {
          const btn = stageEl.querySelector(`#sw-${sw.id}`);
          if (btn) {
            btn.addEventListener('click', () => {
              if (currentSwitchSequence.includes(sw.id)) return;

              const expectedNext = currentSwitchSequence.length + 1;
              if (sw.id === expectedNext) {
                // Correct in sequence!
                playSfx('place');
                currentSwitchSequence.push(sw.id);

                if (currentSwitchSequence.length === 3) {
                  // ALL 3 MODULES FINISHED! VICTORY!
                  stop();
                  playSfx('success');
                  if (typeof SoundSystem !== 'undefined' && SoundSystem.play) {
                    setTimeout(() => SoundSystem.play('badge'), 300);
                  }

                  let stars = 3;
                  if (remainingTime < 3.0 || mistakes >= 3) stars = 1;
                  else if (remainingTime < 10.0 || mistakes >= 1) stars = 2;

                  notify(`👑 KEMENANGAN TOTAL! Markas Office Kids berhasil diselamatkan dari Dr. Chaos! ⭐ ${stars} Bintang!`, 'success');
                  setTimeout(() => {
                    if (callbacks.onComplete) {
                      callbacks.onComplete({ stars, score: 1200, timeRemaining: remainingTime, mistakes });
                    }
                  }, 1200);
                } else {
                  renderModule();
                }
              } else {
                // Wrong switch in sequence!
                playSfx('warning');
                mistakes++;
                applyPenalty(3.0);
                currentSwitchSequence = [];
                notify('Urutan salah! Protokol harus berurutan: 1. Reaktor ➔ 2. Enkripsi ➔ 3. Perisai! Sistem reset! (-3.0s)', 'warning');
                renderModule();
              }
            });
          }
        });
      }
    }

    renderModule();

    startTimer(30.0, (rem) => {
      if (bossDigits) bossDigits.textContent = `${Math.max(0, rem).toFixed(2)}s`;
    }, () => {
      showFailScreen(mount, 'WAKTU PEMULIHAN HABIS! Anomali gravitasi Dr. Chaos menenggelamkan markas Office Kids dalam kekacauan total!');
    });
  }

  // ===========================================================================
  // Engine Entry Point
  // ===========================================================================
  function start(episodeId, options = {}) {
    currentEpisodeId = episodeId;
    callbacks = {
      onComplete: options.onComplete || null,
      onRetry: options.onRetry || null,
      onQuit: options.onQuit || null,
    };

    const mount = document.getElementById('ch4-minigame-mount');
    if (!mount) {
      console.error('[Chapter4MiniGames] #ch4-minigame-mount not found');
      return;
    }

    stop();

    if (episodeId === 1) {
      startEpisode1(mount);
    } else if (episodeId === 2) {
      startEpisode2(mount);
    } else if (episodeId === 3) {
      startEpisode3(mount);
    } else if (episodeId === 4) {
      startEpisode4(mount);
    } else if (episodeId === 5) {
      startEpisode5(mount);
    } else {
      startEpisode1(mount);
    }
  }

  return {
    start,
    stop,
  };
})();

window.Chapter4MiniGames = Chapter4MiniGames;

