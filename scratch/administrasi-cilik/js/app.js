/**
 * Administrasi Cilik - Main Application Orchestrator
 * State management, screen transitions, scoring, and confetti particle system.
 */

class App {
  constructor() {
    this.playerName = "Budi Petugas";
    this.currentScreen = "screen-welcome";
    this.activeModule = null;
    this.moduleStars = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.unlockedModules = [1, 2, 3, 4]; // All accessible for exploration

    this.confettiCanvas = document.getElementById('confetti-canvas');
    this.confettiParticles = [];
    this.isConfettiActive = false;

    this.initDOM();
    this.initConfetti();
    this.loadSavedProgress();
  }

  initDOM() {
    // Header elements
    this.btnHome = document.getElementById('btn-home');
    this.btnSoundToggle = document.getElementById('btn-sound-toggle');
    this.soundIcon = document.getElementById('sound-icon');
    this.btnVoiceToggle = document.getElementById('btn-voice-toggle');
    this.btnFullscreen = document.getElementById('btn-fullscreen');
    this.displayPlayerName = document.getElementById('display-player-name');
    this.headerTotalStars = document.getElementById('header-total-stars');

    // Welcome Screen
    this.inputPlayerName = document.getElementById('input-player-name');
    this.btnStartGame = document.getElementById('btn-start-game');

    // Menu Cards
    this.moduleCards = document.querySelectorAll('.module-card');
    this.btnOpenCert = document.getElementById('btn-open-certificate');
    this.certStatusText = document.getElementById('cert-status-text');

    // Completion Modal
    this.modalCompletion = document.getElementById('modal-completion');
    this.modalCompTitle = document.getElementById('modal-comp-title');
    this.modalCompDesc = document.getElementById('modal-comp-desc');
    this.modalCompStars = document.getElementById('modal-comp-stars');
    this.modalCompAccuracy = document.getElementById('modal-comp-accuracy');
    this.modalCompSpeed = document.getElementById('modal-comp-speed');
    this.modalBtnRetry = document.getElementById('modal-btn-retry');
    this.modalBtnNext = document.getElementById('modal-btn-next');

    // Replay Voice Button
    this.btnReplayVoice = document.getElementById('btn-replay-voice');
    if (this.btnReplayVoice) {
      this.btnReplayVoice.addEventListener('click', () => {
        window.soundEngine.playClick();
        window.characterController.replay();
      });
    }

    // Restart buttons inside modules
    document.querySelectorAll('.btn-restart-mod').forEach(btn => {
      btn.addEventListener('click', () => {
        const modId = parseInt(btn.getAttribute('data-module'), 10);
        this.startModule(modId);
      });
    });

    this.bindEvents();
  }

