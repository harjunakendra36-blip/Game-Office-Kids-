/**
 * Administrasi Cilik - Certificate Generator & Exporter
 * Renders digital certificate on Canvas and provides Download PNG & Print functions.
 */

class CertificateManager {
  constructor() {
    this.modalEl = document.getElementById('modal-certificate');
    this.btnClose = document.getElementById('btn-close-cert');
    this.btnDownload = document.getElementById('btn-download-cert');
    this.btnPrint = document.getElementById('btn-print-cert');
    this.nameDisplayEl = document.getElementById('cert-display-name');

    this.initEvents();
  }

  initEvents() {
    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.hide());
    }

    if (this.btnPrint) {
      this.btnPrint.addEventListener('click', () => {
        window.print();
      });
    }

    if (this.btnDownload) {
      this.btnDownload.addEventListener('click', () => this.downloadAsPNG());
    }
  }

  show(playerName = "Petugas Cilik") {
    if (this.nameDisplayEl) {
      this.nameDisplayEl.textContent = playerName;
    }
    if (this.modalEl) {
      this.modalEl.classList.add('active');
    }

    window.soundEngine.playFanfare();
    window.characterController.say(
      `Selamat ya ${playerName}! Kamu telah lulus menjadi Petugas Administrasi Cilik Teladan. Ini sertifikat resmimu!`
    );
  }

  hide() {
    if (this.modalEl) {
      this.modalEl.classList.remove('active');
    }
  }

  /**
   * Draw high-resolution certificate directly on HTML5 Canvas and trigger PNG download
   */
  downloadAsPNG() {
    const playerName = (window.app && window.app.playerName) ? window.app.playerName : "Petugas Cilik";
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 850;
    const ctx = canvas.getContext('2d');

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 1200, 850);
    bgGrad.addColorStop(0, '#fffdfa');
    bgGrad.addColorStop(1, '#fef9c3');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1200, 850);

    // Outer Border
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 14;
    ctx.strokeRect(30, 30, 1140, 790);

    // Inner Dashed Border
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(50, 50, 1100, 750);
    ctx.setLineDash([]); // Reset dash

    // Header Emblem
    ctx.font = '50px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏢', 600, 120);

    // Title
    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 38px Fredoka, sans-serif';
    ctx.fillText('SERTIFIKAT KELULUSAN RESMI', 600, 180);

    ctx.fillStyle = '#0284c7';
    ctx.font = 'bold 22px Fredoka, sans-serif';
    ctx.fillText('PETUGAS ADMINISTRASI CILIK INDONESIA', 600, 215);

    // Awarded text
    ctx.fillStyle = '#475569';
    ctx.font = '18px Quicksand, sans-serif';
    ctx.fillText('Diberikan dengan penuh apresiasi dan penghargaan kepada:', 600, 275);

    // Recipient Name
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 44px Fredoka, sans-serif';
    ctx.fillText(playerName, 600, 335);

    // Decorative Underline
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(350, 350);
    ctx.lineTo(850, 350);
    ctx.stroke();

    // Body Statement
    ctx.fillStyle = '#334155';
    ctx.font = '20px Quicksand, sans-serif';
    ctx.fillText('Telah berhasil menyelesaikan seluruh 4 Modul Praktik Administrasi Perkantoran:', 600, 395);

    // 4 Badges
    const modules = ['🛎️ Front Office', '🗂️ Pengarsipan Berkas', '📑 Tata Surat & Stempel', '💵 Uang Kas Cilik'];
    modules.forEach((mod, i) => {
      const x = 200 + i * 220;
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(x - 85, 420, 170, 36);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 85, 420, 170, 36);

      ctx.fillStyle = '#0369a1';
      ctx.font = 'bold 15px Fredoka, sans-serif';
      ctx.fillText(mod, x, 444);
    });

    // Predikat
    ctx.fillStyle = '#166534';
    ctx.font = 'bold 22px Fredoka, sans-serif';
    ctx.fillText('Predikat: SANGAT MEMUASKAN (EXCELLENT) ⭐⭐⭐', 600, 510);

    // Gold Seal (Center Bottom)
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.arc(600, 640, 55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#713f12';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('★ RESMI ★', 600, 630);
    ctx.fillText('SAH & LULUS', 600, 648);
    ctx.fillText('2026', 600, 665);

    // Signature 1: Andini
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(180, 680);
    ctx.lineTo(340, 680);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px Fredoka, sans-serif';
    ctx.fillText('Andini', 260, 710);
    ctx.fillStyle = '#64748b';
    ctx.font = '14px Quicksand, sans-serif';
    ctx.fillText('Pemandu Kantor Cilik', 260, 730);

    // Signature 2: Direktur
    ctx.beginPath();
    ctx.moveTo(860, 680);
    ctx.lineTo(1020, 680);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px Fredoka, sans-serif';
    ctx.fillText('Kak Fajar, M.M.', 940, 710);
    ctx.fillStyle = '#64748b';
    ctx.font = '14px Quicksand, sans-serif';
    ctx.fillText('Direktur Pembina Cilik', 940, 730);

    // Trigger download
    const link = document.createElement('a');
    link.download = `Sertifikat-Administrasi-Cilik-${playerName.replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    window.soundEngine.playClick();
  }
}

// Global Certificate Manager Instance
window.certificateManager = new CertificateManager();
