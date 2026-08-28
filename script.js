/**
 * ==========================================================================
 * OFFICE KIDS - SCRIPT.JS
 * Game Interaktif Berbasis Slide dengan LocalStorage & Web Audio API
 * ==========================================================================
 */

// --- Game Database & Constants ---
const STORAGE_KEY = 'office_kids_game_save_v1';

// --- Character Database (Mentor, Villain, & Kid Agents) ---
const GAME_CHARACTERS = {
  mentor: {
    id: 'mentor_kiki',
    name: 'Komandan Kiki',
    role: 'Mentor & Pimpinan Kantor Cilik',
    avatar: '🦉',
    trait: 'Bijaksana, ramah, dan penuh bimbingan',
    desc: 'Kepala operasi kantor cilik yang selalu siap memberikan arahan, tips cerdas, dan motivasi kepada para agen!'
  },
  villain: {
    id: 'villain_chaos',
    name: 'Dr. Chaos',
    role: 'Master Pengacau Kantor',
    avatar: '🦹‍♂️',
    trait: 'Jahili, usil, dan suka membuat onar',
    desc: 'Ilmuwan usil yang suka menyembunyikan berkas rahasia, mengotori mesin fotokopi, dan mengacak-acak dokumen kantor!'
  },
  agents: [
    {
      id: 'agent_daffa',
      name: 'Daffa',
      avatar: '👦🏻',
      specialty: 'Sigap',
      tagline: 'Daffa (Sigap)',
      desc: 'Agen yang selalu sigap, berani bergerak cepat, dan siap membantu tugas lapangan kantor.'
    },
    {
      id: 'agent_nia',
      name: 'Nia',
      avatar: '👧🏻',
      specialty: 'Teliti',
      tagline: 'Nia (Teliti)',
      desc: 'Agen yang sangat teliti memeriksa kelengkapan dokumen, cap stempel resmi, dan kerapian arsip.'
    },
    {
      id: 'agent_budi',
      name: 'Budi',
      avatar: '🧒🏽',
      specialty: 'Cepat',
      tagline: 'Budi (Cepat)',
      desc: 'Agen gesit yang ahli mengantarkan berkas kilat dan menyelesaikan pekerjaan tepat waktu.'
    },
    {
      id: 'agent_sarah',
      name: 'Sarah',
      avatar: '👧🏼',
      specialty: 'Kreatif',
      tagline: 'Sarah (Kreatif)',
      desc: 'Agen penuh imajinasi visual, jago merancang slide presentasi warna-warni dan ide inovatif.'
    },
    {
      id: 'agent_kenzo',
      name: 'Kenzo',
      avatar: '🧑🏾',
      specialty: 'Detektif',
      tagline: 'Kenzo (Detektif)',
      desc: 'Agen detektif yang jago mengurai teka-teki sandi kantor dan melacak berkas rahasia yang hilang.'
    },
    {
      id: 'agent_maya',
      name: 'Maya',
      avatar: '👧🏾',
      specialty: 'Manajer',
      tagline: 'Maya (Manajer)',
      desc: 'Agen organisator yang pintar membagi tugas tim, memimpin rapat, dan menjaga kekompakan kantor.'
    }
  ]
};

/**
 * Helper function to retrieve NPC companion agents,
 * excluding the avatar currently selected by the player as the Main Character.
 * @param {string} [playerAvatar] - Optional avatar emoji (defaults to gameState.profile.avatar)
 * @returns {Array} Array of 5 NPC companion agent objects
 */
function getNPCAgents(playerAvatar) {
  const activeAvatar = playerAvatar || (typeof gameState !== 'undefined' && gameState?.profile ? gameState.profile.avatar : '👦🏻');
  return GAME_CHARACTERS.agents.filter(agent => agent.avatar !== activeAvatar);
}

/**
 * Helper function to retrieve the active Main Agent character profile.
 * @param {string} [playerAvatar] - Optional avatar emoji (defaults to gameState.profile.avatar)
 * @returns {Object} Active Main Agent object
 */
function getMainPlayerAgent(playerAvatar) {
  const activeAvatar = playerAvatar || (typeof gameState !== 'undefined' && gameState?.profile ? gameState.profile.avatar : '👦🏻');
  return GAME_CHARACTERS.agents.find(agent => agent.avatar === activeAvatar) || GAME_CHARACTERS.agents[0];
}

const BADGES_DATA = [
  {
    id: 'badge_1',
    name: 'Magang Hebat',
    icon: '📋',
    desc: 'Selamat! Kamu resmi bergabung dan memulai petualangan di hari pertama kantor cilik.',
    chapterReq: 0 // unlocked by default
  },
  {
    id: 'badge_2',
    name: 'Detektif Berkas',
    icon: '🕵️',
    desc: 'Menemukan berkas rahasia bos yang terselip di ruang arsip kantor.',
    chapterReq: 1 // unlocked after chapter 1
  },
  {
    id: 'badge_3',
    name: 'Master Fotokopi',
    icon: '🖨️',
    desc: 'Berhasil mencetak dan menyusun 10 laporan warna-warni tepat waktu!',
    chapterReq: 2 // unlocked after chapter 2
  },
  {
    id: 'badge_4',
    name: 'Barista Cilik',
    icon: '☕',
    desc: 'Menyiapkan minuman hangat dan camilan segar untuk tim sebelum rapat.',
    chapterReq: 2
  },
  {
    id: 'badge_5',
    name: 'Bintang Presentasi',
    icon: '📊',
    desc: 'Menjelaskan grafik gambar penuh warna di hadapan teman-teman kantor.',
    chapterReq: 3 // unlocked after chapter 3
  },
  {
    id: 'badge_6',
    name: 'Si Paling Tepat Waktu',
    icon: '⏰',
    desc: 'Menyelesaikan semua tugas sebelum bel istirahat makan siang berbunyi.',
    chapterReq: 3
  },
  {
    id: 'badge_7',
    name: 'Rekan Teladan',
    icon: '🤝',
    desc: 'Selalu ramah dan suka membantu teman satu divisi menyelesaikan pekerjaan.',
    chapterReq: 4 // unlocked after chapter 4
  },
  {
    id: 'badge_8',
    name: 'Direktur Cilik',
    icon: '👔',
    desc: 'Pencapaian tertinggi! Berhasil menuntaskan seluruh misi kantor impian.',
    chapterReq: 4
  }
];

// --- Pilar 4: Office Layout Customizer - Decorations Database ---
const DECORATIONS_DATA = [
  // 1. Meja Kerja (Desk)
  {
    id: 'item_desk_1',
    category: 'desk',
    categoryName: 'Meja Kerja',
    name: 'Meja Kerja Mahoni',
    icon: '🪑',
    roomVisual: '🪑 Meja Mahoni',
    desc: 'Meja kayu kokoh dengan laci arsip berkas rapi.',
    price: 150
  },
  {
    id: 'item_desk_2',
    category: 'desk',
    categoryName: 'Meja Kerja',
    name: 'Meja Direktur Modern',
    icon: '🖥️',
    roomVisual: '🖥️ Meja Modern',
    desc: 'Meja eksekutif elegan dengan komputer mini cerdas.',
    price: 220
  },
  // 2. Rak Arsip (Cabinet)
  {
    id: 'item_cabinet_1',
    category: 'cabinet',
    categoryName: 'Rak Arsip',
    name: 'Rak Arsip Baja',
    icon: '📁',
    roomVisual: '🗄️ Rak Baja',
    desc: 'Lemari baja kuat untuk menyimpan dokumen rahasia.',
    price: 120
  },
  {
    id: 'item_cabinet_2',
    category: 'cabinet',
    categoryName: 'Rak Arsip',
    name: 'Lemari Dokumen Emas',
    icon: '🗄️',
    roomVisual: '🗄️ Lemari Emas',
    desc: 'Lemari arsip mewah berpelindung sandi keamanan.',
    price: 180
  },
  // 3. Tanaman Hias (Houseplant)
  {
    id: 'item_plant_1',
    category: 'plant',
    categoryName: 'Tanaman Hias',
    name: 'Tanaman Monstera',
    icon: '🪴',
    roomVisual: '🪴 Monstera',
    desc: 'Tanaman hijau penyegar suasana ruang kantor.',
    price: 80
  },
  {
    id: 'item_plant_2',
    category: 'plant',
    categoryName: 'Tanaman Hias',
    name: 'Kaktus Mini Ceria',
    icon: '🌵',
    roomVisual: '🌵 Kaktus Mini',
    desc: 'Kaktus lucu dalam pot warna-warni ceria.',
    price: 60
  },
  // 4. Jam Dinding (Wall Clock)
  {
    id: 'item_clock_1',
    category: 'clock',
    categoryName: 'Jam Dinding',
    name: 'Jam Dinding Ceria',
    icon: '⏰',
    roomVisual: '⏰ Jam Ceria',
    desc: 'Jam bundar ceria pengingat waktu tugas kantor.',
    price: 50
  },
  {
    id: 'item_clock_2',
    category: 'clock',
    categoryName: 'Jam Dinding',
    name: 'Jam Digital Neon',
    icon: '⏱️',
    roomVisual: '⏱️ Jam Neon',
    desc: 'Jam modern bercahaya futuristik keren.',
    price: 90
  }
];

const CHAPTERS_DATA = [
  {
    id: 1,
    title: 'Hari Pertama Masuk Kantor',
    icon: '🏢',
    desc: 'Kenali meja kerjamu, rapikan alat tulis, dan cetak ID Card agen pertamamu!',
    badgeReward: 'badge_2',
    tasks: [
      { text: 'Rapikan meja & tata pensil warna ✨', button: 'Rapikan' },
      { text: 'Cap dokumen surat sambutan 🔏', button: 'Stempel' },
      { text: 'Ambil kartu tanda pengenal resmi 🪪', button: 'Ambil' }
    ]
  },
  {
    id: 2,
    title: 'Misteri Berkas Rahasia',
    icon: '📁',
    desc: 'Cari dokumen berkas penting pimpinan yang terselip di lemari arsip rahasia.',
    badgeReward: 'badge_3',
    tasks: [
      { text: 'Nyalakan lampu senter pencari 🔦', button: 'Nyalakan' },
      { text: 'Buka map berkas bersandi rahasia 🗝️', button: 'Buka Map' },
      { text: 'Serahkan berkas aman ke meja bos 💼', button: 'Serahkan' }
    ]
  },
  {
    id: 3,
    title: 'Operasi Fotokopi Ajaib',
    icon: '🖨️',
    desc: 'Bantu tim kantor memperbanyak laporan warna-warni sebelum presentasi dimulai.',
    badgeReward: 'badge_5',
    tasks: [
      { text: 'Isi kertas warna-warni ke mesin 📄', button: 'Isi Kertas' },
      { text: 'Tekan tombol cetak ajaib 🟢', button: 'Cetak' },
      { text: 'Jilid berkas rapi dengan klip emas 📎', button: 'Jilid' }
    ]
  },
  {
    id: 4,
    title: 'Rapat Direksi Cilik',
    icon: '👔',
    desc: 'Pimpin rapat besar bersama seluruh teman agen untuk menentukan masa depan kantor!',
    badgeReward: 'badge_8',
    tasks: [
      { text: 'Ketuk palu tanda rapat dimulai 🔨', button: 'Ketuk Palu' },
      { text: 'Tampilkan slide presentasi impian 📊', button: 'Tampilkan' },
      { text: 'Rayakan keberhasilan tim kantor 🎉', button: 'Rayakan' }
    ]
  }
];

