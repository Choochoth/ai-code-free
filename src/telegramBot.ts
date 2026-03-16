import fs from "fs";
import path from "path";
import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import { updatePollTarget } from "./services/promoCodeApi";

dotenv.config();

/* =======================
   CONFIG
======================= */

const botToken = process.env.TELEGRAM_BOT_TOKEN || "";

if (!botToken) {
  throw new Error("❌ TELEGRAM_BOT_TOKEN missing in .env");
}

const bot = new Telegraf(botToken);

let baseUrl = process.env.BASE_URL || "";

/* กัน localhost ใน production */
if (
  baseUrl.includes("localhost") ||
  baseUrl.includes("127.0.0.1") ||
  baseUrl.trim() === ""
) {
  console.warn("⚠️ BASE_URL invalid, fallback to telegram channel");
  baseUrl = "https://t.me/AiCodeFree";
}

const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)
  .map((id) => Number(id));

/* =======================
   UTILS
======================= */

function escapeHTML(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getForwardMessageId(msg: any): number | null {
  return typeof msg.forward_from_message_id === "number"
    ? msg.forward_from_message_id
    : null;
}

function getForwardFromChat(msg: any): { id: number } | null {
  if (msg.forward_from_chat && typeof msg.forward_from_chat.id === "number") {
    return msg.forward_from_chat;
  }
  return null;
}

/* =======================
   CAPTCHA STORE
======================= */

const pendingCaptchas = new Map<
  number,
  {
    resolve: (code: string) => void;
    reject: (err: Error) => void;
    timeout: NodeJS.Timeout;
  }
>();

/* =======================
   FORWARDED MESSAGE LISTENER
======================= */

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

    updatePollTarget(fromChat.id.toString(), fromMessageId)
      .then(() => {
        console.log("✅ poll-update", fromChat.id, fromMessageId);
      })
      .catch((err) => {
        console.error("⚠️ poll-update failed:", err?.message || err);
      });

    text += `\n⏳ Poll target updating...`;
  } else {
    text += `\n⚠️ Forward source unavailable`;
  }

  await ctx.telegram.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_parameters: {
      message_id: messageId,
    },
  });
});

/* =======================
   SEND CAPTCHA
======================= */

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
      console.error(`❌ CAPTCHA send failed ${adminId}`, err);
    }
  }

  if (sentMessageId === null) {
    throw new Error("❌ Failed to send CAPTCHA");
  }

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingCaptchas.delete(sentMessageId!);
      reject(new Error("⏰ CAPTCHA timeout"));
    }, 2 * 60 * 1000);

    pendingCaptchas.set(sentMessageId, { resolve, reject, timeout });
  });
}

/* =======================
   APPLY CODE REPORT
======================= */

export async function sendApplyCodeDataToTelegram() {
  try {
    const applyCodeFile = path.join(__dirname, "data", "apply_code.json");

    if (!fs.existsSync(applyCodeFile)) {
      console.error("❌ apply_code.json not found");
      return;
    }

    const raw = fs.readFileSync(applyCodeFile, "utf8");
    const data = JSON.parse(raw);

    const todayData = data.apply_code_today;
    if (!todayData) return;

    const msgLines: string[] = [];

    msgLines.push(`📌 *Apply Code Report*`);
    msgLines.push(`📅 วันที่: *${todayData.date}*`);
    msgLines.push("");

    for (const site of Object.keys(todayData)) {
      if (site === "date") continue;

      msgLines.push(`🏷️ *${site}*`);

      const players = todayData[site].players || [];

      if (!players.length) {
        msgLines.push("— ไม่มีรายการ\n");
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
            `⏳ หมดเวลา: ${new Date(p.time_limit).toLocaleString("th-TH")}\n`
        );
      });
    }

    const finalMessage = msgLines.join("\n");

    for (const adminId of ADMIN_IDS) {
      await bot.telegram.sendMessage(adminId, finalMessage, {
        parse_mode: "Markdown",
      });

      await bot.telegram.sendDocument(adminId, {
        source: applyCodeFile,
        filename: "apply_code.json",
      });
    }

    console.log("✅ Apply code report sent");
  } catch (err) {
    console.error("❌ sendApplyCodeData error", err);
  }
}

/* =======================
   INLINE BUTTONS
======================= */

function getInlineButtons(link: string) {
  if (link.includes("localhost")) {
    link = "https://t.me/AiCodeFree";
  }

  return {
    inline_keyboard: [
      [{ text: "⭐ สมัครแพ็กเกจ AI ยิงโค้ด", url: link }],
      [{ text: "📞 ติดต่อแอดมิน", url: "https://t.me/freeceditcode" }],
      [{ text: "💬 แจ้งเตือนรับโค้ดฟรี", url: "https://t.me/AiCodeFree" }],
    ],
  };
}

/* =======================
   SEND RESULT
======================= */

export async function sendResultToTelegram(
  message: string,
  usertelegram?: number | null
) {
  const safeMessage = escapeHTML(message);

  const options = {
    parse_mode: "HTML" as const,
    reply_markup: getInlineButtons(`${baseUrl}/package`),
  };

  if (usertelegram) {
    try {
      await bot.telegram.sendMessage(usertelegram, safeMessage, options);
    } catch (err) {
      console.error("❌ send to user failed", err);
    }
  }

  for (const adminId of ADMIN_IDS) {
    try {
      await bot.telegram.sendMessage(adminId, safeMessage, options);
    } catch (err) {
      console.error("❌ send to admin failed", err);
    }
  }
}

/* =======================
   SEND SLIP
======================= */

export async function sendSlipToTelegram(
  packageName: string,
  imagePath: string
) {
  const caption = `📦 มีการสั่งซื้อแพ็กเกจใหม่!\n\nแพ็กเกจ: <b>${escapeHTML(
    packageName
  )}</b>\nเวลา: ${new Date().toLocaleString("th-TH")}`;

  for (const adminId of ADMIN_IDS) {
    try {
      await bot.telegram.sendPhoto(
        adminId,
        { source: imagePath },
        { caption, parse_mode: "HTML" }
      );
    } catch (err) {
      console.error("❌ send slip failed", err);
    }
  }
}

/* =======================
   START BOT
======================= */

bot.launch()
  .then(() => console.log("🤖 Telegram Bot started"))
  .catch(console.error);

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));