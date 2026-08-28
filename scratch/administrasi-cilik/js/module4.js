/**
 * Administrasi Cilik - Modul 4: Petty Cash (Uang Kas Cilik)
 * Simple math, toy Rupiah banknotes selection, cash register sound,
 * and ledger book accounting.
 */

class Module4 {
  constructor() {
    this.currentScenarioIndex = 0;
    this.currentBalance = 100000;
    this.selectedTrayTotal = 0;
    this.selectedBills = [];
    this.mistakes = 0;
    this.startTime = 0;

    this.scenarios = [
      {
        id: 1,
        title: 'Membeli 5 Lembar Perangko Kantor',
        price: 5000,
        desc: 'Ambil pecahan uang pas senilai Rp 5.000 dari laci kasir (misal: 1 lembar Rp 5.000, atau 2 lembar Rp 2.000 + 1 lembar Rp 1.000), lalu serahkan dan catat sisa saldo kas!',
        category: 'Perangko Surat'
      },
      {
        id: 2,
        title: 'Membeli Kertas HVS & Spidol Rapat',
        price: 15000,
        desc: 'Ambil pecahan uang pas senilai Rp 15.000 (misal: 1 lembar Rp 10.000 + 1 lembar Rp 5.000) dari laci kasir, lalu catat pengurangan saldo kas!',
        category: 'Alat Tulis Kantor'
      }
    ];

    this.initElements();
  }

  initElements() {
    this.cashBalanceEl = document.getElementById('mod4-cash-balance');
    this.itemTitleEl = document.getElementById('mod4-item-title');
    this.itemPriceEl = document.getElementById('mod4-item-price');
    this.itemDescEl = document.getElementById('mod4-item-desc');
    this.calcPriceEl = document.getElementById('mod4-calc-price');

    this.trayTotalEl = document.getElementById('mod4-tray-total');
    this.trayItemsEl = document.getElementById('mod4-tray-items');
    this.btnPay = document.getElementById('mod4-btn-pay');
    this.btnResetMoney = document.getElementById('mod4-btn-reset-money');

    this.ledgerRowsEl = document.getElementById('mod4-ledger-rows');
    this.ledgerFormEl = document.getElementById('mod4-ledger-form');
    this.inputBalanceEl = document.getElementById('mod4-input-balance');
    this.btnSubmitLedger = document.getElementById('mod4-btn-submit-ledger');
    this.mathFeedbackEl = document.getElementById('mod4-math-feedback');

    // Setup Banknotes Click
    const notes = document.querySelectorAll('.money-note');
    notes.forEach(note => {
      note.addEventListener('click', () => {
        const val = parseInt(note.getAttribute('data-value'), 10);
        this.addMoneyToTray(val);
      });
    });

    if (this.btnResetMoney) {
      this.btnResetMoney.addEventListener('click', () => this.resetTray());
    }

    if (this.btnPay) {
      this.btnPay.addEventListener('click', () => this.handlePayment());
    }

    if (this.btnSubmitLedger) {
      this.btnSubmitLedger.addEventListener('click', () => this.handleLedgerSubmit());
    }
  }

  start() {
    this.currentScenarioIndex = 0;
    this.currentBalance = 100000;
    this.mistakes = 0;
    this.startTime = Date.now();

    if (this.cashBalanceEl) {
      this.cashBalanceEl.textContent = this.formatRupiah(this.currentBalance);
    }

    // Reset ledger table to initial row
    if (this.ledgerRowsEl) {
      this.ledgerRowsEl.innerHTML = `
        <tr>
          <td>0</td>
          <td>Saldo Awal Kas Kecil</td>
          <td>-</td>
          <td>Rp 100.000</td>
        </tr>
      `;
    }

    this.loadScenario(0);
  }

  loadScenario(index) {
    this.currentScenarioIndex = index;
    this.resetTray();

    const data = this.scenarios[index];
    if (this.itemTitleEl) this.itemTitleEl.textContent = data.title;
    if (this.itemPriceEl) this.itemPriceEl.textContent = this.formatRupiah(data.price);
    if (this.itemDescEl) this.itemDescEl.textContent = data.desc;
    if (this.calcPriceEl) this.calcPriceEl.textContent = this.formatRupiah(data.price);

    // Hide ledger form until payment is made
    if (this.ledgerFormEl) {
      this.ledgerFormEl.style.opacity = '0.5';
      this.ledgerFormEl.style.pointerEvents = 'none';
    }
    if (this.inputBalanceEl) this.inputBalanceEl.value = "";
    if (this.mathFeedbackEl) this.mathFeedbackEl.innerHTML = "";

    window.characterController.say(
      `Kita perlu membeli ${data.category} seharga ${this.formatRupiah(data.price)}. Pilih lembaran uang yang pas di laci kasir sebelah kanan!`
    );
  }