// --- Episode Database for Chapter 1 ---
const CHAPTER_1_EPISODES = [
  {
    id: 1,
    chapterId: 1,
    title: 'Bencana Kertas Terbang!',
    icon: '📄',
    desc: 'Dr. Chaos menyalakan kipas angin raksasa di ruang administrasi! Dokumen penting dan kertas sampah berterbangan campur aduk.',
    dialogs: [
      {
        speaker: 'mentor',
        text: 'Gawat, Agen {PLAYER_NAME}! Dr. Chaos baru saja menyalakan kipas angin raksasa di ruang administrasi kantor!'
      },
      {
        speaker: 'villain',
        text: 'Mwahahaha! Semua berkas rahasia dan sampah kantor sekarang berterbangan campur aduk! Coba kalau kalian bisa merapikannya, dasar agen cilik! 🌪️'
      },
      {
        speaker: 'player',
        text: 'Tenang, Komandan! Saya akan segera memilah dokumen penting dan membuang kertas sampah ke tempat yang tepat! 💪'
      },
      {
        speaker: 'mentor',
        text: 'Bagus sekali! Masukkan dokumen resmi ke Lemari Arsip 📁 dan buang kertas kotor ke Tempat Sampah 🗑️. Siap bertugas?'
      }
    ],
    sortingItems: [
      {
        id: 'item_1_1',
        type: 'archive',
        title: 'Laporan Keuangan Kantor',
        typeBadge: 'Dokumen Penting Resmi 📊',
        icon: '📊'
      },
      {
        id: 'item_1_2',
        type: 'archive',
        title: 'Surat Rahasia Komandan',
        typeBadge: 'Surat Bersegel Emas 📜',
        icon: '📜'
      },
      {
        id: 'item_1_3',
        type: 'trash',
        title: 'Bungkus Permen Bekas',
        typeBadge: 'Sampah Makanan Ringan 🍬',
        icon: '🍬'
      },
      {
        id: 'item_1_4',
        type: 'trash',
        title: 'Kertas Coretan Kusut',
        typeBadge: 'Kertas Bekas Tak Terpakai 🗞️',
        icon: '🗞️'
      }
    ]
  },
  {
    id: 2,
    chapterId: 1,
    title: 'Misteri Stempel Merah',
    icon: '🔏',
    desc: 'Semua stempel persetujuan pimpinan kantor disembunyikan Dr. Chaos di laci bersandi rahasia!',
    dialogs: [
      {
        speaker: 'mentor',
        text: 'Agen {PLAYER_NAME}, Dr. Chaos telah mencampuradukkan stempel resmi kantor dengan benda-benda jahilnya!'
      },
      {
        speaker: 'villain',
        text: 'Mwahaha! Laci persetujuan kantor sudah penuh jebakan! Dokumen kalian tidak akan bisa disahkan hari ini! 🔏'
      },
      {
        speaker: 'player',
        text: 'Jangan khawatir! Saya akan amankan stempel resmi pimpinan dan bersihkan perangkap usilnya! 🛡️'
      },
      {
        speaker: 'mentor',
        text: 'Hebat! Simpan Stempel & Tinta Resmi ke Lemari Arsip 📁 dan buang benda perangkap ke Tempat Sampah 🗑️!'
      }
    ],
    sortingItems: [
      {
        id: 'item_2_1',
        type: 'archive',
        title: 'Stempel Bintang Emas',
        typeBadge: 'Cap Persetujuan Resmi 🔏',
        icon: '🔏'
      },
      {
        id: 'item_2_2',
        type: 'archive',
        title: 'Bantalan Tinta Merah',
        typeBadge: 'Tinta Cap Pimpinan 🔴',
        icon: '🔴'
      },
      {
        id: 'item_2_3',
        type: 'trash',
        title: 'Kulit Pisang Licin',
        typeBadge: 'Jebakan Usil Dr. Chaos 🍌',
        icon: '🍌'
      },
      {
        id: 'item_2_4',
        type: 'trash',
        title: 'Klip Kertas Karatan',
        typeBadge: 'Klip Rusak Tak Layak 📎',
        icon: '📎'
      }
    ]
  },
  {
    id: 3,
    chapterId: 1,
    title: 'Operasi Kopi Tumpah',
    icon: '☕',
    desc: 'Bersihkan tumpahan kopi di meja kerja sebelum berkas penting basah kuyup terkena cairan!',
    dialogs: [
      {
        speaker: 'mentor',
        text: 'Awas Agen {PLAYER_NAME}! Dr. Chaos menyenggol teko kopi dan cairan mulai mengalir ke meja berkas penting!'
      },
      {
        speaker: 'villain',
        text: 'Biar semua catatan rapat luntur dan hitam terkena kopi! Selamat menikmati kekacauan! ☕'
      },
      {
        speaker: 'player',
        text: 'Segera bertindak! Saya selamatkan berkas yang masih kering dan buang sampah basah!'
      },
      {
        speaker: 'mentor',
        text: 'Cepat amankan berkas kering ke Lemari Arsip 📁 dan masukkan sampah tisu kotor ke Tempat Sampah 🗑️!'
      }
    ],
    sortingItems: [
      {
        id: 'item_3_1',
        type: 'archive',
        title: 'Berkas Kontrak Kering',
        typeBadge: 'Dokumen Terselamatkan 📄',
        icon: '📄'
      },
      {
        id: 'item_3_2',
        type: 'archive',
        title: 'Buku Agenda Kerja',
        typeBadge: 'Agenda Harian Penting 📓',
        icon: '📓'
      },
      {
        id: 'item_3_3',
        type: 'trash',
        title: 'Cangkir Kopi Pecah',
        typeBadge: 'Pecahan Gelas Kotor ☕',
        icon: '☕'
      },
      {
        id: 'item_3_4',
        type: 'trash',
        title: 'Tisu Basah Pekat',
        typeBadge: 'Tisu Kotor Bekas Kopi 🧻',
        icon: '🧻'
      }
    ]
  },
  {
    id: 4,
    chapterId: 1,
    title: 'Mesin Fotokopi Ajaib',
    icon: '🖨️',
    desc: 'Perbaiki tombol mesin cetak agar laporan warna-warni divisi tidak tercetak berantakan!',
    dialogs: [
      {
        speaker: 'mentor',
        text: 'Dr. Chaos mengotori mesin fotokopi dengan kertas macet dan bubuk tinta tumpah!'
      },
      {
        speaker: 'villain',
        text: 'Brosur presentasi kalian tidak akan pernah selesai! Semuanya jadi abu-abu buram! 🖨️'
      },
      {
        speaker: 'player',
        text: 'Saya akan sortir hasil cetakan yang sempurna dan bersihkan kertas rusak dari mesin!'
      },
      {
        speaker: 'mentor',
        text: 'Tepat! Simpan Laporan Berwarna ke Lemari Arsip 📁 dan singkirkan kertas macet ke Tempat Sampah 🗑️!'
      }
    ],
    sortingItems: [
      {
        id: 'item_4_1',
        type: 'archive',
        title: 'Laporan Grafik Warna',
        typeBadge: 'Hasil Cetak Sempurna 📊',
        icon: '📊'
      },
      {
        id: 'item_4_2',
        type: 'archive',
        title: 'Brosur Kantor Cilik',
        typeBadge: 'Materi Presentasi Tim 📑',
        icon: '📑'
      },
      {
        id: 'item_4_3',
        type: 'trash',
        title: 'Kertas Macet Kusut',
        typeBadge: 'Kertas Cacat Fotokopi 🗞️',
        icon: '🗞️'
      },
      {
        id: 'item_4_4',
        type: 'trash',
        title: 'Botol Tinta Bocor',
        typeBadge: 'Limbah Tinta Habis 🖨️',
        icon: '🖨️'
      }
    ]
  },
  {
    id: 5,
    chapterId: 1,
    title: 'Rapat Divisi Pimpinan',
    icon: '👔',
    desc: 'Kumpulkan seluruh lencana dan pimpin inspeksi kantor besar bersama Komandan Kiki!',
    dialogs: [
      {
        speaker: 'mentor',
        text: 'Inilah misi pamungkas Chapter 1, Agen {PLAYER_NAME}! Rapat dewan kantor akan segera dimulai!'
      },
      {
        speaker: 'villain',
        text: 'Aku belum menyerah! Masih ada surat kaleng ejekan dan balon kempis yang kusebarkan! 🎈'
      },
      {
        speaker: 'player',
        text: 'Kantor ini milik kita bersama! Semua piagam dan hasil keputusan rapat akan aman tersimpan! 🏆'
      },
      {
        speaker: 'mentor',
        text: 'Luar biasa! Masukkan Piagam & Berkas Keputusan ke Lemari Arsip 📁, buang sampah usil ke Tempat Sampah 🗑️!'
      }
    ],
    sortingItems: [
      {
        id: 'item_5_1',
        type: 'archive',
        title: 'Piagam Penghargaan Tim',
        typeBadge: 'Piagam Kehormatan Resmi 🏆',
        icon: '🏆'
      },
      {
        id: 'item_5_2',
        type: 'archive',
        title: 'Notulen Keputusan Rapat',
        typeBadge: 'Dokumen Bersegel Kantor 📜',
        icon: '📜'
      },
      {
        id: 'item_5_3',
        type: 'trash',
        title: 'Surat Kaleng Dr. Chaos',
        typeBadge: 'Surat Jahil Tak Terpakai ✉️',
        icon: '✉️'
      },
      {
        id: 'item_5_4',
        type: 'trash',
        title: 'Pita Balon Kempis',
        typeBadge: 'Sampah Dekorasi Bekas 🎈',
        icon: '🎈'
      }
    ]
  }
];

// --- Default Application State ---
const DEFAULT_STATE = {
  profile: {
    name: 'Agen Cilik',
    avatar: '👦🏻',
    rank: 'Magang Baru ⭐',
    code: 'OK-2026-01'
  },
  coins: 500, // 500 Starter Coins granted only once upon initial launch
  inventory: {
    owned: [],
    equipped: {
      desk: null,
      cabinet: null,
      plant: null,
      clock: null
    }
  },
  progress: {
    unlockedChapters: [1],
    completedChapters: [],
    chapterStars: { 1: 0, 2: 0, 3: 0, 4: 0 },
    chapterEpisodes: {
      1: {
        unlocked: [1],
        completed: [],
        stars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      }
    }
  },
  badges: ['badge_1'],
  settings: {
    bgm: true,
    sfx: true,
    hints: true,
    animations: true
  }
};

// Application State Object
let gameState = JSON.parse(JSON.stringify(DEFAULT_STATE));
let activeMissionChapterId = null;

// ==========================================================================
// CHAPTER PROGRESSION & UNLOCK CONTROLLER
// ==========================================================================

