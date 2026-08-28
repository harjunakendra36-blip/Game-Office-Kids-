/**
 * Administrasi Cilik - Modul 2: Pengarsipan Berkas
 * Interactive Drag and Drop with Mouse & Touch support.
 * Snap animation, color matching, and filing cabinet organization.
 */

class Module2 {
  constructor() {
    this.filedCount = 0;
    this.totalFolders = 5;
    this.mistakes = 0;
    this.startTime = 0;
    this.draggedElement = null;

    this.foldersData = [
      {
        id: 'f-keuangan',
        category: 'keuangan',
        color: 'kuning',
        code: '[K-01]',
        title: 'Laporan Keuangan & Kas',
        icon: '📊'
      },
      {
        id: 'f-surat',
        category: 'surat_masuk',
        color: 'merah',
        code: '[S-02]',
        title: 'Surat Masuk Resmi',
        icon: '✉️'
      },
      {
        id: 'f-personalia',
        category: 'personalia',
        color: 'hijau',
        code: '[P-03]',
        title: 'Data Personalia & Staf',
        icon: '👥'
      },
      {
        id: 'f-jadwal',
        category: 'jadwal',
        color: 'biru',
        code: '[J-04]',
        title: 'Jadwal Agenda Rapat',
        icon: '📅'
      },
      {
        id: 'f-inventaris',
        category: 'inventaris',
        color: 'ungu',
        code: '[I-05]',
        title: 'Daftar Inventaris ATK',
        icon: '📦'
      }
    ];

    this.initElements();
  }

  initElements() {
    this.foldersPoolEl = document.getElementById('mod2-folders-pool');
    this.drawers = document.querySelectorAll('.cabinet-drawer');
    this.filedCountEl = document.getElementById('mod2-filed-count');

    // Setup Drawer Drop Zones
    this.drawers.forEach(drawer => {
      // HTML5 Drag and Drop events
      drawer.addEventListener('dragover', (e) => {
        e.preventDefault();
        drawer.classList.add('drag-over');
      });

      drawer.addEventListener('dragleave', () => {
        drawer.classList.remove('drag-over');
      });

      drawer.addEventListener('drop', (e) => {
        e.preventDefault();
        drawer.classList.remove('drag-over');
        if (this.draggedElement) {
          this.handleFolderDrop(this.draggedElement, drawer);
        }
      });
    });
  }

  start() {
    this.filedCount = 0;
    this.mistakes = 0;
    this.startTime = Date.now();
    this.updateProgress();

    // Clear drawer slots
    this.drawers.forEach(drawer => {
      const slot = drawer.querySelector('.drawer-slot');
      if (slot) slot.innerHTML = '';
      drawer.style.borderColor = '#64748b';
    });

    this.renderFolders();

    window.characterController.say(
      "Lihat, ada 5 map berkas yang berserakan di meja kerja! Seret dan masukkan setiap map ke laci lemari arsip yang memiliki warna atau huruf kategori yang sama ya!"
    );
  }

  renderFolders() {
    this.foldersPoolEl.innerHTML = '';
    // Shuffle folders on desk
    const shuffled = [...this.foldersData].sort(() => Math.random() - 0.5);

    shuffled.forEach(folder => {
      const el = document.createElement('div');
      el.className = 'doc-folder';
      el.setAttribute('draggable', 'true');
      el.setAttribute('data-id', folder.id);
      el.setAttribute('data-category', folder.category);
      el.id = folder.id;

      el.innerHTML = `
        <div class="folder-icon">${folder.icon}</div>
        <div class="folder-title">${folder.title}</div>
        <div class="folder-code">${folder.code}</div>
      `;

      // Mouse drag handlers
      el.addEventListener('dragstart', (e) => {
        this.draggedElement = el;
        el.classList.add('is-dragging');
        window.soundEngine.playSwoosh();
        e.dataTransfer.setData('text/plain', folder.id);
      });

      el.addEventListener('dragend', () => {
        el.classList.remove('is-dragging');
        this.draggedElement = null;
      });

      // Touch handlers for mobile/tablets
      this.attachTouchListeners(el);

      this.foldersPoolEl.appendChild(el);
    });
  }

