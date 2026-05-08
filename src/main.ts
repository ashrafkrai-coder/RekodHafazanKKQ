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
const SHEETS_BASE_URL = 'https://docs.google.com/spreadsheets/d';

const envSheetId = (import.meta.env.VITE_HAFAZAN_SHEET_ID ?? '').toString().trim();
const envSheetName = (import.meta.env.VITE_HAFAZAN_SHEET_NAME ?? 'Rekod Hafazan').toString().trim();
const envSheetRange = (import.meta.env.VITE_HAFAZAN_SHEET_RANGE ?? 'A1:F200').toString().trim();
const envNameColumn = (import.meta.env.VITE_HAFAZAN_NAME_COLUMN ?? 'Nama').toString().trim();
const envClassColumn = (import.meta.env.VITE_HAFAZAN_CLASS_COLUMN ?? 'Kelas').toString().trim();
const envMetricColumn = (import.meta.env.VITE_HAFAZAN_METRIC_COLUMN ?? 'Peratus').toString().trim();
const envSummaryColumn = (import.meta.env.VITE_HAFAZAN_SUMMARY_COLUMN ?? 'Surah').toString().trim();
const envUpdatedColumn = (import.meta.env.VITE_HAFAZAN_UPDATED_COLUMN ?? 'Tarikh').toString().trim();
const envScriptUrl = (import.meta.env.VITE_HAFAZAN_SCRIPT_URL ?? '').toString().trim();

const hasSheetId = envSheetId.length > 0;
const hasScriptUrl = envScriptUrl.length > 0;
const usingSheet = hasSheetId && !hasScriptUrl;
const scriptUrl = hasScriptUrl ? envScriptUrl : hasSheetId ? '' : FALLBACK_SCRIPT_URL;
const DATA_REFRESH_INTERVAL_MS = 60_000;

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
let activeLoadToken = 0;
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

type ColumnMeta = {
  label: string;
  normalized: string;
  index: number;
};

type GvizTable = {
  cols?: { label?: string; id?: string }[];
  rows?: { c?: { v?: unknown; f?: string }[] }[];
};

const NAME_COLUMN_FALLBACKS = ['Nama', 'Nama Pelajar', 'Nama Lengkap', 'name'];
const CLASS_COLUMN_FALLBACKS = ['Kelas', 'kelas', 'Class'];
const METRIC_COLUMN_FALLBACKS = ['Peratus', 'Skor', 'Nilai', 'Markah', 'Peratusan'];
const SUMMARY_COLUMN_FALLBACKS = ['Surah', 'Catatan', 'Nota'];
const UPDATED_COLUMN_FALLBACKS = ['Tarikh', 'Kemaskini', 'Updated', 'Tarikh Kemaskini'];

const FIELD_ALIAS_TARGETS = {
  name: ['Nama', 'Nama Pelajar', 'name'] as const,
  class: ['Kelas', 'kelas'] as const,
  metric: ['Peratus', 'Skor', 'Nilai', 'Markah'] as const,
  summary: ['Surah', 'Catatan', 'Nota'] as const,
  updated: ['Tarikh', 'Kemaskini', 'Updated'] as const,
};

const normalizeKey = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

const buildColumnMeta = (cols: { label?: string; id?: string }[]): ColumnMeta[] =>
  cols.map((col, index) => {
    const rawLabel =
      (typeof col.label === 'string' && col.label.trim()) ||
      (typeof col.id === 'string' && col.id.trim()) ||
      `column_${index + 1}`;
    return {
      label: rawLabel,
      normalized: normalizeKey(rawLabel),
      index,
    };
  });

const buildColumnCandidates = (envValue: string, defaults: string[]) => {
  const list = [...defaults];
  if (envValue.length) {
    list.unshift(envValue);
  }
  return Array.from(new Set(list.map(normalizeKey))).filter(Boolean);
};

const findColumnLabel = (columns: ColumnMeta[], candidates: string[]) => {
  if (!columns.length || !candidates.length) {
    return undefined;
  }

  for (const column of columns) {
    if (candidates.includes(column.normalized)) {
      return column.label;
    }
  }

  return undefined;
};

const applyFieldAliases = (
  record: HafazanRecord,
  columnLabel: string | undefined,
  aliasTargets: readonly string[],
) => {
  if (!columnLabel) {
    return record;
  }

  const value = record[columnLabel];
  if (value == null) {
    return record;
  }

  const mutated = { ...record };
  for (const alias of aliasTargets) {
    if (!(alias in mutated)) {
      mutated[alias] = value;
    }
  }

  return mutated;
};

const buildSheetRequestUrl = () => {
  if (!hasSheetId) {
    return null;
  }

  const params = new URLSearchParams({ tqx: 'out:json' });
  if (envSheetName.length) {
    params.set('sheet', envSheetName);
  }
  if (envSheetRange.length) {
    params.set('range', envSheetRange);
  }
  params.set('_ts', Date.now().toString());

  return `${SHEETS_BASE_URL}/${envSheetId}/gviz/tq?${params.toString()}`;
};

