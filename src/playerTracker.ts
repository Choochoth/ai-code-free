// เก็บ player ที่เพิ่งลองยิงไป
export const recentlyTriedPlayers: Map<string, number> = new Map();
export const PLAYER_RETRY_BLOCK_MS = 2 * 60 * 1000; // 2 นาที

// helper function สำหรับเช็คว่า player ใช้ได้มั้ย
export function isPlayerBlocked(player: string): boolean {
  const lastTried = recentlyTriedPlayers.get(player);
  if (!lastTried) return false;
  return Date.now() - lastTried < PLAYER_RETRY_BLOCK_MS;
}

// helper function สำหรับบันทึก player ที่เพิ่งยิงไป
export function markPlayerTried(player: string): void {
  recentlyTriedPlayers.set(player, Date.now());
}
