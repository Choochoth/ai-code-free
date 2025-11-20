import axios from "axios";
import readline from 'readline';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';
import { playerTelegram, rewardUsers, freeUsers} from "./playerTelegram";

const OCR_API_BASE = process.env.OCR_API_BASE || "http://localhost:8002";
const BASE_URL = process.env.BASE_URL || "http://localhost:5300";

function escapeMarkdown(text: string): string {
  // Escape เฉพาะ Markdown characters ที่ต้องการจริงๆ
  return text.replace(/([\\_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

function maskUsername(username: string): string {
  if (username.length <= 5) {
    return escapeMarkdown(username); // ถ้าสั้นเกินไป ไม่ต้อง mask
  }

  const start = username.slice(0, 3);
  const end = username.slice(-2);
  const maskedMiddle = '*'.repeat(username.length - 5);

  return escapeMarkdown(start + maskedMiddle + end);
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

export function formatTelegramMessage(data: any): string {
  const playerId = data.player_id || "-";
  const site = data.site || "-";
  const link = data.link || "-";
  const points = typeof data.point === "number" ? data.point.toFixed(2) : "-";
  const messageText = data.message || data.status_mess || "-";

  // โลโก้ (สำหรับ Telegram preview)
  const logoUrl = `${BASE_URL}/images/procodeAi.png`;

  let message = "";



  // -------------------------------
  // thai_789bet
  // -------------------------------
  if (site === "thai_789bet") {
    const siteUrl = "https://shorturl.asia/3Iw6T";
    // เทมเพลสพื้นฐานสำหรับเว็บทั่วไป
    const baseMessage = (siteName: string) => `
      🖼️ <a href="${logoUrl}">​</a>

      🎯 <b>ยินดีด้วย! คุณได้รับเครดิตจากแพ็กเกจยิงโค้ด ระบบยิงโค้ด (AiCodeV2) ได้จัดส่งเครดิตเข้าบัญชีแล้ว</b>
      👤 <b>ยูสเซอร์:</b> ${maskUsername(playerId)}
      🏷️ <b>เว็บไซต์:</b> ${siteName}
      💬 <b>ข้อความจากระบบ:</b> ยินดีด้วย! คุณได้รับโปรโมชั่นโค้ดฟรีเครดิตจาก 789BetThailand
      💰 <b>ยอดฟรีเครดิต:</b> ${points} บาท
      ⭐ <b>สมัครแพ็กเกจ AI ยิงโค้ด:</b> ${link}
    `;

    if (rewardUsers.includes(playerId)) {
      message = `
      🖼️ <a href="${logoUrl}">​</a>

      🎯 <b>ยินดีด้วย! คุณได้รับเครดิตจากแพ็กเกจยิงโค้ด ระบบยิงโค้ด (AiCodeV2) ได้จัดส่งเครดิตเข้าบัญชีแล้ว</b>

      👤 <b>ยูสเซอร์:</b> ${maskUsername(playerId)}
      🏷️ <b>เว็บไซต์:</b> ${siteUrl}
      💬 <b>ข้อความจากระบบ:</b> ยินดีด้วย! คุณได้รับโปรโมชั่นโค้ดฟรีเครดิตจาก 789BetThailand
      💰 <b>ยอดฟรีเครดิต:</b> ${points} บาท
      ⭐ <b>สมัครแพ็กเกจ AI ยิงโค้ด:</b> ${link}
      `;
    } else if (freeUsers.includes(playerId)) {
      message = `
      🖼️ <a href="${logoUrl}">​</a>

      🎯 <b>ยินดีด้วย! คุณได้รับรางวัล ทดลองใช้ AI ยิงโค้ดฟรี</b>

      👤 <b>ยูสเซอร์:</b> ${maskUsername(playerId)}
      🏷️ <b>เว็บไซต์:</b> ${siteUrl}
      💬 <b>ข้อความจากระบบ:</b> ยินดีด้วย! คุณได้รับโปรโมชั่นโค้ดฟรีเครดิตจาก 789BetThailand
      💰 <b>ยอดฟรีเครดิต:</b> ${points} บาท
      ⭐ <b>สมัครแพ็กเกจ AI ยิงโค้ด:</b> ${link}
            `;
    } else {
      message = baseMessage(siteUrl);
    }

  // -------------------------------
  // thai_jun88k36
  // -------------------------------
  } else if (site === "thai_jun88k36") {
    const siteUrl = "http://shorturl.at/UcyVS";
    // เทมเพลสพื้นฐานสำหรับเว็บทั่วไป
    const baseMessage = (siteName: string) => `
      🖼️ <a href="${logoUrl}">​</a>

      🎯 <b>ยินดีด้วย! คุณได้รับเครดิตจากแพ็กเกจยิงโค้ด  ระบบยิงโค้ด (AiCodeV2) ได้จัดส่งเครดิตเข้าบัญชีแล้ว</b>
      👤 <b>ยูสเซอร์:</b> ${maskUsername(playerId)}
      🏷️ <b>เว็บไซต์:</b> ${siteName}
      💬 <b>ข้อความจากระบบ:</b> ยินดีด้วย! คุณได้รับโปรโมชั่นโค้ดฟรีเครดิตจาก Jun88Thailand
      💰 <b>ยอดฟรีเครดิต:</b> ${points} บาท
      ⭐ <b>สมัครแพ็กเกจ AI ยิงโค้ด:</b> ${link}
    `;
    
    if (rewardUsers.includes(playerId)) {
      message = `
      🖼️ <a href="${logoUrl}">​</a>

      🎯 <b>ยินดีด้วย! คุณได้รับรางวัล โค้ดสมนาคุณลูกค้าฟรี  ระบบยิงโค้ด (AiCodeV2) ได้จัดส่งเครดิตเข้าบัญชีแล้ว</b>

      👤 <b>ยูสเซอร์:</b> ${maskUsername(playerId)}
      🏷️ <b>เว็บไซต์:</b> ${siteUrl}
      💬 <b>ข้อความจากระบบ:</b> ยินดีด้วย! คุณได้รับโปรโมชั่นโค้ดฟรีเครดิตจาก Jun88Thailand
      💰 <b>ยอดฟรีเครดิต:</b> ${points} บาท
      ⭐ <b>สมัครแพ็กเกจ AI ยิงโค้ด:</b> ${link}
      `;
    } else if (freeUsers.includes(playerId)) {
      message = `
      🖼️ <a href="${logoUrl}">​</a>

      🎯 <b>ยินดีด้วย! ทดลองใช้ AI ยิงโค้ดฟรี  ระบบยิงโค้ด (AiCodeV2) ได้จัดส่งเครดิตเข้าบัญชีแล้ว</b>

      👤 <b>ยูสเซอร์:</b> ${maskUsername(playerId)}
      🏷️ <b>เว็บไซต์:</b> ${siteUrl}
      💬 <b>ข้อความจากระบบ:</b> ยินดีด้วย! คุณได้รับโปรโมชั่นโค้ดฟรีเครดิตจาก Jun88Thailand
      💰 <b>ยอดฟรีเครดิต:</b> ${points} บาท
      ⭐ <b>สมัครแพ็กเกจ AI ยิงโค้ด:</b> ${link}
      `;
    } else {
      message = baseMessage(siteUrl);
    }

  // -------------------------------
  // OTHER SITES
  // -------------------------------
  } else {
    message = `
🖼️ <a href="${logoUrl}">​</a>

🎯 <b>ผลการส่งโค้ด</b>

👤 <b>ยูสเซอร์:</b> ${maskUsername(playerId)}
🏷️ <b>เว็บไซต์:</b> ${site}
💬 <b>ข้อความ:</b> ${messageText}
💰 <b>ยอดฟรีเครดิต:</b> ${points} บาท
⭐ <b>สมัครแพ็กเกจ AI ยิงโค้ด:</b> ${link}
`;
  }

  return message.trim();
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