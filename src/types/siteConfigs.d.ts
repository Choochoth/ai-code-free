interface AbortFlag {
  canceled: boolean;
}

export interface SiteQueue {
  remainingCodes: string[];
  isProcessing: boolean;
  abortFlag: AbortFlag; // ✅ เพิ่มบรรทัดนี้
  players: any[];
  apiEndPoint: string;
  site: string;
  hostUrl: string;
}

