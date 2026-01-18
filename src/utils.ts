import axios from "axios";
import readline from 'readline';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';
import { playerTelegram, rewardUsers, freeUsers} from "./playerTelegram";
import { PollTarget } from "./types/siteConfigs";

const OCR_API_BASE = process.env.OCR_API_BASE || "";
const BASE_URL = process.env.BASE_URL || "";

// function escapeMarkdown(text: string): string {
//   // Escape เฉพาะ Markdown characters ที่ต้องการจริงๆ
//   return text.replace(/([\\_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
// }
// -------------------------------
// ESCAPE HTML สำหรับ Telegram HTML Mode
// -------------------------------
function escapeHTML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// -------------------------------
// MASK USERNAME
// -------------------------------
function maskUsername(username: string): string {
  if (username.length <= 5) return escapeHTML(username);

  const start = username.slice(0, 3);
  const end = username.slice(-2);
  const masked = "*".repeat(username.length - 5);

  return escapeHTML(start + masked + end);
}

// -------------------------------
// SITE CONFIG (เพิ่มเว็บใหม่ได้ง่าย)
// -------------------------------
const SITE_CONFIG: Record<string, any> = {
  "thai_789bet": {
    url: "https://shorturl.asia/3Iw6T",
    promo: "789Bet Thailand",
  },
  "thai_jun88k36": {
    url: "http://shorturl.at/UcyVS",
    promo: "Jun88Thailand",
  }
};

// -------------------------------
// MAIN FUNCTION
// -------------------------------
export function formatTelegramMessage(data: any): string {
  const playerId =
  (data.player_id ? String(data.player_id).toLowerCase() : "-");
  const site = data.site || "-";
  const link = data.link || "-";
  const points = typeof data.point === "number" ? data.point.toFixed(2) : "-";
  const messageText = data.message || data.status_mess || "-";
  const logoUrl = `${BASE_URL}/images/procodeAi.png`;

  const siteInfo = SITE_CONFIG[site];

  // -------------------------------
  // กำหนด messageTitle อัตโนมัติ
  // -------------------------------
  let messageTitle = "";

  if (rewardUsers.includes(playerId)) {
    messageTitle = "ยินดีด้วย! คุณได้รับรางวัล โค้ดฟรีสวัสดีปีใหม่ 2026 ได้จัดส่งเครดิตเข้าบัญชีแล้ว";
  } else if (freeUsers.includes(playerId)) {
    messageTitle = "ยินดีด้วย! คุณได้รับรางวัล ทดลองใช้ AI ยิงโค้ดฟรีโปรทดลองใช้ ได้จัดส่งเครดิตเข้าบัญชีแล้ว";
  } else {
    messageTitle = "ยินดีด้วย! คุณได้รับเครดิตจากแพ็กเกจยิงโค้ด V.2026 ได้จัดส่งเครดิตเข้าบัญชีแล้ว";
  }
  // -------------------------------
  // TEMPLATE ใช้ร่วมกันทั้งระบบ
  // -------------------------------
  const template = (
    siteName: string,
    promoText: string
  ) => `
      🖼️ <a href="${logoUrl}">​</a>

      🎯 <b>${messageTitle}</b>
      👤 <b>ยูสเซอร์:</b> ${maskUsername(playerId)}
      🏷️ <b>เว็บไซต์:</b> ${siteName}
      💬 <b>ข้อความจากระบบ:</b> ยินดีด้วย! คุณได้รับโค้ดฟรีเครดิตจาก ${promoText}
      💰 <b>ยอดฟรีเครดิต:</b> ${points} บาท
      ⭐ <b>สมัครแพ็กเกจ AI ยิงโค้ด:</b> ${link}
      `;

  // -------------------------------
  // SITE CONFIG FOUND → ใช้ TEMPLATE
  // -------------------------------
  if (siteInfo) {
    return template(siteInfo.url, siteInfo.promo).trim();
  }

  // -------------------------------
  // OTHER SITE (ไม่อยู่ใน CONFIG)
  // -------------------------------
  return `
🖼️ <a href="${logoUrl}">​</a>

🎯 <b>ผลการส่งโค้ด</b>
👤 <b>ยูสเซอร์:</b> ${maskUsername(playerId)}
🏷️ <b>เว็บไซต์:</b> ${escapeHTML(site)}
💬 <b>ข้อความ:</b> ${escapeHTML(messageText)}
💰 <b>ยอดฟรีเครดิต:</b> ${points} บาท
⭐ <b>สมัครแพ็กเกจ AI ยิงโค้ด:</b> ${link}
`.trim();
}



export async function checkNetworkConnectivity(): Promise<boolean> {
  try {
    const response = await axios.get(`${OCR_API_BASE}`, {
      timeout: 10000, // Timeout after 5 seconds
    });
    // console.log("checkNetworkConnectivity status:", response.status);
    // If the response status is between 200 and 299, consider it a successful connection
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    // An error occurred, indicating network connectivity issues
    return false;
  }
}

export async function getInput(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    process.stdin.once("data", (data) => resolve(data.toString().trim()));
  });
}


export async function promptInput(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function shuffleArray<T>(array: T[]): T[] {
  let shuffledArray = [...array];
  for (let i = shuffledArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]]; // Swap
  }
  return shuffledArray;
}

export async function removeImage(imagePath: string): Promise<void> {
  const resolvedPath = path.resolve(imagePath);
  try {
    await fs.unlink(resolvedPath);
    console.log(`🗑️ Removed image: ${resolvedPath}`);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn(`⚠️ File not found: ${resolvedPath}`);
    } else {
      console.error(`❌ Error deleting image: ${resolvedPath}`, error);
    }
  }
}

export function getTelegramId(user: string) {
  const found = playerTelegram[0].users.find(item =>
    item.users.includes(user)
  );
  return found ? found.TelegramId : null;
}

export function loadPollTargetsFromEnv(): PollTarget[] {
  const raw = process.env.POLL_TARGETS;
  if (!raw) return [];

  try {
    let value = raw.trim();

    // 🧹 ตัด quote ครอบนอก ถ้ามี
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // 🧹 แก้ escape ซ้อน
    value = value.replace(/\\"/g, '"');

    let parsed = JSON.parse(value);

    // 🧯 กรณี parse แล้วได้ string (Railway บางเคส)
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }

    if (!Array.isArray(parsed)) {
      throw new Error("POLL_TARGETS is not an array");
    }

    return parsed.filter(
      (t): t is PollTarget =>
        typeof t?.channelId === "string" &&
        typeof t?.messageId === "number"
    );
  } catch (err) {
    console.error("❌ Invalid POLL_TARGETS in env:", err);
    console.error("❌ RAW POLL_TARGETS =", raw);
    return [];
  }
}