/**
 * Check if a specific Chapter is marked completed.
 * Condition:
 * - Chapter 1 is completed if all 5 episodes are completed OR completedChapters contains 1 OR localStorage has chapter1_completed = true.
 * - Chapter N (2-4) is completed if completedChapters contains N OR localStorage has chapterN_completed = true.
 * @param {number} chapterId
 * @returns {boolean}
 */
function isChapterCompleted(chapterId) {
  const localFlag = localStorage.getItem(`chapter${chapterId}_completed`) === 'true';
  const stateFlag = Boolean(gameState.progress && Array.isArray(gameState.progress.completedChapters) && gameState.progress.completedChapters.includes(chapterId));

  if (chapterId === 1) {
    const ch1 = gameState.progress && gameState.progress.chapterEpisodes && gameState.progress.chapterEpisodes[1];
    const allEpDone = Boolean(ch1 && Array.isArray(ch1.completed) && CHAPTER_1_EPISODES.every(ep => ch1.completed.includes(ep.id)));
    return localFlag || stateFlag || allEpDone;
  }
  return localFlag || stateFlag;
}

/**
 * Check if a specific Chapter is unlocked.
 * Rule:
 * - Chapter 1 is always unlocked by default.
 * - Chapter 2 is unlocked ONLY IF Chapter 1 is completed.
 * - Chapter 3 is unlocked ONLY IF Chapter 2 is completed.
 * - Chapter 4 is unlocked ONLY IF Chapter 3 is completed.
 * @param {number} chapterId
 * @returns {boolean}
 */
function isChapterUnlocked(chapterId) {
  if (chapterId === 1) return true;
  return isChapterCompleted(chapterId - 1);
}

/**
 * Synchronize all unlocked & completed chapters strictly based on sequential rules.
 */
function syncProgression() {
  if (!gameState.progress) {
    gameState.progress = JSON.parse(JSON.stringify(DEFAULT_STATE.progress));
  }

  // 1. Sync Chapter 1 Episodes
  if (!gameState.progress.chapterEpisodes) gameState.progress.chapterEpisodes = {};
  if (!gameState.progress.chapterEpisodes[1]) {
    gameState.progress.chapterEpisodes[1] = {
      unlocked: [1],
      completed: [],
      stars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
  }

  const ch1 = gameState.progress.chapterEpisodes[1];
  const allChapter1EpDone = Array.isArray(ch1.completed) && CHAPTER_1_EPISODES.every(ep => ch1.completed.includes(ep.id));

  // 2. Validate completed chapters sequentially
  const completed = [];
  for (let id = 1; id <= 4; id++) {
    if (isChapterCompleted(id)) {
      completed.push(id);
      localStorage.setItem(`chapter${id}_completed`, 'true');
    } else {
      localStorage.removeItem(`chapter${id}_completed`);
    }
  }
  gameState.progress.completedChapters = completed;

  // 3. Build strictly unlocked chapters array
  const unlocked = [1];
  for (let id = 2; id <= 4; id++) {
    if (isChapterUnlocked(id)) {
      unlocked.push(id);
    }
  }
  gameState.progress.unlockedChapters = unlocked;
}

// ==========================================================================
// 1. LOCAL STORAGE CONTROLLER
// ==========================================================================
const Storage = {
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
      // Save individual chapter completion flags for persistent portability
      for (let id = 1; id <= 4; id++) {
        if (gameState.progress && gameState.progress.completedChapters && gameState.progress.completedChapters.includes(id)) {
          localStorage.setItem(`chapter${id}_completed`, 'true');
        } else {
          localStorage.removeItem(`chapter${id}_completed`);
        }
      }
    } catch (e) {
      console.warn('Gagal menyimpan ke localStorage:', e);
    }
  },

  load() {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      const starterGranted = localStorage.getItem('office_kids_starter_granted_v1') === 'true';

      if (savedData) {
        const parsed = JSON.parse(savedData);
        const savedEpisodes = parsed.progress && parsed.progress.chapterEpisodes
          ? parsed.progress.chapterEpisodes
          : DEFAULT_STATE.progress.chapterEpisodes;

        gameState = {
          profile: { ...DEFAULT_STATE.profile, ...(parsed.profile || {}) },
          coins: (typeof parsed.coins === 'number') ? parsed.coins : (starterGranted ? 0 : 500),
          inventory: {
            owned: Array.isArray(parsed.inventory?.owned) ? parsed.inventory.owned : [],
            equipped: {
              desk: parsed.inventory?.equipped?.desk || null,
              cabinet: parsed.inventory?.equipped?.cabinet || null,
              plant: parsed.inventory?.equipped?.plant || null,
              clock: parsed.inventory?.equipped?.clock || null
            }
          },
          progress: {
            ...DEFAULT_STATE.progress,
            ...(parsed.progress || {}),
            chapterEpisodes: {
              ...DEFAULT_STATE.progress.chapterEpisodes,
              ...(savedEpisodes || {})
            }
          },
          badges: Array.isArray(parsed.badges) ? parsed.badges : DEFAULT_STATE.badges,
          settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) }
        };
      } else {
        gameState = JSON.parse(JSON.stringify(DEFAULT_STATE));
      }

      // Mark starter coins as granted permanently in localStorage
      if (!starterGranted) {
        localStorage.setItem('office_kids_starter_granted_v1', 'true');
      }

      // Re-validate and strictly synchronize progression
      syncProgression();
    } catch (e) {
      console.warn('Gagal memuat data dari localStorage, menggunakan default:', e);
      gameState = JSON.parse(JSON.stringify(DEFAULT_STATE));
      syncProgression();
    }
  },

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    for (let id = 1; id <= 4; id++) {
      localStorage.removeItem(`chapter${id}_completed`);
    }
    // Grant fresh 500 starter coins upon intentional reset
    localStorage.setItem('office_kids_starter_granted_v1', 'true');
    gameState = JSON.parse(JSON.stringify(DEFAULT_STATE));
    syncProgression();
    this.save();
  }
};

// ==========================================================================
// 2. AUDIO & BGM CONTROLLER (Sound Effects & Crossfade Scene BGM Manager)
// ==========================================================================
const BGM_TRACKS = {
  office: 'assets/audio/23117649-spy-always-dies-along-93740.mp3',
  chaos: 'assets/audio/chosic-run-amok-238788.mp3',
  flashback: 'assets/audio/paulyudin-sad-sad-music-485935.mp3',
  menu: 'assets/audio/ikoliks_aj-quirky-sneaky-memes-background-music-392224.mp3'
};

const BGMManager = {
  currentTrackKey: null,
  audioEl: null,
  fadeInterval: null,
  targetVolume: 0.35, // Balanced volume for comfortable background music
  isFading: false,
  unlocked: false,

  init() {
    if (!this.audioEl) {
      this.audioEl = new Audio();
      this.audioEl.loop = true;
      this.audioEl.volume = 0;
      this.audioEl.preload = 'auto';
    }
  },

  unlockAudio() {
    if (this.unlocked) return;
    this.unlocked = true;
    if (gameState.settings.bgm) {
      if (this.currentTrackKey) {
        this.playTrack(this.currentTrackKey, true);
      } else {
        this.playMenuBGM();
      }
    }
  },

  /**
   * Smoothly transitions from current BGM to a new track using a gradual fade-out / fade-in effect.
   * @param {string} trackKey - 'office' | 'chaos' | 'flashback' | 'menu'
   * @param {boolean} force - Force restart even if track is already playing
   * @param {number} fadeDuration - Total fade duration in milliseconds (default: 800ms)
   */
  playTrack(trackKey, force = false, fadeDuration = 800) {
    this.init();

    const src = BGM_TRACKS[trackKey] || trackKey;
    if (!src) return;

    // Avoid restarting if already playing the exact same track
    if (!force && this.currentTrackKey === trackKey && this.audioEl && !this.audioEl.paused && this.audioEl.volume > 0.05) {
      return;
    }

    this.currentTrackKey = trackKey;

    if (!gameState.settings.bgm) {
      if (this.audioEl) {
        this.audioEl.pause();
        this.audioEl.volume = 0;
      }
      return;
    }

    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    const stepTime = 30;
    const fadeSteps = Math.max(1, Math.floor((fadeDuration / 2) / stepTime));

    // Phase 1: Fade out current track if playing
    if (this.audioEl && !this.audioEl.paused && this.audioEl.volume > 0.02) {
      this.isFading = true;
      let currentVol = this.audioEl.volume;
      const volStepDown = currentVol / fadeSteps;

      this.fadeInterval = setInterval(() => {
        currentVol = Math.max(0, currentVol - volStepDown);
        if (this.audioEl) this.audioEl.volume = currentVol;

        if (currentVol <= 0.01) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
          this._startNewTrack(src, fadeSteps, stepTime);
        }
      }, stepTime);
    } else {
      this._startNewTrack(src, fadeSteps, stepTime);
    }
  },

  _startNewTrack(src, fadeSteps, stepTime) {
    if (!gameState.settings.bgm) return;

    this.audioEl.pause();
    this.audioEl.src = src;
    this.audioEl.currentTime = 0;
    this.audioEl.volume = 0;

    const playPromise = this.audioEl.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        let currentVol = 0;
        const volStepUp = this.targetVolume / fadeSteps;

        this.fadeInterval = setInterval(() => {
          currentVol = Math.min(this.targetVolume, currentVol + volStepUp);
          if (this.audioEl) this.audioEl.volume = currentVol;

          if (currentVol >= this.targetVolume - 0.01) {
            if (this.audioEl) this.audioEl.volume = this.targetVolume;
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
            this.isFading = false;
          }
        }, stepTime);
      }).catch(err => {
        // Handled silently for browser autoplay policy until user gesture
        console.log('BGM menunggu interaksi pengguna untuk memulai audio:', err.message);
      });
    }
  },

  /**
   * Fade out and pause current BGM smoothly
   */
  stopBGM(fadeDuration = 600) {
    if (!this.audioEl || this.audioEl.paused) {
      this.currentTrackKey = null;
      return;
    }

    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    const stepTime = 30;
    const fadeSteps = Math.max(1, Math.floor(fadeDuration / stepTime));
    let currentVol = this.audioEl.volume;
    const volStepDown = currentVol / fadeSteps;

    this.fadeInterval = setInterval(() => {
      currentVol = Math.max(0, currentVol - volStepDown);
      if (this.audioEl) this.audioEl.volume = currentVol;

      if (currentVol <= 0.01) {
        clearInterval(this.fadeInterval);
        this.fadeInterval = null;
        if (this.audioEl) {
          this.audioEl.pause();
          this.audioEl.volume = 0;
        }
        this.currentTrackKey = null;
      }
    }, stepTime);
  },

  updateSetting(enabled) {
    if (enabled) {
      if (this.currentTrackKey) {
        this.playTrack(this.currentTrackKey, true);
      } else {
        this.playMenuBGM();
      }
    } else {
      this.stopBGM(400);
    }
  },

  playOfficeNormalBGM() {
    this.playTrack('office');
  },

  playChaosTheme() {
    this.playTrack('chaos');
  },

  playFlashbackBGM() {
    this.playTrack('flashback');
  },

  playMenuBGM() {
    this.playTrack('menu');
  }
};

