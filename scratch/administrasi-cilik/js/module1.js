/**
 * Administrasi Cilik - Modul 1: Front Office & Buku Tamu
 * Interactive reception desk, polite dialogue branching, guestbook entry.
 */

class Module1 {
  constructor() {
    this.currentVisitorIndex = 0;
    this.mistakes = 0;
    this.startTime = 0;
    this.visitors = [
      {
        id: 1,
        type: 'kurir',
        name: 'Pak Budi Hartono',
        org: 'Kantor Pos Kilat Express',
        purpose: 'Mengantarkan paket dokumen resmi untuk Direktur',
        greetings: [
          { text: "Selamat pagi Pak Budi! Selamat datang di Kantor Cilik. Ada yang bisa kami bantu?", correct: true },
          { text: "Pak, taruh saja paketnya di lantai!", correct: false },
          { text: "Mau ngapain ke sini pak?", correct: false }
        ],
        dialogue: "Halo Dik Petugas! Saya mau mengantar dokumen penting untuk Direktur. Mohon dicatat ya!",
        passNumber: "V-101"
      },
      {
        id: 2,
        type: 'klien',
        name: 'Ibu Ratna Dewi, S.E.',
        org: 'PT Maju Mandiri Bersama',
        purpose: 'Menghadiri Rapat Koordinasi Program Baru',
        greetings: [
          { text: "Selamat siang Ibu Ratna, silakan duduk. Boleh kami bantu mencatat buku tamu?", correct: true },
          { text: "Ibu siapa ya? Ruang rapat lagi sibuk nih.", correct: false },
          { text: "Tunggu sebentar, saya mau main game dulu.", correct: false }
        ],
        dialogue: "Selamat siang! Saya ada janji rapat jam 10 pagi dengan tim administrasi cilik.",
        passNumber: "V-102"
      },
      {
        id: 3,
        type: 'teknisi',
        name: 'Kak Dimas Prasetyo',
        org: 'Tim IT Ceria Support',
        purpose: 'Pengecekan dan pemeliharaan rutin komputer kantor',
        greetings: [
          { text: "Halo Kak Dimas! Terima kasih sudah datang. Mari kami buatkan kartu tamunya ya!", correct: true },
          { text: "Komputernya tidak rusak kok kak, pulang saja.", correct: false },
          { text: "Eh kak, ada apa?", correct: false }
        ],
        dialogue: "Halo! Saya dari tim IT untuk servis berkala peralatan kantor cilik hari ini.",
        passNumber: "V-103"
      }
    ];

    this.initElements();
  }

  initElements() {
    this.bellEl = document.getElementById('mod1-bell');
    this.visitorAvatarEl = document.getElementById('mod1-visitor-avatar');
    this.speakerEl = document.getElementById('mod1-speaker');
    this.dialogueTextEl = document.getElementById('mod1-dialogue-text');
    this.choicesContainerEl = document.getElementById('mod1-choices');
    this.visitorIndexEl = document.getElementById('mod1-visitor-index');
    this.todayDateEl = document.getElementById('mod1-today-date');

    this.inputName = document.getElementById('mod1-input-name');
    this.inputOrg = document.getElementById('mod1-input-org');
    this.inputPurpose = document.getElementById('mod1-input-purpose');
    this.btnSubmit = document.getElementById('mod1-btn-submit');

    this.passName = document.getElementById('mod1-pass-name');
    this.passStatus = document.getElementById('mod1-pass-status');

    if (this.bellEl) {
      this.bellEl.addEventListener('click', () => {
        window.soundEngine.playBell();
        this.bellEl.style.animation = 'none';
        void this.bellEl.offsetWidth;
        this.bellEl.style.animation = 'bellDing 0.4s ease';
      });
    }

    if (this.btnSubmit) {
      this.btnSubmit.addEventListener('click', () => this.handleSaveGuestbook());
    }

    if (this.todayDateEl) {
      const now = new Date();
      const options = { day: 'numeric', month: 'long', year: 'numeric' };
      this.todayDateEl.textContent = now.toLocaleDateString('id-ID', options);
    }
  }

  start() {
    this.currentVisitorIndex = 0;
    this.mistakes = 0;
    this.startTime = Date.now();
    this.loadVisitor(0);
  }

