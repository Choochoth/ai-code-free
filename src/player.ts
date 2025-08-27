import axios from "axios";
import dayjs from "dayjs";

import { AppliedPlayer, ApplyCodeToday, PlayerPool, PlayerLock, Site } from "./types/player";
import { getPlayerPools } from "./services/loadPlayerPools";

const OCR_API_BASE = process.env.OCR_API_BASE || "http://localhost:8000";
const APPLY_CODE_EXPIRE_MS = 24 * 60 * 60 * 1000;

/**
 * ดึงข้อมูล apply_code_today จาก API
 */
async function loadApplyCodeToday(): Promise<ApplyCodeToday> {
  try {
    const res = await axios.get(`${OCR_API_BASE}/api/players-apply-code`);
    return res.data.apply_code_today;
  } catch (error) {
    console.error("Failed to load apply code today from API:", error);
    return {
      date: dayjs().format("YYYY-MM-DD"),
      thai_789bet: { players: [], playersLock: [] },
      thai_jun88k36: { players: [], playersLock: [] },
    };
  }
}

/**
 * update apply code log ผ่าน API POST
 */
async function updateApplyCodeLog(site: string, player: string, promoCode: string, point: number) {
  try {
    await axios.post(`${OCR_API_BASE}/api/players-apply-code`, {
      site,
      player,
      promo_code: promoCode,
      point,
    });
    console.log(`✅ Updated apply code log: site=${site}, player=${player}`);
  } catch (error) {
    console.error("Failed to update apply code log:", error);
  }
}

/**
 * update player lock ผ่าน API POST
 * @param lockTime มิลลิวินาที
 */
async function updatePlayersLock(site: string, playerId: string, lockMessage: string, lockTime: number, lockCode: number) {
  try {
    const lockMinutes = Math.floor(lockTime / 60000);
    await axios.post(`${OCR_API_BASE}/api/players-lock`, {
      site:site,
      username: playerId,
      lock_minutes: lockMinutes,
      lock_message: lockMessage,
      lock_code: lockCode,
    });
    const hours = Math.floor(lockTime / 3600000);
    const minutes = Math.floor((lockTime % 3600000) / 60000);
    console.log(`✅ Player ${playerId} locked for ${hours}h ${minutes}m (${lockMessage})`);
  } catch (error) {
    console.error("Failed to update player lock:", error);
  }
}

/**
 * ดึง pool ผู้เล่นตาม point และ site โดยกรองผู้เล่นที่ล็อกหรือใช้โค้ดแล้วจาก API
 */
async function getPlayerPool(point: number, site: string): Promise<string[]> {
  const pools = getPlayerPools();
  const pool = pools[site];
  if (!pool) return pools["thai_jun88k36"]?.all ?? [];

  const applyCodeToday = await loadApplyCodeToday();
  const now = Date.now();
  const siteData = applyCodeToday[site];

  const usedPlayers = new Set(
    siteData?.players?.filter(p => isUsedPlayer(p, now)).map(p => p.player)
  );
  const lockedPlayers = new Set(
    siteData?.playersLock?.filter(l => isLockedPlayer(l, now)).map(l => l.player)
  );

  const filterEligible = (list?: string[]) =>
    (list ?? []).filter(p => !usedPlayers.has(p) && !lockedPlayers.has(p));

  const strictFallback = (...lists: (string[] | undefined)[]): string[] => {
    for (const list of lists) {
      const eligible = filterEligible(list);
      if (eligible.length > 0) return eligible;
    }
    return filterEligible(pool.all);
  };

  if (!Number.isFinite(point) || point < 0) {
    return strictFallback(pool.low, pool.mid);
  } else if (point > 25) {
    return strictFallback(pool.very_high, pool.high);
  } else if (point >= 20) {
    return strictFallback(pool.high, pool.very_high, pool.mid);
  } else if (point >= 15) {
    return strictFallback(pool.mid, pool.low);
  } else if (point >= 12) {
    return strictFallback(pool.low);
  }

  return strictFallback(pool.all);
}

/**
 * ดึงผู้เล่นแบบสุ่ม 1 คน จาก pool
 */
async function getSinglePlayer(point: number, site: string): Promise<string> {
  const eligiblePlayers = await getPlayerPool(point, site);
  if (eligiblePlayers.length > 0) {
    return eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)];
  }
  const fallback = getPlayerPools()[site]?.all ?? [];
  return fallback[Math.floor(Math.random() * fallback.length)];
}

/**
 * โหลดข้อมูลผู้เล่นที่ถูกใช้โค้ดวันนี้ (reset daily)
 */
async function resetDailySentIfNeeded(): Promise<Record<string, AppliedPlayer[]>> {
  const applyCodeToday = await loadApplyCodeToday();
  const now = Date.now();
  const sentPlayers: Record<string, AppliedPlayer[]> = {};
  const playerPools = getPlayerPools();

  console.log("playerPools : ",playerPools);

  for (const site of Object.keys(playerPools)) {
    const siteData = applyCodeToday[site];
    if (siteData && typeof siteData === "object") {
      sentPlayers[site] = (siteData.players ?? []).filter(
        p => now < (p.time_limit ?? p.time + APPLY_CODE_EXPIRE_MS)
      );
    } else {
      sentPlayers[site] = [];
    }
  }
  return sentPlayers;
}

/**
 * เช็คว่า player ใช้โค้ดแล้วหรือยัง
 */
function isPlayerAlreadyUsed(siteData: { players: AppliedPlayer[] }, playerId: string): boolean {
  return siteData.players.some(p => p.player === playerId);
}

export {
  getPlayerPool,
  getSinglePlayer,
  updatePlayersLock,
  updateApplyCodeLog,
  resetDailySentIfNeeded,
  isPlayerAlreadyUsed,
};
