import fs from "fs";
import path from "path";
import { Telegraf, Context, Telegram } from "telegraf";
import { Message, Update } from "telegraf/typings/core/types/typegram";
import dotenv from "dotenv";
import {
updatePollTarget
} from "./services/promoCodeApi";
dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
const bot = new Telegraf(botToken);
const baseUrl = process.env.BASE_URL || "";

const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map(id => id.trim())
  .filter(Boolean)
  .map(id => Number(id));

const ADMIN_ID = (process.env.ADMIN_ID || "")
  .split(",")
  .map(id => id.trim())
  .filter(Boolean)
  .map(id => Number(id));



// เก็บ CAPTCHA ที่รอคำตอบ
const pendingCaptchas = new Map<
  number,
  {
    resolve: (code: string) => void;
    reject: (err: Error) => void;
    timeout: NodeJS.Timeout;
  }
>();


function getForwardMessageId(msg: any): number | null {
  return typeof msg.forward_from_message_id === "number"
    ? msg.forward_from_message_id
    : null;
}

function getForwardFromChat(msg: any): { id: number } | null {
  if (
    msg.forward_from_chat &&
    typeof msg.forward_from_chat.id === "number"
  ) {
    return msg.forward_from_chat;
  }
  return null;
}


// =======================
// 📩 Listener: Forwarded Message
// =======================
bot.on("message", async (ctx) => {
  const msg = ctx.message;
  if (!msg) return;

  const isForwarded =
    "forward_from" in msg ||
    "forward_from_chat" in msg ||
    "forward_sender_name" in msg;

  if (!isForwarded) return;

  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const msgAny = msg as any;

  const fromChat = getForwardFromChat(msgAny);
  const fromMessageId = getForwardMessageId(msgAny);

  let text = `📩 *Forward Message Detected*\n\n`;
  text += `📌 Chat ID: \`${chatId}\`\n`;
  text += `🆔 Message ID: \`${messageId}\`\n`;

  if (fromChat && fromMessageId !== null) {
    text += `\n🔁 *Original Source*\n`;
    text += `📢 From Chat ID: \`${fromChat.id}\`\n`;
    text += `📄 From Message ID: \`${fromMessageId}\`\n`;

    // 🔥 Fire-and-forget (ไม่ await)
    updatePollTarget(fromChat.id.toString(), fromMessageId)
      .then(() => {
        console.log("✅ poll-update", fromChat.id, fromMessageId);
      })
      .catch((err) => {
        console.error("⚠️ poll-update failed (ignored):", err?.message || err);
      });

    text += `\n⏳ Poll target updating...`;
  } else {
    text += `\n⚠️ Forward source unavailable (copy / protected content)`;
  }

  await ctx.telegram.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_parameters: {
      message_id: messageId,
    },
  });
});




// =======================
// 📌 ส่ง CAPTCHA ให้แอดมิน
// =======================
export async function sendCaptchaToTelegram(
  imagePath: string
): Promise<string> {
  const captchaId = path.basename(imagePath, ".png");
  const caption = `🔒 CAPTCHA ID: ${captchaId}\nพิมพ์โค้ดตอบกลับเพื่อยืนยัน`;

  let sentMessageId: number | null = null;

  for (const adminId of ADMIN_IDS) {
    try {
      const sent = await bot.telegram.sendPhoto(
        adminId,
        { source: imagePath },
        { caption }
      );

      if (sentMessageId === null) {
        sentMessageId = sent.message_id;
      }

      console.log(`✅ CAPTCHA sent to ${adminId}`);
    } catch (err) {
      console.error(`❌ Failed to send CAPTCHA to ${adminId}:`, err);
    }
  }

  if (sentMessageId === null) {
    throw new Error("❌ Failed to send CAPTCHA to all admins.");
  }

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingCaptchas.delete(sentMessageId!);
      reject(new Error("⏰ CAPTCHA reply timeout"));
    }, 2 * 60 * 1000);

    pendingCaptchas.set(sentMessageId, { resolve, reject, timeout });
  });
}