  loadVisitor(index) {
    this.currentVisitorIndex = index;
    if (this.visitorIndexEl) this.visitorIndexEl.textContent = index + 1;

    const data = this.visitors[index];
    if (!data) {
      this.completeModule();
      return;
    }

    // Reset Form
    this.inputName.value = "";
    this.inputOrg.value = "";
    this.inputPurpose.value = "";
    this.btnSubmit.disabled = true;
    this.passName.textContent = "Belum Terdaftar";
    this.passStatus.textContent = "Status: Menunggu Pencatatan";

    // Render Visitor Avatar
    if (this.visitorAvatarEl) {
      this.visitorAvatarEl.innerHTML = window.characterController.getVisitorSVG(data.type);
      this.visitorAvatarEl.style.transform = 'translateX(-100px)';
      setTimeout(() => {
        this.visitorAvatarEl.style.transform = 'translateX(0)';
      }, 50);
    }

    // Play Bell
    window.soundEngine.playBell();

    // Andini guide
    window.characterController.say(`Tamu ke-${index + 1} tiba di meja resepsionis! Pilih sapaan 5S yang paling sopan dan ramah ya!`);

    // Setup Dialogue & Choices
    this.speakerEl.textContent = data.name + ` (${data.org})`;
    this.dialogueTextEl.textContent = `Tamu baru saja tiba di depan meja resepsionis. Sapa tamu dengan sopan:`;

    this.renderChoices(data.greetings);
  }

  renderChoices(choices) {
    this.choicesContainerEl.innerHTML = "";
    // Shuffle choices slightly
    const shuffled = [...choices].sort(() => Math.random() - 0.5);

    shuffled.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'dialogue-choice-btn';
      btn.textContent = `💬 "${choice.text}"`;
      btn.addEventListener('click', () => this.handleGreetingSelection(choice));
      this.choicesContainerEl.appendChild(btn);
    });
  }

  handleGreetingSelection(choice) {
    window.soundEngine.playClick();
    const data = this.visitors[this.currentVisitorIndex];

    if (choice.correct) {
      this.dialogueTextEl.innerHTML = `<span style="color: #16a34a;"><strong>Sapaan Tepat! ✅</strong></span><br>"${data.dialogue}"`;
      this.choicesContainerEl.innerHTML = `
        <button class="btn-primary" id="btn-fill-guestbook" style="width: 100%;">
          ✍️ Buka & Catat ke Buku Tamu
        </button>
      `;

      window.characterController.say(`Hebat! Tamu merasa sangat dihargai. Sekarang klik tombol untuk mencatat identitas tamu ke buku tamu digital!`);

      const btnFill = document.getElementById('btn-fill-guestbook');
      if (btnFill) {
        btnFill.addEventListener('click', () => this.autoFillAndEnablePass(data));
      }
    } else {
      this.mistakes++;
      this.dialogueTextEl.innerHTML = `<span style="color: #dc2626;"><strong>Kurang Sopan ❌</strong></span><br>Sebagai petugas administrasi yang baik, kita harus selalu ramah dan menerapkan 5S (Senyum, Sapa, Salam, Sopan, Santun). Coba lagi ya!`;
      window.characterController.say(`Ups, jawaban tadi kurang ramah. Yuk pilih sapaan yang lebih sopan!`);
    }
  }

  autoFillAndEnablePass(data) {
    window.soundEngine.playSwoosh();
    this.inputName.value = data.name;
    this.inputOrg.value = data.org;
    this.inputPurpose.value = data.purpose;

    this.passName.textContent = data.name;
    this.passStatus.textContent = `Status: Terverifikasi [No. Pass: ${data.passNumber}]`;
    this.passStatus.style.color = "#059669";

    this.btnSubmit.disabled = false;
    this.btnSubmit.classList.add('btn-pulse');

    this.dialogueTextEl.textContent = `Data tamu telah dimasukkan ke dalam sistem buku tamu. Tekan tombol 'Simpan & Berikan Kartu Tamu'!`;
  }

  handleSaveGuestbook() {
    window.soundEngine.playSnap();
    this.btnSubmit.disabled = true;
    this.btnSubmit.classList.remove('btn-pulse');

    window.characterController.say(`Bagus sekali! Kartu visitor pass berhasil diserahkan kepada tamu.`);

    setTimeout(() => {
      if (this.currentVisitorIndex < this.visitors.length - 1) {
        this.loadVisitor(this.currentVisitorIndex + 1);
      } else {
        this.completeModule();
      }
    }, 1200);
  }

  completeModule() {
    const elapsedSeconds = Math.round((Date.now() - this.startTime) / 1000);
    let stars = 3;
    if (this.mistakes > 2) stars = 1;
    else if (this.mistakes > 0 || elapsedSeconds > 45) stars = 2;

    window.app.showCompletionModal(1, stars, {
      accuracy: this.mistakes === 0 ? "100% (Sempurna)" : `${Math.max(60, 100 - this.mistakes * 20)}%`,
      speed: elapsedSeconds < 30 ? "Sangat Cepat ⚡" : "Bagus & Teliti 👍"
    });
  }
}

// Global Module 1 Instance
window.module1 = new Module1();
