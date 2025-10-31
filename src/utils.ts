import axios from "axios";
import readline from 'readline';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';
import { playerTelegram, rewardUsers, freeUsers} from "./playerTelegram";

const OCR_API_BASE = process.env.OCR_API_BASE || "https://ai-code-api-production-474c.up.railway.app";

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

  let message = "";


  if (site === "thai_789bet") {

    if (rewardUsers.includes(playerId)) {
        message =  `🎯 *ยินดีด้วย! คุณได้รับรางวัล โค้ดสมนาคุณลูกค้าฟรี เครดิตถูกส่งเข้าบัญชีแล้ว*
        👤 *ยูสเซอร์:* ${maskUsername(playerId)}
        🏷️ *เว็บไซต์:* https://shorturl.asia/3Iw6T
        💬 *ข้อความจากระบบ:* ยินดีด้วย! คุณได้รับโปรโมชั่นโค้ดฟรีเครดิตจาก 789BetThailand
        💰 *ยอดฟรีเครดิต:* ${points} บาท
        🔗 *ลิงก์ยูสที่ได้รับโค้ดวันนี้:* ${link}`;
    } else if (freeUsers.includes(playerId)) {
        message =  `🎯 *ยินดีด้วย! คุณได้รับรางวัล ขอทดลองใช้ Ai ยิงโค้ดฟรี เครดิตถูกส่งเข้าบัญชีแล้ว*
        👤 *ยูสเซอร์:* ${maskUsername(playerId)}
        🏷️ *เว็บไซต์:* https://shorturl.asia/3Iw6T
        💬 *ข้อความจากระบบ:* ยินดีด้วย! คุณได้รับโปรโมชั่นโค้ดฟรีเครดิตจาก 789BetThailand
        💰 *ยอดฟรีเครดิต:* ${points} บาท
        🔗 *ลิงก์ยูสที่ได้รับโค้ดวันนี้:* ${link}`;
    } else {
        message =  `🎯 *ยินดีด้วย! คุณได้รับโค้ดฟรีเครดิต เครดิตถูกส่งเข้าบัญชีแล้ว*
        👤 *ยูสเซอร์:* ${maskUsername(playerId)}
        🏷️ *เว็บไซต์:* https://shorturl.asia/3Iw6T
        💬 *ข้อความจากระบบ:* ยินดีด้วย! คุณได้รับโปรโมชั่นโค้ดฟรีเครดิตจาก 789BetThailand
        💰 *ยอดฟรีเครดิต:* ${points} บาท
        🔗 *ลิงก์ยูสที่ได้รับโค้ดวันนี้:* ${link}`;
    }

  } else if (site === "thai_jun88k36") {

    if (rewardUsers.includes(playerId)) {
      message = `🎯 *ยินดีด้วย! คุณได้รับรางวัล โค้ดสมนาคุณลูกค้าฟรี เครดิตถูกส่งเข้าบัญชีแล้ว*
      👤 *ยูสเซอร์:* ${maskUsername(playerId)}
      🏷️ *เว็บไซต์:* http://shorturl.at/UcyVS
      💬 *ข้อความจากระบบ:* ยินดีด้วย! คุณได้รับโปรโมชั่นโค้ดฟรีเครดิตจาก Jun88Thailand
      💰 *ยอดฟรีเครดิต:* ${points} บาท
      🔗 *ลิงก์ยูสที่ได้รับโค้ดวันนี้:* ${link}`;
    } else if (freeUsers.includes(playerId)) {
      message = `🎯 *ยินดีด้วย! คุณได้รับรางวัล ขอทดลองใช้ Ai ยิงโค้ดฟรี เครดิตถูกส่งเข้าบัญชีแล้ว*
      👤 *ยูสเซอร์:* ${maskUsername(playerId)}
      🏷️ *เว็บไซต์:* http://shorturl.at/UcyVS
      💬 *ข้อความจากระบบ:* ยินดีด้วย! คุณได้รับโปรโมชั่นโค้ดฟรีเครดิตจาก Jun88Thailand
      💰 *ยอดฟรีเครดิต:* ${points} บาท
      🔗 *ลิงก์ยูสที่ได้รับโค้ดวันนี้:* ${link}`;
    } else {
      message = `🎯 *ยินดีด้วย! คุณได้รับโค้ดฟรีเครดิต เครดิตถูกส่งเข้าบัญชีแล้ว*
      👤 *ยูสเซอร์:* ${maskUsername(playerId)}
      🏷️ *เว็บไซต์:* http://shorturl.at/UcyVS
      💬 *ข้อความจากระบบ:* ยินดีด้วย! คุณได้รับโปรโมชั่นโค้ดฟรีเครดิตจาก Jun88Thailand
      💰 *ยอดฟรีเครดิต:* ${points} บาท
      🔗 *ลิงก์ยูสที่ได้รับโค้ดวันนี้:* ${link}`;
    }
    
  } else {
    message = `🎯 *ผลการส่งโค้ด*
    👤 *ยูสเซอร์:* ${maskUsername(playerId)}
    🏷️ *เว็บไซต์:* ${site}
    💬 *ข้อความ:* ${messageText}
    💰 *ยอดฟรีเครดิต:* ${points} บาท
    🔗 *ลิงก์:* ${link}`;
  }

  return message;
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