// =======================
// 📌 ส่ง Apply Code Data + JSON file ให้แอดมิน
// =======================
export async function sendApplyCodeDataToTelegram() {
  try {
    const baseDir = __dirname;
    const dataDir = path.join(baseDir, "data");
    const applyCodeFile = path.join(dataDir, "apply_code.json");

    if (!fs.existsSync(applyCodeFile)) {
      console.error("❌ apply_code.json not found");
      return;
    }

    const raw = fs.readFileSync(applyCodeFile, "utf8");
    const data = JSON.parse(raw);

    if (!data.apply_code_today) {
      console.error("❌ apply_code_today missing");
      return;
    }

    const todayData = data.apply_code_today;
    const msgLines: string[] = [];

    msgLines.push(`📌 *Apply Code Report*`);
    msgLines.push(`📅 วันที่: *${todayData.date}*`);
    msgLines.push("");

    for (const site of Object.keys(todayData)) {
      if (site === "date") continue;

      msgLines.push(`🏷️ *${site}*`);

      const players = todayData[site].players || [];

      if (players.length === 0) {
        msgLines.push(`— ไม่มีรายการ`);
        msgLines.push("");
        continue;
      }

      players.forEach((p: any, index: number) => {
        msgLines.push(
          `#${index + 1}\n` +
          `👤 Player: *${p.player}*\n` +
          `🎟️ Code: \`${p.promo_code}\`\n` +
          `⭐ Status: *${p.status}*\n` +
          `💎 Point: *${p.point}*\n` +
          `⏱️ เวลา: ${new Date(p.time).toLocaleString("th-TH")}\n` +
          `⏳ หมดเวลา: ${new Date(p.time_limit).toLocaleString("th-TH")}`
        );
        msgLines.push("");
      });
    }

    const finalMessage = msgLines.join("\n");

    const id = String(8253154458).trim();  // <-- แก้ error ตรงนี้

    await bot.telegram.sendMessage(id, finalMessage, {
      parse_mode: "Markdown"
    });

    await bot.telegram.sendDocument(id, {
      source: applyCodeFile,
      filename: "apply_code.json"
    });


    console.log("✅ ส่งรายงาน + ไฟล์ JSON ให้แอดมินแล้ว");
  } catch (error) {
    console.error("❌ Error sendApplyCodeDataToTelegram:", error);
  }
}

// =======================
// 📌 ปุ่มสำหรับผลยิงโค้ด
// =======================
function getInlineButtons(link: string) {
  return {
    inline_keyboard: [
      [
        {
          text: "⭐ สมัครแพ็กเกจ AI ยิงโค้ด",
          url: link,
        },
      ],
      [
        {
          text: "📞 ติดต่อแอดมิน",
          url: "https://t.me/freeceditcode",
        },
      ],
      [
        {
          text: "💬 แจ้งเตือนรับโค้ดฟรี",
          url: "https://t.me/AiCodeFree",
        },
      ]      
    ],
  };
}

// =======================
// 📌 ส่งผลยิงโค้ด
// =======================
export async function sendResultToTelegram(
  message: string,
  usertelegram?: number | null
): Promise<void> {
  const options = {
    parse_mode: "HTML" as const,
    reply_markup: getInlineButtons(`${baseUrl}/package`),
  };

  // ส่งให้ user ก่อน
  // if (typeof usertelegram === "number" && usertelegram > 0) {
  //   try {
  //     await bot.telegram.sendMessage(usertelegram, message, options);
  //   } catch (error) {
  //     console.error(`❌ Failed to send result to user ${usertelegram}:`, error);
  //   }
  // }

  // Broadcast to admins
  for (const adminId of ADMIN_IDS) {
    try {
      await bot.telegram.sendMessage(adminId, message, options);
    } catch (error) {
      console.error(`❌ Failed to send result to admin ${adminId}:`, error);
    }
  }
}

// =======================
// 📌 ส่งสลิปซื้อแพ็กเกจ
// =======================
export async function sendSlipToTelegram(
  packageName: string,
  imagePath: string
): Promise<void> {
  const caption = `📦 มีการสั่งซื้อแพ็กเกจใหม่!\n\nแพ็กเกจ: <b>${packageName}</b>\nเวลา: ${new Date().toLocaleString(
    "th-TH"
  )}`;

  for (const adminId of ADMIN_IDS) {
    try {
      await bot.telegram.sendPhoto(adminId, { source: imagePath }, {
        caption,
        parse_mode: "HTML",
      });
    } catch (error) {
      console.error(`❌ Failed to send slip to ${adminId}:`, error);
    }
  }
}

// =======================
// 🚀 START BOT
// =======================
bot.launch()
  .then(() => console.log("🤖 Bot started"))
  .catch(console.error);

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
