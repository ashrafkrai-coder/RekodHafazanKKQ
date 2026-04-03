import './styles.css';

type HafazanRecord = Record<string, unknown>;

type NavButtonElement = HTMLElement & {
  variant?: string;
};

type ProgressBarElement = HTMLElement & {
  value?: number;
};

const FALLBACK_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbx7y_x8u9moo2yp-TY-lVZpJLFufYGV-vLZy_iIu8WhyZqSKVZxYPC3dmzeI-wDj7Po/exec';

const envScriptUrl = (import.meta.env.VITE_HAFAZAN_SCRIPT_URL ?? '').toString().trim();
const scriptUrl = envScriptUrl.length ? envScriptUrl : FALLBACK_SCRIPT_URL;

const spinnerPlaceholder = `
  <div class="placeholder">
    <sl-spinner style="font-size: 2rem;"></sl-spinner>
    <p>Menarik data dari Google Sheets...</p>
  </div>
`;

const surahSlots = [
  {
    labelKeys: ['Surah1_Nama', 'Surah1', 'Surah 1', 'surah1', 'n1'],
    scoreKeys: ['Surah1_Skor', 'Surah1_Skor%', 'Peratus1', 'Skor1', 'Peratus'],
    fallbackLabel: 'Surah 1',
  },
  {
    labelKeys: ['Surah2_Nama', 'Surah2', 'Surah 2', 'surah2', 'n2'],
    scoreKeys: ['Surah2_Skor', 'Surah2_Skor%', 'Peratus2', 'Skor2'],
    fallbackLabel: 'Surah 2',
  },
];

let kelasSemasa = '1AF';
let navButtons: NavButtonElement[] = [];
let dataContainer: HTMLElement | null = null;
const badge = typeof document !== 'undefined' ? document.getElementById('badgeKelas') : null;

const numberKeys = (value: unknown): number => {
  if (value == null) {
    return 0;
  }

  if (typeof value === 'string') {
    const sanitized = value.replace(/[^0-9.-]+/g, '');
    const parsed = Number(sanitized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  return 0;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max);

const getIndicatorColor = (score: number) =>
  score >= 100 ? 'var(--sl-color-success-500)' : 'var(--sl-color-primary-500)';

const chooseString = (source: HafazanRecord, keys: string[], fallback: string) => {
  for (const key of keys) {
    const raw = source[key];
    if (raw == null) continue;
    const text = String(raw).trim();
    if (text.length) {
      return text;
    }
  }
  return fallback;
};

const chooseNumber = (source: HafazanRecord, keys: string[]) => {
  for (const key of keys) {
    const raw = source[key];
    if (raw == null) {
      continue;
    }

    const parsed = clamp(numberKeys(raw));
    return parsed;
  }
  return 0;
};

const createMuridCard = (murid: HafazanRecord) => {
  const card = document.createElement('article');
  card.className = 'murid-card';

  const nama = document.createElement('span');
  nama.className = 'nama-murid';
  nama.textContent = chooseString(
    murid,
    ['Nama', 'Nama Pelajar', 'nama', 'name'],
    'Nama Tidak Diketahui',
  );
  card.appendChild(nama);

  surahSlots.forEach((slot) => {
    const label = document.createElement('span');
    label.className = 'surah-label';
    label.textContent = chooseString(murid, slot.labelKeys, slot.fallbackLabel);

    const wrapper = document.createElement('div');
    wrapper.className = 'surah-container';

    const row = document.createElement('div');
    row.className = 'progress-wrapper';

    const progress = document.createElement('sl-progress-bar') as ProgressBarElement;
    const score = chooseNumber(murid, slot.scoreKeys);
    progress.value = score;
    progress.style.setProperty('--indicator-color', getIndicatorColor(score));
    progress.setAttribute('aria-label', `${label.textContent} ${Math.round(score)}%`);

    const percentage = document.createElement('span');
    percentage.className = 'peratus-teks';
    percentage.textContent = `${Math.round(score)}%`;

    row.appendChild(progress);
    row.appendChild(percentage);

    wrapper.appendChild(label);
    wrapper.appendChild(row);
    card.appendChild(wrapper);
  });

  return card;
};

const normalizeResponse = (payload: unknown): HafazanRecord[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const container = payload as Record<string, unknown>;
    if (container.error) {
      throw new Error(String(container.error));
    }

    const candidateKeys = ['records', 'data', 'items', 'result'];
    for (const key of candidateKeys) {
      if (Array.isArray(container[key])) {
        return container[key] as HafazanRecord[];
      }
    }
  }

  return [];
};

const updateBadge = () => {
  if (badge) {
    badge.textContent = `KELAS ${kelasSemasa}`;
  }
};

const setActiveButton = (target: NavButtonElement) => {
  navButtons.forEach((button) => {
    button.variant = 'default';
    button.setAttribute('aria-selected', 'false');
  });

  target.variant = 'primary';
  target.setAttribute('aria-selected', 'true');
};

const handleNavSelection = (button: NavButtonElement) => {
  const kelas = button.dataset.kelas;
  if (!kelas || kelasSemasa === kelas) {
    return;
  }

  kelasSemasa = kelas;
  updateBadge();
  setActiveButton(button);
  muatData();
};

const setUpNavigation = () => {
  navButtons = Array.from(document.querySelectorAll<NavButtonElement>('.nav-kelas sl-button'));
  if (!navButtons.length) {
    return;
  }

  const initial = navButtons.find((button) => button.dataset.kelas === kelasSemasa) ?? navButtons[0];
  if (initial) {
    setActiveButton(initial);
  }

  navButtons.forEach((button) => {
    button.addEventListener('click', () => handleNavSelection(button));
  });
};

const buildSheetUrl = (kelas: string) => {
  if (!scriptUrl) {
    return null;
  }
  return `${scriptUrl}?kelas=${encodeURIComponent(kelas)}`;
};

const muatData = async () => {
  if (!dataContainer) {
    return;
  }

  dataContainer.innerHTML = spinnerPlaceholder;
  const url = buildSheetUrl(kelasSemasa);

  if (!url) {
    dataContainer.innerHTML =
      '<sl-alert variant="warning" open>Tiada URL Google Apps Script dikonfigurasikan. Tambahkan VITE_HAFAZAN_SCRIPT_URL.</sl-alert>';
    return;
  }

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Pelayan mengembalikan kod ${response.status}`);
    }

    const payload = await response.json();
    const records = normalizeResponse(payload);

    if (!records.length) {
      dataContainer.innerHTML = `<sl-alert variant="info" open>Tiada data untuk kelas ${kelasSemasa}.</sl-alert>`;
      return;
    }

    dataContainer.innerHTML = '';
    records.forEach((murid) => {
      dataContainer?.appendChild(createMuridCard(murid));
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ralat tidak dikenal pasti';
    dataContainer.innerHTML = `<sl-alert variant="danger" open>Gagal memuatkan data: ${message}</sl-alert>`;
  }
};

const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.error('Service worker registration failed', err));
  });
};

window.addEventListener('DOMContentLoaded', () => {
  dataContainer = document.getElementById('senaraiHafazan');
  setUpNavigation();
  updateBadge();
  muatData();
  registerServiceWorker();
});
