interface ImportMetaEnv {
  readonly VITE_HAFAZAN_SHEET_ID?: string;
  readonly VITE_HAFAZAN_SHEET_NAME?: string;
  readonly VITE_HAFAZAN_SHEET_RANGE?: string;
  readonly VITE_HAFAZAN_NAME_COLUMN?: string;
  readonly VITE_HAFAZAN_CLASS_COLUMN?: string;
  readonly VITE_HAFAZAN_METRIC_COLUMN?: string;
  readonly VITE_HAFAZAN_SUMMARY_COLUMN?: string;
  readonly VITE_HAFAZAN_UPDATED_COLUMN?: string;
  readonly VITE_HAFAZAN_SCRIPT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
