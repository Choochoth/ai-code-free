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

export interface  ChannelMessageResult {
  channelId: string;
  channelName: string;
  messageId: number;
  message: string;
};

export interface PollTarget {
  channelId: string;
  messageId: number;
};

export interface  ChannelSnapshot {
  messageId: number;
  text: string;
  editDate?: number;
};

