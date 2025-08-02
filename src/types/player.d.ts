export type Site = "thai_789bet" | "thai_jun88k36"; // extend as needed

export interface AppliedPlayer {
  promo_code: string;
  time: number; // timestamp (ms since epoch)
  time_limit?: number; // ✅ Optional field for expiration timestamp
  status: "success" | "failed" | string;
  player: string;
  point: number;
}

export interface PlayerLock {
  player: string;
  timelock: number;
  lockMessage: string;
  lockTime: number; // หน่วยเป็นมิลลิวินาที หรือจะใช้เป็นชั่วโมงก็ได้
}

export interface SiteData {
  players: AppliedPlayer[];
  playersLock: PlayerLock[];
}

export interface ApplyCodeToday {
  date: string;
  [site: string]: SiteData | string;
}

export interface SiteSentPlayers {
  appliedPlayers: AppliedPlayer[];
  playersLock: PlayerLock[];
}

export type LockedPlayer = PlayerLock;

export type Tier = "very_high" | "high" | "mid" | "low" | "all";

export type PlayerPool = Record<Tier, string[]>;

// Type guard to check if a string is a valid Site
export function isValidSite(site: string): site is Site {
  return ["thai_789bet", "thai_jun88k36"].includes(site);
}

// ✅ อัปเดต isSiteData ให้รองรับ time_limit (optional)
export function isSiteData(data: any): data is SiteData {
  return (
    typeof data === "object" &&
    data !== null &&
    Array.isArray(data.players) &&
    Array.isArray(data.playersLock) &&
    data.players.every(
      (p: any) =>
        typeof p === "object" &&
        typeof p.promo_code === "string" &&
        typeof p.time === "number" &&
        (typeof p.time_limit === "undefined" || typeof p.time_limit === "number") &&
        typeof p.status === "string" &&
        typeof p.player === "string" &&
        typeof p.point === "number"
    ) &&
    data.playersLock.every(
      (lock: any) =>
        typeof lock === "object" &&
        typeof lock.player === "string" &&
        typeof lock.timelock === "number" &&
        typeof lock.lockMessage === "string" &&
        typeof lock.lockTime === "number"
    )
  );
}