  addMoneyToTray(value) {
    window.soundEngine.playSwoosh();
    this.selectedBills.push(value);
    this.selectedTrayTotal += value;
    this.updateTrayDisplay();

    const targetPrice = this.scenarios[this.currentScenarioIndex].price;
    if (this.selectedTrayTotal === targetPrice) {
      this.btnPay.disabled = false;
      this.btnPay.classList.add('btn-pulse');
      window.characterController.say("Jumlah uang pas! Tekan tombol 'Bayar Sekarang' ya!");
    } else if (this.selectedTrayTotal > targetPrice) {
      this.btnPay.disabled = true;
      this.btnPay.classList.remove('btn-pulse');
      window.characterController.say("Jumlah uang berlebih. Coba klik 'Bersihkan Baki' dan pilih uang yang pas.");
    } else {
      this.btnPay.disabled = true;
      this.btnPay.classList.remove('btn-pulse');
    }
  }

  resetTray() {
    window.soundEngine.playClick();
    this.selectedBills = [];
    this.selectedTrayTotal = 0;
    this.updateTrayDisplay();
    this.btnPay.disabled = true;
    this.btnPay.classList.remove('btn-pulse');
  }

  updateTrayDisplay() {
    if (this.trayTotalEl) {
      this.trayTotalEl.textContent = this.formatRupiah(this.selectedTrayTotal);
    }

    if (this.trayItemsEl) {
      if (this.selectedBills.length === 0) {
        this.trayItemsEl.innerHTML = `<span class="tray-empty-hint">Klik uang di atas untuk meletakkan ke baki pembayaran</span>`;
      } else {
        this.trayItemsEl.innerHTML = this.selectedBills
          .map(val => `<span class="tray-chip">💵 ${this.formatRupiah(val)}</span>`)
          .join('');
      }
    }
  }

  handlePayment() {
    const data = this.scenarios[this.currentScenarioIndex];
    if (this.selectedTrayTotal !== data.price) return;

    window.soundEngine.playCashRegister();
    this.btnPay.disabled = true;
    this.btnPay.classList.remove('btn-pulse');

    // Unlock ledger entry form
    if (this.ledgerFormEl) {
      this.ledgerFormEl.style.opacity = '1';
      this.ledgerFormEl.style.pointerEvents = 'auto';
    }

    window.characterController.say(
      `Pembayaran berhasil! Sekarang hitung sisa kas: ${this.formatRupiah(this.currentBalance)} dikurangi ${this.formatRupiah(data.price)}. Ketik sisa saldo ke Buku Kas!`
    );
  }

  handleLedgerSubmit() {
    const data = this.scenarios[this.currentScenarioIndex];
    const expectedBalance = this.currentBalance - data.price;
    const userVal = parseInt(this.inputBalanceEl.value, 10);

    if (isNaN(userVal)) {
      this.mathFeedbackEl.innerHTML = `<span style="color: #dc2626;">Silakan ketik angka sisa saldo terlebih dahulu!</span>`;
      return;
    }

    if (userVal === expectedBalance) {
      // Correct!
      window.soundEngine.playSnap();
      this.mathFeedbackEl.innerHTML = `<span style="color: #16a34a;">Benar sekali! Pencatatan buku kas tercatat rapi. ✅</span>`;

      // Append row to table
      this.currentBalance = expectedBalance;
      if (this.cashBalanceEl) {
        this.cashBalanceEl.textContent = this.formatRupiah(this.currentBalance);
      }

      const newRow = document.createElement('tr');
      newRow.innerHTML = `
        <td>${this.currentScenarioIndex + 1}</td>
        <td>${data.title}</td>
        <td style="color: #dc2626; font-weight: bold;">-${this.formatRupiah(data.price)}</td>
        <td style="color: #16a34a; font-weight: bold;">${this.formatRupiah(this.currentBalance)}</td>
      `;
      this.ledgerRowsEl.appendChild(newRow);

      window.characterController.say("Hebat! Perhitungan kas kecil kamu sangat teliti dan akurat!");

      setTimeout(() => {
        if (this.currentScenarioIndex < this.scenarios.length - 1) {
          this.loadScenario(this.currentScenarioIndex + 1);
        } else {
          this.completeModule();
        }
      }, 1500);

    } else {
      this.mistakes++;
      window.soundEngine.playClick();
      this.mathFeedbackEl.innerHTML = `
        <span style="color: #dc2626;">Perhitungan belum tepat. Coba hitung lagi: ${this.formatRupiah(this.currentBalance)} - ${this.formatRupiah(data.price)}</span>
      `;
      window.characterController.say("Hitungannya masih kurang pas, ayo coba hitung pengurangan sekali lagi!");
    }
  }

  formatRupiah(num) {
    return "Rp " + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  completeModule() {
    const elapsedSeconds = Math.round((Date.now() - this.startTime) / 1000);
    let stars = 3;
    if (this.mistakes > 2) stars = 1;
    else if (this.mistakes > 0 || elapsedSeconds > 45) stars = 2;

    window.app.showCompletionModal(4, stars, {
      accuracy: this.mistakes === 0 ? "100% (Hitungan Akurat)" : `${Math.max(60, 100 - this.mistakes * 20)}%`,
      speed: elapsedSeconds < 30 ? "Cepat & Cermat ⚡" : "Bagus 👍"
    });
  }
}

// Global Module 4 Instance
window.module4 = new Module4();
