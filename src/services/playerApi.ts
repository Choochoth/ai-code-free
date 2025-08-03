import axios from "axios";
const OCR_API_BASE = process.env.OCR_API_BASE || "http://localhost:8000";

import { PlayerPool } from "../types/player";

export let playerPools: Record<string, PlayerPool> = {};

export async function loadPlayerPools() {
  try {
    const res = await axios.get(`${OCR_API_BASE}/api/playerPools`);
    if (res.status !== 200) throw new Error(`Failed to fetch playerPools: ${res.statusText}`);

    const data = res.data;
    if (!data.players || !Array.isArray(data.players)) {
      throw new Error("Invalid data format from playerPools API");
    }

    const pools: Record<string, PlayerPool> = {};

    for (const siteData of data.players) {
      const siteKey = siteData.site_key || siteData.site;
      pools[siteKey] = {
        very_high: siteData.very_high || [],
        high: siteData.high || [],
        mid: siteData.mid || [],
        low: siteData.low || [],
        all: siteData.all || [],
      };
    }

    playerPools = pools;

    console.log("✅ Loaded playerPools:", playerPools);

  } catch (err: any) {
    console.error("❌ Error loading playerPools:", err.message || err);
    throw err;
  }
}