// ==========================================================================
// SCENE MANAGER (Pengatur Alur Cerita & Transisi Musik BGM)
// ==========================================================================
const SceneManager = {
  currentScene: 'menu',

  changeScene(sceneName, customBGM = null) {
    this.currentScene = sceneName;
    if (customBGM) {
      BGMManager.playTrack(customBGM);
      return;
    }

    switch (sceneName) {
      case 'menu':
        BGMManager.playMenuBGM();
        break;
      case 'office_normal':
        BGMManager.playOfficeNormalBGM();
        break;
      case 'chaos':
        BGMManager.playChaosTheme();
        break;
      case 'flashback':
        BGMManager.playFlashbackBGM();
        break;
      default:
        BGMManager.playMenuBGM();
        break;
    }
  },

  onSlideChange(slideId) {
    this.changeScene('menu');
  },

  onStartEpisodeStory(chapterId, episodeId) {
    const epData = CHAPTER_1_EPISODES.find(e => e.id === episodeId);
    if (epData && epData.isFlashback) {
      this.changeScene('flashback');
    } else {
      this.changeScene('office_normal');
    }
  },

  onStartEpisodeGameplay(chapterId, episodeId) {
    this.changeScene('chaos');
  },

  onEpisodeCompleted() {
    this.changeScene('office_normal');
  }
};

// ==========================================================================
// GLOBAL HELPER FUNCTIONS (BGM Scene Controller)
// ==========================================================================
function playOfficeNormalBGM() {
  SceneManager.changeScene('office_normal');
}

function playChaosTheme() {
  SceneManager.changeScene('chaos');
}

function playFlashbackBGM() {
  SceneManager.changeScene('flashback');
}

function playMenuBGM() {
  SceneManager.changeScene('menu');
}

// Attach globally to window
window.playOfficeNormalBGM = playOfficeNormalBGM;
window.playChaosTheme = playChaosTheme;
window.playFlashbackBGM = playFlashbackBGM;
window.playMenuBGM = playMenuBGM;
window.SceneManager = SceneManager;
window.BGMManager = BGMManager;

const SoundSystem = {
  audioCtx: null,

  init() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
  },

  play(type) {
    if (!gameState.settings.sfx) return;
    this.init();
    if (!this.audioCtx) return;

    // Resume context if suspended
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const now = this.audioCtx.currentTime;

    try {
      if (type === 'click') {
        // Cheerful bubbly click pop
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'back') {
        // Soft back tone
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.1);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'success' || type === 'badge') {
        // Happy arpeggio fanfare (C5, E5, G5, C6)
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, index) => {
          const noteTime = now + (index * 0.08);
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, noteTime);
          gain.gain.setValueAtTime(0.2, noteTime);
          gain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.25);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(noteTime);
          osc.stop(noteTime + 0.25);
        });
      } else if (type === 'step') {
        // Mini mission step ding
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(650, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'coin' || type === 'buy') {
        // Shimmering coin transaction audio (Dual bell frequencies 987Hz & 1318Hz with metallic sparkle)
        [987.77, 1318.51].forEach((freq, i) => {
          const noteTime = now + (i * 0.07);
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, noteTime);
          osc.frequency.exponentialRampToValueAtTime(freq * 1.4, noteTime + 0.18);
          gain.gain.setValueAtTime(0.22, noteTime);
          gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.22);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(noteTime);
          osc.stop(noteTime + 0.22);
        });
      } else if (type === 'place' || type === 'equip') {
        // Satisfying furniture placement snap / thud (punchy 320Hz down to 140Hz + click)
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.14);
      } else if (type === 'unequip') {
        // Gentle breezy unequip whoosh
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.exponentialRampToValueAtTime(260, now + 0.1);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'warning') {
        // Soft kid-friendly warning tone
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.linearRampToValueAtTime(220, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
      }
    } catch (err) {
      console.warn('Audio playback error:', err);
    }
  }
};

// ==========================================================================
// 3. NAVIGATION & SLIDE CONTROLLER
// ==========================================================================
const Navigation = {
  currentSlide: 'slide-1',

  showSlide(targetSlideId) {
    const targetElement = document.getElementById(targetSlideId);
    if (!targetElement) return;

    // Remove active from all slides
    document.querySelectorAll('.game-slide').forEach(slide => {
      slide.classList.remove('active');
    });

    // Activate target slide
    targetElement.classList.add('active');
    this.currentSlide = targetSlideId;

    // Trigger Menu Scene BGM when navigating main menu & overview slides
    SceneManager.onSlideChange(targetSlideId);

    // Refresh contents if needed
    if (targetSlideId === 'slide-3') {
      BadgeGallery.render();
    } else if (targetSlideId === 'slide-4') {
      ProfileManager.syncFormWithState();
    } else if (targetSlideId === 'slide-5') {
      ChapterManager.render();
    } else if (targetSlideId === 'slide-6') {
      OfficeCustomizer.render();
    }

    // Scroll to top of slide
    const viewport = document.querySelector('.slides-viewport');
    if (viewport) viewport.scrollTop = 0;
  }
};

// ==========================================================================
// 4. TOP BAR & GLOBAL UI
// ==========================================================================
const TopBar = {
  update() {
    const avatarEl = document.getElementById('top-avatar-display');
    const nameEl = document.getElementById('top-name-display');
    const rankEl = document.getElementById('top-rank-display');
    const badgeCountEl = document.getElementById('top-badge-count');
    const coinCountEl = document.getElementById('top-coin-count');
    const customizerCoinEl = document.getElementById('customizer-coin-display');
    const soundIconEl = document.getElementById('top-sound-icon');

    if (avatarEl) avatarEl.textContent = gameState.profile.avatar;
    if (nameEl) nameEl.textContent = gameState.profile.name;
    if (rankEl) rankEl.textContent = gameState.profile.rank;
    if (badgeCountEl) badgeCountEl.textContent = `${gameState.badges.length}/${BADGES_DATA.length}`;
    if (coinCountEl) coinCountEl.textContent = `${gameState.coins}`;
    if (customizerCoinEl) customizerCoinEl.textContent = `${gameState.coins}`;
    if (soundIconEl) {
      soundIconEl.textContent = (gameState.settings.sfx || gameState.settings.bgm) ? '🔊' : '🔇';
    }
  }
};

// ==========================================================================
// 5. TOAST NOTIFICATIONS
// ==========================================================================
function showToast(message, type = 'normal') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  let icon = '✨';
  let typeClass = '';
  if (type === 'success') {
    typeClass = 'success';
    icon = '🎉';
  } else if (type === 'warning') {
    typeClass = 'warning';
    icon = '🔒';
  }
  toast.className = `toast ${typeClass}`.trim();
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

// ==========================================================================
// 6. RANK CALCULATOR
// ==========================================================================
function calculateRank(completedCount) {
  if (completedCount >= 4) return 'Direktur Cilik 🏆';
  if (completedCount === 3) return 'Manajer Cilik 👑';
  if (completedCount === 2) return 'Supervisor Cilik ⭐⭐⭐';
  if (completedCount === 1) return 'Staf Teladan ⭐⭐';
  return 'Magang Baru ⭐';
}

// ==========================================================================
// 7. BADGE GALLERY MODULE (SLIDE 3)
// ==========================================================================
const BadgeGallery = {
  render() {
    const grid = document.getElementById('badges-grid');
    const textEl = document.getElementById('gallery-progress-text');
    const fillEl = document.getElementById('gallery-progress-fill');
    if (!grid) return;

    grid.innerHTML = '';
    const totalBadges = BADGES_DATA.length;
    const unlockedCount = gameState.badges.length;
    const percent = Math.round((unlockedCount / totalBadges) * 100);

    if (textEl) textEl.textContent = `${unlockedCount} dari ${totalBadges} Terkumpul (${percent}%)`;
    if (fillEl) fillEl.style.width = `${percent}%`;

    BADGES_DATA.forEach(badge => {
      const isUnlocked = gameState.badges.includes(badge.id);
      const card = document.createElement('div');
      card.className = `badge-card ${isUnlocked ? 'unlocked' : 'locked'}`;
      card.innerHTML = `
        <div class="badge-card-icon">${isUnlocked ? badge.icon : '🔒'}</div>
        <div class="badge-card-name">${badge.name}</div>
        <div class="badge-card-status">${isUnlocked ? 'TERBUKA ✨' : 'TERKUNCI 🔒'}</div>
      `;

      card.addEventListener('click', () => {
        SoundSystem.play('click');
        this.openDetailModal(badge, isUnlocked);
      });

      grid.appendChild(card);
    });
  },

  openDetailModal(badge, isUnlocked) {
    const modal = document.getElementById('badge-modal');
    const iconEl = document.getElementById('badge-modal-icon');
    const titleEl = document.getElementById('badge-modal-title');
    const statusEl = document.getElementById('badge-modal-status');
    const descEl = document.getElementById('badge-modal-desc');

    if (!modal) return;

    iconEl.textContent = isUnlocked ? badge.icon : '🔒';
    titleEl.textContent = badge.name;
    statusEl.textContent = isUnlocked ? 'TERBUKA ✨' : 'MASIH TERKUNCI 🔒';
    statusEl.style.background = isUnlocked ? '#D1FAE5' : '#E2E8F0';
    statusEl.style.color = isUnlocked ? '#065F46' : '#64748B';
    descEl.textContent = badge.desc;

    modal.classList.add('active');
  },

  unlockBadge(badgeId) {
    if (!gameState.badges.includes(badgeId)) {
      gameState.badges.push(badgeId);
      Storage.save();
      TopBar.update();
      const badgeObj = BADGES_DATA.find(b => b.id === badgeId);
      const badgeName = badgeObj ? badgeObj.name : 'Lencana Baru';
      SoundSystem.play('badge');
      showToast(`🏆 Lencana Baru Terbuka: "${badgeName}"!`, 'success');
    }
  }
};

// ==========================================================================
// 8. PROFILE MANAGER MODULE (SLIDE 4)
// ==========================================================================
const ProfileManager = {
  init() {
    const nameInput = document.getElementById('input-agent-name');
    const avatarOptions = document.querySelectorAll('.avatar-option');
    const saveBtn = document.getElementById('btn-save-profile');

    // Live preview typing
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        const val = e.target.value.trim() || 'Agen Cilik';
        const display = document.getElementById('id-card-name-display');
        if (display) display.textContent = val;
      });
    }

    // Avatar option click
    avatarOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        SoundSystem.play('click');
        avatarOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');

        const selectedAvatar = opt.getAttribute('data-avatar');
        const cardAvatarDisplay = document.getElementById('id-card-avatar-display');
        if (cardAvatarDisplay) cardAvatarDisplay.textContent = selectedAvatar;
      });
    });

    // Save profile action
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        SoundSystem.play('success');
        this.saveFromForm();
      });
    }
  },

  syncFormWithState() {
    const nameInput = document.getElementById('input-agent-name');
    const cardNameDisplay = document.getElementById('id-card-name-display');
    const cardAvatarDisplay = document.getElementById('id-card-avatar-display');
    const cardRankDisplay = document.getElementById('id-card-rank-display');
    const avatarOptions = document.querySelectorAll('.avatar-option');

    // Update rank based on completed chapters
    const updatedRank = calculateRank(gameState.progress.completedChapters.length);
    gameState.profile.rank = updatedRank;

    if (nameInput) nameInput.value = gameState.profile.name;
    if (cardNameDisplay) cardNameDisplay.textContent = gameState.profile.name;
    if (cardAvatarDisplay) cardAvatarDisplay.textContent = gameState.profile.avatar;
    if (cardRankDisplay) cardRankDisplay.textContent = updatedRank;

    // Highlight active avatar
    avatarOptions.forEach(opt => {
      const optAvatar = opt.getAttribute('data-avatar');
      if (optAvatar === gameState.profile.avatar) {
        opt.classList.add('active');
      } else {
        opt.classList.remove('active');
      }
    });
  },

  saveFromForm() {
    const nameInput = document.getElementById('input-agent-name');
    const activeAvatarOption = document.querySelector('.avatar-option.active');

    const newName = nameInput ? (nameInput.value.trim() || 'Agen Cilik') : gameState.profile.name;
    const newAvatar = activeAvatarOption ? activeAvatarOption.getAttribute('data-avatar') : gameState.profile.avatar;

    gameState.profile.name = newName;
    gameState.profile.avatar = newAvatar;
    gameState.profile.rank = calculateRank(gameState.progress.completedChapters.length);

    Storage.save();
    TopBar.update();
    showToast('Profil Agen Berhasil Disimpan! 🎉', 'success');
  }
};

