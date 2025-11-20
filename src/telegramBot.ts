import { Telegraf, Context, Telegram } from "telegraf";
import { Message, Update } from "telegraf/typings/core/types/typegram";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
const bot = new Telegraf(botToken);
const baseUrl = process.env.BASE_URL || "";

const ADMIN_IDS = (process.env.ADMIN_IDS || "")
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

// =======================
// 📌 Listener Reply CAPTCHA
// =======================
bot.on(
  "text",
  async (ctx: Context<Update.MessageUpdate<Message.TextMessage>>) => {
    const message = ctx.message;
    if (!message.reply_to_message) return;

    const replyToId = message.reply_to_message.message_id;
    const entry = pendingCaptchas.get(replyToId);
    if (!entry) return;

    const code = message.text?.trim();
    if (!code || code.length < 4) return;

    console.log(`🔤 Received CAPTCHA: ${code}`);

    clearTimeout(entry.timeout);
    pendingCaptchas.delete(replyToId);
    entry.resolve(code);
  }
);

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
          text: "🔄 ยิงโค้ดอีกครั้ง",
          callback_data: "retry_code",
        },
      ],
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
    reply_markup: getInlineButtons(`${baseUrl}/packages`),
  };

  // ส่งให้ user ก่อน
  if (typeof usertelegram === "number" && usertelegram > 0) {
    try {
      await bot.telegram.sendMessage(usertelegram, message, options);
    } catch (error) {
      console.error(`❌ Failed to send result to user ${usertelegram}:`, error);
    }
  }

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
