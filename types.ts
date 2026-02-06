
export interface Marker {
  id: string;
  time: number; // in seconds
  label: string;
  color: string;
}

export interface AnalysisConfig {
  sensitivity: number; // 0 to 1
  minDistance: number; // minimum distance between markers in seconds
  aggressiveMode: boolean;
}

export enum ExportFormat {
  PREMIERE_XML = 'PREMIERE_XML',
  AFTER_EFFECTS_JS = 'AFTER_EFFECTS_JS',
  FINAL_CUT_XML = 'FINAL_CUT_XML'
}