  attachTouchListeners(element) {
    let currentX, currentY, initialX, initialY;
    let isTouchActive = false;

    element.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      initialX = touch.clientX;
      initialY = touch.clientY;
      this.draggedElement = element;
      isTouchActive = true;
      element.style.zIndex = '1000';
      element.classList.add('is-dragging');
      window.soundEngine.playSwoosh();
    }, { passive: true });

    element.addEventListener('touchmove', (e) => {
      if (!isTouchActive) return;
      const touch = e.touches[0];
      currentX = touch.clientX - initialX;
      currentY = touch.clientY - initialY;
      element.style.transform = `translate(${currentX}px, ${currentY}px) scale(1.1)`;

      // Detect drawer underneath finger
      const targetDrawer = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.cabinet-drawer');
      this.drawers.forEach(d => d.classList.remove('drag-over'));
      if (targetDrawer) {
        targetDrawer.classList.add('drag-over');
      }
    }, { passive: true });

    element.addEventListener('touchend', (e) => {
      if (!isTouchActive) return;
      isTouchActive = false;
      element.style.zIndex = '';
      element.style.transform = '';
      element.classList.remove('is-dragging');

      const touch = e.changedTouches[0];
      const targetDrawer = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.cabinet-drawer');
      this.drawers.forEach(d => d.classList.remove('drag-over'));

      if (targetDrawer) {
        this.handleFolderDrop(element, targetDrawer);
      }
      this.draggedElement = null;
    });
  }

  handleFolderDrop(folderEl, drawerEl) {
    const folderCategory = folderEl.getAttribute('data-category');
    const drawerCategory = drawerEl.getAttribute('data-category');

    if (folderCategory === drawerCategory) {
      // Correct Drawer!
      window.soundEngine.playSnap();
      drawerEl.style.animation = 'none';
      void drawerEl.offsetWidth;
      drawerEl.style.animation = 'folderSnap 0.35s ease';

      // Move into drawer slot
      const slot = drawerEl.querySelector('.drawer-slot');
      slot.innerHTML = `<span style="font-size: 1.4rem; animation: starPulse 0.4s ease;">📁 ✅</span>`;
      drawerEl.style.borderColor = '#22c55e';

      folderEl.remove();
      this.filedCount++;
      this.updateProgress();

      window.characterController.say(`Tepat sekali! Berkas telah tersimpan rapi di laci ${drawerCategory.toUpperCase()}.`);

      if (this.filedCount >= this.totalFolders) {
        setTimeout(() => this.completeModule(), 800);
      }
    } else {
      // Incorrect Drawer
      this.mistakes++;
      window.soundEngine.playClick();
      drawerEl.style.animation = 'screenShake 0.3s ease';
      
      window.characterController.say(
        `Ups, itu belum cocok! Coba cek lagi kode huruf dan warna map-nya ya!`
      );
    }
  }

  updateProgress() {
    if (this.filedCountEl) {
      this.filedCountEl.textContent = this.filedCount;
    }
  }

  completeModule() {
    const elapsedSeconds = Math.round((Date.now() - this.startTime) / 1000);
    let stars = 3;
    if (this.mistakes > 2) stars = 1;
    else if (this.mistakes > 0 || elapsedSeconds > 40) stars = 2;

    window.app.showCompletionModal(2, stars, {
      accuracy: this.mistakes === 0 ? "100% (Rapi Total!)" : `${Math.max(60, 100 - this.mistakes * 15)}%`,
      speed: elapsedSeconds < 25 ? "Kilat & Teratur ⚡" : "Bagus & Rapi 👍"
    });
  }
}

// Global Module 2 Instance
window.module2 = new Module2();
