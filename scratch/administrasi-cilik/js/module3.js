/**
 * Administrasi Cilik - Modul 3: Tata Surat & Stempel Digital
 * Interactive precision stamping, ink pad dipping, screen shake & audio feedback.
 */

class Module3 {
  constructor() {
    this.currentLetterIndex = 0;
    this.isInkReady = false;
    this.selectedStampType = 'APPROVED';
    this.mistakes = 0;
    this.startTime = 0;

    this.letters = [
      {
        id: 1,
        number: '001/ADM-CILIK/VIII/2026',
        subject: 'Surat Undangan Rapat Kerja Cilik',
        body: 'Dengan hormat, bersama surat ini kami mengundang seluruh staf Administrasi Cilik untuk menghadiri Rapat Koordinasi Program Kantor Cilik Semester 2. Mohon hadir tepat waktu dengan membawa catatan tugas.',
        requiredType: 'APPROVED',
        signTitle: 'Direktur Kantor Cilik',
        signName: 'Kak Fajar, M.M.'
      },
      {
        id: 2,
        number: '002/MEMO-INT/VIII/2026',
        subject: 'Memo Dinas Pengadaan ATK Baru',
        body: 'Diberitahukan kepada seluruh divisi bahwa pengadaan buku arsip, tinta printer, dan perangko kantor telah disetujui. Petugas kas cilik dimohon mempersiapkan dana petty cash yang diperlukan.',
        requiredType: 'OFFICIAL',
        signTitle: 'Kepala Bagian Umum',
        signName: 'Bu Heni Sartika'
      },
      {
        id: 3,
        number: '003/SK-PETUGAS/VIII/2026',
        subject: 'Surat Keputusan Petugas Administrasi Cilik',
        body: 'Menetapkan dan mengesahkan seluruh hasil pelatihan praktik administrasi kantor sebagai bukti kompetensi keahlian dasar perkantoran modern yang berdedikasi tinggi dan amanah.',
        requiredType: 'APPROVED',
        signTitle: 'Direktur Utama Pembina',
        signName: 'Kak Fajar, M.M.'
      }
    ];

    this.initElements();
  }