// ==========================================================================
// 9. CHAPTER SELECT & MISSION SIMULATION (SLIDE 5)
// ==========================================================================
const ChapterManager = {
  render() {
    const container = document.getElementById('chapters-list');
    if (!container) return;

    // Ensure progression is in sync before rendering
    syncProgression();
    container.innerHTML = '';

    CHAPTERS_DATA.forEach(chapter => {
      const isUnlocked = isChapterUnlocked(chapter.id);
      const isCompleted = isChapterCompleted(chapter.id);

      const card = document.createElement('div');
      card.className = `chapter-card ${isCompleted ? 'completed' : (isUnlocked ? 'unlocked' : 'locked')}`;
      card.setAttribute('data-chapter-id', chapter.id);

      // Star rating display
      const starsCount = isCompleted ? 3 : (isUnlocked ? 1 : 0);
      const starsHtml = isCompleted
        ? '⭐⭐⭐ Selesai'
        : (isUnlocked ? '⭐ Belum Selesai' : '🔒 Terkunci');

      card.innerHTML = `
        <div class="chapter-num-badge">
          ${isCompleted ? '✅' : (isUnlocked ? chapter.icon : '🔒')}
        </div>
        <div class="chapter-info">
          <div class="chapter-title-row">
            <h4 class="chapter-title">Chapter ${chapter.id}: ${chapter.title}</h4>
          </div>
          <p class="chapter-desc">${chapter.desc}</p>
          <div class="chapter-stars" title="Peringkat Bintang">${starsHtml}</div>
        </div>
        <button class="chapter-btn-action ${isCompleted ? 'chapter-btn-completed' : (isUnlocked ? 'chapter-btn-play' : 'chapter-btn-locked')}"
          data-action-chapter="${chapter.id}">
          ${isCompleted ? 'Main Ulang 🔄' : (isUnlocked ? 'Mulai Misi 🚀' : '🔒 Terkunci')}
        </button>
      `;

      // Card & Button click handlers
      card.addEventListener('click', () => {
        if (isUnlocked) {
          SoundSystem.play('click');
          if (chapter.id === 1) {
            EpisodeSelectManager.openModal(1);
          } else {
            this.startMission(chapter.id);
          }
        } else {
          // Locked Chapter feedback
          SoundSystem.play('back');
          showToast('Selesaikan Chapter sebelumnya terlebih dahulu!', 'warning');
        }
      });

      container.appendChild(card);
    });
  },

  startMission(chapterId) {
    if (!isChapterUnlocked(chapterId)) {
      SoundSystem.play('back');
      showToast('Selesaikan Chapter sebelumnya terlebih dahulu!', 'warning');
      return;
    }

    if (chapterId === 1) {
      EpisodeSelectManager.openModal(1);
      return;
    }

    const chapter = CHAPTERS_DATA.find(c => c.id === chapterId);
    if (!chapter) return;

    activeMissionChapterId = chapterId;
    SceneManager.changeScene('office_normal');

    const modal = document.getElementById('mission-modal');
    const iconEl = document.getElementById('mission-modal-icon');
    const titleEl = document.getElementById('mission-modal-title');
    const descEl = document.getElementById('mission-modal-desc');
    const completeBtn = document.getElementById('btn-complete-mission');

    if (!modal) return;

    iconEl.textContent = chapter.icon;
    titleEl.textContent = `Chapter ${chapter.id}: ${chapter.title}`;
    descEl.textContent = chapter.desc;
    if (completeBtn) completeBtn.style.display = 'none';

    // Reset steps state
    for (let i = 1; i <= 3; i++) {
      const stepEl = document.getElementById(`task-step-${i}`);
      const btn = document.getElementById(`btn-step-${i}`);
      const textEl = document.getElementById(`step-${i}-text`);
      const taskData = chapter.tasks[i - 1];

      if (stepEl && btn && taskData) {
        stepEl.classList.remove('completed', 'disabled');
        textEl.textContent = taskData.text;
        btn.textContent = `${taskData.button} ✨`;
        btn.disabled = (i !== 1); // Only step 1 enabled at start

        if (i !== 1) stepEl.classList.add('disabled');
      }
    }

    modal.classList.add('active');
  },

  finishMission() {
    if (!activeMissionChapterId) return;

    const chapterId = activeMissionChapterId;
    const chapter = CHAPTERS_DATA.find(c => c.id === chapterId);

    // Mark completed
    if (!gameState.progress.completedChapters.includes(chapterId)) {
      gameState.progress.completedChapters.push(chapterId);
    }
    localStorage.setItem(`chapter${chapterId}_completed`, 'true');
    gameState.progress.chapterStars[chapterId] = 3;

    // Sync sequential unlocks for Chapter 3, 4, etc.
    syncProgression();

    // Unlock reward badge if configured
    if (chapter && chapter.badgeReward) {
      BadgeGallery.unlockBadge(chapter.badgeReward);
    }

    // Award bonus coins for completing chapter mission (+100 Coins)
    const earnedCoins = 100;
    gameState.coins = (gameState.coins || 0) + earnedCoins;

    // Update rank
    gameState.profile.rank = calculateRank(gameState.progress.completedChapters.length);

    // Save
    Storage.save();
    TopBar.update();
    this.render();

    // Close modal & return to menu scene BGM
    const modal = document.getElementById('mission-modal');
    if (modal) modal.classList.remove('active');
    SceneManager.changeScene('menu');

    SoundSystem.play('success');
    const nextChapterId = chapterId + 1;
    if (nextChapterId <= 4) {
      showToast(`🎉 Chapter ${chapterId} Selesai! (+${earnedCoins} 🪙) Chapter ${nextChapterId} kini Terbuka! 🔓`, 'success');
    } else {
      showToast(`👑 Luar Biasa! Seluruh Chapter tuntas diselesaikan! (+${earnedCoins} 🪙) 🏆`, 'success');
    }
  }
};

