import axios from "axios";
import { PlayerPool } from "../types/player";

const OCR_API_BASE = process.env.OCR_API_BASE || "http://localhost:8000";

export let playerPools: Record<string, PlayerPool> = {};

/**
 * คืนค่า playerPools ปัจจุบัน
 */
export function getPlayerPools() {
  return playerPools;
}

/**
 * อัปเดต playerPools
 */
function setPlayerPools(pools: Record<string, PlayerPool>) {
  playerPools = pools;
}

/**
 * โหลด player pools จาก API backend และเก็บไว้ในตัวแปร global
 */
export async function loadPlayerPoolsFromApi() {
  try {
    const res = await axios.get(`${OCR_API_BASE}/api/player-pools`);
    const data = res.data;

    const pools: Record<string, PlayerPool> = data;

    // อัปเดต global state
    setPlayerPools(pools);

    console.log("✅ Loaded player pools from API:", pools);
    return pools;
  } catch (error) {
    console.error("❌ Failed to load player pools from API:", error);
    throw error;
  }
}