const parseGvizPayload = (raw: string) => {
  const trimmed = raw.trim();
  const marker = 'google.visualization.Query.setResponse(';
  const startIndex = trimmed.indexOf(marker);
  const endIndex = trimmed.lastIndexOf(');');
  const jsonText =
    startIndex !== -1 && endIndex !== -1 && endIndex > startIndex
      ? trimmed.slice(startIndex + marker.length, endIndex)
      : trimmed;

  return JSON.parse(jsonText);
};

const buildRecordFromRow = (row: { c?: { v?: unknown; f?: string }[] } | undefined, columns: ColumnMeta[]) => {
  const record: HafazanRecord = {};
  const cells = row?.c ?? [];

  cells.forEach((cell, index) => {
    const column = columns[index];
    if (!column) {
      return;
    }

    const value = cell?.v ?? cell?.f ?? null;
    record[column.label] = value;
  });

  return record;
};

const loadFromSheet = async (kelas: string) => {
  const url = buildSheetRequestUrl();
  if (!url) {
    throw new Error('VITE_HAFAZAN_SHEET_ID tidak dikonfigurasikan.');
  }

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Pelayan mengembalikan kod ${response.status}`);
  }

  const text = await response.text();
  const payload = parseGvizPayload(text);
  const table = (payload as { table?: GvizTable }).table;
  if (!table) {
    throw new Error('Google Sheets tidak mengembalikan jadual data.');
  }

  const columns = buildColumnMeta(table.cols ?? []);
  const nameCandidates = buildColumnCandidates(envNameColumn, NAME_COLUMN_FALLBACKS);
  const classCandidates = buildColumnCandidates(envClassColumn, CLASS_COLUMN_FALLBACKS);
  const metricCandidates = buildColumnCandidates(envMetricColumn, METRIC_COLUMN_FALLBACKS);
  const summaryCandidates = buildColumnCandidates(envSummaryColumn, SUMMARY_COLUMN_FALLBACKS);
  const updatedCandidates = buildColumnCandidates(envUpdatedColumn, UPDATED_COLUMN_FALLBACKS);

  const aliasSources = {
    name: findColumnLabel(columns, nameCandidates),
    class: findColumnLabel(columns, classCandidates),
    metric: findColumnLabel(columns, metricCandidates),
    summary: findColumnLabel(columns, summaryCandidates),
    updated: findColumnLabel(columns, updatedCandidates),
  };

  const enrichRecord = (record: HafazanRecord) => {
    let decorated = record;
    decorated = applyFieldAliases(decorated, aliasSources.name, FIELD_ALIAS_TARGETS.name);
    decorated = applyFieldAliases(decorated, aliasSources.class, FIELD_ALIAS_TARGETS.class);
    decorated = applyFieldAliases(decorated, aliasSources.metric, FIELD_ALIAS_TARGETS.metric);
    decorated = applyFieldAliases(decorated, aliasSources.summary, FIELD_ALIAS_TARGETS.summary);
    decorated = applyFieldAliases(decorated, aliasSources.updated, FIELD_ALIAS_TARGETS.updated);
    return decorated;
  };

  const rows = table.rows ?? [];
  const records = rows.map((row) => enrichRecord(buildRecordFromRow(row, columns)));

  if (!aliasSources.class) {
    return records;
  }

  const normalizedClass = kelas.trim().toLowerCase();
  return records.filter((record) => {
    const value = (record['Kelas'] ?? record['kelas'] ?? '').toString().trim().toLowerCase();
    return value === normalizedClass;
  });
};

const buildScriptRequestUrl = (kelas: string) => {
  if (!scriptUrl) {
    return null;
  }

  const params = new URLSearchParams({
    kelas,
    _ts: Date.now().toString(),
  });
  return `${scriptUrl}?${params.toString()}`;
};

const loadFromScript = async (kelas: string) => {
  const url = buildScriptRequestUrl(kelas);
  if (!url) {
    throw new Error('Tiada URL Google Apps Script dikonfigurasikan.');
  }

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Pelayan mengembalikan kod ${response.status}`);
  }

  const payload = await response.json();
  return normalizeResponse(payload);
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

const muatData = async () => {
  if (!dataContainer) {
    return;
  }

  const loadToken = ++activeLoadToken;
  dataContainer.innerHTML = spinnerPlaceholder;

  try {
    const records = usingSheet ? await loadFromSheet(kelasSemasa) : await loadFromScript(kelasSemasa);
    if (loadToken !== activeLoadToken) {
      return;
    }

    if (!records.length) {
      dataContainer.innerHTML = `<sl-alert variant="info" open>Tiada data untuk kelas ${kelasSemasa}.</sl-alert>`;
      return;
    }

    dataContainer.innerHTML = '';
    records.forEach((murid) => {
      dataContainer?.appendChild(createMuridCard(murid));
    });
  } catch (error) {
    if (loadToken !== activeLoadToken) {
      return;
    }

    const message = error instanceof Error ? error.message : 'Ralat tidak dikenal pasti';
    dataContainer.innerHTML = `<sl-alert variant="danger" open>Gagal memuatkan data: ${message}</sl-alert>`;
  }
};

const setUpAutoRefresh = () => {
  window.setInterval(() => {
    void muatData();
  }, DATA_REFRESH_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void muatData();
    }
  });

  window.addEventListener('focus', () => {
    void muatData();
  });
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
  setUpAutoRefresh();
  muatData();
  registerServiceWorker();
});
