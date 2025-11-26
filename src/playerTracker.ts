// เก็บ player ที่เพิ่งลองยิงไป (แยกตาม site)
export const recentlyTriedPlayers: Map<string, number> = new Map();
export const PLAYER_RETRY_BLOCK_MS = 90 * 1000; // 1.30 นาที

// สร้าง key ที่ unique ต่อ site + player
function makeKey(site: string, player: string): string {
  return `${site}:${player}`;
}

// helper function สำหรับเช็คว่า player ใช้ได้มั้ย (เช็คตาม site)
export function isPlayerBlocked(site: string, player: string): boolean {
  const key = makeKey(site, player);
  const lastTried = recentlyTriedPlayers.get(key);
  if (!lastTried) return false;
  return Date.now() - lastTried < PLAYER_RETRY_BLOCK_MS;
}

// helper function สำหรับบันทึก player ที่เพิ่งยิงไป (ผูกกับ site)
export function markPlayerTried(site: string, player: string): void {
  const key = makeKey(site, player);
  recentlyTriedPlayers.set(key, Date.now());
}


export function cleanupExpiredBlocks(): void {
  const now = Date.now();
  for (const [key, lastTried] of recentlyTriedPlayers.entries()) {
    if (now - lastTried >= PLAYER_RETRY_BLOCK_MS) {
      recentlyTriedPlayers.delete(key);
    }
  }
}
