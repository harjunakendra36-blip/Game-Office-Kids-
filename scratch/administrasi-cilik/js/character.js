/**
 * Administrasi Cilik - Character & Dialogue Controller
 * Renders SVG cartoon characters (Andini & Visitors)
 * Manages Speech Bubble & Indonesian Text-To-Speech (TTS)
 */

class CharacterController {
  constructor() {
    this.voiceEnabled = true;
    this.speechSynth = window.speechSynthesis || null;
    this.currentUtterance = null;
    this.typewriterTimer = null;
    this.lastSpokenText = "";
    this.indonesianVoice = null;

    this.initVoice();
    this.renderAndiniAvatar();
  }

  initVoice() {
    if (!this.speechSynth) return;

    const findVoice = () => {
      const voices = this.speechSynth.getVoices();
      // Look for Indonesian voice (id-ID or id_ID)
      this.indonesianVoice = voices.find(v => v.lang.startsWith('id') || v.lang.includes('ID')) || null;
    };

    findVoice();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = findVoice;
    }
  }

  toggleVoice() {
    this.voiceEnabled = !this.voiceEnabled;
    if (!this.voiceEnabled && this.speechSynth) {
      this.speechSynth.cancel();
    }
    return this.voiceEnabled;
  }

  /**
   * Render high-detail 2D SVG cartoon for Andini
   */
  getAndiniSVG(size = "100%", isWaving = true) {
    return `
      <svg viewBox="0 0 160 200" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" class="andini-svg-root" style="overflow: visible;">
        <defs>
          <radialGradient id="skinGrad" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stop-color="#fed7aa"/>
            <stop offset="100%" stop-color="#fdba74"/>
          </radialGradient>
          <linearGradient id="hairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#451a03"/>
            <stop offset="100%" stop-color="#1f0901"/>
          </linearGradient>
          <linearGradient id="blazerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0284c7"/>
            <stop offset="100%" stop-color="#0369a1"/>
          </linearGradient>
        </defs>

        <!-- Shadow -->
        <ellipse cx="80" cy="192" rx="45" ry="8" fill="rgba(0,0,0,0.15)" />

        <!-- Andini Body Group with Breathing Animation -->
        <g class="andini-body-anim" style="transform-origin: 80px 190px; animation: andiniBreathe 3s ease-in-out infinite;">
          
          <!-- Back Ponytail Hair -->
          <path d="M 40 50 C 20 60, 15 110, 35 125 C 45 105, 48 80, 50 65 Z" fill="url(#hairGrad)"/>
          <path d="M 120 50 C 140 60, 145 110, 125 125 C 115 105, 112 80, 110 65 Z" fill="url(#hairGrad)"/>

          <!-- Body / Office Outfit -->
          <!-- Inner White Shirt -->
          <polygon points="65,115 95,115 88,175 72,175" fill="#ffffff"/>
          <!-- Red Necktie -->
          <polygon points="78,118 82,118 85,145 80,152 75,145" fill="#ef4444"/>

          <!-- Office Blazer -->
          <path d="M 52 118 Q 80 128 108 118 L 115 180 Q 80 185 45 180 Z" fill="url(#blazerGrad)"/>
          <polygon points="52,118 72,160 55,160" fill="#0369a1"/>
          <polygon points="108,118 88,160 105,160" fill="#0369a1"/>

          <!-- ID Badge Card -->
          <rect x="90" y="132" width="16" height="22" rx="2" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
          <rect x="92" y="135" width="12" height="6" fill="#38bdf8"/>
          <line x1="93" y1="144" x2="103" y2="144" stroke="#64748b" stroke-width="1.5"/>
          <line x1="93" y1="148" x2="100" y2="148" stroke="#64748b" stroke-width="1"/>
          <!-- Badge Ribbon Strap -->
          <line x1="88" y1="120" x2="98" y2="132" stroke="#0284c7" stroke-width="2"/>

          <!-- Left Arm (Holding clipboard) -->
          <g class="andini-arm-left">
            <path d="M 52 120 Q 38 145 42 165" stroke="url(#blazerGrad)" stroke-width="14" stroke-linecap="round" fill="none"/>
            <circle cx="43" cy="168" r="8" fill="url(#skinGrad)"/>
            <!-- Cute Mini Clipboard -->
            <rect x="25" y="152" width="22" height="28" rx="3" fill="#d97706" transform="rotate(-15 25 152)"/>
            <rect x="28" y="156" width="16" height="20" rx="1" fill="#ffffff" transform="rotate(-15 25 152)"/>
          </g>

          <!-- Right Arm (Waving) -->
          <g class="andini-arm-right" style="transform-origin: 108px 124px; ${isWaving ? 'animation: andiniWaveHand 2.2s ease-in-out infinite;' : ''}">
            <path d="M 108 122 Q 130 115 138 95" stroke="url(#blazerGrad)" stroke-width="14" stroke-linecap="round" fill="none"/>
            <circle cx="140" cy="92" r="9" fill="url(#skinGrad)"/>
            <!-- Waving fingers -->
            <ellipse cx="144" cy="86" rx="3" ry="5" fill="url(#skinGrad)" transform="rotate(20 144 86)"/>
            <ellipse cx="140" cy="83" rx="3" ry="5" fill="url(#skinGrad)"/>
            <ellipse cx="136" cy="85" rx="3" ry="5" fill="url(#skinGrad)" transform="rotate(-20 136 85)"/>
          </g>

          <!-- Neck -->
          <rect x="74" y="102" width="12" height="18" fill="url(#skinGrad)" rx="3"/>

          <!-- Head -->
          <g class="andini-head">
            <!-- Face -->
            <circle cx="80" cy="72" r="36" fill="url(#skinGrad)"/>

            <!-- Blush Cheeks -->
            <circle cx="60" cy="80" r="7" fill="#f43f5e" opacity="0.35"/>
            <circle cx="100" cy="80" r="7" fill="#f43f5e" opacity="0.35"/>

            <!-- Eyes (With Blinking Animation) -->
            <g class="andini-eyes" style="transform-origin: 80px 70px; animation: andiniBlinkEye 4s infinite;">
              <!-- Left Eye -->
              <circle cx="66" cy="70" r="6" fill="#1e1b4b"/>
              <circle cx="64" cy="68" r="2.5" fill="#ffffff"/>
              <path d="M 58 62 Q 66 58 72 62" stroke="#451a03" stroke-width="2" fill="none" stroke-linecap="round"/>

              <!-- Right Eye -->
              <circle cx="94" cy="70" r="6" fill="#1e1b4b"/>
              <circle cx="92" cy="68" r="2.5" fill="#ffffff"/>
              <path d="M 88 62 Q 94 58 102 62" stroke="#451a03" stroke-width="2" fill="none" stroke-linecap="round"/>
            </g>

            <!-- Cute Nose -->
            <circle cx="80" cy="76" r="1.5" fill="#ea580c"/>

            <!-- Smiling Mouth -->
            <path d="M 72 82 Q 80 92 88 82" stroke="#991b1b" stroke-width="2.5" fill="#f43f5e" stroke-linecap="round"/>

            <!-- Front Hair & Bangs -->
            <path d="M 44 64 C 44 32, 116 32, 116 64 C 110 50, 95 44, 80 48 C 65 44, 50 50, 44 64 Z" fill="url(#hairGrad)"/>
            <path d="M 44 64 Q 58 72 68 62 Q 80 72 92 60 Q 106 72 116 64 C 120 85, 118 90, 115 95 C 110 70, 112 55, 108 50 C 95 45, 65 45, 52 50 C 48 55, 50 70, 45 95 Z" fill="url(#hairGrad)"/>

            <!-- Cheerful Hair Ribbon / Clip -->
            <circle cx="106" cy="46" r="7" fill="#38bdf8"/>
            <circle cx="106" cy="46" r="3" fill="#fef08a"/>
          </g>
        </g>
      </svg>
    `;
  }

  /**
   * Render SVG Avatars for 3 Different Visitors
   */
  getVisitorSVG(type = 'kurir') {
    if (type === 'kurir') {
      // Pak Budi (Kurir Pos Paket)
      return `
        <svg viewBox="0 0 160 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="kurirSkin" cx="50%" cy="40%" r="50%">
              <stop offset="0%" stop-color="#fed7aa"/>
              <stop offset="100%" stop-color="#fba866"/>
            </radialGradient>
          </defs>
          <ellipse cx="80" cy="210" rx="40" ry="7" fill="rgba(0,0,0,0.15)"/>
          <!-- Body: Orange Courier Uniform -->
          <rect x="52" y="115" width="56" height="75" rx="6" fill="#ea580c"/>
          <polygon points="70,115 90,115 84,170 76,170" fill="#ffffff"/>
          <line x1="80" y1="120" x2="80" y2="165" stroke="#1e293b" stroke-width="2"/>
          <!-- Courier Cap -->
          <circle cx="80" cy="65" r="34" fill="url(#kurirSkin)"/>
          <path d="M 46 60 Q 80 30 114 60 Z" fill="#ea580c"/>
          <path d="M 44 60 Q 80 52 126 56" stroke="#c2410c" stroke-width="6" fill="none" stroke-linecap="round"/>
          <circle cx="80" cy="48" r="5" fill="#fef08a"/>
          <!-- Face Features -->
          <circle cx="68" cy="65" r="4" fill="#1e293b"/>
          <circle cx="92" cy="65" r="4" fill="#1e293b"/>
          <!-- Friendly Mustache -->
          <path d="M 72 75 Q 80 72 88 75" stroke="#451a03" stroke-width="3" stroke-linecap="round"/>
          <path d="M 74 82 Q 80 88 86 82" stroke="#991b1b" stroke-width="2" fill="none"/>
          <!-- Holding Package Box -->
          <rect x="42" y="140" width="76" height="50" rx="4" fill="#d97706" stroke="#b45309" stroke-width="2"/>
          <line x1="80" y1="140" x2="80" y2="190" stroke="#fef3c7" stroke-width="8"/>
          <line x1="42" y1="165" x2="118" y2="165" stroke="#fef3c7" stroke-width="8"/>
          <text x="80" y="169" font-size="8" font-weight="bold" fill="#78350f" text-anchor="middle">KILAT POS</text>
        </svg>
      `;
    } else if (type === 'klien') {
      // Bu Ratna (Klien Mitra Bisnis)
      return `
        <svg viewBox="0 0 160 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="80" cy="210" rx="40" ry="7" fill="rgba(0,0,0,0.15)"/>
          <!-- Hijab & Business Attire -->
          <rect x="50" y="115" width="60" height="75" rx="8" fill="#4f46e5"/>
          <!-- Hijab Head Covering -->
          <circle cx="80" cy="65" r="36" fill="#818cf8"/>
          <circle cx="80" cy="67" r="26" fill="#fed7aa"/>
          <!-- Face -->
          <circle cx="70" cy="65" r="3.5" fill="#1e293b"/>
          <circle cx="90" cy="65" r="3.5" fill="#1e293b"/>
          <!-- Glasses -->
          <circle cx="70" cy="65" r="8" fill="none" stroke="#d97706" stroke-width="2"/>
          <circle cx="90" cy="65" r="8" fill="none" stroke="#d97706" stroke-width="2"/>
          <line x1="78" y1="65" x2="82" y2="65" stroke="#d97706" stroke-width="2"/>
          <!-- Smile -->
          <path d="M 74 78 Q 80 84 86 78" stroke="#dc2626" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <!-- Handbag -->
          <rect x="110" y="145" width="26" height="32" rx="4" fill="#991b1b"/>
          <path d="M 116 145 Q 123 130 130 145" stroke="#991b1b" stroke-width="3" fill="none"/>
        </svg>
      `;
    } else {
      // Kak Dimas (Teknisi Komputer)
      return `
        <svg viewBox="0 0 160 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="80" cy="210" rx="40" ry="7" fill="rgba(0,0,0,0.15)"/>
          <!-- Body: Tech Polo Shirt -->
          <rect x="52" y="115" width="56" height="75" rx="6" fill="#0d9488"/>
          <circle cx="80" cy="65" r="32" fill="#fed7aa"/>
          <!-- Cool Spiky Hair -->
          <path d="M 48 55 Q 60 30 80 32 Q 100 30 112 55 Z" fill="#334155"/>
          <!-- Eyes & Headset -->
          <circle cx="70" cy="65" r="4" fill="#1e293b"/>
          <circle cx="90" cy="65" r="4" fill="#1e293b"/>
          <path d="M 74 76 Q 80 82 86 76" stroke="#991b1b" stroke-width="2" fill="none"/>
          <!-- Headset with Mic -->
          <path d="M 46 65 Q 80 25 114 65" stroke="#0f172a" stroke-width="4" fill="none"/>
          <rect x="44" y="60" width="8" height="14" rx="3" fill="#0f172a"/>
          <rect x="108" y="60" width="8" height="14" rx="3" fill="#0f172a"/>
          <path d="M 112 70 Q 110 85 96 84" stroke="#0f172a" stroke-width="2.5" fill="none"/>
          <circle cx="94" cy="84" r="3" fill="#ef4444"/>
          <!-- Toolbox -->
          <rect x="36" y="150" width="38" height="28" rx="4" fill="#475569"/>
          <rect x="48" y="144" width="14" height="6" rx="2" fill="#1e293b"/>
        </svg>
      `;
    }
  }

  renderAndiniAvatar() {
    const avatarEl = document.getElementById('andini-character-svg');
    if (avatarEl) {
      avatarEl.innerHTML = this.getAndiniSVG('100%', true);
    }
    const welcomeEl = document.getElementById('welcome-andini-avatar');
    if (welcomeEl) {
      welcomeEl.innerHTML = this.getAndiniSVG('100%', true);
    }
  }

  /**
   * Speak and display message through Andini
   */
  say(text, callback = null) {
    this.lastSpokenText = text;
    const textEl = document.getElementById('andini-speech-text');
    const bubbleEl = document.getElementById('andini-speech-bubble');

    if (bubbleEl) {
      bubbleEl.style.animation = 'none';
      void bubbleEl.offsetWidth; // trigger reflow
      bubbleEl.style.animation = 'bubbleBounce 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    }

    // Typewriter effect
    if (textEl) {
      textEl.textContent = "";
      if (this.typewriterTimer) clearInterval(this.typewriterTimer);

      let charIdx = 0;
      this.typewriterTimer = setInterval(() => {
        if (charIdx < text.length) {
          textEl.textContent += text.charAt(charIdx);
          charIdx++;
        } else {
          clearInterval(this.typewriterTimer);
          this.typewriterTimer = null;
          if (callback) callback();
        }
      }, 18);
    }

    // Text to Speech
    if (this.voiceEnabled && this.speechSynth) {
      try {
        this.speechSynth.cancel(); // Stop any previous speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        utterance.rate = 1.05; // Slightly cheerful and brisk pace
        utterance.pitch = 1.25; // Youthful, friendly pitch for Andini

        if (this.indonesianVoice) {
          utterance.voice = this.indonesianVoice;
        }

        this.currentUtterance = utterance;
        this.speechSynth.speak(utterance);
      } catch (e) {
        console.warn("TTS notice:", e);
      }
    }
  }

  replay() {
    if (this.lastSpokenText) {
      this.say(this.lastSpokenText);
    }
  }
}

// Global Character Controller Instance
window.characterController = new CharacterController();
