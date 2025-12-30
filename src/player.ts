import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { AppliedPlayer, ApplyCodeToday, PlayerPool, PlayerLock } from "./types/player";
import { isPlayerBlocked , cleanupExpiredBlocks} from "./playerTracker";

const playerPools: Record<string, PlayerPool> = {
  thai_789bet: {
    very_high: ["manus9331", "nus9331", "aroon11"],
    high:  ["manus9331", "nus9331", "aroon11", "vip0955171905", "poypy789", "qeerty"],
    mid: ["manus9331", "nus9331", "poypy789", "aroon11", "vip0955171905", "qeerty" ],
    low: ["vip0955171905", "poypy789", "borvon", "kootong"],
    all: ["manus9331", "poypy789", "aroon11", "vip0955171905", "nus9331", "qeerty"]
  },
  thai_jun88k36: {
    very_high: ["manus9331", "nus9331", "aroon11", "nuschai", "ary11", "bank0760"],
    high: ["manus9331", "nus9331", "aroon11", "nuschai", "ary11", "bank0760", "junplayer"],
    mid:  ["aroon11", "junplayer"],
    low: ["bank0760", "junplayer"],
    all: ["manus9331", "nus9331", "aroon11", "nuschai", "ary11", "bank0760", "junplayer"]
  }
};




export type Site = keyof typeof playerPools;

const baseDir = __dirname;
const dataDir = path.join(baseDir, "data");
const applyCodeFile = path.join(dataDir, "apply_code.json");

const APPLY_CODE_EXPIRE_MS = 24 * 60 * 60 * 1000;

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(applyCodeFile);
  } catch {
    const initData = {
      apply_code_today: {
        date: "",
        thai_789bet: { players: [], playersLock: [] },
        thai_jun88k36: { players: [], playersLock: [] }
      }
    };
    await fs.writeFile(applyCodeFile, JSON.stringify(initData, null, 2), "utf-8");
  }
}

function getTodayString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

async function loadApplyCodeToday(): Promise<ApplyCodeToday> {
  await ensureDataFile();
  const raw = await fs.readFile(applyCodeFile, "utf-8");
  const data = JSON.parse(raw);
  return data.apply_code_today || {
    date: "",
    thai_789bet: { players: [], playersLock: [] },
    thai_jun88k36: { players: [], playersLock: [] }
  };
}

async function saveApplyCodeToday(applyCodeToday: ApplyCodeToday) {
  const data = { apply_code_today: applyCodeToday };
  await fs.writeFile(applyCodeFile, JSON.stringify(data, null, 2), "utf-8");
}

async function resetIfNeeded() {
  const today = getTodayString();
  const applyCodeToday = await loadApplyCodeToday();
  if (applyCodeToday.date !== today) {
    const newData: ApplyCodeToday = { date: today };
    for (const site of Object.keys(playerPools)) {
      newData[site] = { players: [], playersLock: [] };
    }
    await saveApplyCodeToday(newData);
  }
}

function isPlayerLocked(lock: PlayerLock): boolean {
  return Date.now() - lock.timelock < lock.lockTime;
}

async function getPlayerPool(point: number, site: string): Promise<string[]> {
  await resetIfNeeded();
  cleanupExpiredBlocks();

  const applyCodeToday = await loadApplyCodeToday();

  const pool = playerPools[site];
  const fallbackPool = playerPools["thai_jun88k36"]?.all ?? [];
  if (!pool) return fallbackPool;

  const siteData = applyCodeToday[site];
  const now = Date.now();

  const usedPlayers = new Set<string>();
  const lockedPlayers = new Set<string>();

  if (siteData && typeof siteData === "object") {
    for (const p of siteData.players ?? []) {
      const expireTime = p.time_limit ?? (p.time + APPLY_CODE_EXPIRE_MS);
      if (now < expireTime) usedPlayers.add(p.player);
    }

    const activeLocks = (siteData.playersLock ?? []).filter(isPlayerLocked);
    for (const lock of activeLocks) lockedPlayers.add(lock.player);

    siteData.playersLock = activeLocks;
  }

  const filterEligible = (list?: string[]) =>
    (list ?? []).filter(
      p => !usedPlayers.has(p) && !lockedPlayers.has(p) && !isPlayerBlocked(site, p)
    );

  const strictFallback = (...lists: (string[] | undefined)[]): string[] => {
    for (const list of lists) {
      const eligible = filterEligible(list);
      if (eligible.length > 0) return eligible;
    }
    return filterEligible(pool.all);
  };

  if (!Number.isFinite(point) || point < 0) {
    return strictFallback(pool.low, pool.mid);
  }
  if (point > 25) {
    return strictFallback(pool.very_high, pool.high);
  }
  if (point >= 20) {
    return strictFallback(pool.high, pool.very_high, pool.mid);
  }
  if (point >= 18) {
    return strictFallback(pool.mid, pool.high);
  }
  if (point >= 15) {
    return strictFallback(pool.mid, pool.low);
  }
  if (point >= 12) {
    return strictFallback(pool.low);
  }

  return strictFallback(pool.all);
}