  bindEvents() {
    // Start Game from Welcome
    if (this.btnStartGame) {
      this.btnStartGame.addEventListener('click', () => {
        const nameVal = this.inputPlayerName.value.trim();
        if (nameVal) {
          this.playerName = nameVal;
        }
        if (this.displayPlayerName) {
          this.displayPlayerName.textContent = this.playerName;
        }
        window.soundEngine.playClick();
        window.soundEngine.startBgm();
        this.saveProgress();
        this.showScreen('screen-menu');
        window.characterController.say(
          `Halo ${this.playerName}! Silakan pilih salah satu dari 4 modul kerja untuk memulai latihan hari ini!`
        );
      });
    }

    // Home button
    if (this.btnHome) {
      this.btnHome.addEventListener('click', () => {
        window.soundEngine.playClick();
        this.showScreen('screen-menu');
      });
    }

    // Sound toggle
    if (this.btnSoundToggle) {
      this.btnSoundToggle.addEventListener('click', () => {
        const isSoundOn = window.soundEngine.toggleMute();
        this.soundIcon.textContent = isSoundOn ? '🔊' : '🔇';
      });
    }

    // Voice toggle
    if (this.btnVoiceToggle) {
      this.btnVoiceToggle.addEventListener('click', () => {
        const isVoiceOn = window.characterController.toggleVoice();
        this.btnVoiceToggle.classList.toggle('active', isVoiceOn);
        window.soundEngine.playClick();
      });
    }

    // Fullscreen toggle
    if (this.btnFullscreen) {
      this.btnFullscreen.addEventListener('click', () => {
        window.soundEngine.playClick();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    // Module Card clicks
    this.moduleCards.forEach(card => {
      card.addEventListener('click', () => {
        const modId = parseInt(card.getAttribute('data-module'), 10);
        window.soundEngine.playClick();
        this.startModule(modId);
      });
    });

    // Open Certificate
    if (this.btnOpenCert) {
      this.btnOpenCert.addEventListener('click', () => {
        window.certificateManager.show(this.playerName);
      });
    }

    // Completion modal actions
    if (this.modalBtnRetry) {
      this.modalBtnRetry.addEventListener('click', () => {
        window.soundEngine.playClick();
        this.modalCompletion.classList.remove('active');
        if (this.activeModule) {
          this.startModule(this.activeModule);
        }
      });
    }

    if (this.modalBtnNext) {
      this.modalBtnNext.addEventListener('click', () => {
        window.soundEngine.playClick();
        this.modalCompletion.classList.remove('active');
        this.showScreen('screen-menu');

        // Check if all 4 completed
        const completedAll = Object.values(this.moduleStars).every(s => s > 0);
        if (completedAll) {
          setTimeout(() => {
            window.certificateManager.show(this.playerName);
            this.triggerConfetti(5000);
          }, 600);
        }
      });
    }
  }

  showScreen(screenId) {
    document.querySelectorAll('.game-screen').forEach(screen => {
      screen.classList.remove('active');
    });

    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      this.currentScreen = screenId;
    }

    this.updateStarsDisplay();
  }

  startModule(moduleId) {
    this.activeModule = moduleId;
    this.showScreen(`screen-module${moduleId}`);

    if (moduleId === 1 && window.module1) {
      window.module1.start();
    } else if (moduleId === 2 && window.module2) {
      window.module2.start();
    } else if (moduleId === 3 && window.module3) {
      window.module3.start();
    } else if (moduleId === 4 && window.module4) {
      window.module4.start();
    }
  }

  showCompletionModal(moduleId, stars, stats = {}) {
    this.moduleStars[moduleId] = Math.max(this.moduleStars[moduleId] || 0, stars);
    this.saveProgress();
    this.updateStarsDisplay();

    window.soundEngine.playFanfare();
    this.triggerConfetti(3500);

    if (this.modalCompAccuracy) this.modalCompAccuracy.textContent = stats.accuracy || "100%";
    if (this.modalCompSpeed) this.modalCompSpeed.textContent = stats.speed || "Cepat & Cermat!";

    // Stars display
    if (this.modalCompStars) {
      let starsHtml = "";
      for (let i = 0; i < 3; i++) {
        if (i < stars) {
          starsHtml += `<span class="star star-anim" style="color: #f59e0b; text-shadow: 0 0 10px rgba(245,158,11,0.6);">⭐</span>`;
        } else {
          starsHtml += `<span class="star" style="color: #cbd5e1;">☆</span>`;
        }
      }
      this.modalCompStars.innerHTML = starsHtml;
    }

    if (this.modalCompletion) {
      this.modalCompletion.classList.add('active');
    }
  }

  updateStarsDisplay() {
    let total = 0;
    for (let i = 1; i <= 4; i++) {
      const s = this.moduleStars[i] || 0;
      total += s;

      const cardStarsEl = document.getElementById(`stars-mod${i}`);
      if (cardStarsEl) {
        let starsHtml = "";
        for (let j = 0; j < 3; j++) {
          if (j < s) {
            starsHtml += `<span class="star filled">★</span>`;
          } else {
            starsHtml += `<span class="star">☆</span>`;
          }
        }
        cardStarsEl.innerHTML = starsHtml;
      }
    }

    if (this.headerTotalStars) {
      this.headerTotalStars.textContent = `${total} / 12`;
    }

    // Check certificate availability
    const completedCount = Object.values(this.moduleStars).filter(s => s > 0).length;
    if (this.btnOpenCert && this.certStatusText) {
      if (completedCount >= 4) {
        this.btnOpenCert.disabled = false;
        this.btnOpenCert.classList.add('btn-pulse');
        this.certStatusText.textContent = "Lulus 4/4 Modul! Klik untuk membuka dan mencetak sertifikat!";
      } else {
        this.btnOpenCert.disabled = true;
        this.btnOpenCert.classList.remove('btn-pulse');
        this.certStatusText.textContent = `Selesaikan seluruh 4 modul untuk membuka sertifikat (Progres: ${completedCount}/4)`;
      }
    }
  }

  saveProgress() {
    try {
      const data = {
        playerName: this.playerName,
        moduleStars: this.moduleStars
      };
      localStorage.setItem('administrasi_cilik_save', JSON.stringify(data));
    } catch (e) {}
  }

  loadSavedProgress() {
    try {
      const raw = localStorage.getItem('administrasi_cilik_save');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.playerName) this.playerName = data.playerName;
        if (data.moduleStars) this.moduleStars = data.moduleStars;
      }
    } catch (e) {}

    if (this.inputPlayerName) this.inputPlayerName.value = this.playerName;
    if (this.displayPlayerName) this.displayPlayerName.textContent = this.playerName;
    this.updateStarsDisplay();
  }

  /* ================= Confetti Engine ================= */
  initConfetti() {
    if (!this.confettiCanvas) return;
    const resize = () => {
      this.confettiCanvas.width = window.innerWidth;
      this.confettiCanvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
  }

  triggerConfetti(durationMs = 3000) {
    if (!this.confettiCanvas) return;
    const ctx = this.confettiCanvas.getContext('2d');
    this.isConfettiActive = true;
    this.confettiParticles = [];

    const colors = ['#38bdf8', '#fbbf24', '#f43f5e', '#34d399', '#a78bfa', '#f97316'];
    const particleCount = 120;

    for (let i = 0; i < particleCount; i++) {
      this.confettiParticles.push({
        x: Math.random() * this.confettiCanvas.width,
        y: -20 - Math.random() * 100,
        size: 8 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: -3 + Math.random() * 6,
        vy: 3 + Math.random() * 5,
        rot: Math.random() * 360,
        vrot: -4 + Math.random() * 8
      });
    }

    const startTime = Date.now();
    const render = () => {
      if (!this.isConfettiActive) return;
      ctx.clearRect(0, 0, this.confettiCanvas.width, this.confettiCanvas.height);

      this.confettiParticles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();

        if (p.y > this.confettiCanvas.height + 20) {
          p.y = -20;
          p.x = Math.random() * this.confettiCanvas.width;
        }
      });

      if (Date.now() - startTime < durationMs) {
        requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, this.confettiCanvas.width, this.confettiCanvas.height);
        this.isConfettiActive = false;
      }
    };

    requestAnimationFrame(render);
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
