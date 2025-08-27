import axios from "axios";
import dayjs from "dayjs";

import { AppliedPlayer, ApplyCodeToday, PlayerPool, PlayerLock, SiteData } from "./types/player";
import { getPlayerPools } from "./services/loadPlayerPools";

const OCR_API_BASE = process.env.OCR_API_BASE || "http://localhost:8000";
const APPLY_CODE_EXPIRE_MS = 24 * 60 * 60 * 1000;

/** Load apply_code_today from API */
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

/** Update apply code log via API */
async function updateApplyCodeLog(site: string, player: string, promoCode: string, point: number) {
  try {
    await axios.post(`${OCR_API_BASE}/api/players-apply-code`, { site, player, promo_code: promoCode, point });
    console.log(`✅ Updated apply code log: site=${site}, player=${player}`);
  } catch (error) {
    console.error("Failed to update apply code log:", error);
  }
}

/** Update player lock via API */
async function updatePlayersLock(site: string, playerId: string, lockMessage: string, lockTime: number, lockCode: number) {
  try {
    const lockMinutes = Math.floor(lockTime / 60000);
    await axios.post(`${OCR_API_BASE}/api/players-lock`, { site, username: playerId, lock_minutes: lockMinutes, lock_message: lockMessage, lock_code: lockCode });
    const hours = Math.floor(lockTime / 3600000);
    const minutes = Math.floor((lockTime % 3600000) / 60000);
    console.log(`✅ Player ${playerId} locked for ${hours}h ${minutes}m (${lockMessage})`);
  } catch (error) {
    console.error("Failed to update player lock:", error);
  }
}

/** Helpers */
function isUsedPlayer(p: AppliedPlayer, now: number): boolean {
  return now < (p.time_limit ?? p.time + APPLY_CODE_EXPIRE_MS);
}

function isLockedPlayer(lock: PlayerLock, now: number): boolean {
  return now < lock.lockTime;
}

/** Get eligible player pool */
async function getPlayerPool(point: number, site: string): Promise<string[]> {
  const pools = getPlayerPools();
  const pool = pools[site];
  if (!pool) return pools["thai_jun88k36"]?.all ?? [];

  const applyCodeToday = await loadApplyCodeToday();
  const now = Date.now();
  const siteData = applyCodeToday[site] as SiteData;

  const usedPlayers = new Set(siteData?.players?.filter(p => isUsedPlayer(p, now)).map(p => p.player));
  const lockedPlayers = new Set(siteData?.playersLock?.filter(l => isLockedPlayer(l, now)).map(l => l.player));

  const filterEligible = (list?: string[]) => (list ?? []).filter(p => !usedPlayers.has(p) && !lockedPlayers.has(p));

  const strictFallback = (...lists: (string[] | undefined)[]): string[] => {
    for (const list of lists) {
      const eligible = filterEligible(list);
      if (eligible.length > 0) return eligible;
    }
    return filterEligible(pool.all);
  };

  if (!Number.isFinite(point) || point < 0) return strictFallback(pool.low, pool.mid);
  if (point > 25) return strictFallback(pool.very_high, pool.high);
  if (point >= 20) return strictFallback(pool.high, pool.very_high, pool.mid);
  if (point >= 15) return strictFallback(pool.mid, pool.low);
  if (point >= 12) return strictFallback(pool.low);

  return strictFallback(pool.all);
}

/** Get single random player from pool */
async function getSinglePlayer(point: number, site: string): Promise<string> {
  const eligiblePlayers = await getPlayerPool(point, site);
  if (eligiblePlayers.length > 0) return eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)];
  const fallback = getPlayerPools()[site]?.all ?? [];
  return fallback[Math.floor(Math.random() * fallback.length)];
}

/** Reset daily used players */
async function resetDailySentIfNeeded(): Promise<Record<string, AppliedPlayer[]>> {
  const applyCodeToday = await loadApplyCodeToday();
  const now = Date.now();
  const sentPlayers: Record<string, AppliedPlayer[]> = {};
  const playerPools = getPlayerPools();

  for (const site of Object.keys(playerPools)) {
    const siteData = applyCodeToday[site] as SiteData;
    sentPlayers[site] = siteData?.players?.filter(p => isUsedPlayer(p, now)) ?? [];
  }
  return sentPlayers;
}

/** Check if player already used */
function isPlayerAlreadyUsed(siteData: SiteData, playerId: string): boolean {
  return siteData.players.some(p => p.player === playerId);
}

export {
  getPlayerPool,
  getSinglePlayer,
  updatePlayersLock,
  updateApplyCodeLog,
  resetDailySentIfNeeded,
  isPlayerAlreadyUsed,
  isUsedPlayer,
  isLockedPlayer,
};