async function getSinglePlayer(point: number, site: string): Promise<string> {
  const eligiblePlayers = await getPlayerPool(point, site);
  // console.log("eligiblePlayers", eligiblePlayers)
  if (eligiblePlayers.length > 0) {
    return eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)];
  }
  
  const fallback = playerPools[site]?.all ?? [];
  // console.log("fallback", fallback)
  return fallback[Math.floor(Math.random() * fallback.length)];
}

async function updatePlayersLock(site: string, playerId: string, lockMessage: string, lockTime: number , lockCode: number) {
  const applyCodeToday = await loadApplyCodeToday();
  const now = Date.now();

  const siteData = applyCodeToday[site];
  if (!siteData || typeof siteData === "string") return;

  const locks = (siteData.playersLock ?? []).filter(lock => lock.player !== playerId);

  locks.push({
    player: playerId,
    timelock: now,
    lockMessage,
    lockTime,
    lockCode
  });

  siteData.playersLock = locks;
  await saveApplyCodeToday(applyCodeToday);

  const hours = Math.floor(lockTime / 3600000);
  const minutes = Math.floor((lockTime % 3600000) / 60000);
  console.log(`✅ Player ${playerId} locked for ${hours}h ${minutes}m (${lockMessage})`);
}

async function updateApplyCodeLog(site: string, player: string, promoCode: string, point: number) {
  await resetIfNeeded();
  const applyCodeToday = await loadApplyCodeToday();

  if (!applyCodeToday[site] || typeof applyCodeToday[site] === "string") {
    applyCodeToday[site] = { players: [], playersLock: [] };
  }

  const now = Date.now();
  const siteData = applyCodeToday[site];
  siteData.players = (siteData.players ?? []).filter(p => now < (p.time_limit ?? p.time + APPLY_CODE_EXPIRE_MS));

  siteData.players.push({
    promo_code: promoCode,
    time: now,
    time_limit: now + APPLY_CODE_EXPIRE_MS,
    status: "success",
    player,
    point
  });

  await saveApplyCodeToday(applyCodeToday);
}

async function resetDailySentIfNeeded(): Promise<Record<string, AppliedPlayer[]>> {
  await resetIfNeeded();
  const applyCodeToday = await loadApplyCodeToday();
  const now = Date.now();
  const sentPlayers: Record<string, AppliedPlayer[]> = {};

  for (const site of Object.keys(playerPools)) {
    const siteData = applyCodeToday[site];
    if (siteData && typeof siteData === "object") {
      siteData.players = (siteData.players ?? []).filter(p => now < (p.time_limit ?? p.time + APPLY_CODE_EXPIRE_MS));
      sentPlayers[site] = siteData.players;
    } else {
      sentPlayers[site] = [];
    }
  }

  await saveApplyCodeToday(applyCodeToday);
  return sentPlayers;
}

function isPlayerAlreadyUsed(siteData: { players: AppliedPlayer[] }, playerId: string): boolean {
  return siteData.players.some(p => p.player === playerId);
}

function clearApplyCodeTemplateForSite(site: Site | null) {
  if (!fsSync.existsSync(dataDir)) fsSync.mkdirSync(dataDir, { recursive: true });

  const today = getTodayString();

  const data: { apply_code_today: ApplyCodeToday } = {
    apply_code_today: {
      date: today,
      thai_789bet: { players: [], playersLock: [] },
      thai_jun88k36: { players: [], playersLock: [] }
    }
  };

  if (site) {
    data.apply_code_today[site] = { players: [], playersLock: [] };
  }

  fsSync.writeFileSync(applyCodeFile, JSON.stringify(data, null, 2), "utf-8");

  const label = site ?? "all sites";
  console.log(`✅ Cleared apply_code.json for ${label}`);
}

export {
  getTodayString,
  getPlayerPool,
  getSinglePlayer,
  updatePlayersLock,
  updateApplyCodeLog,
  resetDailySentIfNeeded,
  isPlayerAlreadyUsed,
  clearApplyCodeTemplateForSite
};