// ==========================================================================
// 10. EPISODE SELECT MANAGER (CHAPTER 1 MODAL)
// ==========================================================================
const EpisodeSelectManager = {
  currentChapterId: 1,

  openModal(chapterId = 1) {
    this.currentChapterId = chapterId;
    const modal = document.getElementById('episode-select-modal');
    const grid = document.getElementById('episodes-grid');
    const chapterTag = document.getElementById('episode-modal-chapter-tag');
    if (!modal || !grid) return;

    if (chapterTag) {
      chapterTag.textContent = `🏢 CHAPTER ${chapterId}`;
    }

    // Ensure chapter episodes data exists in gameState
    if (!gameState.progress.chapterEpisodes) {
      gameState.progress.chapterEpisodes = {};
    }
    if (!gameState.progress.chapterEpisodes[chapterId]) {
      gameState.progress.chapterEpisodes[chapterId] = {
        unlocked: [1],
        completed: [],
        stars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
    }

    const epProgress = gameState.progress.chapterEpisodes[chapterId];
    grid.innerHTML = '';

    CHAPTER_1_EPISODES.forEach(ep => {
      // Episode 1 is unlocked by default, episode N unlocked if episode N-1 completed
      const isUnlocked = (ep.id === 1) || (epProgress.completed && epProgress.completed.includes(ep.id - 1)) || (epProgress.unlocked && epProgress.unlocked.includes(ep.id));
      const isCompleted = epProgress.completed && epProgress.completed.includes(ep.id);
      const starsCount = epProgress.stars[ep.id] || (isCompleted ? 3 : 0);
      const starsHtml = isCompleted ? '⭐⭐⭐ Selesai' : (isUnlocked ? '⭐ Belum Selesai' : '🔒 Terkunci');

      const card = document.createElement('div');
      card.className = `episode-card ${isCompleted ? 'completed' : (isUnlocked ? 'unlocked' : 'locked')}`;
      card.innerHTML = `
        <span class="episode-number-badge">Episode ${ep.id}</span>
        <div class="episode-card-icon">${isUnlocked ? ep.icon : '🔒'}</div>
        <h4 class="episode-card-title">${ep.title}</h4>
        <p class="episode-card-desc">${ep.desc}</p>
        <div class="episode-card-stars">${starsHtml}</div>
        <button class="episode-btn-action ${isCompleted ? 'episode-btn-completed' : (isUnlocked ? 'episode-btn-play' : 'episode-btn-locked')}">
          ${isCompleted ? 'Main Ulang 🔄' : (isUnlocked ? 'Mulai Misi 🚀' : '🔒 Terkunci')}
        </button>
      `;

      card.addEventListener('click', () => {
        if (isUnlocked) {
          SoundSystem.play('click');
          this.closeModal();
          EpisodeMissionManager.startEpisode(chapterId, ep.id);
        } else {
          SoundSystem.play('back');
          showToast('Selesaikan Episode sebelumnya terlebih dahulu! 🔒', 'warning');
        }
      });

      grid.appendChild(card);
    });

    modal.classList.add('active');
  },

  closeModal() {
    const modal = document.getElementById('episode-select-modal');
    if (modal) modal.classList.remove('active');
    SceneManager.changeScene('menu');
  }
};

// ==========================================================================
// 11. EPISODE MISSION SCREEN MANAGER (3 PHASES: STORY, GAMEPLAY, REWARD)
// ==========================================================================
const EpisodeMissionManager = {
  activeChapterId: 1,
  activeEpisodeId: 1,
  sortedItemIds: new Set(),
  archiveCount: 0,
  trashCount: 0,

  startEpisode(chapterId = 1, episodeId = 1) {
    this.activeChapterId = chapterId;
    this.activeEpisodeId = episodeId;
    this.sortedItemIds.clear();
    this.archiveCount = 0;
    this.trashCount = 0;

    const modal = document.getElementById('episode-game-modal');
    if (!modal) return;

    const episodeData = CHAPTER_1_EPISODES.find(e => e.id === episodeId) || CHAPTER_1_EPISODES[0];
    
    // Set Header Info
    const chapterPill = document.getElementById('game-screen-chapter-pill');
    const screenTitle = document.getElementById('game-screen-title');
    if (chapterPill) chapterPill.textContent = `🏢 Chapter ${chapterId} • Episode ${episodeId}`;
    if (screenTitle) screenTitle.textContent = `${episodeData.title} 🌪️`;

    modal.classList.add('active');
    this.showPhase(1);
    
    // Trigger Scene BGM for Story Mode (Office Normal or Flashback)
    SceneManager.onStartEpisodeStory(chapterId, episodeId);
    this.renderStoryPhase(episodeData);
  },

  closeGameModal() {
    const modal = document.getElementById('episode-game-modal');
    if (modal) modal.classList.remove('active');
    SceneManager.changeScene('menu');
  },

  showPhase(phaseNum) {
    // Switch Panels
    document.querySelectorAll('.game-screen-phase').forEach(panel => panel.classList.remove('active'));
    if (phaseNum === 1) {
      document.getElementById('game-phase-story')?.classList.add('active');
    } else if (phaseNum === 2) {
      document.getElementById('game-phase-gameplay')?.classList.add('active');
    } else if (phaseNum === 3) {
      document.getElementById('game-phase-reward')?.classList.add('active');
    }

    // Update Step Indicators
    for (let i = 1; i <= 3; i++) {
      const dot = document.getElementById(`phase-dot-${i}`);
      if (dot) {
        dot.classList.remove('active', 'completed');
        if (i < phaseNum) dot.classList.add('completed');
        else if (i === phaseNum) dot.classList.add('active');
      }
    }
    const line1 = document.getElementById('phase-line-1');
    const line2 = document.getElementById('phase-line-2');
    if (line1) line1.classList.toggle('active', phaseNum >= 2);
    if (line2) line2.classList.toggle('active', phaseNum >= 3);
  },

  renderStoryPhase(episodeData) {
    const container = document.getElementById('story-dialog-container');
    if (!container) return;

    container.innerHTML = '';
    const playerName = gameState.profile.name || 'Agen Cilik';
    const playerAvatar = gameState.profile.avatar || '👦🏻';
    const dialogs = episodeData.dialogs || [];

    dialogs.forEach((dialog, index) => {
      let avatarEmoji = '👦🏻';
      let senderName = playerName;
      let themeClass = 'dialog-player';

      if (dialog.speaker === 'mentor') {
        avatarEmoji = GAME_CHARACTERS.mentor.avatar;
        senderName = `${GAME_CHARACTERS.mentor.name} (Mentor)`;
        themeClass = 'dialog-mentor';
      } else if (dialog.speaker === 'villain') {
        avatarEmoji = GAME_CHARACTERS.villain.avatar;
        senderName = `${GAME_CHARACTERS.villain.name} (Villain)`;
        themeClass = 'dialog-villain';
      } else {
        avatarEmoji = playerAvatar;
        senderName = `${playerName} (Agen Utama)`;
        themeClass = 'dialog-player';
      }

      const formattedText = dialog.text.replace(/\{PLAYER_NAME\}/g, playerName);

      const row = document.createElement('div');
      row.className = `dialog-bubble-row ${themeClass}`;
      row.style.animationDelay = `${index * 0.12}s`;
      row.innerHTML = `
        <div class="dialog-avatar">${avatarEmoji}</div>
        <div class="dialog-card">
          <div class="dialog-sender">${senderName}</div>
          <p class="dialog-text">${formattedText}</p>
        </div>
      `;
      container.appendChild(row);
    });
  },

  startGameplay() {
    this.showPhase(2);
    // Dr. Chaos chaos theme starts during messy sorting gameplay
    SceneManager.onStartEpisodeGameplay(this.activeChapterId, this.activeEpisodeId);
    this.renderGameplayPhase();
  },

  renderGameplayPhase() {
    const container = document.getElementById('sorting-items-container');
    const remainingEl = document.getElementById('sorting-remaining-count');
    const archiveBadge = document.getElementById('count-archive');
    const trashBadge = document.getElementById('count-trash');
    if (!container) return;

    container.innerHTML = '';
    this.sortedItemIds.clear();
    this.archiveCount = 0;
    this.trashCount = 0;

    if (archiveBadge) archiveBadge.textContent = '0 Disimpan';
    if (trashBadge) trashBadge.textContent = '0 Dibuang';
    if (remainingEl) remainingEl.textContent = '4';

    const episodeData = CHAPTER_1_EPISODES.find(e => e.id === this.activeEpisodeId) || CHAPTER_1_EPISODES[0];
    const items = episodeData.sortingItems || [];

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'sorting-item-card';
      card.id = `sort-card-${item.id}`;
      card.draggable = true;
      card.setAttribute('data-item-id', item.id);
      card.setAttribute('data-target-type', item.type);

      card.innerHTML = `
        <div class="sorting-item-header">
          <div class="sorting-item-icon">${item.icon}</div>
          <div class="sorting-item-info">
            <h5 class="sorting-item-title">${item.title}</h5>
            <span class="sorting-item-type-badge">${item.typeBadge}</span>
          </div>
        </div>
        <div class="sorting-actions-row">
          <button type="button" class="btn-sort-archive" data-action="archive" title="Simpan ke Lemari Arsip">
            📁 Ke Lemari Arsip
          </button>
          <button type="button" class="btn-sort-trash" data-action="trash" title="Buang ke Tempat Sampah">
            🗑️ Ke Tempat Sampah
          </button>
        </div>
      `;

      // Direct button click handlers
      const archiveBtn = card.querySelector('[data-action="archive"]');
      const trashBtn = card.querySelector('[data-action="trash"]');

      if (archiveBtn) {
        archiveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleSortAction(item, 'archive', card);
        });
      }

      if (trashBtn) {
        trashBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleSortAction(item, 'trash', card);
        });
      }

      // Drag and Drop Events
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ itemId: item.id, type: item.type }));
        card.style.opacity = '0.5';
      });

      card.addEventListener('dragend', () => {
        card.style.opacity = '1';
      });

      container.appendChild(card);
    });

    // Setup Target Drop Zones
    this.setupDropZones();
  },

  setupDropZones() {
    const archiveZone = document.getElementById('target-archive');
    const trashZone = document.getElementById('target-trash');

    [archiveZone, trashZone].forEach(zone => {
      if (!zone) return;
      
      zone.ondragover = (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
      };

      zone.ondragleave = () => {
        zone.classList.remove('dragover');
      };

      zone.ondrop = (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        try {
          const data = JSON.parse(e.dataTransfer.getData('text/plain'));
          if (data && data.itemId) {
            const card = document.getElementById(`sort-card-${data.itemId}`);
            const episodeData = CHAPTER_1_EPISODES.find(e => e.id === this.activeEpisodeId) || CHAPTER_1_EPISODES[0];
            const item = episodeData.sortingItems ? episodeData.sortingItems.find(i => i.id === data.itemId) : null;
            if (item && card) {
              const targetType = zone.getAttribute('data-type');
              this.handleSortAction(item, targetType, card);
            }
          }
        } catch (err) {
          console.warn('Drag drop parse error:', err);
        }
      };
    });
  },

  handleSortAction(item, chosenTarget, cardElement) {
    if (this.sortedItemIds.has(item.id)) return;

    if (item.type === chosenTarget) {
      // Correct!
      this.sortedItemIds.add(item.id);
      SoundSystem.play('step');
      
      cardElement.classList.add('sorted');
      setTimeout(() => {
        cardElement.style.display = 'none';
      }, 280);

      // Update counters
      if (chosenTarget === 'archive') {
        this.archiveCount++;
        const badge = document.getElementById('count-archive');
        if (badge) badge.textContent = `${this.archiveCount} Disimpan ✨`;
      } else {
        this.trashCount++;
        const badge = document.getElementById('count-trash');
        if (badge) badge.textContent = `${this.trashCount} Dibuang ✨`;
      }

      const remaining = 4 - this.sortedItemIds.size;
      const remainingEl = document.getElementById('sorting-remaining-count');
      if (remainingEl) remainingEl.textContent = remaining;

      showToast(`Tepat! "${item.title}" berhasil dipilah ✨`, 'success');

      // Check if all 4 sorted
      if (this.sortedItemIds.size === 4) {
        setTimeout(() => {
          this.finishMissionReward();
        }, 600);
      }
    } else {
      // Wrong!
      SoundSystem.play('back');
      cardElement.classList.add('wiggle');
      setTimeout(() => cardElement.classList.remove('wiggle'), 500);
      showToast(chosenTarget === 'archive' 
        ? 'Ups! Itu kertas sampah, buang ke Tempat Sampah ya 🗑️' 
        : 'Ups! Itu dokumen penting resmi, simpan ke Lemari Arsip ya 📁'
      );
    }
  },

  finishMissionReward() {
    this.showPhase(3);
    SceneManager.onEpisodeCompleted();
    SoundSystem.play('success');

    const epId = this.activeEpisodeId;
    const isLastEpisode = (epId >= 5);
    const nextEpId = epId + 1;

    const playerName = gameState.profile.name || 'Agen Cilik';
    const playerAvatar = gameState.profile.avatar || '👦🏻';
    const nameEl = document.getElementById('reward-agent-name');
    const avatarEl = document.getElementById('reward-agent-avatar');
    const praiseTextEl = document.getElementById('reward-praise-text');
    const unlockIconEl = document.getElementById('reward-unlock-icon');
    const unlockTitleEl = document.getElementById('reward-unlock-title');
    const unlockSubEl = document.getElementById('reward-unlock-subtitle');
    const nextBtnTextEl = document.getElementById('btn-next-episode-text');

    if (nameEl) nameEl.textContent = playerName;
    if (avatarEl) avatarEl.textContent = playerAvatar;

    // Ensure chapterEpisodes structure exists
    if (!gameState.progress.chapterEpisodes) gameState.progress.chapterEpisodes = {};
    if (!gameState.progress.chapterEpisodes[1]) {
      gameState.progress.chapterEpisodes[1] = {
        unlocked: [1],
        completed: [],
        stars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
    }

    const ch1 = gameState.progress.chapterEpisodes[1];
    if (!ch1.completed.includes(epId)) ch1.completed.push(epId);
    ch1.stars[epId] = 3;

    if (!isLastEpisode) {
      // Unlock next episode within Chapter 1
      if (!ch1.unlocked.includes(nextEpId)) ch1.unlocked.push(nextEpId);
      const nextEpData = CHAPTER_1_EPISODES.find(e => e.id === nextEpId);
      const nextTitle = nextEpData ? nextEpData.title : `Episode ${nextEpId}`;

      if (praiseTextEl) {
        praiseTextEl.textContent = `"Kerja hebat, Agen ${playerName}! Seluruh dokumen di Episode ${epId} berhasil diamankan! Siap untuk tantangan selanjutnya?"`;
      }
      if (unlockIconEl) unlockIconEl.textContent = '🔓';
      if (unlockTitleEl) unlockTitleEl.textContent = `EPISODE ${nextEpId} BERHASIL TERBUKA!`;
      if (unlockSubEl) unlockSubEl.textContent = `"${nextTitle}" kini siap kamu jelajahi!`;
      if (nextBtnTextEl) nextBtnTextEl.textContent = `➔ Lanjut Episode ${nextEpId}`;

      // Chapter 1 is NOT finished yet, Chapter 2 stays locked!
      syncProgression();

      // Award bonus coins (+50 Coins per episode)
      const earnedCoins = 50;
      gameState.coins = (gameState.coins || 0) + earnedCoins;

      showToast(`🎉 Episode ${epId} Selesai! (+${earnedCoins} 🪙) ⭐⭐⭐ Episode ${nextEpId} Terbuka!`, 'success');
    } else {
      // ALL EPISODES OF CHAPTER 1 ARE COMPLETE!
      if (!gameState.progress.completedChapters.includes(1)) {
        gameState.progress.completedChapters.push(1);
      }
      localStorage.setItem('chapter1_completed', 'true');
      gameState.progress.chapterStars[1] = 3;

      // Unlock reward badge 2
      BadgeGallery.unlockBadge('badge_2');

      // Sync progression - now Chapter 2 is unlocked!
      syncProgression();

      // Award bonus coins (+100 Coins for Chapter 1 grand finale)
      const earnedCoins = 100;
      gameState.coins = (gameState.coins || 0) + earnedCoins;

      if (praiseTextEl) {
        praiseTextEl.textContent = `"Kerja yang SANGAT LUAR BIASA, Agen ${playerName}! Seluruh 5 episode di Chapter 1 telah tuntas diselesaikan! Dr. Chaos berhasil dihentikan!"`;
      }
      if (unlockIconEl) unlockIconEl.textContent = '🏆';
      if (unlockTitleEl) unlockTitleEl.textContent = '🎉 CHAPTER 1 SELESAI SEMPURNA!';
      if (unlockSubEl) unlockSubEl.textContent = 'Chapter 2 "Misteri Berkas Rahasia" kini RESMI TERBUKA di Menu Misi! 🔓';
      if (nextBtnTextEl) nextBtnTextEl.textContent = '➔ Buka Chapter 2 di Menu Misi 🗺️';

      showToast(`🎉 Luar Biasa! Semua Episode Chapter 1 Selesai! (+${earnedCoins} 🪙) ⭐⭐⭐ Chapter 2 RESMI TERBUKA! 🔓`, 'success');
    }

    // Update rank
    gameState.profile.rank = calculateRank(gameState.progress.completedChapters.length);

    // Save
    Storage.save();
    TopBar.update();
    ChapterManager.render();
  }
};