  initElements() {
    this.letterIndexEl = document.getElementById('mod3-letter-index');
    this.docNumberEl = document.getElementById('mod3-doc-number');
    this.docSubjectEl = document.getElementById('mod3-doc-subject');
    this.docBodyEl = document.getElementById('mod3-doc-body');
    this.signPlayerNameEl = document.getElementById('mod3-sign-player-name');

    this.stampZoneEl = document.getElementById('mod3-stamp-zone');
    this.stampedImprintEl = document.getElementById('mod3-stamped-imprint');
    this.inkpadEl = document.getElementById('mod3-inkpad');
    this.stampStatusEl = document.getElementById('mod3-stamp-status');
    this.stamperInkStatusEl = document.getElementById('stamper-ink-status');
    this.btnNextLetter = document.getElementById('mod3-btn-next-letter');
    this.letterSheetEl = document.getElementById('mod3-letter-sheet');

    // Stamp type switcher
    this.stampTypeButtons = document.querySelectorAll('.stamp-type-option');
    this.stampTypeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        window.soundEngine.playClick();
        this.stampTypeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedStampType = btn.getAttribute('data-type');
        this.isInkReady = false; // Need to re-dip ink
        this.updateInkState();
      });
    });

    // Inkpad Click / Touch
    if (this.inkpadEl) {
      this.inkpadEl.addEventListener('click', () => {
        window.soundEngine.playSnap();
        this.isInkReady = true;
        this.updateInkState();

        this.inkpadEl.style.animation = 'none';
        void this.inkpadEl.offsetWidth;
        this.inkpadEl.style.animation = 'glowPulse 0.6s ease';

        window.characterController.say(
          "Stempel sudah basah terkena tinta merah! Sekarang arahkan kursor dan klik tepat pada kotak 'AREA CAP STEMPEL RESMI' di surat!"
        );
      });
    }

    // Stamp Zone Click
    if (this.stampZoneEl) {
      this.stampZoneEl.addEventListener('click', () => this.handleStampTarget());
    }

    // Next Letter Button
    if (this.btnNextLetter) {
      this.btnNextLetter.addEventListener('click', () => {
        window.soundEngine.playClick();
        if (this.currentLetterIndex < this.letters.length - 1) {
          this.loadLetter(this.currentLetterIndex + 1);
        } else {
          this.completeModule();
        }
      });
    }
  }

  start() {
    this.currentLetterIndex = 0;
    this.mistakes = 0;
    this.startTime = Date.now();
    this.isInkReady = false;
    this.selectedStampType = 'APPROVED';

    const playerName = window.app ? window.app.playerName : "Petugas Cilik";
    if (this.signPlayerNameEl) {
      this.signPlayerNameEl.textContent = `Petugas: ${playerName}`;
    }

    this.loadLetter(0);
  }

  loadLetter(index) {
    this.currentLetterIndex = index;
    this.isInkReady = false;
    this.updateInkState();

    if (this.letterIndexEl) this.letterIndexEl.textContent = index + 1;
    if (this.btnNextLetter) this.btnNextLetter.style.display = 'none';

    // Reset Stamp Imprint
    if (this.stampedImprintEl) {
      this.stampedImprintEl.className = 'stamped-imprint';
      this.stampedImprintEl.innerHTML = '';
    }

    const data = this.letters[index];
    if (this.docNumberEl) this.docNumberEl.textContent = data.number;
    if (this.docSubjectEl) this.docSubjectEl.textContent = data.subject;
    if (this.docBodyEl) this.docBodyEl.innerHTML = data.body;

    window.characterController.say(
      `Surat ke-${index + 1}: Periksa surat "${data.subject}". Celupkan stempel ke bantalan tinta lalu cap dokumen agar resmi!`
    );
  }

  updateInkState() {
    if (this.isInkReady) {
      this.stampStatusEl.innerHTML = `<span style="color: #16a34a;">✅ Tinta Siap! Klik area cap stempel di surat.</span>`;
      this.stamperInkStatusEl.textContent = "Tinta: BASAH";
      this.stamperInkStatusEl.style.color = "#fef08a";
      this.stampZoneEl.style.borderColor = "#ef4444";
    } else {
      this.stampStatusEl.innerHTML = `👉 Celupkan stempel ke bantalan tinta!`;
      this.stamperInkStatusEl.textContent = "Tinta: Kering";
      this.stamperInkStatusEl.style.color = "#ffffff";
      this.stampZoneEl.style.borderColor = "#38bdf8";
    }
  }

  handleStampTarget() {
    if (!this.isInkReady) {
      this.mistakes++;
      window.soundEngine.playClick();
      window.characterController.say(
        "Oops! Stempel belum dicelupkan ke bantalan tinta. Klik bantalan tinta merah terlebih dahulu ya!"
      );
      return;
    }

    // Play powerful stamp sound effect
    window.soundEngine.playStamp();

    // Trigger screen shake & visual stamp seal
    if (this.letterSheetEl) {
      this.letterSheetEl.style.animation = 'none';
      void this.letterSheetEl.offsetWidth;
      this.letterSheetEl.style.animation = 'screenShake 0.3s ease';
    }

    const stampText = this.selectedStampType === 'APPROVED' ? 'DISETUJUI / APPROVED' : 'RESMI KANTOR CILIK';

    this.stampedImprintEl.innerHTML = `
      <div class="imprint-seal">
        ★ ${stampText} ★<br>
        <span style="font-size: 0.65rem; font-weight: normal;">KANTOR ADMINISTRASI CILIK</span>
      </div>
    `;
    this.stampedImprintEl.className = 'stamped-imprint stamped';

    this.isInkReady = false;
    this.updateInkState();

    window.characterController.say(
      "Keren! Surat telah berhasil disahkan dengan stempel resmi yang sangat rapi dan presisi!"
    );

    if (this.btnNextLetter) {
      this.btnNextLetter.style.display = 'inline-flex';
      this.btnNextLetter.classList.add('btn-pulse');
    }
  }

  completeModule() {
    const elapsedSeconds = Math.round((Date.now() - this.startTime) / 1000);
    let stars = 3;
    if (this.mistakes > 2) stars = 1;
    else if (this.mistakes > 0 || elapsedSeconds > 40) stars = 2;

    window.app.showCompletionModal(3, stars, {
      accuracy: this.mistakes === 0 ? "100% (Sangat Presisi)" : `${Math.max(60, 100 - this.mistakes * 20)}%`,
      speed: elapsedSeconds < 30 ? "Cepat & Tepat ⚡" : "Bagus 👍"
    });
  }
}

// Global Module 3 Instance
window.module3 = new Module3();