// ==========================================================================
// 12. SETTINGS CONTROLLER (SLIDE 2)
// ==========================================================================
const SettingsManager = {
  init() {
    const bgmToggle = document.getElementById('setting-bgm-toggle');
    const sfxToggle = document.getElementById('setting-sfx-toggle');
    const hintsToggle = document.getElementById('setting-hints-toggle');
    const animToggle = document.getElementById('setting-anim-toggle');
    const resetBtn = document.getElementById('btn-reset-data');

    // Sync current values
    if (bgmToggle) bgmToggle.checked = gameState.settings.bgm;
    if (sfxToggle) sfxToggle.checked = gameState.settings.sfx;
    if (hintsToggle) hintsToggle.checked = gameState.settings.hints;
    if (animToggle) animToggle.checked = gameState.settings.animations;

    // Change listeners
    if (bgmToggle) {
      bgmToggle.addEventListener('change', (e) => {
        gameState.settings.bgm = e.target.checked;
        Storage.save();
        TopBar.update();
        BGMManager.updateSetting(gameState.settings.bgm);
        SoundSystem.play('click');
      });
    }

    if (sfxToggle) {
      sfxToggle.addEventListener('change', (e) => {
        gameState.settings.sfx = e.target.checked;
        Storage.save();
        TopBar.update();
        if (e.target.checked) SoundSystem.play('click');
      });
    }

    if (hintsToggle) {
      hintsToggle.addEventListener('change', (e) => {
        gameState.settings.hints = e.target.checked;
        Storage.save();
        SoundSystem.play('click');
      });
    }

    if (animToggle) {
      animToggle.addEventListener('change', (e) => {
        gameState.settings.animations = e.target.checked;
        Storage.save();
        SoundSystem.play('click');
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        SoundSystem.play('click');
        if (confirm('Apakah kamu yakin ingin mereset semua data permainan (nama, progres chapter & lencana)?')) {
          Storage.reset();
          TopBar.update();
          ProfileManager.syncFormWithState();
          ChapterManager.render();
          OfficeCustomizer.render();
          showToast('Data game telah direset kembali ke awal! 🔄 (500 Starter Koin diberikan ✨)');
          Navigation.showSlide('slide-1');
        }
      });
    }
  }
};

// ==========================================================================
// 13. OFFICE LAYOUT CUSTOMIZER & DECORATION SHOP (PILAR 4 - SLIDE 6)
// ==========================================================================
const OfficeCustomizer = {
  currentFilter: 'all',

  init() {
    // 1. Filter Category Tabs
    const tabContainer = document.getElementById('shop-category-tabs');
    if (tabContainer) {
      tabContainer.querySelectorAll('.shop-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          SoundSystem.play('click');
          tabContainer.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          this.currentFilter = tab.getAttribute('data-filter') || 'all';
          this.renderShop();
        });
      });
    }

    // 2. Direct click on room slots to inspect/open corresponding category
    ['clock', 'cabinet', 'desk', 'plant'].forEach(cat => {
      const slotEl = document.getElementById(`room-slot-${cat}`);
      if (slotEl) {
        slotEl.addEventListener('click', (e) => {
          // If unequip button was clicked, let its own handler execute
          if (e.target.closest('.btn-unequip-mini')) return;
          this.selectFilterTab(cat);
        });
      }
    });

    // 3. Mini Unequip Buttons in Room Canvas
    document.querySelectorAll('[data-action-unequip]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cat = btn.getAttribute('data-action-unequip');
        if (cat) this.unequipItem(cat);
      });
    });
  },

  selectFilterTab(category) {
    const tabContainer = document.getElementById('shop-category-tabs');
    if (!tabContainer) return;
    const targetTab = tabContainer.querySelector(`[data-filter="${category}"]`);
    if (targetTab) {
      SoundSystem.play('click');
      tabContainer.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
      targetTab.classList.add('active');
      this.currentFilter = category;
      this.renderShop();
    }
  },

  render() {
    this.renderRoom();
    this.renderShop();
    this.renderSummaryBar();
    TopBar.update();
  },

  renderRoom() {
    const avatarEl = document.getElementById('room-agent-avatar');
    const nameEl = document.getElementById('room-agent-name');
    if (avatarEl) avatarEl.textContent = gameState.profile.avatar;
    if (nameEl) nameEl.textContent = gameState.profile.name;

    const equipped = gameState.inventory.equipped || {};

    // 4 Slots: clock, cabinet, desk, plant
    ['clock', 'cabinet', 'desk', 'plant'].forEach(category => {
      const itemId = equipped[category];
      const placeholder = document.getElementById(`placeholder-${category}`);
      const content = document.getElementById(`content-${category}`);
      const iconEl = document.getElementById(`placed-${category}-icon`);
      const slotEl = document.getElementById(`room-slot-${category}`);

      if (itemId) {
        const item = DECORATIONS_DATA.find(d => d.id === itemId);
        if (placeholder) placeholder.style.display = 'none';
        if (content) content.style.display = 'flex';
        if (iconEl && item) iconEl.textContent = item.icon;
        if (slotEl) slotEl.classList.add('has-item');
      } else {
        if (placeholder) placeholder.style.display = 'flex';
        if (content) content.style.display = 'none';
        if (slotEl) slotEl.classList.remove('has-item');
      }
    });
  },

  renderSummaryBar() {
    const bar = document.getElementById('installed-summary-bar');
    if (!bar) return;

    bar.innerHTML = '';
    const equipped = gameState.inventory.equipped || {};
    const categories = [
      { key: 'desk', label: 'Meja', icon: '🪑' },
      { key: 'cabinet', label: 'Rak Arsip', icon: '📁' },
      { key: 'plant', label: 'Tanaman', icon: '🪴' },
      { key: 'clock', label: 'Jam Dinding', icon: '⏰' }
    ];

    categories.forEach(cat => {
      const itemId = equipped[cat.key];
      const item = itemId ? DECORATIONS_DATA.find(d => d.id === itemId) : null;

      const pill = document.createElement('div');
      pill.className = `installed-pill ${item ? 'installed' : 'empty'}`;
      if (item) {
        pill.innerHTML = `
          <span class="pill-icon">${item.icon}</span>
          <span class="pill-name">${item.name}</span>
          <button class="pill-remove-btn" title="Lepas ${item.name}">✕</button>
        `;
        pill.querySelector('.pill-remove-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          this.unequipItem(cat.key);
        });
      } else {
        pill.innerHTML = `
          <span class="pill-icon">${cat.icon}</span>
          <span class="pill-name">${cat.label}: Kosong</span>
        `;
        pill.addEventListener('click', () => {
          this.selectFilterTab(cat.key);
        });
      }
      bar.appendChild(pill);
    });
  },

  renderShop() {
    const grid = document.getElementById('shop-items-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const owned = gameState.inventory.owned || [];
    const equipped = gameState.inventory.equipped || {};
    const filter = this.currentFilter;

    const items = DECORATIONS_DATA.filter(item => {
      if (filter === 'all') return true;
      return item.category === filter;
    });

    items.forEach(item => {
      const isOwned = owned.includes(item.id);
      const isEquipped = equipped[item.category] === item.id;

      const card = document.createElement('div');
      card.className = `shop-item-card ${isEquipped ? 'equipped' : (isOwned ? 'owned' : 'available')}`;

      let actionHtml = '';
      if (isEquipped) {
        actionHtml = `
          <div class="shop-action-row">
            <span class="badge-equipped">Terpasang ✅</span>
            <button class="btn-shop-unequip" data-action="unequip" data-category="${item.category}">Lepas ✕</button>
          </div>
        `;
      } else if (isOwned) {
        actionHtml = `
          <div class="shop-action-row">
            <span class="badge-owned">Milikmu ✨</span>
            <button class="btn-shop-equip" data-action="equip" data-item-id="${item.id}">Pasang 📦</button>
          </div>
        `;
      } else {
        const canAfford = gameState.coins >= item.price;
        actionHtml = `
          <div class="shop-action-row">
            <div class="item-price-tag ${canAfford ? '' : 'expensive'}">
              <span class="coin-icon">🪙</span>
              <span class="price-val">${item.price}</span>
            </div>
            <button class="btn-shop-buy" data-action="buy" data-item-id="${item.id}">
              Beli 🪙 ${item.price}
            </button>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="shop-item-icon-wrap">
          <span class="shop-item-icon">${item.icon}</span>
          <span class="shop-category-tag">${item.categoryName}</span>
        </div>
        <div class="shop-item-info">
          <h4 class="shop-item-title">${item.name}</h4>
          <p class="shop-item-desc">${item.desc}</p>
        </div>
        <div class="shop-item-footer">
          ${actionHtml}
        </div>
      `;

      // Event listeners for action buttons
      const buyBtn = card.querySelector('[data-action="buy"]');
      const equipBtn = card.querySelector('[data-action="equip"]');
      const unequipBtn = card.querySelector('[data-action="unequip"]');

      if (buyBtn) {
        buyBtn.addEventListener('click', () => {
          this.buyItem(item.id);
        });
      }
      if (equipBtn) {
        equipBtn.addEventListener('click', () => {
          this.equipItem(item.id);
        });
      }
      if (unequipBtn) {
        unequipBtn.addEventListener('click', () => {
          this.unequipItem(item.category);
        });
      }

      grid.appendChild(card);
    });
  },

  buyItem(itemId) {
    const item = DECORATIONS_DATA.find(d => d.id === itemId);
    if (!item) return;

    // Check if player has enough coins
    if ((gameState.coins || 0) < item.price) {
      SoundSystem.play('warning');
      showToast('Koinmu belum cukup, Agen Cilik! Selesaikan misi cerita untuk kumpulkan koin lagi ya! 😊🪙', 'warning');
      return;
    }

    // Deduct coins & add to inventory
    gameState.coins -= item.price;
    if (!gameState.inventory.owned.includes(item.id)) {
      gameState.inventory.owned.push(item.id);
    }

    // Automatically equip the newly bought decoration
    gameState.inventory.equipped[item.category] = item.id;

    // Play coin SFX immediately, and placement SFX right after
    SoundSystem.play('coin');
    setTimeout(() => SoundSystem.play('place'), 200);

    // Save and re-render
    Storage.save();
    this.render();

    showToast(`🎉 Hore! Berhasil membeli & memasang "${item.name}"! Sisa Koin: ${gameState.coins} 🪙`, 'success');
  },

  equipItem(itemId) {
    const item = DECORATIONS_DATA.find(d => d.id === itemId);
    if (!item) return;

    gameState.inventory.equipped[item.category] = item.id;
    SoundSystem.play('place');
    Storage.save();
    this.render();

    showToast(`📦 "${item.name}" berhasil dipasang di ruang kerjamu! ✨`, 'success');
  },

  unequipItem(category) {
    const currentItemId = gameState.inventory.equipped[category];
    if (!currentItemId) return;

    const item = DECORATIONS_DATA.find(d => d.id === currentItemId);
    const itemName = item ? item.name : 'Dekorasi';

    gameState.inventory.equipped[category] = null;
    SoundSystem.play('unequip');
    Storage.save();
    this.render();

    showToast(`"${itemName}" dilepas dari ruang kerja.`, 'normal');
  }
};

// ==========================================================================
// 13. INITIALIZATION & EVENT LISTENERS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // 1. Load data from LocalStorage
  Storage.load();

  // 2. Initialize Audio & UI modules
  BGMManager.init();
  const unlockBGM = () => {
    BGMManager.unlockAudio();
    ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(evt => {
      window.removeEventListener(evt, unlockBGM);
    });
  };
  ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(evt => {
    window.addEventListener(evt, unlockBGM, { passive: true });
  });

  TopBar.update();
  ProfileManager.init();
  SettingsManager.init();
  OfficeCustomizer.init();
  OfficeCustomizer.render();

  // Start with Menu Scene BGM if enabled
  SceneManager.changeScene('menu');

  // 3. Bind Main Menu Navigation Buttons
  document.querySelectorAll('[data-target]').forEach(button => {
    button.addEventListener('click', (e) => {
      const target = button.getAttribute('data-target');
      if (button.classList.contains('btn-back')) {
        SoundSystem.play('back');
      } else {
        SoundSystem.play('click');
      }
      Navigation.showSlide(target);
    });
  });

  // 4. Top Bar Sound Action Handler
  const topSoundBtn = document.getElementById('btn-top-sound');
  if (topSoundBtn) {
    topSoundBtn.addEventListener('click', () => {
      const isSoundOn = gameState.settings.sfx || gameState.settings.bgm;
      const newState = !isSoundOn;
      gameState.settings.sfx = newState;
      gameState.settings.bgm = newState;

      const bgmToggle = document.getElementById('setting-bgm-toggle');
      const sfxToggle = document.getElementById('setting-sfx-toggle');
      if (bgmToggle) bgmToggle.checked = newState;
      if (sfxToggle) sfxToggle.checked = newState;

      Storage.save();
      TopBar.update();
      BGMManager.updateSetting(newState);
      if (newState) SoundSystem.play('click');
      showToast(newState ? 'Suara Diaktifkan 🔊' : 'Suara Dimatikan 🔇');
    });
  }

  // 5. Badge Modal Close Handlers
  const badgeModal = document.getElementById('badge-modal');
  const closeBadgeModalBtn = document.getElementById('btn-close-badge-modal');
  const okBadgeModalBtn = document.getElementById('btn-ok-badge-modal');

  const closeBadgeModal = () => {
    SoundSystem.play('back');
    if (badgeModal) badgeModal.classList.remove('active');
  };

  if (closeBadgeModalBtn) closeBadgeModalBtn.addEventListener('click', closeBadgeModal);
  if (okBadgeModalBtn) okBadgeModalBtn.addEventListener('click', closeBadgeModal);

  // 7. Interactive Mission Task Step Handlers
  const step1Btn = document.getElementById('btn-step-1');
  const step2Btn = document.getElementById('btn-step-2');
  const step3Btn = document.getElementById('btn-step-3');
  const completeMissionBtn = document.getElementById('btn-complete-mission');
  const closeMissionModalBtn = document.getElementById('btn-close-mission-modal');
  const missionModal = document.getElementById('mission-modal');

  if (step1Btn) {
    step1Btn.addEventListener('click', () => {
      SoundSystem.play('step');
      document.getElementById('task-step-1').classList.add('completed');
      step1Btn.disabled = true;
      step1Btn.textContent = 'Selesai ✓';

      const step2 = document.getElementById('task-step-2');
      step2.classList.remove('disabled');
      step2Btn.disabled = false;
    });
  }

  if (step2Btn) {
    step2Btn.addEventListener('click', () => {
      SoundSystem.play('step');
      document.getElementById('task-step-2').classList.add('completed');
      step2Btn.disabled = true;
      step2Btn.textContent = 'Selesai ✓';

      const step3 = document.getElementById('task-step-3');
      step3.classList.remove('disabled');
      step3Btn.disabled = false;
    });
  }

  if (step3Btn) {
    step3Btn.addEventListener('click', () => {
      SoundSystem.play('step');
      document.getElementById('task-step-3').classList.add('completed');
      step3Btn.disabled = true;
      step3Btn.textContent = 'Selesai ✓';

      if (completeMissionBtn) {
        completeMissionBtn.style.display = 'block';
      }
    });
  }

  if (completeMissionBtn) {
    completeMissionBtn.addEventListener('click', () => {
      ChapterManager.finishMission();
    });
  }

  if (closeMissionModalBtn && missionModal) {
    closeMissionModalBtn.addEventListener('click', () => {
      SoundSystem.play('back');
      missionModal.classList.remove('active');
      SceneManager.changeScene('menu');
    });
  }

  // 8. Episode & Game Screen Modal Handlers
  const closeEpisodeModalBtn = document.getElementById('btn-close-episode-modal');
  const closeGameScreenBtn = document.getElementById('btn-close-game-screen');
  const startGameplayBtn = document.getElementById('btn-start-gameplay');
  const returnEpisodesBtn = document.getElementById('btn-return-episodes');
  const nextEpisodeBtn = document.getElementById('btn-next-episode');

  if (closeEpisodeModalBtn) {
    closeEpisodeModalBtn.addEventListener('click', () => {
      SoundSystem.play('back');
      EpisodeSelectManager.closeModal();
    });
  }

  if (closeGameScreenBtn) {
    closeGameScreenBtn.addEventListener('click', () => {
      SoundSystem.play('back');
      EpisodeMissionManager.closeGameModal();
    });
  }

  if (startGameplayBtn) {
    startGameplayBtn.addEventListener('click', () => {
      SoundSystem.play('click');
      EpisodeMissionManager.startGameplay();
    });
  }

  if (returnEpisodesBtn) {
    returnEpisodesBtn.addEventListener('click', () => {
      SoundSystem.play('click');
      EpisodeMissionManager.closeGameModal();
      EpisodeSelectManager.openModal(1);
    });
  }

  if (nextEpisodeBtn) {
    nextEpisodeBtn.addEventListener('click', () => {
      SoundSystem.play('click');
      const currentEp = EpisodeMissionManager.activeEpisodeId;
      EpisodeMissionManager.closeGameModal();
      if (currentEp < 5) {
        const nextEp = currentEp + 1;
        EpisodeMissionManager.startEpisode(1, nextEp);
        showToast(`Memulai Episode ${nextEp}! 🚀`, 'success');
      } else {
        // Completed Chapter 1 -> Show Chapter Select menu
        Navigation.showSlide('slide-5');
        ChapterManager.render();
        showToast('Chapter 2 Resmi Terbuka! Silakan pilih Chapter 2 🎉', 'success');
      }
    });
  }

  // 9. Demo Testing Controls in Chapter Select
  const unlockAllBtn = document.getElementById('btn-unlock-all');
  const resetChaptersBtn = document.getElementById('btn-reset-chapters');

  if (unlockAllBtn) {
    unlockAllBtn.addEventListener('click', () => {
      SoundSystem.play('success');
      gameState.progress.completedChapters = [1, 2, 3, 4];
      gameState.progress.unlockedChapters = [1, 2, 3, 4];
      for (let i = 1; i <= 4; i++) {
        localStorage.setItem(`chapter${i}_completed`, 'true');
        gameState.progress.chapterStars[i] = 3;
      }
      if (!gameState.progress.chapterEpisodes) gameState.progress.chapterEpisodes = {};
      gameState.progress.chapterEpisodes[1] = {
        unlocked: [1, 2, 3, 4, 5],
        completed: [1, 2, 3, 4, 5],
        stars: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 }
      };
      gameState.profile.rank = calculateRank(4);
      Storage.save();
      TopBar.update();
      ChapterManager.render();
      showToast('Semua chapter & episode berhasil dibuka! 🔓', 'success');
    });
  }

  if (resetChaptersBtn) {
    resetChaptersBtn.addEventListener('click', () => {
      SoundSystem.play('back');
      gameState.progress.unlockedChapters = [1];
      gameState.progress.completedChapters = [];
      gameState.progress.chapterStars = { 1: 0, 2: 0, 3: 0, 4: 0 };
      for (let i = 1; i <= 4; i++) {
        localStorage.removeItem(`chapter${i}_completed`);
      }
      gameState.progress.chapterEpisodes = {
        1: {
          unlocked: [1],
          completed: [],
          stars: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        }
      };
      gameState.profile.rank = calculateRank(0);
      Storage.save();
      TopBar.update();
      ChapterManager.render();
      showToast('Progres chapter dikunci kembali. Hanya Chapter 1 yang terbuka 🔒', 'warning');
    });
  }

  // 10. Close modals on background overlay click
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      SoundSystem.play('back');
      e.target.classList.remove('active');
      SceneManager.changeScene('menu');
    }
  });

  // Welcome Toast on initial load
  setTimeout(() => {
    showToast(`Selamat datang di kantor, ${gameState.profile.name}! 🌟`);
  }, 400);
});
